import type { NextFunction, Request, Response, Router } from 'express';
import type { HydratedDocument } from 'mongoose';
import { StaffMember } from '../models/StaffMember.js';
import type { IStaffMember } from '../models/StaffMember.js';
import { StaffRole } from '../models/StaffRole.js';
import { MODULE_ACTIONS, can, grantedActions, normalisePermissions } from '../permissions/catalogue.js';
import type { ModuleId } from '../permissions/catalogue.js';
import { recordAudit } from './audit.js';

/**
 * Role-based access control for the doctor panel.
 *
 * THE TENANCY TRICK, and the reason nothing else had to change: a staff session
 * carries the DOCTOR as its subject. `req.userId` is therefore the practice
 * owner for staff and doctor alike, so all 97 existing `scopeToDoctor` queries
 * and every `requireRole('doctor')` gate keep working untouched. What differs is
 * `req.staff`, and `requirePermission` narrows the session on top.
 *
 * The owner is not a role. A doctor logged into their own practice passes every
 * check — there is no permission map that could lock them out of their own data,
 * which is the failure mode a small clinic can least afford.
 */

export interface StaffContext {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  permissions: Record<ModuleId, string>;
  locationId?: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    /** Present only for staff sessions; absent when the doctor is signed in. */
    staff?: StaffContext;
    staffId?: string;
  }
}

/**
 * What a staff member may actually do: their role, with their own per-person
 * exceptions laid over it — and only for the modules those exceptions name, so
 * editing a role still reaches everyone who holds it.
 *
 * A role deleted out from under someone grants nothing rather than falling back
 * to something permissive. Everything that answers "what can this person do"
 * goes through here, so the guard and the UI can never disagree.
 */
export function effectivePermissions(
  overrides: Record<string, unknown> | undefined | null,
  rolePermissions: unknown,
): Record<ModuleId, string> {
  return normalisePermissions({
    ...(rolePermissions as Record<string, unknown> | undefined),
    ...(overrides ?? {}),
  });
}

/**
 * Loads the staff member behind `req.staffId` and attaches their permissions.
 * Read from the DATABASE every request, never from the token: a role change or a
 * deactivation has to take effect immediately, not when a JWT happens to expire.
 */
export async function loadStaffContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.staffId) {
    next();
    return;
  }
  const staff = await StaffMember.findOne({ _id: req.staffId, doctorUserId: req.userId });
  if (!staff || staff.status !== 'active') {
    res.status(401).json({ error: 'This staff account is no longer active' });
    return;
  }
  const role = await StaffRole.findOne({ _id: staff.roleId, doctorUserId: req.userId });
  req.staff = {
    id: String(staff._id),
    name: staff.name,
    email: staff.email,
    roleId: String(staff.roleId),
    roleName: role?.name ?? 'Unknown role',
    permissions: effectivePermissions(staff.permissions, role?.permissions),
    locationId: staff.locationId ? String(staff.locationId) : undefined,
  };
  next();
}

/**
 * Demand `module:action` of the current session.
 *
 * Unknown module or action denies — a typo in a route locks the endpoint down
 * rather than opening it up, which is the safe direction to fail.
 */
export function requirePermission(module: ModuleId, action: string) {
  return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
    // The practice owner. No permission map applies to their own data.
    if (!req.staff) {
      next();
      return;
    }
    if (can(req.staff.permissions, module, action)) {
      next();
      return;
    }
    // A refused attempt is worth recording: it is the only way a clinic sees
    // that someone is reaching for something they should not have.
    await recordAudit(req, {
      action: 'read',
      resourceType: `permission:${module}:${action}`,
      outcome: 'deny',
    }).catch(() => undefined);
    res.status(403).json({
      error: `Your role (${req.staff.roleName}) does not allow this action`,
      required: `${module}:${action}`,
    });
  };
}

/**
 * Blanket guard for a whole router, deriving the action from the HTTP method.
 *
 * Applied with `router.use(...)`, so an endpoint added tomorrow is covered the
 * moment it exists — the alternative, decorating 97 routes by hand, guarantees
 * that the one that gets forgotten is the one that matters.
 *
 * `overrides` handles the endpoints whose meaning is not their method: a POST to
 * /bills is a `sale`, not a `create`, and a POST to /invoices/:id/refund is a
 * `refund`. The key is matched against the route path as a substring.
 */
/** Which actions each module actually defines — precomputed once. */
const MODULE_ACTION_KEYS = Object.fromEntries(
  Object.entries(MODULE_ACTIONS).map(([m, a]) => [m, Object.keys(a)]),
) as Record<ModuleId, string[]>;

const METHOD_ACTION: Record<string, string> = {
  GET: 'view',
  HEAD: 'view',
  POST: 'create',
  PUT: 'edit',
  PATCH: 'edit',
  DELETE: 'delete',
};

export function guardModule(module: ModuleId, overrides: Override[] = []) {
  return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.staff) {
      next();
      return;
    }
    const path = req.path;
    const override = overrides.find(
      (o) => path.includes(o.match) && (!o.method || o.method === req.method),
    );
    const action = override?.action ?? METHOD_ACTION[req.method] ?? 'view';

    // A module may not define the derived action (patients has no `delete`
    // action for a soft archive, say). Fall back to the nearest broader action
    // rather than letting an undefined action deny a legitimate endpoint —
    // `can()` already denies unknown actions, so the fallback must be a real one.
    const actions = MODULE_ACTION_KEYS[module];
    const resolved = actions.includes(action)
      ? action
      : action === 'delete' && actions.includes('edit') ? 'edit'
        : action === 'create' && actions.includes('edit') ? 'edit'
          : 'view';

    if (can(req.staff.permissions, module, resolved)) {
      next();
      return;
    }
    await recordAudit(req, {
      action: 'read',
      resourceType: `permission:${module}:${resolved}`,
      outcome: 'deny',
    }).catch(() => undefined);
    res.status(403).json({
      error: `Your role (${req.staff.roleName}) does not allow this action`,
      required: `${module}:${resolved}`,
    });
  };
}

type Override = { match: string; method?: string; action: string };
type RouteMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';
const ROUTE_METHODS: RouteMethod[] = ['get', 'post', 'put', 'patch', 'delete'];

/**
 * Bind a module guard to the routes THIS router declares.
 *
 * Not `router.use(guardModule(...))`, which looks equivalent and is not: all
 * nineteen doctor routers are mounted at the same `/api/doctor`, so a `use()`
 * guard runs for every request that reaches that mount — including the ones
 * belonging to a different router further down the chain. The first router whose
 * guard denied would then answer for everybody, and a receptionist with
 * `team: full` was refused Team & Roles because an earlier router's
 * `consultations` guard got there first.
 *
 * Injecting the guard at route-registration time means it fires only when the
 * path actually matches this router's own route. Call it BEFORE registering any
 * routes.
 */
export function guardRoutes(router: Router, module: ModuleId, overrides: Override[] = []): void {
  const guard = guardModule(module, overrides);
  for (const method of ROUTE_METHODS) {
    const original = router[method].bind(router) as (...args: unknown[]) => unknown;
    router[method] = ((path: unknown, ...handlers: unknown[]) =>
      original(path, guard, ...handlers)) as typeof router[RouteMethod];
  }
}

/** The permission payload the client needs to hide what a session cannot do. */
export function sessionPermissions(req: Request): { owner: boolean; role: string | null; actions: string[] } {
  if (!req.staff) return { owner: true, role: null, actions: [] };
  return {
    owner: false,
    role: req.staff.roleName,
    actions: grantedActions(req.staff.permissions),
  };
}

/** The human behind the request — the staff member if there is one, else the doctor. */
export function actorName(req: Request): string | undefined {
  return req.staff?.name ?? req.authUser?.name;
}

export type StaffDoc = HydratedDocument<IStaffMember>;
