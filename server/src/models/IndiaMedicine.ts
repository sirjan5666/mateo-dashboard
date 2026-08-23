import { Schema, model } from 'mongoose';

// A read-only reference catalog of Indian medicines (the public "A-Z medicines
// dataset of India": brand name + composition + pack). It powers the prescribe
// form's medicine typeahead. This is GLOBAL reference data — NOT per-user and
// NOT the doctor's pharmacy stock (that's the separate `Medicine` model in
// Pharmacy.ts) — so it is seeded once via scripts/import-medicines.ts and is not
// touched by per-user DPDP erasure. It carries NO dosing guidance; pediatric
// dosing still comes from the curated (signed-off) drug-dosing.ts.
export interface IIndiaMedicine {
  name: string;
  nameLower: string; // indexed; anchored-prefix regex autocomplete
  type?: string; // e.g. "allopathy"
  packSize?: string; // e.g. "strip of 10 tablets"
  composition1?: string; // e.g. "Amoxycillin (500mg)"
  composition2?: string; // e.g. "Clavulanic Acid (125mg)"
}

const indiaMedicineSchema = new Schema<IIndiaMedicine>(
  {
    name: { type: String, required: true },
    nameLower: { type: String, required: true, index: true },
    type: String,
    packSize: String,
    composition1: String,
    composition2: String,
  },
  { timestamps: false },
);

export const IndiaMedicine = model<IIndiaMedicine>('IndiaMedicine', indiaMedicineSchema);
