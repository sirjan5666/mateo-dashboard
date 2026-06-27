import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export interface IBaby {
  userId: Types.ObjectId;
  name: string;
  dob: Date;
  sex: 'male' | 'female';
  birthWeightG?: number;
  birthLengthCm?: number;
  birthHeadCircCm?: number;
  createdAt: Date;
}

const babySchema = new Schema<IBaby>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    // Stored as a UTC Date; age is always computed from dob at read time, never stored
    dob: { type: Date, required: true },
    sex: { type: String, enum: ['male', 'female'], required: true },
    birthWeightG: { type: Number },
    birthLengthCm: { type: Number },
    birthHeadCircCm: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Baby = model<IBaby>('Baby', babySchema);
