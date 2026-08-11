import type { NextFunction, Request, Response } from 'express';
import type { HydratedDocument } from 'mongoose';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import type { IUser, UserRole } from '../models/User.js';

export const AUTH_COOKIE = 'mateo_token';
const SESSION_DAYS = 7;

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
    userRole?: UserRole;
    authUser?: HydratedDocument<IUser>;
    // When an admin is impersonating another user, the cookie's session is the
    // target user (userId) but carries the admin's id here (the JWT `act` claim).
    impersonatorId?: string;
    /**
     * True when the practice OWNER is viewing the panel as one of their own
     * staff (the JWT `imp` claim). A real staff login never carries it, which is
     * what stops a staff member from using the exit route to become the doctor.
     */
    viewAs?: boolean;
  }
}

// Issue the auth cookie for `userId`. When `actorId` is set, this is an admin
// impersonation session: it acts as `userId` but records the admin in `act`.
export function setAuthCookie(res: Response, userId: string, actorId?: string): void {
  const token = jwt.sign(actorId ? { act: actorId } : {}, env.JWT_SECRET, {
    subject: userId,
    expiresIn: `${SESSION_DAYS}d`,
  });
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

/**
 * Issue the auth cookie for a STAFF session.
 *
 * The subject is the DOCTOR, not the staff member. That is deliberate and is
 * what lets staff use the doctor panel without touching a single tenant-scoped
 * query: `req.userId` stays the practice owner everywhere. The staff id rides
 * along in `stf`, and middleware/permissions.ts narrows the session from there.
 *
 * Short-lived on purpose — the refresh token (StaffSession) is the revocable
 * half, so a deactivated account loses access in minutes, not days.
 */
export const STAFF_ACCESS_MINUTES = 30;

export function setStaffAuthCookie(res: Response, doctorUserId: string, staffId: string): void {
  const token = jwt.sign({ stf: staffId }, env.JWT_SECRET, {
    subject: doctorUserId,
    expiresIn: `${STAFF_ACCESS_MINUTES}m`,
  });
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: STAFF_ACCESS_MINUTES * 60 * 1000,
    path: '/',
  });
}

/**
 * Issue a "view as" cookie: the practice owner, seeing the panel as one of their
 * own staff members.
 *
 * This is the one impersonation that can only ever REMOVE capability. The
 * subject stays the doctor — the same subject their own session already carries —
 * so nothing is unlocked that the owner could not already reach; the `stf` claim
 * narrows them to that role's permissions. `imp` marks the session as
 * owner-initiated, and only a session carrying it may drop back to the owner.
 *
 * Full session length, not the 30 minutes a real staff login gets: the identity
 * underneath is the doctor's own, and expiring it early would sign the doctor
 * out of their own practice mid-task.
 */
export function setStaffViewAsCookie(res: Response, doctorUserId: string, staffId: string): void {
  const token = jwt.sign({ stf: staffId, imp: true }, env.JWT_SECRET, {
    subject: doctorUserId,
    expiresIn: `${SESSION_DAYS}d`,
  });
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const cookies = req.cookies as Record<string, string | undefined>;
  const token = cookies[AUTH_COOKIE];
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      res.status(401).json({ error: 'Invalid session' });
      return;
    }
    req.userId = payload.sub;
    if (typeof payload.act === 'string') req.impersonatorId = payload.act;
    // A staff session: the subject is the practice owner, so everything scoped by
    // req.userId keeps working; loadStaffContext then attaches the permissions.
    if (typeof payload.stf === 'string') req.staffId = payload.stf;
    // Owner-initiated "view as". Only meaningful alongside `stf`.
    if (payload.imp === true && req.staffId) req.viewAs = true;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, please log in again' });
  }
}

/**
 * Gate a route to specific roles. Runs AFTER requireAuth. Loads the user from
 * the DB (so a role change takes effect immediately, never trusting a stale
 * token) and attaches it to req.authUser for the handler to reuse.
 */
export function requireRole(...roles: UserRole[]) {
  return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (!roles.includes(user.role)) {
      res.status(403).json({ error: 'You do not have access to this area' });
      return;
    }
    req.authUser = user;
    req.userRole = user.role;
    next();
  };
}
