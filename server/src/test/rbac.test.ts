import { describe, expect, it } from 'vitest';
import { DEFAULT_ROLES, MODULES, can, grantedActions, normalisePermissions } from '../permissions/catalogue.js';
import type { ModuleId } from '../permissions/catalogue.js';

/**
 * The permission catalogue is pure, so it is tested directly — no database, no
 * HTTP. These are the assertions that decide whether a receptionist can delete a
 * child's clinical record, which is worth pinning down explicitly rather than
 * inferring from a matrix in a UI.
 */
describe('permission catalogue', () => {
  describe('normalisePermissions', () => {
    it('fills every module, so an absent one denies rather than defaulting open', () => {
      const p = normalisePermissions({ patients: 'full' });
      expect(p.patients).toBe('full');
      for (const m of MODULES) expect(p[m]).toBeDefined();
      expect(p.billing).toBe('none');
      expect(p.settings).toBe('none');
    });

    it('rejects junk levels rather than trusting them', () => {
      const p = normalisePermissions({ patients: 'superuser', billing: 42, pharmacy: null });
      expect(p.patients).toBe('none');
      expect(p.billing).toBe('none');
      expect(p.pharmacy).toBe('none');
    });

    it('treats a missing permission map as no access at all', () => {
      const p = normalisePermissions(undefined);
      for (const m of MODULES) expect(p[m]).toBe('none');
    });
  });

  describe('can()', () => {
    it('grants an action when the level is at or above what it requires', () => {
      expect(can({ patients: 'view' }, 'patients', 'view')).toBe(true);
      expect(can({ patients: 'edit' }, 'patients', 'view')).toBe(true);
      expect(can({ patients: 'edit' }, 'patients', 'create')).toBe(true);
      expect(can({ patients: 'full' }, 'patients', 'delete')).toBe(true);
    });

    it('refuses an action above the granted level', () => {
      expect(can({ patients: 'view' }, 'patients', 'create')).toBe(false);
      expect(can({ patients: 'edit' }, 'patients', 'delete')).toBe(false);
      expect(can({ patients: 'none' }, 'patients', 'view')).toBe(false);
    });

    // A typo in a route's guard must lock the endpoint, not open it.
    it('denies an unknown module or action', () => {
      expect(can({ patients: 'full' }, 'nonsense', 'view')).toBe(false);
      expect(can({ patients: 'full' }, 'patients', 'obliterate')).toBe(false);
    });

    it('never leaks one module into another', () => {
      const p = { pharmacy: 'full' };
      expect(can(p, 'pharmacy', 'sale')).toBe(true);
      expect(can(p, 'patients', 'view')).toBe(false);
      expect(can(p, 'billing', 'refund')).toBe(false);
    });
  });

  describe('default roles', () => {
    const byName = (n: string) => DEFAULT_ROLES.find((r) => r.name === n)!;

    it('ships the eight roles a clinic expects', () => {
      expect(DEFAULT_ROLES.map((r) => r.name)).toEqual([
        'Super Admin', 'Clinic Admin', 'Doctor', 'Receptionist',
        'Nurse', 'Pharmacist', 'Lab Technician', 'Accountant',
      ]);
    });

    it('gives Super Admin everything — within this practice', () => {
      const p = byName('Super Admin').permissions;
      for (const m of MODULES) expect(can(p, m, 'view')).toBe(true);
      expect(can(p, 'settings', 'edit')).toBe(true);
      expect(can(p, 'team', 'delete')).toBe(true);
    });

    // The load-bearing assertion of the whole model: front-desk staff book and
    // register, they do not destroy clinical records.
    it('lets a Receptionist book and register but never delete', () => {
      const p = byName('Receptionist').permissions;
      expect(can(p, 'appointments', 'create')).toBe(true);
      expect(can(p, 'appointments', 'cancel')).toBe(true);
      expect(can(p, 'patients', 'create')).toBe(true);
      expect(can(p, 'billing', 'create')).toBe(true);

      expect(can(p, 'patients', 'delete')).toBe(false);
      expect(can(p, 'patients', 'archive')).toBe(false);
      expect(can(p, 'appointments', 'delete')).toBe(false);
      expect(can(p, 'billing', 'refund')).toBe(false);
      expect(can(p, 'settings', 'edit')).toBe(false);
      expect(can(p, 'team', 'view')).toBe(false);
      expect(can(p, 'audit', 'view')).toBe(false);
    });

    it('keeps a Nurse out of money and settings', () => {
      const p = byName('Nurse').permissions;
      expect(can(p, 'growth', 'create')).toBe(true);
      expect(can(p, 'vaccinations', 'create')).toBe(true);
      expect(can(p, 'billing', 'view')).toBe(false);
      expect(can(p, 'pharmacy', 'sale')).toBe(false);
      expect(can(p, 'settings', 'view')).toBe(false);
    });

    it('keeps a Pharmacist out of clinical writing', () => {
      const p = byName('Pharmacist').permissions;
      expect(can(p, 'pharmacy', 'sale')).toBe(true);
      expect(can(p, 'pharmacy', 'purchase')).toBe(true);
      expect(can(p, 'prescriptions', 'view')).toBe(true);
      expect(can(p, 'prescriptions', 'create')).toBe(false);
      expect(can(p, 'consultations', 'view')).toBe(false);
      expect(can(p, 'billing', 'refund')).toBe(false);
    });

    it('keeps an Accountant out of the clinical record', () => {
      const p = byName('Accountant').permissions;
      expect(can(p, 'billing', 'refund')).toBe(true);
      expect(can(p, 'reports', 'export')).toBe(true);
      expect(can(p, 'consultations', 'view')).toBe(false);
      expect(can(p, 'prescriptions', 'view')).toBe(false);
      expect(can(p, 'growth', 'view')).toBe(false);
    });

    it('lets a Doctor practise without being able to reshape the practice', () => {
      const p = byName('Doctor').permissions;
      expect(can(p, 'prescriptions', 'create')).toBe(true);
      expect(can(p, 'consultations', 'create')).toBe(true);
      expect(can(p, 'billing', 'view')).toBe(true);
      expect(can(p, 'team', 'view')).toBe(false);
      expect(can(p, 'settings', 'edit')).toBe(false);
      expect(can(p, 'locations', 'edit')).toBe(false);
    });

    it('never grants an action no module defines', () => {
      for (const role of DEFAULT_ROLES) {
        for (const granted of grantedActions(role.permissions)) {
          const [m, a] = granted.split(':');
          expect(can(role.permissions, m, a)).toBe(true);
          expect((MODULES as readonly string[]).includes(m)).toBe(true);
        }
      }
    });
  });

  describe('grantedActions', () => {
    it('lists exactly what a level allows, for the client to hide the rest', () => {
      const actions = grantedActions({ patients: 'view' } as Record<ModuleId, string>);
      expect(actions).toContain('patients:view');
      expect(actions).not.toContain('patients:create');
      expect(actions).not.toContain('patients:delete');
    });

    it('returns nothing for an empty map', () => {
      expect(grantedActions({})).toEqual([]);
    });
  });
});
