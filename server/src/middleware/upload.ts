import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import type { Request } from 'express';

// Dev-local photo storage. Files live here and are streamed back only through
// an authenticated, ownership-checked route (see routes/skin.ts).
export const uploadsDir = path.resolve('uploads');
mkdirSync(uploadsDir, { recursive: true });

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, `${randomUUID()}${EXT_BY_MIME[file.mimetype] ?? ''}`),
});

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void {
  if (EXT_BY_MIME[file.mimetype]) cb(null, true);
  else cb(new Error('Only JPEG, PNG or WebP images are allowed'));
}

export const uploadPhoto = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
}).single('photo');

// Same storage/rules, for an image attached to a consultation chat message.
export const uploadImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
}).single('image');
