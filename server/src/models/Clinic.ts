import { Schema, model } from 'mongoose';

/**
 * A clinic (business/organisation) that groups multiple doctors.
 *
 * Unlike every doctor-domain document, a Clinic is NOT scoped by doctorUserId —
 * it is a platform-level org that several independent doctor accounts belong to
 * (via DoctorProfile.clinicId). This is the "Private per doctor" multi-doctor
 * model (owner decision, 2026): the clinic is only a grouping + shared branding;
 * each doctor keeps their own private tenancy, so a clinic's doctors never share
 * patients, prescriptions or consultations. No PHI lives here — a clinic's name,
 * address and phone are business details.
 */
export interface IClinic {
  name: string;
  address?: string;
  phone?: string;
  city?: string;
  createdAt: Date;
  updatedAt: Date;
}

const clinicSchema = new Schema<IClinic>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    address: { type: String, trim: true, maxlength: 300 },
    phone: { type: String, trim: true, maxlength: 20 },
    city: { type: String, trim: true, maxlength: 80 },
  },
  { timestamps: true },
);

export const Clinic = model<IClinic>('Clinic', clinicSchema);
