import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';
import { encryptedFields } from '../lib/crypto/mongooseEncryption.js';

/**
 * A report the doctor (or their staff) exported from Reports & Analytics.
 *
 * Doctor-owned and tenant-scoped like every other clinic document. This exists
 * so the "Recent Reports" table has something real behind it: before, it was a
 * hard-coded empty array and the card looked broken.
 *
 * The stored `csvEnc` is the SNAPSHOT that was downloaded — re-running the range
 * later would give different figures (invoices get paid, appointments complete),
 * and a doctor re-downloading last week's export expects last week's numbers.
 * It holds practice aggregates rather than per-patient rows, but service
 * descriptions can hint at care, so it is field-encrypted at rest on the same
 * principle as Invoice.itemsEnc — decrypted only in the download handler.
 */
export type SavedReportType = 'summary' | 'appointments' | 'revenue' | 'patients' | 'services';
export const SAVED_REPORT_TYPES: SavedReportType[] = ['summary', 'appointments', 'revenue', 'patients', 'services'];

/** Newest-first list cap, and the number kept per practice (older rows pruned on create). */
export const SAVED_REPORT_KEEP = 50;

export interface ISavedReport {
  doctorUserId: Types.ObjectId; // TENANT
  name: string;
  type: SavedReportType;
  /** IST calendar dates, YYYY-MM-DD — the window the figures cover. */
  rangeFrom: string;
  rangeTo: string;
  /** SNAPSHOT of who generated it, readable after the account is gone. */
  generatedByName: string;
  csvEnc: string; // encrypted CSV snapshot
  createdAt: Date;
  updatedAt: Date;
}

const savedReportSchema = new Schema<ISavedReport>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: SAVED_REPORT_TYPES, default: 'summary' },
    rangeFrom: { type: String, required: true, maxlength: 10 },
    rangeTo: { type: String, required: true, maxlength: 10 },
    generatedByName: { type: String, required: true, trim: true, maxlength: 120 },
    csvEnc: { type: String, required: true },
  },
  { timestamps: true },
);

// Tenant-scoped, newest first — the only way this is ever read.
savedReportSchema.index({ doctorUserId: 1, createdAt: -1 });

encryptedFields(savedReportSchema, ['csvEnc']);

export const SavedReport = model<ISavedReport>('SavedReport', savedReportSchema);
