import type { NextFunction, Request, Response } from 'express';
import type { HydratedDocument } from 'mongoose';
import { Patient } from '../models/Patient.js';
import type { IPatient } from '../models/Patient.js';

declare module 'express-serve-static-core' {
  interface Request {
    myPatient?: HydratedDocument<IPatient>;
  }
}

/**
 * Portal tenancy boundary. A patient-role user is bound to exactly one Patient via
 * Patient.patientUserId. This loads THAT record (their own) keyed on req.userId, so a
 * portal user can never reach another patient's data. Runs after requireRole('patient').
 */
export async function loadMyPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
  const patient = req.userId ? await Patient.findOne({ patientUserId: req.userId }) : null;
  if (!patient) {
    res.status(404).json({ error: 'No patient record is linked to your account' });
    return;
  }
  req.myPatient = patient;
  next();
}
