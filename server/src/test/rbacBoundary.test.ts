import 'dotenv/config';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * RBAC enforcement, against a real database.
 *
 * The pure catalogue is tested separately; this file asserts the part that can
 * actually be got wrong at runtime — that a staff session is resolved from the
 * DB on every request, that a role change or a deactivation bites immediately,
 * and that the practice owner is never locked out of their own data.
 *
 * Skips gracefully with no mongod, exactly like ehrBoundary.test.ts.
 */
const TEST_URI = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mateo').replace(
  /\/[^/?]+(\?|$)/,
  '/mateo_rbac_test$1',
);

let dbOk = false;
try {
  await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 2000 });
  dbOk = true;
} catch {
  dbOk = false;
}

process.env.DATA_ENCRYPTION_KEY ||= randomBytes(32).toString('base64');

const { StaffMember } = await import('../models/StaffMember.js');
const { StaffRole } = await import('../models/StaffRole.js');
const { loadStaffContext, guardModule, guardRoutes, sessionPermissions } = await import('../middleware/permissions.js');
const { DEFAULT_ROLES } = await import('../permissions/catalogue.js');

const oid = () => new mongoose.Types.ObjectId();

/** Minimal Express doubles — enough for middleware, nothing more. */
function fakeReq(over: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    path: '/patients',
    params: {},
    query: {},
    body: {},
    get: () => undefined,
    ip: '127.0.0.1',
    ...over,
  } as unknown as Request;
}
function fakeRes(): Response & { statusCode?: number; payload?: unknown } {
  const res = {
    statusCode: undefined as number | undefined,
    payload: undefined as unknown,
    status(code: number) { res.statusCode = code; return res; },
    json(body: unknown) { res.payload = body; return res; },
  };
  return res as unknown as Response & { statusCode?: number; payload?: unknown };
}
/** Runs middleware and reports whether it called next() or answered itself. */
async function run(mw: (q: Request, s: Response, n: NextFunction) => unknown, req: Request) {
  const res = fakeRes();
  let passed = false;
  await mw(req, res, () => { passed = true; });
  return { passed, status: res.statusCode, payload: res.payload as { error?: string; required?: string } };
}

const d = dbOk ? describe : describe.skip;

d('RBAC enforcement (DB-backed)', () => {
  let doctor: mongoose.Types.ObjectId;
  let receptionistRole: mongoose.Types.ObjectId;
  let staffId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    await Promise.all([StaffMember.deleteMany({}), StaffRole.deleteMany({})]);
    doctor = oid();
    const role = await StaffRole.create({
      doctorUserId: doctor,
      name: 'Receptionist',
      permissions: DEFAULT_ROLES.find((r) => r.name === 'Receptionist')!.permissions,
      isSystem: true,
    });
    receptionistRole = role._id;
    const staff = await StaffMember.create({
      doctorUserId: doctor,
      roleId: receptionistRole,
      name: 'Front Desk',
      email: `desk-${Date.now()}@example.com`,
      passwordHash: 'x',
      status: 'active',
    });
    staffId = staff._id;
  });

  afterAll(async () => {
    if (dbOk) await mongoose.disconnect();
  });

  describe('the practice owner', () => {
    // The failure a small clinic can least afford is the doctor being locked
    // out of their own records by a permission map.
    it('passes every guard with no staff context at all', async () => {
      const req = fakeReq({ userId: doctor.toString() });
      await run(loadStaffContext, req);
      expect(req.staff).toBeUndefined();

      for (const [mod, method] of [['patients', 'DELETE'], ['settings', 'PATCH'], ['audit', 'GET']] as const) {
        const r = await run(guardModule(mod), fakeReq({ userId: doctor.toString(), method }));
        expect(r.passed).toBe(true);
      }
    });
  });

  describe('a staff session', () => {
    it('resolves its role and permissions from the database', async () => {
      const req = fakeReq({ userId: doctor.toString(), staffId: staffId.toString() });
      const r = await run(loadStaffContext, req);
      expect(r.passed).toBe(true);
      expect(req.staff?.roleName).toBe('Receptionist');
      expect(req.staff?.permissions.patients).toBe('edit');
      expect(req.staff?.permissions.settings).toBe('none');
    });

    it('is allowed what its role grants', async () => {
      const req = fakeReq({ userId: doctor.toString(), staffId: staffId.toString(), method: 'POST' });
      await run(loadStaffContext, req);
      expect((await run(guardModule('appointments'), req)).passed).toBe(true);
    });

    it('is refused what its role does not, with the reason', async () => {
      const req = fakeReq({ userId: doctor.toString(), staffId: staffId.toString(), method: 'PATCH' });
      await run(loadStaffContext, req);
      const r = await run(guardModule('settings'), req);
      expect(r.passed).toBe(false);
      expect(r.status).toBe(403);
      expect(r.payload.required).toBe('settings:edit');
      expect(r.payload.error).toContain('Receptionist');
    });

    it('cannot delete a clinical record even though it may create one', async () => {
      const create = fakeReq({ userId: doctor.toString(), staffId: staffId.toString(), method: 'POST' });
      await run(loadStaffContext, create);
      expect((await run(guardModule('patients'), create)).passed).toBe(true);

      const destroy = fakeReq({ userId: doctor.toString(), staffId: staffId.toString(), method: 'DELETE' });
      await run(loadStaffContext, destroy);
      expect((await run(guardModule('patients'), destroy)).passed).toBe(false);
    });
  });

  describe('changes take effect immediately', () => {
    // Permissions are read per request precisely so this is true — a stale JWT
    // must not keep granting access that has been taken away.
    it('a role edit applies on the very next request', async () => {
      const before = fakeReq({ userId: doctor.toString(), staffId: staffId.toString(), method: 'PATCH' });
      await run(loadStaffContext, before);
      expect((await run(guardModule('settings'), before)).passed).toBe(false);

      await StaffRole.updateOne({ _id: receptionistRole }, { $set: { 'permissions.settings': 'edit' } });

      const after = fakeReq({ userId: doctor.toString(), staffId: staffId.toString(), method: 'PATCH' });
      await run(loadStaffContext, after);
      expect((await run(guardModule('settings'), after)).passed).toBe(true);
    });

    it('a deactivated account stops being able to do anything', async () => {
      await StaffMember.updateOne({ _id: staffId }, { $set: { status: 'disabled', active: false } });
      const req = fakeReq({ userId: doctor.toString(), staffId: staffId.toString() });
      const r = await run(loadStaffContext, req);
      expect(r.passed).toBe(false);
      expect(r.status).toBe(401);
    });

    it('a deleted role grants nothing rather than defaulting open', async () => {
      await StaffRole.deleteOne({ _id: receptionistRole });
      const req = fakeReq({ userId: doctor.toString(), staffId: staffId.toString() });
      await run(loadStaffContext, req);
      expect((await run(guardModule('patients'), req)).passed).toBe(false);
    });
  });

  describe('a guard only answers for its own router', () => {
    /**
     * Every doctor router is mounted at /api/doctor. With the guard applied via
     * `router.use()` the FIRST router in the chain answered for all of them, so
     * a receptionist was refused Team & Roles with "consultations:view" — the
     * wrong module denying the wrong route. `guardRoutes` binds it per route.
     */
    it('does not deny a path belonging to a different router at the same mount', async () => {
      const express = (await import('express')).default;
      const { Router } = await import('express');

      const consultations = Router();
      guardRoutes(consultations, 'consultations');
      consultations.get('/encounters', (_q, s) => { s.json({ ok: true }); });

      const team = Router();
      guardRoutes(team, 'team');
      team.get('/team/members', (_q, s) => { s.json({ ok: true }); });

      const ctx = fakeReq({ userId: doctor.toString(), staffId: staffId.toString() });
      await run(loadStaffContext, ctx);
      // Reception cannot see consultations, but has been granted team access.
      ctx.staff!.permissions.team = 'full';
      ctx.staff!.permissions.consultations = 'none';

      const app = express();
      app.use('/api/doctor', (q, _s, n) => { q.staff = ctx.staff; n(); });
      // Mount order matters: consultations first is what used to swallow the rest.
      app.use('/api/doctor', consultations);
      app.use('/api/doctor', team);

      const server = app.listen(0);
      try {
        const port = (server.address() as { port: number }).port;
        const team200 = await fetch(`http://127.0.0.1:${port}/api/doctor/team/members`);
        expect(team200.status).toBe(200);
        // And the guard that DOES own a path still refuses it.
        const denied = await fetch(`http://127.0.0.1:${port}/api/doctor/encounters`);
        expect(denied.status).toBe(403);
        expect((await denied.json() as { required?: string }).required).toBe('consultations:view');
      } finally {
        await new Promise<void>((r) => server.close(() => { r(); }));
      }
    });
  });

  describe('per-person exceptions', () => {
    // A role is the default, not a cage: one receptionist may also handle
    // billing without inventing a role for a single person.
    it('layer on top of the role', async () => {
      await StaffMember.updateOne({ _id: staffId }, { $set: { permissions: { settings: 'edit' } } });
      const req = fakeReq({ userId: doctor.toString(), staffId: staffId.toString(), method: 'PATCH' });
      await run(loadStaffContext, req);
      expect((await run(guardModule('settings'), req)).passed).toBe(true);
      // Everything they did not name still comes from the role.
      expect(req.staff?.permissions.appointments).toBe('edit');
    });

    it('can take access away as well as grant it', async () => {
      await StaffMember.updateOne({ _id: staffId }, { $set: { permissions: { appointments: 'none' } } });
      const req = fakeReq({ userId: doctor.toString(), staffId: staffId.toString() });
      await run(loadStaffContext, req);
      expect((await run(guardModule('appointments'), req)).passed).toBe(false);
    });

    it('do not freeze the modules they leave alone — a later role edit still reaches them', async () => {
      await StaffMember.updateOne({ _id: staffId }, { $set: { permissions: { settings: 'edit' } } });
      await StaffRole.updateOne({ _id: receptionistRole }, { $set: { 'permissions.pharmacy': 'view' } });
      const req = fakeReq({ userId: doctor.toString(), staffId: staffId.toString() });
      await run(loadStaffContext, req);
      expect(req.staff?.permissions.pharmacy).toBe('view');
    });
  });

  describe('the owner viewing the panel as a staff member', () => {
    // "View as" is the one impersonation that can only REMOVE capability: the
    // session's subject stays the doctor, who could already reach everything the
    // staff member can. What must hold is that it never works the other way.
    it('is narrowed to that role, not to the owner\'s own reach', async () => {
      const req = fakeReq({
        userId: doctor.toString(), staffId: staffId.toString(), viewAs: true, method: 'PATCH',
      });
      await run(loadStaffContext, req);
      expect(req.staff?.roleName).toBe('Receptionist');
      expect((await run(guardModule('settings'), req)).passed).toBe(false);
    });

    it('can preview an invitation that has not been accepted yet', async () => {
      await StaffMember.updateOne({ _id: staffId }, { $set: { status: 'invited', active: false } });

      // A real staff session with that account is refused...
      const real = fakeReq({ userId: doctor.toString(), staffId: staffId.toString() });
      expect((await run(loadStaffContext, real)).status).toBe(401);

      // ...but the owner checking what the invitee will see is not.
      const preview = fakeReq({ userId: doctor.toString(), staffId: staffId.toString(), viewAs: true });
      expect((await run(loadStaffContext, preview)).passed).toBe(true);
    });

    it('will not preview a deactivated account', async () => {
      await StaffMember.updateOne({ _id: staffId }, { $set: { status: 'disabled', active: false } });
      const req = fakeReq({ userId: doctor.toString(), staffId: staffId.toString(), viewAs: true });
      expect((await run(loadStaffContext, req)).status).toBe(401);
    });

    it('reports itself, so the client can offer a way back', async () => {
      const req = fakeReq({ userId: doctor.toString(), staffId: staffId.toString(), viewAs: true });
      await run(loadStaffContext, req);
      expect(sessionPermissions(req).viewAs).toBe(true);

      const plain = fakeReq({ userId: doctor.toString(), staffId: staffId.toString() });
      await run(loadStaffContext, plain);
      // A real staff login must never look like an owner-initiated view, or the
      // exit route would hand them the doctor's session.
      expect(sessionPermissions(plain).viewAs).toBe(false);
    });

    it('is not granted by the cookie unless the token really says so', async () => {
      const { setStaffAuthCookie, setStaffViewAsCookie, requireAuth: auth } = await import('../middleware/auth.js');
      const read = (setCookie: (r: Response) => void) => {
        let token = '';
        setCookie({ cookie: (_n: string, v: string) => { token = v; } } as unknown as Response);
        const req = { cookies: { mateo_token: token } } as unknown as Request;
        auth(req, fakeRes(), () => undefined);
        return req;
      };
      expect(read((r) => { setStaffViewAsCookie(r, doctor.toString(), staffId.toString()); }).viewAs).toBe(true);
      expect(read((r) => { setStaffAuthCookie(r, doctor.toString(), staffId.toString()); }).viewAs).toBeUndefined();
    });
  });

  describe('tenancy', () => {
    // RBAC narrows a session inside one practice; it must never be a way across.
    it('will not resolve a staff member belonging to another practice', async () => {
      const otherDoctor = oid();
      const req = fakeReq({ userId: otherDoctor.toString(), staffId: staffId.toString() });
      const r = await run(loadStaffContext, req);
      expect(r.passed).toBe(false);
      expect(r.status).toBe(401);
      expect(req.staff).toBeUndefined();
    });
  });
});
