import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

// Brute-force protection for credential endpoints. Tight in production; generous in
// dev/test so local testing and the preview are never blocked. Keyed by client IP
// (relies on `trust proxy` being set in app.ts so the real IP is used behind a
// reverse proxy / the Vite dev proxy). Applied ONLY to /login + /signup — never to
// /me, which the SPA calls on every page load.
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'production' ? 10 : 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});
