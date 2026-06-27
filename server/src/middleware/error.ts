import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Invalid request',
      details: err.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message })),
    });
    return;
  }
  const e = (typeof err === 'object' && err !== null ? err : {}) as Record<string, unknown>;

  // Mongoose ValidationError / CastError embed the offending VALUE in .message and
  // .errors[path].value. For PHI documents that value is the secret — return and
  // log only the field PATHS, never the values. (Hard rule 5: no PHI in logs.)
  if (e.name === 'ValidationError' && e.errors && typeof e.errors === 'object') {
    res.status(400).json({
      error: 'Invalid request',
      details: Object.keys(e.errors as Record<string, unknown>).map((path) => ({ path, message: 'Invalid value' })),
    });
    return;
  }
  if (e.name === 'CastError') {
    res.status(400).json({ error: 'Invalid request', details: [{ path: typeof e.path === 'string' ? e.path : '', message: 'Invalid value' }] });
    return;
  }
  if (e.code === 11000) {
    res.status(409).json({ error: 'Already exists' });
    return;
  }
  // body-parser attaches an HTTP status to errors like malformed JSON; pass 4xx through
  if (typeof e.status === 'number' && e.status >= 400 && e.status < 500) {
    res.status(e.status).json({ error: 'Invalid request body' });
    return;
  }
  // 500: log a REDACTED summary only — never the raw err (it can serialize a
  // Mongoose document / validation value carrying PHI), never req/body.
  console.error('[error]', { name: e.name, code: e.code, message: typeof e.message === 'string' ? e.message : undefined });
  res.status(500).json({ error: 'Something went wrong' });
}
