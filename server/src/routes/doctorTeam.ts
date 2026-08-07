import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import type { Types } from 'mongoose';
import { z } from 'zod';
import { setStaffViewAsCookie } from '../middleware/auth.js';
import { guardRoutes } from '../middleware/permissions.js';
import { auditAccess, recordAudit } from '../middleware/audit.js';
import { scopeToDoctor } from '../middleware/loadOwnedPatient.js';
import { StaffRole } from '../models/StaffRole.js';
import { StaffMember } from '../models/StaffMember.js';
import { StaffSession } from '../models/StaffSession.js';
import { StaffToken } from '../models/StaffToken.js';
import { ClinicLocation } from '../models/ClinicLocation.js';
import { User } from '../models/User.js';
import {
  DEFAULT_ROLES, MODULES, MODULE_ACTIONS, MODULE_LABELS, PERMISSION_LEVELS, normalisePermissions,
} from '../permissions/catalogue.js';
import { newToken } from '../lib/staffTokens.js';
import { sendStaffInviteEmail, staffActivateLink } from '../lib/staffEmails.js';

/** An invitation link is valid for three days — long enough over a weekend. */
const INVITE_HOURS = 72;

/** Tints for the seeded roles, in catalogue order. Presentation only. */
const ROLE_TINTS = [
  { tint: '#EEF2FF', fg: '#3B4FE0' },
  { tint: '#F5F3FF', fg: '#6D28D9' },
  { tint: '#ECFDF5', fg: '#12A150' },
  { tint: '#EFF6FF', fg: '#2B6FF0' },
  { tint: '#FDF2F8', fg: '#BE185D' },
  { tint: '#FFF7ED', fg: '#C2410C' },
  { tint: '#F0FDFA', fg: '#0E9F9B' },
  { tint: '#FEF3C7', fg: '#B45309' },
];

/**
 * Team & Roles — the practice's sub-user roster and its permission matrix.
 * Doctor-role-gated and tenant-scoped; a doctor only ever sees their own staff.
 *
 * Creating a staff member here INVITES them: the account is created without a
 * password and an activation link is emailed. The recipient sets their own
 * password (routes/staffAuth.ts), which is why no endpoint below ever accepts,
 * returns or logs one.
 *
 * The roles are the shared catalogue (permissions/catalogue.ts) — the same
 * definitions the API enforces — so a role's matrix and an endpoint's check can
 * never drift apart in two places.
 */
const router = Router();
// RBAC: a staff session is narrowed to what its role allows. The doctor who
// owns the practice passes every check — see middleware/permissions.ts.
guardRoutes(router, 'team', [
  { match: '/invite', action: 'invite' },
  { match: '/members/', method: 'DELETE', action: 'deactivate' },
]);

type RoleDoc = Awaited<ReturnType<typeof StaffRole.findOne>>;
type MemberDoc = Awaited<ReturnType<typeof StaffMember.findOne>>;

function roleShape(r: NonNullable<RoleDoc>, memberCount = 0) {
  return {
    id: r._id,
    name: r.name,
    description: r.description ?? null,
    permissions: normalisePermissions(r.permissions as Record<string, unknown>),
    isSystem: r.isSystem,
    tint: r.tint,
    fg: r.fg,
    memberCount,
  };
}

// Never includes passwordHash.
function memberShape(
  m: NonNullable<MemberDoc>,
  roleName: string,
  locationName: string | null,
  rolePerms?: Record<string, unknown>,
) {
  const overrides = (m.permissions ?? {}) as Record<string, string>;
  return {
    id: m._id,
    name: m.name,
    email: m.email,
    phone: m.phone ?? null,
    roleId: m.roleId,
    roleName,
    locationId: m.locationId ?? null,
    locationName,
    employeeCode: m.employeeCode ?? null,
    joinedOn: m.joinedOn ?? null,
    status: m.status,
    active: m.active,
    lastLoginAt: m.lastLoginAt ?? null,
    lastActiveAt: m.lastActiveAt ?? null,
    createdAt: m.createdAt,
    // What this person can actually reach: the role, with their own exceptions
    // laid over it — the same merge `loadStaffContext` performs on every request.
    permissions: normalisePermissions({ ...rolePerms, ...overrides }),
    /** Which modules were set for this person specifically. */
    overrides,
    customPermissions: Object.keys(overrides).length > 0,
  };
}

/** Seed the catalogue's defaults the first time a practice opens this page. */
async function ensureRoles(req: Parameters<typeof scopeToDoctor>[0]) {
  const count = await StaffRole.countDocuments(scopeToDoctor(req));
  if (count > 0) return;
  // `create`, not `insertMany`: bulk inserts bypass Mongoose's save hooks, a
  // mistake that has already cost this codebase a plaintext-PHI leak.
  await StaffRole.create(
    DEFAULT_ROLES.map((r, i) => ({
      doctorUserId: req.userId,
      name: r.name,
      description: r.description,
      permissions: r.permissions,
      isSystem: true,
      ...ROLE_TINTS[i % ROLE_TINTS.length],
    })),
  );
}

/** memberCount per role — one grouped query rather than N. */
async function countsByRole(req: Parameters<typeof scopeToDoctor>[0]): Promise<Map<string, number>> {
  const rows = await StaffMember.find(scopeToDoctor(req, { active: true })).select('roleId');
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.roleId.toString(), (map.get(r.roleId.toString()) ?? 0) + 1);
  return map;
}

// ── Roles ────────────────────────────────────────────────────────────────────

const roleSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(240).optional().or(z.literal('')),
  permissions: z.record(z.string(), z.enum(PERMISSION_LEVELS)).optional(),
});

// GET /api/doctor/team/roles — the roles + the permission matrix behind them.
router.get('/team/roles', auditAccess('team'), async (req, res) => {
  await ensureRoles(req);
  const [roles, counts] = await Promise.all([
    StaffRole.find(scopeToDoctor(req)).sort({ createdAt: 1 }),
    countsByRole(req),
  ]);
  res.json({
    roles: roles.map((r) => roleShape(r, counts.get(r._id.toString()) ?? 0)),
    modules: MODULES,
    levels: PERMISSION_LEVELS,
  });
});

// POST /api/doctor/team/roles — "Add New Role".
router.post('/team/roles', auditAccess('team'), async (req, res) => {
  const body = roleSchema.parse(req.body);
  const role = await StaffRole.create({
    doctorUserId: req.userId,
    name: body.name,
    description: body.description || undefined,
    permissions: normalisePermissions(body.permissions),
    isSystem: false,
  });
  res.status(201).json({ role: roleShape(role) });
});

// PATCH /api/doctor/team/roles/:id — rename, re-describe, or edit the matrix.
router.patch('/team/roles/:id', auditAccess('team'), async (req, res) => {
  const { id } = req.params;
  const body = roleSchema.partial().parse(req.body);
  const role = isValidObjectId(id) ? await StaffRole.findOne(scopeToDoctor(req, { _id: id })) : null;
  if (!role) {
    res.status(404).json({ error: 'Role not found' });
    return;
  }
  if (body.name !== undefined) role.name = body.name;
  if (body.description !== undefined) role.description = body.description || undefined;
  if (body.permissions !== undefined) {
    // Merge, so a partial matrix edit cannot silently reset untouched modules.
    role.permissions = normalisePermissions({
      ...(role.permissions as Record<string, unknown>),
      ...body.permissions,
    });
    role.markModified('permissions');
  }
  await role.save();
  const counts = await countsByRole(req);
  res.json({ role: roleShape(role, counts.get(role._id.toString()) ?? 0) });
});

// DELETE /api/doctor/team/roles/:id — only if nobody holds it.
router.delete('/team/roles/:id', auditAccess('team'), async (req, res) => {
  const { id } = req.params;
  const role = isValidObjectId(id) ? await StaffRole.findOne(scopeToDoctor(req, { _id: id })) : null;
  if (!role) {
    res.status(404).json({ error: 'Role not found' });
    return;
  }
  if (role.isSystem) {
    res.status(400).json({ error: 'Built-in roles cannot be deleted — edit their permissions instead' });
    return;
  }
  const holders = await StaffMember.countDocuments(scopeToDoctor(req, { roleId: role._id }));
  if (holders > 0) {
    res.status(400).json({ error: `${holders} team member(s) still hold this role — reassign them first` });
    return;
  }
  await role.deleteOne();
  res.json({ ok: true });
});

// ── Members ──────────────────────────────────────────────────────────────────

const memberSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(24).optional().or(z.literal('')),
  roleId: z.string().min(1),
  locationId: z.string().optional().or(z.literal('')),
  employeeCode: z.string().trim().max(40).optional().or(z.literal('')),
  joinedOn: z.string().trim().max(30).optional().or(z.literal('')),
  /**
   * Per-person exceptions to the role. Only the modules that differ are kept —
   * an empty object means "follow the role exactly", which is also how the
   * "reset to role defaults" button clears them.
   */
  permissions: z.record(z.string(), z.enum(PERMISSION_LEVELS)).optional(),
});

/**
 * A `YYYY-MM-DD` from the form, anchored to IST like every other calendar date
 * in this app. An empty string clears the field rather than storing an
 * Invalid Date.
 */
function parseDay(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00+05:30`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Strip the entries that merely repeat the role, so a later edit to the role
 * still reaches this person. Returns undefined when nothing differs.
 */
function diffFromRole(
  wanted: Record<string, string> | undefined,
  rolePerms: Record<string, unknown> | undefined,
): Record<string, string> | undefined {
  if (!wanted) return undefined;
  const base = normalisePermissions(rolePerms);
  const out: Record<string, string> = {};
  for (const m of MODULES) {
    const w = wanted[m];
    if (w && w !== base[m]) out[m] = w;
  }
  return Object.keys(out).length ? out : undefined;
}

// GET /api/doctor/team/members
router.get('/team/members', auditAccess('team'), async (req, res) => {
  const members = await StaffMember.find(scopeToDoctor(req)).sort({ createdAt: -1 }).limit(300);
  const [roles, locations] = await Promise.all([
    StaffRole.find(scopeToDoctor(req)).select('name permissions'),
    ClinicLocation.find(scopeToDoctor(req)).select('name'),
  ]);
  const byRole = new Map(roles.map((r) => [r._id.toString(), r]));
  const locNames = new Map(locations.map((l) => [l._id.toString(), l.name]));
  res.json({
    members: members.map((m) => {
      const role = byRole.get(m.roleId.toString());
      return memberShape(
        m,
        role?.name ?? 'Unassigned',
        m.locationId ? locNames.get(m.locationId.toString()) ?? null : null,
        role?.permissions as Record<string, unknown> | undefined,
      );
    }),
  });
});

// POST /api/doctor/team/members — the Create Sub-User form.
router.post('/team/members', auditAccess('team'), async (req, res) => {
  const body = memberSchema.parse(req.body);

  // The role must belong to THIS doctor — never trust a roleId from the client.
  const role = isValidObjectId(body.roleId)
    ? await StaffRole.findOne(scopeToDoctor(req, { _id: body.roleId }))
    : null;
  if (!role) {
    res.status(400).json({ error: 'Choose a role from your own practice' });
    return;
  }
  let locationName: string | null = null;
  if (body.locationId) {
    const loc = isValidObjectId(body.locationId)
      ? await ClinicLocation.findOne(scopeToDoctor(req, { _id: body.locationId }))
      : null;
    if (!loc) {
      res.status(400).json({ error: 'Choose a location from your own practice' });
      return;
    }
    locationName = loc.name;
  }

  const member = await StaffMember.create({
    doctorUserId: req.userId,
    roleId: role._id,
    name: body.name,
    email: body.email.toLowerCase(),
    phone: body.phone || undefined,
    locationId: body.locationId || undefined,
    employeeCode: body.employeeCode || undefined,
    joinedOn: parseDay(body.joinedOn),
    // No password is set here and none is accepted. The invitee chooses their
    // own, which is the only way the practice never handles it.
    status: 'invited',
    permissions: diffFromRole(body.permissions, role.permissions as Record<string, unknown>),
  });

  const invite = await issueInvite(member);
  res.status(201).json({
    member: memberShape(member, role.name, locationName, role.permissions as Record<string, unknown>),
    ...invite,
  });
});

/**
 * Create an invitation token and email it.
 *
 * Returns whether the mail could actually go out and, when it could not, the
 * activation link itself — otherwise a clinic without SMTP would create accounts
 * nobody can ever sign into. Same show-once approach as the parent invite flow.
 *
 * Any earlier unused invite is burned first, so only the newest link works.
 */
async function issueInvite(member: NonNullable<MemberDoc>): Promise<{ emailed: boolean; link?: string }> {
  await StaffToken.updateMany(
    { staffId: member._id, purpose: 'invite', usedAt: { $exists: false } },
    { $set: { usedAt: new Date() } },
  );
  const { token, hash } = newToken();
  await StaffToken.create({
    doctorUserId: member.doctorUserId,
    staffId: member._id,
    purpose: 'invite',
    tokenHash: hash,
    expiresAt: new Date(Date.now() + INVITE_HOURS * 60 * 60_000),
  });
  const doctor = await User.findById(member.doctorUserId);
  let emailed: boolean;
  try {
    emailed = await sendStaffInviteEmail({
      to: member.email,
      name: member.name,
      practice: doctor?.name ?? 'your clinic',
      token,
      doctorUserId: String(member.doctorUserId),
      expiresInHours: INVITE_HOURS,
    });
  } catch {
    // The account and its token exist either way; the invite can be resent.
    emailed = false;
  }
  return emailed ? { emailed } : { emailed, link: staffActivateLink(token) };
}

/** POST /api/doctor/team/members/:id/invite — resend (or re-issue) the link. */
router.post('/team/members/:id/invite', auditAccess('team'), async (req, res) => {
  const { id } = req.params;
  const member = isValidObjectId(id) ? await StaffMember.findOne(scopeToDoctor(req, { _id: id })) : null;
  if (!member) {
    res.status(404).json({ error: 'Staff member not found' });
    return;
  }
  if (member.status === 'disabled') {
    res.status(400).json({ error: 'Reactivate this account before inviting them again' });
    return;
  }
  res.json(await issueInvite(member));
});

/**
 * POST /api/doctor/team/members/:id/view-as — see the panel as this person does.
 *
 * The practice owner is the super admin of their own clinic: they can already
 * reach everything a staff member can. This route therefore only ever REMOVES
 * capability — the session's subject stays the doctor, and the staff id narrows
 * it to that role. Nothing is unlocked that the owner did not already have.
 *
 * OWNER ONLY. A staff session is refused outright, because "view as" from inside
 * a role would be an escalation: a receptionist could step into the clinic
 * admin's permissions. Both entering and leaving are audited.
 */
router.post('/team/members/:id/view-as', async (req, res) => {
  if (req.staffId) {
    res.status(403).json({ error: 'Only the practice owner can view the panel as someone else' });
    return;
  }
  const { id } = req.params;
  const member = isValidObjectId(id) ? await StaffMember.findOne(scopeToDoctor(req, { _id: id })) : null;
  if (!member) {
    res.status(404).json({ error: 'Staff member not found' });
    return;
  }
  if (member.status === 'disabled') {
    res.status(400).json({ error: 'This account is deactivated — reactivate it first' });
    return;
  }
  const role = await StaffRole.findOne(scopeToDoctor(req, { _id: member.roleId }));
  await recordAudit(req, {
    action: 'read',
    resourceType: 'staff:view-as:start',
    resourceId: String(member._id),
    outcome: 'allow',
  }).catch(() => undefined);
  setStaffViewAsCookie(res, String(req.userId), String(member._id));
  res.json({
    viewingAs: { id: member._id, name: member.name, roleName: role?.name ?? 'Unknown role' },
  });
});

/**
 * POST /api/doctor/team/members/:id/deactivate — and its reverse.
 *
 * Deactivating REVOKES every live session immediately. That is the whole point:
 * "this person has left" has to mean they lose access now, not when a token
 * happens to expire.
 */
function applyActive(member: NonNullable<MemberDoc>, active: boolean): void {
  // Someone who never activated goes back to 'invited', not 'active' — they
  // still have no password.
  member.status = active ? (member.passwordHash ? 'active' : 'invited') : 'disabled';
}

function revokeSessions(staffId: Types.ObjectId) {
  return StaffSession.updateMany(
    { staffId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date(), revokedReason: 'account deactivated' } },
  );
}

router.post('/team/members/:id/deactivate', auditAccess('team'), async (req, res) => {
  const { id } = req.params;
  const { active } = z.object({ active: z.boolean() }).parse(req.body ?? {});
  const member = isValidObjectId(id) ? await StaffMember.findOne(scopeToDoctor(req, { _id: id })) : null;
  if (!member) {
    res.status(404).json({ error: 'Staff member not found' });
    return;
  }
  applyActive(member, active);
  await member.save();
  if (!active) await revokeSessions(member._id);
  res.json({ status: member.status });
});

/** The permission catalogue itself, so the matrix UI is never a second copy. */
router.get('/team/catalogue', async (_req, res) => {
  res.json({
    modules: MODULES.map((m) => ({
      id: m,
      label: MODULE_LABELS[m],
      actions: Object.entries(MODULE_ACTIONS[m]).map(([action, minLevel]) => ({ action, minLevel })),
    })),
    levels: PERMISSION_LEVELS,
    defaultRoles: DEFAULT_ROLES.map((r) => ({ name: r.name, description: r.description })),
  });
});

const memberPatchSchema = memberSchema.partial().extend({
  active: z.boolean().optional(),
});

// PATCH /api/doctor/team/members/:id — edit / activate / deactivate.
router.patch('/team/members/:id', auditAccess('team'), async (req, res) => {
  const { id } = req.params;
  const body = memberPatchSchema.parse(req.body);
  const member = isValidObjectId(id) ? await StaffMember.findOne(scopeToDoctor(req, { _id: id })) : null;
  if (!member) {
    res.status(404).json({ error: 'Team member not found' });
    return;
  }
  if (body.roleId !== undefined) {
    const role = isValidObjectId(body.roleId)
      ? await StaffRole.findOne(scopeToDoctor(req, { _id: body.roleId }))
      : null;
    if (!role) {
      res.status(400).json({ error: 'Choose a role from your own practice' });
      return;
    }
    member.roleId = role._id;
  }
  if (body.locationId !== undefined) {
    if (!body.locationId) {
      member.locationId = undefined;
    } else {
      const loc = isValidObjectId(body.locationId)
        ? await ClinicLocation.findOne(scopeToDoctor(req, { _id: body.locationId }))
        : null;
      if (!loc) {
        res.status(400).json({ error: 'Choose a location from your own practice' });
        return;
      }
      member.locationId = loc._id;
    }
  }
  if (body.name !== undefined) member.name = body.name;
  if (body.email !== undefined) member.email = body.email.toLowerCase();
  if (body.phone !== undefined) member.phone = body.phone || undefined;
  if (body.employeeCode !== undefined) member.employeeCode = body.employeeCode || undefined;
  if (body.joinedOn !== undefined) member.joinedOn = parseDay(body.joinedOn);

  // The role may have just changed, so the exceptions are diffed against the
  // role this member ends up with, not the one they arrived with.
  const roleNow = await StaffRole.findOne(scopeToDoctor(req, { _id: member.roleId }));
  if (body.permissions !== undefined) {
    member.permissions = diffFromRole(body.permissions, roleNow?.permissions as Record<string, unknown>);
    member.markModified('permissions');
  }
  // `active` is derived from `status` on save, so writing it directly would be
  // silently discarded. Route it through the same lifecycle the dedicated
  // endpoint uses, including revoking live sessions on the way out.
  if (body.active !== undefined) applyActive(member, body.active);
  await member.save();
  if (body.active === false) await revokeSessions(member._id);

  const loc = member.locationId
    ? await ClinicLocation.findOne(scopeToDoctor(req, { _id: member.locationId })).select('name')
    : null;
  res.json({
    member: memberShape(
      member,
      roleNow?.name ?? 'Unassigned',
      loc?.name ?? null,
      roleNow?.permissions as Record<string, unknown> | undefined,
    ),
  });
});

// DELETE /api/doctor/team/members/:id
router.delete('/team/members/:id', auditAccess('team'), async (req, res) => {
  const { id } = req.params;
  const member = isValidObjectId(id) ? await StaffMember.findOne(scopeToDoctor(req, { _id: id })) : null;
  if (!member) {
    res.status(404).json({ error: 'Team member not found' });
    return;
  }
  await member.deleteOne();
  res.json({ ok: true });
});

export default router;
