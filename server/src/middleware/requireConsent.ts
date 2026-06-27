import type { NextFunction, Request, Response } from 'express';
import { ConsentRecord } from '../models/ConsentRecord.js';
import type { ConsentPurpose } from '../models/ConsentRecord.js';
import { scopeToDoctor } from './loadOwnedPatient.js';

/**
 * Block PHI processing unless consent for (patient, purpose) is currently granted.
 * Runs AFTER loadOwnedPatient (needs req.patient). Fails CLOSED: no consent on
 * record => 403.
 *
 * Tie-break safety: consent rows are append-only and `at` is millisecond
 * wall-clock, so a grant and a same-instant withdrawal can share a timestamp and
 * MongoDB does not order ties deterministically. We therefore (a) take the latest
 * granted row, then (b) deny if ANY withdrawal exists at or after it — a
 * withdrawal always wins the tie (fail closed).
 *
 * Defence in depth: the query is scoped to the calling doctor via scopeToDoctor,
 * not just to req.patient, so it never relies solely on upstream ordering.
 *
 * COMPLIANCE (DPDP): a policyVersion bump should require re-consent — once the
 * consent policy text is finalised, also match the current policyVersion here so a
 * stale-version grant no longer satisfies the gate.
 */
export function requireConsent(purpose: ConsentPurpose) {
  return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
    const patient = req.patient;
    if (!patient) {
      // Programming error — this gate must be chained after loadOwnedPatient.
      res.status(500).json({ error: 'Consent check misconfigured' });
      return;
    }
    const deny = (): void => {
      res.status(403).json({ error: 'Patient consent is required for this action', purpose });
    };
    const latest = await ConsentRecord.findOne(scopeToDoctor(req, { patientId: patient._id, purpose })).sort({
      at: -1,
      _id: -1,
    });
    if (!latest || latest.status !== 'granted') {
      deny();
      return;
    }
    // A withdrawal at the same instant (or later) as the latest grant wins the tie.
    const supersedingWithdrawal = await ConsentRecord.exists(
      scopeToDoctor(req, { patientId: patient._id, purpose, status: 'withdrawn', at: { $gte: latest.at } }),
    );
    if (supersedingWithdrawal) {
      deny();
      return;
    }
    next();
  };
}
