import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { auditAccess } from '../middleware/audit.js';
import { scopeToDoctor } from '../middleware/loadOwnedPatient.js';
import { StaffRole, STAFF_MODULES, PERMISSION_LEVELS } from '../models/StaffRole.js';
import type { PermissionLevel } from '../models/StaffRole.js';
import { StaffMember } from '../models/StaffMember.js';
import { ClinicLocation } from '../models/ClinicLocation.js';

/**
 * Team & Roles — the practice's sub-user roster and its permission matrix.
 * Doctor-role-gated and tenant-scoped; a doctor only ever sees their own staff.
 *
 * ⚠ Creating a staff member here does NOT create a login. See StaffMember's
 * header: an actual staff sign-in needs a new role in USER_ROLES plus permission
 * enforcement on every doctor route, which is a separate security-reviewed
 * change. The password is hashed and stored so that switch-on is a small step,
 * and it is NEVER returned by any endpoint below.
 */
const router = Router();
router.use(requireAuth, requireRole('doctor'));

// The five roles every practice starts with. Seeded on first read so the matrix
// is never empty, and marked isSystem so they cannot be deleted out from under
// the staff already assigned to them.
const DEFAULT_ROLES: {
  name: string;
  description: string;
  tint: string;
  fg: string;
  permissions: Record<string, PermissionLevel>;
}[] = [
  {
    name: 'Reception',
    description: 'Front desk — books appointments and registers patients.',
    tint: '#EEF2FF', fg: '#3B4FE0',
    permissions: { dashboard: 'view', appointments: 'full', patients: 'edit', billing: 'view', reports: 'none', prescriptions: 'none', pharmacy: 'none', locations: 'view', team: 'none', settings: 'none', logs: 'none' },
  },
  {
    name: 'OPD',
    description: 'Clinical assistant — vitals, growth and visit notes.',
    tint: '#ECFDF5', fg: '#12A150',
    permissions: { dashboard: 'view', appointments: 'edit', patients: 'edit', prescriptions: 'view', billing: 'none', pharmacy: 'none', reports: 'view', locations: 'view', team: 'none', settings: 'none', logs: 'none' },
  },
  {
    name: 'Accounts',
    description: 'Billing, invoices and collections.',
    tint: '#FEF3C7', fg: '#B45309',
    permissions: { dashboard: 'view', appointments: 'view', patients: 'view', prescriptions: 'none', billing: 'full', pharmacy: 'view', reports: 'full', locations: 'view', team: 'none', settings: 'none', logs: 'view' },
  },
  {
    name: 'HR',
    description: 'Staff records, attendance and payroll.',
    tint: '#FCE7F3', fg: '#BE185D',
    permissions: { dashboard: 'view', appointments: 'none', patients: 'none', prescriptions: 'none', billing: 'none', pharmacy: 'none', reports: 'view', locations: 'view', team: 'full', settings: 'view', logs: 'view' },
  },
  {
    name: 'Pharmacy',
    description: 'Stock, purchases and counter billing.',
    tint: '#FFF7ED', fg: '#C2410C',
    permissions: { dashboard: 'view', appointments: 'none', patients: 'view', prescriptions: 'view', billing: 'view', pharmacy: 'full', reports: 'view', locations: 'view', team: 'none', settings: 'none', logs: 'none' },
  },
];

/** Fill every known module so the client never has to guess a missing key. */
function normalisePermissions(raw: Record<string, unknown> | undefined): Record<string, PermissionLevel> {
  const out: Record<string, PermissionLevel> = {};
  for (const m of STAFF_MODULES) {
    const v = raw?.[m];
    out[m] = (PERMISSION_LEVELS as readonly string[]).includes(v as string) ? (v as PermissionLevel) : 'none';
  }
  return out;
}

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
function memberShape(m: NonNullable<MemberDoc>, roleName: string, locationName: string | null) {
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
    active: m.active,
    lastActiveAt: m.lastActiveAt ?? null,
    createdAt: m.createdAt,
  };
}

/** Seed the five defaults the first time a practice opens this page. */
async function ensureRoles(req: Parameters<typeof scopeToDoctor>[0]) {
  const count = await StaffRole.countDocuments(scopeToDoctor(req));
  if (count > 0) return;
  await StaffRole.insertMany(
    DEFAULT_ROLES.map((r) => ({ ...r, doctorUserId: req.userId, isSystem: true })),
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
    modules: STAFF_MODULES,
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
  password: z.string().min(8).max(200),
});

// GET /api/doctor/team/members
router.get('/team/members', auditAccess('team'), async (req, res) => {
  const members = await StaffMember.find(scopeToDoctor(req)).sort({ createdAt: -1 }).limit(300);
  const [roles, locations] = await Promise.all([
    StaffRole.find(scopeToDoctor(req)).select('name'),
    ClinicLocation.find(scopeToDoctor(req)).select('name'),
  ]);
  const roleNames = new Map(roles.map((r) => [r._id.toString(), r.name]));
  const locNames = new Map(locations.map((l) => [l._id.toString(), l.name]));
  res.json({
    members: members.map((m) =>
      memberShape(
        m,
        roleNames.get(m.roleId.toString()) ?? 'Unassigned',
        m.locationId ? locNames.get(m.locationId.toString()) ?? null : null,
      ),
    ),
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
    passwordHash: await bcrypt.hash(body.password, 12),
    active: true,
  });
  res.status(201).json({ member: memberShape(member, role.name, locationName) });
});

const memberPatchSchema = memberSchema.partial().omit({ password: true }).extend({
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
  if (body.active !== undefined) member.active = body.active;
  await member.save();

  const [role, loc] = await Promise.all([
    StaffRole.findOne(scopeToDoctor(req, { _id: member.roleId })).select('name'),
    member.locationId
      ? ClinicLocation.findOne(scopeToDoctor(req, { _id: member.locationId })).select('name')
      : Promise.resolve(null),
  ]);
  res.json({ member: memberShape(member, role?.name ?? 'Unassigned', loc?.name ?? null) });
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
