import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { SkinLog } from '../models/SkinLog.js';
import type { ISkinLog } from '../models/SkinLog.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSubscription } from '../middleware/subscription.js';
import { loadOwnedBaby } from '../middleware/ownership.js';
import { uploadPhoto, uploadsDir } from '../middleware/upload.js';
import { awardTrackerEntry } from '../points/service.js';
import { isFutureISTDate } from '../lib/ist.js';

const MIN_DATE = new Date('2000-01-01T00:00:00.000Z');

const createSkinSchema = z.object({
  loggedAt: z.coerce
    .date()
    .refine((d) => d.getTime() >= MIN_DATE.getTime(), 'Date is too far in the past')
    // IST calendar day, not raw instant (a date-only value is UTC midnight).
    .refine((d) => !isFutureISTDate(d), 'Date cannot be in the future'),
  area: z.string().trim().min(1).max(60),
  description: z.string().trim().min(1).max(1000),
  severity: z.enum(['mild', 'moderate', 'concerning']),
});

function publicLog(log: ISkinLog & { id: string }, babyId: string) {
  return {
    id: log.id,
    loggedAt: log.loggedAt,
    area: log.area,
    description: log.description,
    severity: log.severity,
    photoUrl: log.photoFile ? `/api/babies/${babyId}/skin/${log.id}/photo` : null,
    createdAt: log.createdAt,
  };
}

// Converts multer errors (size/type) into 400s instead of 500s.
function handleUpload(req: Request, res: Response, next: NextFunction): void {
  uploadPhoto(req, res, (err: unknown) => {
    if (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed' });
      return;
    }
    next();
  });
}

const router = Router();

router.get('/babies/:id/skin', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  // Newest observation first; createdAt breaks ties when several share a date.
  const logs = await SkinLog.find({ babyId: baby._id }).sort({ loggedAt: -1, createdAt: -1 });
  res.json({ logs: logs.map((l) => publicLog(l, baby.id)) });
});

router.post('/babies/:id/skin', requireAuth, requireSubscription, loadOwnedBaby, handleUpload, async (req, res) => {
  const baby = req.baby!;
  const cleanupFile = async () => {
    if (req.file) await unlink(req.file.path).catch(() => {});
  };

  let body: z.infer<typeof createSkinSchema>;
  try {
    body = createSkinSchema.parse(req.body);
  } catch (err) {
    await cleanupFile();
    throw err;
  }
  if (body.loggedAt.getTime() < baby.dob.getTime()) {
    await cleanupFile();
    res.status(400).json({ error: 'Date cannot be before the baby was born' });
    return;
  }

  const log = await SkinLog.create({ babyId: baby._id, ...body, photoFile: req.file?.filename });
  void awardTrackerEntry(req.userId!, 'skin_log', log.id, `earn:skin:${log.id}`).catch((e) => console.error('sitare award failed:', e));
  res.status(201).json({ log: publicLog(log, baby.id) });
});

router.get('/babies/:id/skin/:logId/photo', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const { logId } = req.params;
  const log = isValidObjectId(logId) ? await SkinLog.findById(logId) : null;
  if (!log || log.babyId.toString() !== baby._id.toString() || !log.photoFile) {
    res.status(404).json({ error: 'Photo not found' });
    return;
  }
  res.sendFile(path.join(uploadsDir, log.photoFile));
});

router.delete('/babies/:id/skin/:logId', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const { logId } = req.params;
  const log = isValidObjectId(logId) ? await SkinLog.findById(logId) : null;
  if (!log || log.babyId.toString() !== baby._id.toString()) {
    res.status(404).json({ error: 'Skin log not found' });
    return;
  }
  if (log.photoFile) await unlink(path.join(uploadsDir, log.photoFile)).catch(() => {});
  await log.deleteOne();
  res.json({ ok: true });
});

export default router;
