import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import type { Types } from 'mongoose';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { AUTH_COOKIE, requireAuth, setStaffAuthCookie } from '../middleware/auth.js';
import { effectivePermissions, loadStaffContext, sessionPermissions } from '../middleware/permissions.js';
import { StaffMember } from '../models/StaffMember.js';
import { StaffRole } from '../models/StaffRole.js';
import { StaffSession } from '../models/StaffSession.js';
import { StaffLoginEvent } from '../models/StaffLoginEvent.js';
import type { LoginOutcome } from '../models/StaffLoginEvent.js';
import { StaffToken } from '../models/StaffToken.js';
import { User } from '../models/User.js';
import { describeDevice, hashToken, newToken } from '../lib/staffTokens.js';
import { grantedActions } from '../permissions/catalogue.js';
import { sendStaffInviteEmail, sendStaffResetEmail } from '../lib/staffEmails.js';

/**
 * Staff authentication.
 *
 * Separate from /api/auth because staff are not `User` rows — they belong to a
 * practice, not to the parent app. What they share is the cookie: a staff login
 * issues the SAME auth cookie with the doctor as its subject, so the doctor
 * panel works for them without a second session mechanism.
 *
 * Two token lifetimes on purpose:
 *   access  — 30 minutes, stateless JWT cookie
 *   refresh — 30 days, stored hashed in StaffSession and therefore REVOCABLE
 * That is what makes "deactivate this person" mean something today rather than
 * whenever their token happens to expire.
 */
const router = Router();

const REFRESH_COOKIE = 'mateo_staff_refresh';
const REFRESH_DAYS = 30;
const INVITE_HOURS = 72;
const RESET_MINUTES = 60;

/**
 * Login and reset are the endpoints worth guessing at, so they are the ones
 * rate-limited. Keyed by IP: a clinic behind one NAT shares the budget, which is
 * why it is generous rather than tight.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

function setRefreshCookie(res: import('express').Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: REFRESH_DAYS * 24 * 60 * 60 * 1000,
    // Scoped to the refresh endpoints, so the long-lived credential is not sent
    // with every ordinary API call.
    path: '/api/staff/auth',
  });
}

async function logLogin(
  req: import('express').Request,
  email: string,
  outcome: LoginOutcome,
  ids?: { doctorUserId?: Types.ObjectId; staffId?: Types.ObjectId },
): Promise<void> {
  await StaffLoginEvent.create({
    email,
    outcome,
    doctorUserId: ids?.doctorUserId,
    staffId: ids?.staffId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  }).catch(() => undefined);
}

/** Everything the client needs to render the panel for this session. */
async function sessionPayload(staffId: string) {
  const staff = await StaffMember.findById(staffId);
  if (!staff) return null;
  const role = await StaffRole.findById(staff.roleId);
  const doctor = await User.findById(staff.doctorUserId);
  return {
    staff: {
      id: staff._id,
      name: staff.name,
      email: staff.email,
      phone: staff.phone ?? null,
      employeeCode: staff.employeeCode ?? null,
      locationId: staff.locationId ?? null,
      status: staff.status,
      lastLoginAt: staff.lastLoginAt ?? null,
      mustChangePassword: !!staff.mustChangePassword,
    },
    role: role ? { id: role._id, name: role.name, description: role.description ?? null } : null,
    practice: { doctorUserId: staff.doctorUserId, doctorName: doctor?.name ?? 'Your clinic' },
    // The role AND this person's own exceptions — the same merge the guard
    // performs, so the UI hides exactly what the API would refuse.
    permissions: grantedActions(effectivePermissions(staff.permissions, role?.permissions)),
  };
}

// ── login ────────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  password: z.string().min(1).max(200),
});

/**
 * POST /api/staff/auth/login
 *
 * Every failure returns the SAME message and the same shape. Whether an email
 * exists in a practice is not something an unauthenticated caller gets to learn.
 * The real reason goes to StaffLoginEvent, where the clinic can see it.
 */
router.post('/login', authLimiter, async (req, res) => {
  const body = loginSchema.parse(req.body);
  const deny = () => res.status(401).json({ error: 'Email or password is incorrect' });

  const staff = await StaffMember.findOne({ email: body.email });
  if (!staff) {
    await logLogin(req, body.email, 'unknown_email');
    deny();
    return;
  }
  if (staff.status === 'disabled') {
    await logLogin(req, body.email, 'disabled', { doctorUserId: staff.doctorUserId, staffId: staff._id });
    res.status(403).json({ error: 'This account has been deactivated. Ask your clinic administrator.' });
    return;
  }
  if (staff.status === 'invited' || !staff.passwordHash) {
    await logLogin(req, body.email, 'not_activated', { doctorUserId: staff.doctorUserId, staffId: staff._id });
    res.status(403).json({ error: 'This account has not been activated yet — use the link in your invitation email.' });
    return;
  }
  if (!(await bcrypt.compare(body.password, staff.passwordHash))) {
    await logLogin(req, body.email, 'bad_password', { doctorUserId: staff.doctorUserId, staffId: staff._id });
    deny();
    return;
  }

  const { token, hash } = newToken();
  await StaffSession.create({
    doctorUserId: staff.doctorUserId,
    staffId: staff._id,
    tokenHash: hash,
    device: describeDevice(req.get('user-agent')),
    ip: req.ip,
    userAgent: req.get('user-agent'),
    expiresAt: new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000),
  });

  staff.lastLoginAt = new Date();
  staff.lastActiveAt = new Date();
  await staff.save();
  await logLogin(req, body.email, 'success', { doctorUserId: staff.doctorUserId, staffId: staff._id });

  setStaffAuthCookie(res, String(staff.doctorUserId), String(staff._id));
  setRefreshCookie(res, token);
  res.json(await sessionPayload(String(staff._id)));
});

// ── refresh ──────────────────────────────────────────────────────────────────

/**
 * POST /api/staff/auth/refresh — trade the refresh token for a new access cookie.
 *
 * The account is re-checked here, not just the token: a member disabled five
 * minutes ago stops being able to refresh immediately.
 */
router.post('/refresh', async (req, res) => {
  const cookies = req.cookies as Record<string, string | undefined>;
  const raw = cookies[REFRESH_COOKIE];
  if (!raw) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const session = await StaffSession.findOne({ tokenHash: hashToken(raw) });
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    res.status(401).json({ error: 'Session expired, please sign in again' });
    return;
  }
  const staff = await StaffMember.findById(session.staffId);
  if (!staff || staff.status !== 'active') {
    session.revokedAt = new Date();
    session.revokedReason = 'account inactive';
    await session.save();
    res.status(401).json({ error: 'This staff account is no longer active' });
    return;
  }
  session.lastUsedAt = new Date();
  await session.save();
  staff.lastActiveAt = new Date();
  await staff.save();

  setStaffAuthCookie(res, String(staff.doctorUserId), String(staff._id));
  res.json(await sessionPayload(String(staff._id)));
});

// ── logout ───────────────────────────────────────────────────────────────────

router.post('/logout', async (req, res) => {
  const cookies = req.cookies as Record<string, string | undefined>;
  const raw = cookies[REFRESH_COOKIE];
  if (raw) {
    await StaffSession.updateOne(
      { tokenHash: hashToken(raw), revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date(), revokedReason: 'signed out' } },
    );
  }
  res.clearCookie(AUTH_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/api/staff/auth' });
  res.json({ ok: true });
});

// ── invitation / activation ──────────────────────────────────────────────────

const activateSchema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(8).max(200),
});

/**
 * GET /api/staff/auth/invite/:token — what this link is for, before asking for a
 * password. Unauthenticated by necessity; it reveals only the name and clinic
 * the invite was issued to, which the recipient already knows.
 */
router.get('/invite/:token', async (req, res) => {
  const record = await StaffToken.findOne({ tokenHash: hashToken(req.params.token), purpose: 'invite' });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    res.status(410).json({ error: 'This invitation link has expired or has already been used.' });
    return;
  }
  const staff = await StaffMember.findById(record.staffId);
  const doctor = staff ? await User.findById(staff.doctorUserId) : null;
  if (!staff) {
    res.status(410).json({ error: 'This invitation is no longer valid.' });
    return;
  }
  res.json({ name: staff.name, email: staff.email, practice: doctor?.name ?? 'the clinic' });
});

/** POST /api/staff/auth/activate — redeem an invite by setting a password. */
router.post('/activate', authLimiter, async (req, res) => {
  const body = activateSchema.parse(req.body);
  const record = await StaffToken.findOne({ tokenHash: hashToken(body.token), purpose: 'invite' });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    res.status(410).json({ error: 'This invitation link has expired or has already been used.' });
    return;
  }
  const staff = await StaffMember.findById(record.staffId);
  if (!staff || staff.status === 'disabled') {
    res.status(410).json({ error: 'This invitation is no longer valid.' });
    return;
  }
  staff.passwordHash = await bcrypt.hash(body.password, 12);
  staff.status = 'active';
  staff.mustChangePassword = false;
  await staff.save();
  record.usedAt = new Date();
  await record.save();
  res.json({ ok: true, email: staff.email });
});

// ── forgot / reset password ──────────────────────────────────────────────────

/**
 * POST /api/staff/auth/forgot — always 200.
 *
 * A different answer for a known and an unknown address turns this endpoint into
 * a way to enumerate a clinic's staff, so it does not give one.
 */
router.post('/forgot', authLimiter, async (req, res) => {
  const { email } = z.object({ email: z.string().trim().toLowerCase().email().max(160) }).parse(req.body);
  const staff = await StaffMember.findOne({ email, status: { $ne: 'disabled' } });
  if (staff) {
    const { token, hash } = newToken();
    await StaffToken.create({
      doctorUserId: staff.doctorUserId,
      staffId: staff._id,
      purpose: 'reset',
      tokenHash: hash,
      expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000),
    });
    const doctor = await User.findById(staff.doctorUserId);
    await sendStaffResetEmail({
      to: staff.email,
      name: staff.name,
      practice: doctor?.name ?? 'your clinic',
      token,
      doctorUserId: String(staff.doctorUserId),
      expiresInMinutes: RESET_MINUTES,
    }).catch(() => undefined);
  }
  res.json({ ok: true });
});

router.post('/reset', authLimiter, async (req, res) => {
  const body = activateSchema.parse(req.body);
  const record = await StaffToken.findOne({ tokenHash: hashToken(body.token), purpose: 'reset' });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    res.status(410).json({ error: 'This reset link has expired or has already been used.' });
    return;
  }
  const staff = await StaffMember.findById(record.staffId);
  if (!staff || staff.status === 'disabled') {
    res.status(410).json({ error: 'This reset link is no longer valid.' });
    return;
  }
  staff.passwordHash = await bcrypt.hash(body.password, 12);
  staff.status = 'active';
  staff.mustChangePassword = false;
  await staff.save();
  record.usedAt = new Date();
  await record.save();

  // Changing a password signs every other device out — the whole point of a
  // reset is that a session someone else holds should stop working.
  await StaffSession.updateMany(
    { staffId: staff._id, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date(), revokedReason: 'password reset' } },
  );
  res.json({ ok: true, email: staff.email });
});

// ── the signed-in staff member's own session ────────────────────────────────

router.get('/me', requireAuth, loadStaffContext, async (req, res) => {
  if (!req.staffId) {
    // A doctor hitting this endpoint is not an error; they simply own everything.
    res.json({ staff: null, ...sessionPermissions(req) });
    return;
  }
  const payload = await sessionPayload(req.staffId);
  if (!payload) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.json(payload);
});

/** The devices this staff member is signed in on, newest first. */
router.get('/sessions', requireAuth, loadStaffContext, async (req, res) => {
  if (!req.staffId) {
    res.json({ sessions: [] });
    return;
  }
  const sessions = await StaffSession.find({ staffId: req.staffId }).sort({ lastUsedAt: -1 }).limit(50);
  res.json({
    sessions: sessions.map((s) => ({
      id: s._id,
      device: s.device ?? 'Unknown device',
      ip: s.ip ?? null,
      lastUsedAt: s.lastUsedAt,
      expiresAt: s.expiresAt,
      revokedAt: s.revokedAt ?? null,
    })),
  });
});

/** Sign out one device, or everything. */
router.post('/sessions/revoke', requireAuth, loadStaffContext, async (req, res) => {
  const { sessionId, all } = z
    .object({ sessionId: z.string().optional(), all: z.boolean().optional() })
    .parse(req.body ?? {});
  if (!req.staffId) {
    res.status(400).json({ error: 'Only staff sessions can be revoked here' });
    return;
  }
  const filter: Record<string, unknown> = { staffId: req.staffId, revokedAt: { $exists: false } };
  if (!all) {
    if (!sessionId || !isValidObjectId(sessionId)) {
      res.status(400).json({ error: 'Choose a device to sign out' });
      return;
    }
    filter._id = sessionId;
  }
  const r = await StaffSession.updateMany(filter, {
    $set: { revokedAt: new Date(), revokedReason: all ? 'signed out everywhere' : 'signed out' },
  });
  res.json({ revoked: r.modifiedCount });
});

/** Change your own password while signed in. */
router.post('/password', requireAuth, loadStaffContext, async (req, res) => {
  const body = z
    .object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(8).max(200) })
    .parse(req.body);
  if (!req.staffId) {
    res.status(400).json({ error: 'Doctors change their password in account settings' });
    return;
  }
  const staff = await StaffMember.findById(req.staffId);
  if (!staff?.passwordHash || !(await bcrypt.compare(body.currentPassword, staff.passwordHash))) {
    res.status(400).json({ error: 'Your current password is incorrect' });
    return;
  }
  staff.passwordHash = await bcrypt.hash(body.newPassword, 12);
  staff.mustChangePassword = false;
  await staff.save();
  res.json({ ok: true });
});

export { INVITE_HOURS, sendStaffInviteEmail };
export default router;
