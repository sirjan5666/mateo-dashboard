import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { User } from '../models/User.js';
import type { IUser } from '../models/User.js';
import { AUTH_COOKIE, requireAuth, setAuthCookie } from '../middleware/auth.js';
import { loginRateLimiter } from '../middleware/security.js';

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

function publicUser(user: IUser & { id: string }, impersonating = false) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    consentAcceptedAt: user.consentAcceptedAt,
    createdAt: user.createdAt,
    impersonating,
  };
}

const router = Router();

// Public signup is disabled — Mateo (admin) creates parent and doctor accounts
// and shares the credentials. Kept as a route so clients get a clear message.
router.post('/signup', loginRateLimiter, (_req, res) => {
  res.status(403).json({ error: 'Accounts are created by Mateo. Please contact us to get access.' });
});

router.post('/login', loginRateLimiter, async (req, res) => {
  const body = loginSchema.parse(req.body);
  const user = await User.findOne({ email: body.email });
  const valid = user !== null && (await bcrypt.compare(body.password, user.passwordHash));
  if (!user || !valid) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  setAuthCookie(res, user.id);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.json({ user: publicUser(user, !!req.impersonatorId) });
});

// End an admin impersonation session — re-issue the admin's own session.
router.post('/stop-impersonating', requireAuth, async (req, res) => {
  if (!req.impersonatorId) {
    res.status(400).json({ error: 'Not impersonating' });
    return;
  }
  const admin = await User.findById(req.impersonatorId);
  if (!admin || admin.role !== 'admin') {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  setAuthCookie(res, admin.id);
  res.json({ user: publicUser(admin) });
});

export default router;
