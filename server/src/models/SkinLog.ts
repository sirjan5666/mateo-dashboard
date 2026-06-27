import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export type SkinSeverity = 'mild' | 'moderate' | 'concerning';

export interface ISkinLog {
  babyId: Types.ObjectId;
  loggedAt: Date;
  area: string;
  description: string;
  // On-disk filename under server/uploads (dev local storage). Served only via
  // an authenticated, ownership-checked route — never as a public static URL.
  photoFile?: string;
  severity: SkinSeverity;
  createdAt: Date;
}

const skinLogSchema = new Schema<ISkinLog>(
  {
    babyId: { type: Schema.Types.ObjectId, ref: 'Baby', required: true, index: true },
    loggedAt: { type: Date, required: true },
    area: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    photoFile: { type: String },
    severity: { type: String, enum: ['mild', 'moderate', 'concerning'], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const SkinLog = model<ISkinLog>('SkinLog', skinLogSchema);
