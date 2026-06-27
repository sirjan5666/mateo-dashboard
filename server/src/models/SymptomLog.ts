import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

// A fever / symptom entry for a baby: an optional temperature reading plus any
// observed symptoms. The escalation level is computed at read time (never
// stored) from age + temperature + symptoms — see server/src/health/symptoms.ts.
export interface ISymptomLog {
  babyId: Types.ObjectId;
  loggedAt: Date;
  temperatureC?: number; // always stored in Celsius
  symptoms: string[]; // symptom keys (see SYMPTOMS catalog)
  notes?: string;
  createdAt: Date;
}

const symptomLogSchema = new Schema<ISymptomLog>(
  {
    babyId: { type: Schema.Types.ObjectId, ref: 'Baby', required: true, index: true },
    loggedAt: { type: Date, required: true },
    temperatureC: { type: Number, min: 30, max: 45 },
    symptoms: { type: [String], default: [] },
    notes: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const SymptomLog = model<ISymptomLog>('SymptomLog', symptomLogSchema);
