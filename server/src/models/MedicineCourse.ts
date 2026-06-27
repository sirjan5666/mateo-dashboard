import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

// Per-course parent state (only stored once the parent acts on it). A course is
// "active" by default; finishing/stopping it sets active=false. Keyed by the
// prescription + item index. Reminder times can hang off this later.
export interface IMedicineCourse {
  babyId: Types.ObjectId;
  parentUserId: Types.ObjectId;
  prescriptionId: Types.ObjectId;
  itemIndex: number;
  active: boolean;
  createdAt: Date;
}

const medicineCourseSchema = new Schema<IMedicineCourse>(
  {
    babyId: { type: Schema.Types.ObjectId, ref: 'Baby', required: true, index: true },
    parentUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    prescriptionId: { type: Schema.Types.ObjectId, ref: 'Prescription', required: true },
    itemIndex: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// One state row per (prescription, item).
medicineCourseSchema.index({ prescriptionId: 1, itemIndex: 1 }, { unique: true });

export const MedicineCourse = model<IMedicineCourse>('MedicineCourse', medicineCourseSchema);
