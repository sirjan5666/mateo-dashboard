// Seed a rich, realistic EHR dataset for the demo doctor so every dashboard is
// populated (KPIs, weekly chart, today's schedule, roster, status mix, portal).
// Idempotent: clears this doctor's existing EHR data, then recreates a fresh set.
//   npx tsx src/scripts/seed-ehr-demo.ts
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { seedGlobalTemplates } from '../records/seedGlobalTemplates.js';
import { writePatientRecord } from '../records/writePatientRecord.js';
import { User } from '../models/User.js';
import { Patient } from '../models/Patient.js';
import { PatientRecord } from '../models/PatientRecord.js';
import { Encounter } from '../models/Encounter.js';
import { DoctorAppointment } from '../models/DoctorAppointment.js';
import { DoctorPrescription } from '../models/DoctorPrescription.js';
import { ConsentRecord } from '../models/ConsentRecord.js';
import { SpecialtyTemplate } from '../models/SpecialtyTemplate.js';

const DOCTOR_EMAIL = 'docphone@example.com';
const PORTAL_EMAIL = 'aarav.portal@example.com';
const DAY = 86_400_000;
const HOUR = 3_600_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const ahead = (ms: number) => new Date(Date.now() + ms);

interface EncSpec { d: number; kind: 'visit' | 'follow_up' | 'phone' | 'procedure' | 'note'; s?: string; o?: string; a?: string; p?: string }
interface ApptSpec { at: Date; dur: number; mode: 'in_person' | 'phone' | 'video'; status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'; reason?: string }
interface RxSpec { drug: string; dose?: string; frequency?: string; duration?: string; instructions?: string; status?: 'active' | 'completed' | 'stopped' }
interface Spec {
  t: 'general' | 'pediatrics' | 'dermatology';
  name: string;
  dob: string;
  sex: 'male' | 'female' | 'other' | 'unspecified';
  phone: string;
  status: string;
  tags: string[];
  fields: Record<string, unknown>;
  enc: EncSpec[];
  appt: ApptSpec[];
  rx: RxSpec[];
  portal?: boolean;
}

const SPECS: Spec[] = [
  {
    t: 'pediatrics', name: 'Aarav Mehta', dob: '2025-11-02', sex: 'male', phone: '9812345670', status: 'active', tags: ['preterm'],
    fields: { chief_complaint: 'Routine check-up', weight_kg: 7.4, height_cm: 68, immunization_status: 'up_to_date', allergies: 'None known', developmental_notes: 'Sitting with support, babbling.' },
    enc: [{ d: 0, kind: 'visit', s: 'Mild cough, feeding well', o: 'Temp 37.1C, chest clear', a: 'Viral URI', p: 'Fluids, review if worse' }, { d: 12, kind: 'follow_up', s: 'Routine', o: 'Growth on track', a: 'Well baby', p: 'Continue feeds' }],
    appt: [{ at: ahead(2 * HOUR), dur: 20, mode: 'in_person', status: 'scheduled', reason: '6-month check-up' }],
    rx: [{ drug: 'Vitamin D drops', dose: '400 IU', frequency: 'Once daily', duration: 'Ongoing', status: 'active' }],
    portal: true,
  },
  {
    t: 'pediatrics', name: 'Diya Sharma', dob: '2023-05-14', sex: 'female', phone: '9801122334', status: 'monitoring', tags: ['asthma', 'food_allergy'],
    fields: { chief_complaint: 'Recurrent wheeze', weight_kg: 12.1, height_cm: 88, immunization_status: 'up_to_date', allergies: 'Peanuts, dust', developmental_notes: 'Speaking in short sentences.' },
    enc: [{ d: 1, kind: 'visit', s: 'Night-time cough, wheeze x3 days', o: 'Mild expiratory wheeze', a: 'Asthma exacerbation (mild)', p: 'Salbutamol PRN, review in 1 week' }],
    appt: [{ at: ahead(1 * DAY + 3 * HOUR), dur: 20, mode: 'in_person', status: 'scheduled', reason: 'Asthma review' }, { at: daysAgo(8), dur: 20, mode: 'in_person', status: 'completed', reason: 'Wheeze' }],
    rx: [{ drug: 'Salbutamol inhaler', dose: '100 mcg', frequency: 'As needed', duration: '1 month', instructions: 'Use spacer', status: 'active' }],
  },
  {
    t: 'general', name: 'Rohan Verma', dob: '1986-03-22', sex: 'male', phone: '9876501234', status: 'follow_up', tags: ['hypertension'],
    fields: { chief_complaint: 'BP review', history: 'Known hypertensive on amlodipine for 2 years.', allergies: 'None', current_medications: 'Amlodipine 5mg OD', bp_systolic: 138, bp_diastolic: 88, notes: 'Advised low-salt diet, daily walk.' },
    enc: [{ d: 2, kind: 'visit', s: 'Feels well, no chest pain', o: 'BP 138/88, pulse 76', a: 'HTN, borderline control', p: 'Continue amlodipine, recheck 2 weeks' }, { d: 16, kind: 'follow_up', s: 'Routine', o: 'BP 142/90', a: 'HTN', p: 'Reinforce lifestyle' }],
    appt: [{ at: ahead(3 * HOUR), dur: 15, mode: 'in_person', status: 'scheduled', reason: 'BP check' }, { at: ahead(2 * DAY), dur: 15, mode: 'phone', status: 'scheduled', reason: 'Report review' }],
    rx: [{ drug: 'Amlodipine', dose: '5 mg', frequency: 'Once daily', duration: 'Ongoing', instructions: 'Morning', status: 'active' }],
  },
  {
    t: 'general', name: 'Meera Iyer', dob: '1992-09-09', sex: 'female', phone: '9933221100', status: 'active', tags: ['diabetes'],
    fields: { chief_complaint: 'Fatigue', history: 'T2DM diagnosed 6 months ago.', allergies: 'Sulfa drugs', current_medications: 'Metformin 500mg BD', bp_systolic: 124, bp_diastolic: 80, notes: 'HbA1c pending.' },
    enc: [{ d: 3, kind: 'visit', s: 'Tired, increased thirst', o: 'Fasting glucose 142', a: 'T2DM, suboptimal control', p: 'Continue metformin, dietitian referral' }],
    appt: [{ at: daysAgo(0.08), dur: 20, mode: 'in_person', status: 'completed', reason: 'Diabetes review' }, { at: ahead(5 * DAY), dur: 20, mode: 'in_person', status: 'scheduled', reason: 'HbA1c results' }],
    rx: [{ drug: 'Metformin', dose: '500 mg', frequency: 'Twice daily', duration: 'Ongoing', instructions: 'After meals', status: 'active' }],
  },
  {
    t: 'dermatology', name: 'Kabir Singh', dob: '2000-12-01', sex: 'male', phone: '9700099000', status: 'clearing', tags: ['acne'],
    fields: { chief_complaint: 'Facial acne', skin_type: 'IV', affected_area: 'Cheeks, forehead', lesion_description: 'Inflammatory papules and comedones.', onset: '2026-03-01T00:00:00.000Z', allergies: 'None', notes: 'Responding to topical therapy.' },
    enc: [{ d: 4, kind: 'follow_up', s: 'Fewer breakouts', o: 'Reduced inflammatory lesions', a: 'Acne vulgaris, improving', p: 'Continue adapalene' }],
    appt: [{ at: ahead(7 * DAY), dur: 15, mode: 'video', status: 'scheduled', reason: 'Acne follow-up' }],
    rx: [{ drug: 'Adapalene gel', dose: '0.1%', frequency: 'Nightly', duration: '3 months', instructions: 'Thin layer, avoid sun', status: 'active' }],
  },
  {
    t: 'dermatology', name: 'Ananya Nair', dob: '1995-07-18', sex: 'female', phone: '9611122233', status: 'maintenance', tags: ['eczema', 'sun_sensitivity'],
    fields: { chief_complaint: 'Dry itchy patches', skin_type: 'III', affected_area: 'Elbows, behind knees', lesion_description: 'Lichenified plaques.', onset: '2026-01-15T00:00:00.000Z', allergies: 'Fragrances', notes: 'Flares with stress.' },
    enc: [{ d: 5, kind: 'visit', s: 'Itch worse this week', o: 'Dry, excoriated plaques', a: 'Atopic eczema flare', p: 'Emollients + short steroid course' }],
    appt: [{ at: daysAgo(6), dur: 15, mode: 'in_person', status: 'completed', reason: 'Eczema' }],
    rx: [{ drug: 'Hydrocortisone 1%', dose: 'Topical', frequency: 'Twice daily', duration: '7 days', instructions: 'Affected areas only', status: 'active' }, { drug: 'Emollient cream', frequency: 'Liberally', duration: 'Ongoing', status: 'active' }],
  },
  {
    t: 'general', name: 'Vikram Rao', dob: '1978-02-11', sex: 'male', phone: '9555544443', status: 'discharged', tags: ['smoker'],
    fields: { chief_complaint: 'Cough resolved', history: 'Acute bronchitis, now resolved.', allergies: 'None', current_medications: 'None', bp_systolic: 130, bp_diastolic: 84, notes: 'Advised smoking cessation.' },
    enc: [{ d: 6, kind: 'visit', s: 'Cough gone', o: 'Chest clear', a: 'Resolved bronchitis', p: 'Discharge, smoking cessation advice' }, { d: 18, kind: 'visit', s: 'Productive cough', o: 'Coarse crackles', a: 'Acute bronchitis', p: 'Rest, fluids' }],
    appt: [{ at: daysAgo(2), dur: 15, mode: 'in_person', status: 'completed', reason: 'Cough review' }],
    rx: [{ drug: 'Azithromycin', dose: '500 mg', frequency: 'Once daily', duration: '3 days', status: 'completed' }],
  },
  {
    t: 'pediatrics', name: 'Ishaan Gupta', dob: '2024-08-30', sex: 'male', phone: '9444433332', status: 'active', tags: ['immunization_delay'],
    fields: { chief_complaint: 'Vaccination catch-up', weight_kg: 9.2, height_cm: 74, immunization_status: 'delayed', allergies: 'None known', developmental_notes: 'Pulling to stand.' },
    enc: [{ d: 0, kind: 'note', s: 'Parent called re: schedule', a: 'Catch-up plan discussed', p: 'Book MMR' }],
    appt: [{ at: daysAgo(1), dur: 15, mode: 'in_person', status: 'no_show', reason: 'Vaccination' }, { at: ahead(3 * DAY), dur: 15, mode: 'in_person', status: 'scheduled', reason: 'Vaccination catch-up' }],
    rx: [],
  },
];

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  await seedGlobalTemplates();

  const doctor = await User.findOne({ email: DOCTOR_EMAIL });
  if (!doctor) throw new Error(`Doctor ${DOCTOR_EMAIL} not found — run seed-user.ts first.`);
  const docId = doctor._id;

  const tpl = {
    general: await SpecialtyTemplate.findOne({ ownerUserId: { $exists: false }, specialization: 'general' }),
    pediatrics: await SpecialtyTemplate.findOne({ ownerUserId: { $exists: false }, specialization: 'pediatrics' }),
    dermatology: await SpecialtyTemplate.findOne({ ownerUserId: { $exists: false }, specialization: 'dermatology' }),
  };
  if (!tpl.general || !tpl.pediatrics || !tpl.dermatology) throw new Error('Global templates missing.');

  // Fresh start: clear this doctor's EHR data.
  await Promise.all([
    PatientRecord.deleteMany({ doctorUserId: docId }),
    Encounter.deleteMany({ doctorUserId: docId }),
    DoctorAppointment.deleteMany({ doctorUserId: docId }),
    DoctorPrescription.deleteMany({ doctorUserId: docId }),
    ConsentRecord.deleteMany({ doctorUserId: docId }),
  ]);
  await Patient.deleteMany({ doctorUserId: docId });

  const portalUser = await User.findOne({ email: PORTAL_EMAIL });

  let nEnc = 0;
  let nAppt = 0;
  let nRx = 0;
  for (const s of SPECS) {
    const template = tpl[s.t];
    if (!template) throw new Error(`Template ${s.t} missing.`);
    const patient = new Patient({
      doctorUserId: docId,
      specialtyTemplateId: template._id,
      displayName: s.name,
      dob: s.dob,
      sex: s.sex,
      phone: s.phone,
      status: s.status,
    });
    if (s.portal && portalUser) patient.patientUserId = portalUser._id;
    await patient.save();

    await writePatientRecord(patient, template, { fields: s.fields, status: s.status, tags: s.tags });

    await ConsentRecord.create([
      { patientId: patient._id, doctorUserId: docId, purpose: 'record_storage', status: 'granted', method: 'in_clinic', policyVersion: 'v1' },
      { patientId: patient._id, doctorUserId: docId, purpose: 'treatment', status: 'granted', method: 'in_clinic', policyVersion: 'v1' },
    ]);

    for (const e of s.enc) {
      await Encounter.create({ doctorUserId: docId, patientId: patient._id, date: daysAgo(e.d), kind: e.kind, subjective: e.s, objective: e.o, assessment: e.a, plan: e.p });
      nEnc += 1;
    }
    for (const a of s.appt) {
      await DoctorAppointment.create({ doctorUserId: docId, patientId: patient._id, start: a.at, durationMin: a.dur, mode: a.mode, status: a.status, reason: a.reason });
      nAppt += 1;
    }
    for (const r of s.rx) {
      await DoctorPrescription.create({ doctorUserId: docId, patientId: patient._id, date: daysAgo(1), drug: r.drug, dose: r.dose, frequency: r.frequency, duration: r.duration, instructions: r.instructions, status: r.status ?? 'active' });
      nRx += 1;
    }
  }

  console.log(`Seeded ${SPECS.length} patients, ${nEnc} encounters, ${nAppt} appointments, ${nRx} prescriptions for ${DOCTOR_EMAIL}.`);
  if (portalUser) console.log(`Portal user ${PORTAL_EMAIL} is bound to "Aarav Mehta".`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
