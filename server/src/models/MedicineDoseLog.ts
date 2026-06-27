import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

// One recorded dose of a prescribed medicine (parent ticked "given"). A medicine
// "course" is identified by its prescription + the item's index in that
// prescription (prescription items have no _id of their own).
export interface IMedicineDoseLog {
  babyId: Types.ObjectId;
  parentUserId: Types.ObjectId;
  prescriptionId: Types.ObjectId;
  itemIndex: number;
  medicine: string;
  givenAt: Date;
  createdAt: Date;
}

const medicineDoseLogSchema = new Schema<IMedicineDoseLog>(
  {
    babyId: { type: Schema.Types.ObjectId, ref: 'Baby', required: true, index: true },
    parentUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    prescriptionId: { type: Schema.Types.ObjectId, ref: 'Prescription', required: true, index: true },
    itemIndex: { type: Number, required: true, min: 0 },
    medicine: { type: String, required: true, trim: true },
    givenAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const MedicineDoseLog = model<IMedicineDoseLog>('MedicineDoseLog', medicineDoseLogSchema);
