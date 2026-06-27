import type { NextFunction, Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import type { HydratedDocument } from 'mongoose';
import { Baby } from '../models/Baby.js';
import type { IBaby } from '../models/Baby.js';
import { VaccineDose } from '../models/VaccineDose.js';
import type { IVaccineDose } from '../models/VaccineDose.js';

declare module 'express-serve-static-core' {
  interface Request {
    baby?: HydratedDocument<IBaby>;
    dose?: HydratedDocument<IVaccineDose>;
  }
}

/**
 * Loads the baby from req.params.id and verifies it belongs to the
 * authenticated user (must run after requireAuth). Never trust a babyId
 * from the client without checking ownership.
 */
export async function loadOwnedBaby(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { id } = req.params;
  const baby = isValidObjectId(id) ? await Baby.findById(id) : null;
  if (!baby) {
    res.status(404).json({ error: 'Baby not found' });
    return;
  }
  if (baby.userId.toString() !== req.userId) {
    res.status(403).json({ error: 'You do not have access to this baby' });
    return;
  }
  req.baby = baby;
  next();
}

/**
 * Loads the vaccine dose from req.params.doseId and verifies the baby it
 * belongs to is owned by the authenticated user. Sets req.dose and req.baby.
 */
export async function loadOwnedDose(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { doseId } = req.params;
  const dose = isValidObjectId(doseId) ? await VaccineDose.findById(doseId) : null;
  if (!dose) {
    res.status(404).json({ error: 'Vaccine dose not found' });
    return;
  }
  const baby = await Baby.findById(dose.babyId);
  if (!baby || baby.userId.toString() !== req.userId) {
    res.status(403).json({ error: 'You do not have access to this vaccine dose' });
    return;
  }
  req.dose = dose;
  req.baby = baby;
  next();
}
