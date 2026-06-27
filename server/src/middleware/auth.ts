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
