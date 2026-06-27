import type { NextFunction, Request, Response } from 'express';
import { Types, isValidObjectId } from 'mongoose';
import type { HydratedDocument } from 'mongoose';
import { Patient } from '../models/Patient.js';
import type { IPatient } from '../models/Patient.js';
import { PatientRecord } from '../models/PatientRecord.js';
import type { IPatientRecord } from '../models/PatientRecord.js';

declare module 'express-serve-static-core' {
  interface Request {
    patient?: HydratedDocument<IPatient>;
    record?: HydratedDocument<IPatientRecord>;
    // Set on a cross-tenant 403 so the audit layer can attribute the attempt to
    // the VICTIM tenant (never granting access). Only ObjectIds — no PHI.
    deniedResource?: { patientId: Types.ObjectId; doctorUserId: Types.ObjectId };
  }
}

/**
 * Tenant boundary for the doctor EHR domain. A patient belongs to exactly one
 * doctor (Patient.doctorUserId); Doctor A can NEVER load Doctor B's patient.
 * Runs AFTER requireAuth + requireRole('doctor'). Mirrors loadOwnedBaby —
 * 404 when missing, 403 when owned by another doctor. Never trust a patientId
 * from the client without this check.
 */
export async function loadOwnedPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { id } = req.params;
  const patient = isValidObjectId(id) ? await Patient.findById(id) : null;
  if (!patient) {
    res.status(404).json({ error: 'Patient not found' });
    return;
  }
  if (patient.doctorUserId.toString() !== req.userId) {
    // Record the targeted ids for the audit trail WITHOUT authorizing access.
    req.deniedResource = { patientId: patient._id, doctorUserId: patient.doctorUserId };
    res.status(403).json({ error: 'You do not have access to this patient' });
    return;
  }
  req.patient = patient;
  next();
}

/**
 * Mandatory loader for a PatientRecord by :id, scoped to the calling doctor in the
 * QUERY itself (findOne with doctorUserId) so a foreign record returns 404 and its
 * PHI is never loaded into memory. Mirrors loadOwnedDose. Use this instead of any
 * bare PatientRecord.findById in routes.
 */
export async function loadOwnedRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const { id } = req.params;
  const record = isValidObjectId(id)
    ? await PatientRecord.findOne(scopeToDoctor(req, { _id: id }))
    : null;
  if (!record) {
    res.status(404).json({ error: 'Record not found' });
    return;
  }
  req.record = record;
  next();
}

/**
 * Defence in depth: scope EVERY collection-level query to the authenticated
 * doctor. Use on find/updateMany/deleteMany etc. so that a single forgotten :id
 * ownership check can never enumerate or mutate another doctor's roster. Fails
 * CLOSED — throws if there is no authenticated user (caught by the error handler
 * as a 500 rather than silently returning everyone's data).
 */
export function scopeToDoctor(req: Request, filter: Record<string, unknown> = {}): Record<string, unknown> {
  if (!req.userId) throw new Error('scopeToDoctor called without an authenticated user');
  return { ...filter, doctorUserId: req.userId };
}
