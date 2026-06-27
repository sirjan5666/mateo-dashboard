import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { scopeToDoctor } from './loadOwnedPatient.js';
import { auditActionForMethod } from './audit.js';

// Pure-logic tests. The DB-backed boundary behaviour (loadOwnedPatient 403/404,
// requireConsent fail-closed, audit rows) is covered by the integration suite
// once the mongodb-memory-server harness lands.

describe('scopeToDoctor', () => {
  it('injects the authenticated doctor into the filter', () => {
    const req = { userId: 'doc-1' } as unknown as Request;
    expect(scopeToDoctor(req, { status: 'active' })).toEqual({ status: 'active', doctorUserId: 'doc-1' });
  });

  it('works with no base filter', () => {
    const req = { userId: 'doc-1' } as unknown as Request;
    expect(scopeToDoctor(req)).toEqual({ doctorUserId: 'doc-1' });
  });

  it('cannot be overridden by a client-supplied doctorUserId', () => {
    const req = { userId: 'doc-1' } as unknown as Request;
    // A malicious filter trying to read another doctor's data is overwritten.
    const out = scopeToDoctor(req, { doctorUserId: 'doc-2' } as Record<string, unknown>);
    expect(out.doctorUserId).toBe('doc-1');
  });

  it('fails closed when there is no authenticated user', () => {
    const req = {} as unknown as Request;
    expect(() => scopeToDoctor(req)).toThrow();
  });
});

describe('auditActionForMethod', () => {
  it.each([
    ['GET', 'read'],
    ['POST', 'create'],
    ['PUT', 'update'],
    ['PATCH', 'update'],
    ['DELETE', 'delete'],
    ['get', 'read'],
  ])('%s -> %s', (method, expected) => {
    expect(auditActionForMethod(method)).toBe(expected);
  });
});
