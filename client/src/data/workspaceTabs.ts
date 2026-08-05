/**
 * Patient Workspace tab data for PT-0002485 / Myra Kapoor (Clinic OS specs 16–22).
 *
 * ⚠ PLACEHOLDER DATA — not wired to the API yet.
 *
 * Several specs deliberately carry figures that do NOT derive from their own
 * lists. Each is stored as its own field, with the derivation noted, so the
 * discrepancy is visible and fixable in one place rather than silently "fixed":
 *   • notes.categoryCounts   — says 2 Clinical / 0 Observation; the list has 1 / 1.
 *   • prescription.totalDays — says 13; the four durations sum to 23.
 *   • documents.typeBreakdown — collapses Report + Notes into "Others = 1"; it is 2.
 *   • growthRecords[].age    — "2y 11m" at 12 May 2025 vs a 12 Jan 2023 DOB (2y 4m).
 */

// ── 16 · Medical History ─────────────────────────────────────────────────────

export interface HistoryCategory {
  id: string;
  label: string;
  icon: string;
  count: number;
}

/** "All Records" is the sum of the rest — derived, never authored. */
export const HISTORY_CATEGORIES: HistoryCategory[] = [
  { id: 'birth', label: 'Birth & Neonatal', icon: 'Baby', count: 4 },
  { id: 'immunizations', label: 'Immunizations', icon: 'Syringe', count: 12 },
  { id: 'allergies', label: 'Allergies', icon: 'Droplet', count: 2 },
  { id: 'chronic', label: 'Chronic Conditions', icon: 'ClipboardList', count: 1 },
  { id: 'surgeries', label: 'Surgeries', icon: 'Scissors', count: 0 },
  { id: 'family', label: 'Family History', icon: 'Users', count: 2 },
  { id: 'medications', label: 'Medications', icon: 'Pill', count: 3 },
];
export const HISTORY_TOTAL = HISTORY_CATEGORIES.reduce((t, c) => t + c.count, 0); // 24

export interface HistoryEntry {
  category: string;
  title: string;
  detail: string;
  author: string;
  date: string;
  time: string;
  tint: string;
  fg: string;
  icon: string;
}

/**
 * Entries 2 and 3 are out of chronological order (10:00 AM above 10:05 AM)
 * despite the "Newest First" sort. Reproduced from the reference — render the
 * array order, never sort on load.
 */
export const HISTORY_ENTRIES: HistoryEntry[] = [
  { category: 'immunizations', title: 'Immunization', detail: 'DTaP, Hib, IPV, Hep B, PCV13', author: 'Dr. Ananya Sharma', date: '12 May 2025', time: '10:30 AM', tint: '#DCF7E6', fg: '#12A150', icon: 'Syringe' },
  { category: 'visits', title: 'Visit & Consultation', detail: 'Fever & Cough', author: 'Dr. Ananya Sharma', date: '12 May 2025', time: '10:00 AM', tint: '#E4EBFD', fg: '#2B6FF0', icon: 'Stethoscope' },
  { category: 'growth', title: 'Growth Measurement', detail: 'Weight: 14.2 kg, Height: 92 cm', author: 'Nurse Priya', date: '12 May 2025', time: '10:05 AM', tint: '#E4EBFD', fg: '#2B6FF0', icon: 'Ruler' },
  { category: 'immunizations', title: 'Immunization', detail: 'Rotavirus Vaccine (Dose 3)', author: 'Dr. Ananya Sharma', date: '18 Mar 2025', time: '11:20 AM', tint: '#DCF7E6', fg: '#12A150', icon: 'Syringe' },
  { category: 'allergies', title: 'Allergy Recorded', detail: 'No known allergies', author: 'Dr. Ananya Sharma', date: '18 Mar 2025', time: '11:15 AM', tint: '#FDECD3', fg: '#F59E0B', icon: 'AlertTriangle' },
];

export const IMMUNIZATION_SUMMARY = [
  { label: 'Completed', color: '#12A150', value: 12 },
  { label: 'Due Soon', color: '#2B6FF0', value: 1 },
  { label: 'Pending', color: '#CBD5E1', value: 1 },
];

export const MINI_DOCUMENTS = [
  { name: 'Birth Certificate', meta: 'PDF • 245 KB', ext: 'PDF', tint: '#FDE2E2', fg: '#E03131' },
  { name: 'Immunization Record', meta: 'PDF • 512 KB', ext: 'PDF', tint: '#DCF7E6', fg: '#12A150' },
  { name: 'Previous Reports', meta: 'PDF • 1.2 MB', ext: 'PDF', tint: '#E4EBFD', fg: '#2B6FF0' },
];

// ── 17 · Visits & Consultations ──────────────────────────────────────────────

export interface Visit {
  date: string;
  time: string;
  type: string;
  subLabel: string;
  diagnosis: string;
  secondary: string;
  followUpDate: string | null;
  followUpTime: string | null;
  tint: string;
  fg: string;
  icon: string;
}

/** Not in date order — rows 2/3 and 4/5 are inverted. Render as given. */
export const VISITS: Visit[] = [
  { date: '12 May 2025', time: '10:00 AM', type: 'Fever & Cough', subLabel: 'Consultation', diagnosis: 'Viral Fever', secondary: 'ICD-10: B34.9', followUpDate: '14 May 2025', followUpTime: '11:00 AM', tint: '#E4EBFD', fg: '#2B6FF0', icon: 'Stethoscope' },
  { date: '15 Apr 2025', time: '11:30 AM', type: 'Well Baby Checkup', subLabel: 'Routine Checkup', diagnosis: 'Normal', secondary: 'Healthy', followUpDate: null, followUpTime: null, tint: '#E4EBFD', fg: '#2B6FF0', icon: 'Ruler' },
  { date: '28 Apr 2025', time: '10:00 AM', type: 'General Consultation', subLabel: 'Consultation', diagnosis: 'Acute Bronchitis', secondary: 'ICD-10: J20.9', followUpDate: '01 May 2025', followUpTime: '10:30 AM', tint: '#FDECD3', fg: '#F59E0B', icon: 'Wind' },
  { date: '18 Mar 2025', time: '11:20 AM', type: 'Vaccination', subLabel: 'Immunization', diagnosis: 'Rotavirus Vaccine', secondary: 'Dose 3', followUpDate: null, followUpTime: null, tint: '#DCF7E6', fg: '#12A150', icon: 'Syringe' },
  { date: '01 Apr 2025', time: '11:00 AM', type: 'General Consultation', subLabel: 'Consultation', diagnosis: 'Loose Motions', secondary: 'ICD-10: R19.7', followUpDate: '03 Apr 2025', followUpTime: '10:00 AM', tint: '#E4EBFD', fg: '#2B6FF0', icon: 'Ruler' },
  { date: '10 Mar 2025', time: '09:30 AM', type: 'Allergy Consultation', subLabel: 'Consultation', diagnosis: 'Dust Allergy', secondary: 'ICD-10: J30.89', followUpDate: '25 Mar 2025', followUpTime: '11:00 AM', tint: '#FDECD3', fg: '#F59E0B', icon: 'AlertTriangle' },
  { date: '12 Feb 2025', time: '04:00 PM', type: 'Tele Consultation', subLabel: 'Video Visit', diagnosis: 'Cold & Cough', secondary: 'ICD-10: J06.9', followUpDate: '15 Feb 2025', followUpTime: '04:30 PM', tint: '#E4EBFD', fg: '#2B6FF0', icon: 'PhoneCall' },
];

export const RECENT_PRESCRIPTIONS = [
  { name: 'Paracetamol 250 mg / 5 ml', regimen: 'Syrup • 5 ml • TID', date: '12 May 2025', tint: '#DCF7E6', fg: '#12A150' },
  { name: 'Cetirizine 2.5 mg / 5 ml', regimen: 'Syrup • 2.5 ml • OD', date: '28 Apr 2025', tint: '#FDE2E2', fg: '#EF4444' },
  { name: 'Salbutamol 2 mg / 5 ml', regimen: 'Syrup • 2.5 ml • TID', date: '01 Apr 2025', tint: '#E4EBFD', fg: '#2B6FF0' },
];

// ── 18 · Growth Charts ───────────────────────────────────────────────────────

export const WS_GROWTH_MONTHS = ["May '24", "Jun '24", "Jul '24", "Aug '24", "Sep '24", "Oct '24", "Nov '24", "Dec '24", "Jan '25", "Feb '25", "Mar '25", "Apr '25", "May '25"];

export type WsMetric = 'Weight' | 'Height' | 'BMI' | 'Head Circumference';
export type WsBand = 'p97' | 'p85' | 'p50' | 'p15' | 'p3';

export interface WsSeries {
  /** '' for BMI, which is dimensionless. */
  unit: string;
  /** First and last double as the y-axis domain. */
  ticks: number[];
  patient: number[];
  /** Right-edge label for each percentile curve, unit included. */
  ends: Record<WsBand, string>;
  badge: string;
}

export const WS_GROWTH_SERIES: Record<WsMetric, WsSeries> = {
  Weight: {
    unit: 'kg', ticks: [4, 6, 8, 10, 12, 14, 16],
    patient: [8.6, 9.1, 9.6, 10.1, 10.6, 11.1, 11.6, 12.1, 12.6, 13.0, 13.4, 13.8, 14.2],
    ends: { p97: '15.0 kg', p85: '12.8 kg', p50: '10.6 kg', p15: '8.2 kg', p3: '6.1 kg' },
    badge: '14.2 kg',
  },
  Height: {
    unit: 'cm', ticks: [70, 76, 82, 88, 94, 100],
    patient: [79, 80.2, 81.4, 82.6, 83.8, 85, 86.2, 87.4, 88.4, 89.4, 90.4, 91.2, 92],
    ends: { p97: '99.0 cm', p85: '95.4 cm', p50: '91.2 cm', p15: '87.0 cm', p3: '83.4 cm' },
    badge: '92 cm',
  },
  BMI: {
    // 19, not 18 — the 97th-percentile band tops out at 18.4 and would otherwise
    // be clipped outside the axis domain. Same reason for 52 on head circumference.
    unit: '', ticks: [13, 14, 15, 16, 17, 18, 19],
    patient: [15.1, 15.3, 15.4, 15.6, 15.7, 15.9, 16.0, 16.2, 16.3, 16.4, 16.5, 16.7, 16.8],
    ends: { p97: '18.4', p85: '17.2', p50: '16.0', p15: '14.8', p3: '13.6' },
    badge: '16.8',
  },
  'Head Circumference': {
    unit: 'cm', ticks: [42, 44, 46, 48, 50, 52],
    patient: [45.2, 45.5, 45.8, 46.1, 46.4, 46.7, 47.0, 47.3, 47.5, 47.7, 47.9, 48.1, 48.3],
    ends: { p97: '50.6 cm', p85: '49.4 cm', p50: '48.1 cm', p15: '46.8 cm', p3: '45.6 cm' },
    badge: '48.3 cm',
  },
};

/** Percentile bands, sampled across the same 13 months. */
export const WS_CURVES: Record<WsMetric, Record<WsBand, number[]>> = {
  Weight: {
    p97: [11.4, 11.7, 12.0, 12.3, 12.6, 12.9, 13.2, 13.5, 13.8, 14.1, 14.4, 14.7, 15.0],
    p85: [9.8, 10.05, 10.3, 10.55, 10.8, 11.05, 11.3, 11.55, 11.8, 12.05, 12.3, 12.55, 12.8],
    p50: [8.2, 8.4, 8.6, 8.8, 9.0, 9.2, 9.4, 9.6, 9.8, 10.0, 10.2, 10.4, 10.6],
    p15: [6.6, 6.73, 6.87, 7.0, 7.13, 7.27, 7.4, 7.53, 7.67, 7.8, 7.93, 8.07, 8.2],
    p3: [5.1, 5.18, 5.27, 5.35, 5.43, 5.52, 5.6, 5.68, 5.77, 5.85, 5.93, 6.02, 6.1],
  },
  Height: {
    p97: [87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99],
    p85: [83.8, 84.8, 85.7, 86.7, 87.6, 88.6, 89.5, 90.5, 91.4, 92.4, 93.3, 94.3, 95.4],
    p50: [79.2, 80.2, 81.2, 82.2, 83.2, 84.2, 85.2, 86.2, 87.2, 88.2, 89.2, 90.2, 91.2],
    p15: [75.0, 76.0, 77.0, 78.0, 79.0, 80.0, 81.0, 82.0, 83.0, 84.0, 85.0, 86.0, 87.0],
    p3: [71.4, 72.4, 73.4, 74.4, 75.4, 76.4, 77.4, 78.4, 79.4, 80.4, 81.4, 82.4, 83.4],
  },
  BMI: {
    p97: [18.4, 18.4, 18.4, 18.4, 18.4, 18.4, 18.4, 18.4, 18.4, 18.4, 18.4, 18.4, 18.4],
    p85: [17.2, 17.2, 17.2, 17.2, 17.2, 17.2, 17.2, 17.2, 17.2, 17.2, 17.2, 17.2, 17.2],
    p50: [16.0, 16.0, 16.0, 16.0, 16.0, 16.0, 16.0, 16.0, 16.0, 16.0, 16.0, 16.0, 16.0],
    p15: [14.8, 14.8, 14.8, 14.8, 14.8, 14.8, 14.8, 14.8, 14.8, 14.8, 14.8, 14.8, 14.8],
    p3: [13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6],
  },
  'Head Circumference': {
    p97: [48.2, 48.4, 48.6, 48.8, 49.0, 49.2, 49.4, 49.6, 49.8, 50.0, 50.2, 50.4, 50.6],
    p85: [47.2, 47.4, 47.6, 47.8, 48.0, 48.1, 48.3, 48.5, 48.7, 48.9, 49.0, 49.2, 49.4],
    p50: [46.0, 46.2, 46.4, 46.6, 46.8, 46.9, 47.1, 47.3, 47.4, 47.6, 47.8, 47.9, 48.1],
    p15: [44.8, 45.0, 45.2, 45.4, 45.5, 45.7, 45.9, 46.0, 46.2, 46.4, 46.5, 46.7, 46.8],
    p3: [43.6, 43.8, 44.0, 44.2, 44.3, 44.5, 44.7, 44.8, 45.0, 45.2, 45.3, 45.5, 45.6],
  },
};

export const WS_CURVE_META: { key: WsBand; label: string; color: string }[] = [
  { key: 'p97', label: '97th percentile', color: '#12A150' },
  { key: 'p85', label: '85th percentile', color: '#12A150' },
  { key: 'p50', label: '50th percentile', color: '#2B6FF0' },
  { key: 'p15', label: '15th percentile', color: '#F59E0B' },
  { key: 'p3', label: '3rd percentile', color: '#EF4444' },
];

/** `age` is stored, never computed — see the file header. */
export const GROWTH_RECORDS = [
  { date: '12 May 2025', age: '2y 11m', weight: 14.2, height: 92, bmi: 16.8, head: 48.3, by: 'Dr. Ananya Sharma' },
  { date: '18 Mar 2025', age: '2y 9m', weight: 13.1, height: 89, bmi: 16.5, head: 47.6, by: 'Dr. Ananya Sharma' },
  { date: '01 Feb 2025', age: '2y 7m', weight: 12.4, height: 87, bmi: 16.4, head: 46.8, by: 'Dr. Ananya Sharma' },
  { date: '28 Dec 2024', age: '2y 6m', weight: 11.2, height: 85, bmi: 15.5, head: 46.1, by: 'Dr. Ananya Sharma' },
  { date: '12 Nov 2024', age: '2y 5m', weight: 10.3, height: 83, bmi: 15.0, head: 45.5, by: 'Dr. Ananya Sharma' },
];

export const GROWTH_SUMMARY_ROWS = [
  { metric: 'Weight', detail: '14.2 kg (62nd percentile)', tint: '#E4EBFD', fg: '#2B6FF0', icon: 'Scale' },
  { metric: 'Height', detail: '92 cm (58th percentile)', tint: '#E4EBFD', fg: '#2B6FF0', icon: 'Ruler' },
  { metric: 'BMI', detail: '16.8 (61st percentile)', tint: '#FDECD3', fg: '#F59E0B', icon: 'FileText' },
  { metric: 'Head Circumference', detail: '48.3 cm (54th percentile)', tint: '#FDE2E2', fg: '#EF4444', icon: 'FileText' },
];

export const MILESTONES = [
  { text: 'Uses 2–4 word sentences', on: 'Achieved on 20 Feb 2025' },
  { text: 'Climbs stairs with alternating feet', on: 'Achieved on 10 Feb 2025' },
  { text: 'Turns pages one at a time', on: 'Achieved on 05 Jan 2025' },
];

export const GROWTH_TIPS = [
  'Ensure a balanced diet with proteins, calcium, and iron.',
  'Encourage outdoor play for at least 1 hour daily.',
  'Regular sleep (10–12 hours) is important for healthy growth.',
];

// ── 19 · Documents ───────────────────────────────────────────────────────────

export interface PatientDocument {
  name: string;
  sub: string;
  ext: 'PDF' | 'JPG' | 'DOCX';
  badgeTint: string;
  badgeFg: string;
  type: string;
  by: string;
  date: string;
  time: string;
  size: string;
}

export const DOC_TYPE_STYLE: Record<string, { bg: string; fg: string }> = {
  Identity: { bg: '#EAF0FE', fg: '#2B6FF0' },
  'Medical Record': { bg: '#DCF7E6', fg: '#12A150' },
  Report: { bg: '#E4EBFD', fg: '#2B6FF0' },
  'Lab Report': { bg: '#FDECD3', fg: '#E8890B' },
  Prescription: { bg: '#FDE2E2', fg: '#E03131' },
  Notes: { bg: '#EAF0FE', fg: '#2B6FF0' },
};

export const DOCUMENTS: PatientDocument[] = [
  { name: 'Birth Certificate', sub: 'Verified copy', ext: 'PDF', badgeTint: '#FDE2E2', badgeFg: '#E03131', type: 'Identity', by: 'Dr. Ananya Sharma', date: '12 May 2025', time: '09:15 AM', size: '245 KB' },
  { name: 'Immunization Record', sub: 'Page 1', ext: 'JPG', badgeTint: '#DCF7E6', badgeFg: '#12A150', type: 'Medical Record', by: 'Nurse Priya', date: '12 May 2025', time: '09:16 AM', size: '512 KB' },
  { name: 'Growth Chart (0-2 Years)', sub: 'WHO Standard', ext: 'PDF', badgeTint: '#FDE2E2', badgeFg: '#E03131', type: 'Report', by: 'Dr. Ananya Sharma', date: '12 May 2025', time: '09:18 AM', size: '320 KB' },
  { name: 'Blood Test Report', sub: 'CBC, 10 May 2025', ext: 'PDF', badgeTint: '#E4EBFD', badgeFg: '#2B6FF0', type: 'Lab Report', by: 'PathCare Labs', date: '10 May 2025', time: '02:30 PM', size: '1.2 MB' },
  { name: 'Prescription - 10 May 2025', sub: 'Fever & Cough', ext: 'JPG', badgeTint: '#E4EBFD', badgeFg: '#2B6FF0', type: 'Prescription', by: 'Dr. Ananya Sharma', date: '10 May 2025', time: '11:45 AM', size: '180 KB' },
  { name: 'Allergy Test Report', sub: 'Dust Allergy', ext: 'PDF', badgeTint: '#FDE2E2', badgeFg: '#E03131', type: 'Lab Report', by: 'PathCare Labs', date: '28 Apr 2025', time: '10:20 AM', size: '980 KB' },
  { name: 'Consultation Notes', sub: '28 Apr 2025', ext: 'DOCX', badgeTint: '#FDECD3', badgeFg: '#E8890B', type: 'Notes', by: 'Dr. Ananya Sharma', date: '28 Apr 2025', time: '10:25 AM', size: '64 KB' },
];

/** Stored, not derived — "Others" is 1 here but Report + Notes is 2. */
export const DOC_TYPE_BREAKDOWN = [
  { label: 'Medical Record', color: '#12A150', count: 2, pct: 29 },
  { label: 'Lab Report', color: '#F59E0B', count: 2, pct: 29 },
  { label: 'Prescription', color: '#EF4444', count: 1, pct: 14 },
  { label: 'Identity', color: '#8B5CF6', count: 1, pct: 14 },
  { label: 'Others', color: '#CBD5E1', count: 1, pct: 14 },
];

// ── 20 · Prescription Details ────────────────────────────────────────────────

export const PRESCRIPTION = {
  id: 'RX-0001567',
  visitDate: '12 May 2025, 10:00 AM',
  doctor: 'Dr. Ananya Sharma',
  role: 'Paediatrician',
  diagnosis: 'Fever & Cough',
  diagnosisSub: 'Viral Fever',
  createdOn: 'Created on 12 May 2025, 10:00 AM',
  medicineCount: 4,
  /** Stored. The four durations below sum to 23, not 13. */
  totalDays: 13,
  notes: 'Plenty of fluids, warm water, steam inhalation. Avoid cold & junk food.',
  medications: [
    { name: 'Paracetamol Syrup', code: '(T-98)', tint: '#E4EBFD', fg: '#2B6FF0', strength: '250 mg / 5 ml', dosage: '5 ml', frequency: '3 times a day', duration: '3 days', instructions: 'After food' },
    { name: 'Cetirizine Syrup', code: '(CTZ-10)', tint: '#FDE2E2', fg: '#EF4444', strength: '2.5 mg / 5 ml', dosage: '2.5 ml', frequency: 'Once a day (Night)', duration: '5 days', instructions: 'After food' },
    { name: 'Salbutamol Syrup', code: '(SBT-2)', tint: '#E4EBFD', fg: '#2B6FF0', strength: '2 mg / 5 ml', dosage: '2.5 ml', frequency: '2 times a day', duration: '5 days', instructions: 'After food' },
    { name: 'Zincovit Drops', code: '(ZV-D)', tint: '#DCF7E6', fg: '#12A150', strength: null, dosage: '1 ml', frequency: 'Once a day', duration: '10 days', instructions: 'After food' },
  ],
  reminders: [
    { name: 'Paracetamol Syrup', when: 'Today, 2:00 PM', tint: '#E4EBFD', fg: '#2B6FF0' },
    { name: 'Salbutamol Syrup', when: 'Today, 2:00 PM', tint: '#E4EBFD', fg: '#2B6FF0' },
    { name: 'Cetirizine Syrup', when: 'Today, 9:00 PM', tint: '#FDE2E2', fg: '#EF4444' },
  ],
  history: [
    { date: '10 Apr 2025', reason: 'Cold & Cough' },
    { date: '28 Mar 2025', reason: 'Fever' },
  ],
};

// ── 21 · Patient Invoices ────────────────────────────────────────────────────

export interface PatientInvoice {
  id: string;
  date: string;
  type: 'Consultation' | 'Lab Test' | 'Vaccination' | 'Pharmacy';
  amount: number;
  status: 'Paid';
  dueDate: string;
}

export const INVOICE_TYPE_STYLE: Record<string, { bg: string; fg: string; icon: string }> = {
  Consultation: { bg: '#EEF1FE', fg: '#4F46E5', icon: 'Stethoscope' },
  'Lab Test': { bg: '#DCF7E6', fg: '#12A150', icon: 'TestTube' },
  Vaccination: { bg: '#FDECD3', fg: '#F59E0B', icon: 'Syringe' },
  Pharmacy: { bg: '#E4EBFD', fg: '#2B6FF0', icon: 'Pill' },
};

export const PATIENT_INVOICES: PatientInvoice[] = [
  { id: 'INV-000124', date: '12 May 2025', type: 'Consultation', amount: 600, status: 'Paid', dueDate: '12 May 2025' },
  { id: 'INV-000118', date: '15 Apr 2025', type: 'Lab Test', amount: 1250, status: 'Paid', dueDate: '15 Apr 2025' },
  { id: 'INV-000109', date: '01 Apr 2025', type: 'Consultation', amount: 600, status: 'Paid', dueDate: '01 Apr 2025' },
  { id: 'INV-000101', date: '18 Mar 2025', type: 'Vaccination', amount: 1800, status: 'Paid', dueDate: '18 Mar 2025' },
  { id: 'INV-000094', date: '12 Mar 2025', type: 'Pharmacy', amount: 450, status: 'Paid', dueDate: '12 Mar 2025' },
  { id: 'INV-000087', date: '28 Feb 2025', type: 'Consultation', amount: 600, status: 'Paid', dueDate: '28 Feb 2025' },
  { id: 'INV-000079', date: '12 Feb 2025', type: 'Lab Test', amount: 900, status: 'Paid', dueDate: '12 Feb 2025' },
];
/** ₹6,200.00 — derived, so the rail can never drift from the table. */
export const PATIENT_INVOICE_TOTAL = PATIENT_INVOICES.reduce((t, i) => t + i.amount, 0);

export const RECENT_PAYMENTS = PATIENT_INVOICES.slice(0, 3);

// ── 22 · Notes ───────────────────────────────────────────────────────────────

export interface PatientNote {
  date: string;
  time: string;
  author: string;
  category: string;
  text: string;
  pinned: boolean;
  tint: string;
  fg: string;
  icon: string;
}

export const NOTE_CATEGORY_STYLE: Record<string, { bg: string; fg: string }> = {
  'Clinical Note': { bg: '#EDE9FE', fg: '#6D28D9' },
  'General Note': { bg: '#E4EBFD', fg: '#2B6FF0' },
  'Follow-up Note': { bg: '#DCF7E6', fg: '#12A150' },
  'Treatment Note': { bg: '#DCF7E6', fg: '#12A150' },
  Observation: { bg: '#EAF0FE', fg: '#2B6FF0' },
};

export const NOTES: PatientNote[] = [
  { date: '12 May 2025', time: '10:20 AM', author: 'Dr. Ananya Sharma', category: 'Clinical Note', pinned: true, tint: '#FDECD3', fg: '#E8890B', icon: 'Pin', text: 'Child presented with fever and mild cough since 2 days. No breathing difficulty. Advised paracetamol as needed, and plenty of fluids. Review in 2 days if symptoms persist.' },
  { date: '15 Apr 2025', time: '11:45 AM', author: 'Dr. Ananya Sharma', category: 'General Note', pinned: false, tint: '#E4EBFD', fg: '#2B6FF0', icon: 'MessageSquare', text: 'Follow-up after well baby checkup. Growth and development on track.' },
  { date: '01 Apr 2025', time: '09:30 AM', author: 'Nurse Priya', category: 'Follow-up Note', pinned: false, tint: '#DCF7E6', fg: '#12A150', icon: 'FileText', text: 'Vaccination given: Rotavirus Dose 3. No adverse reactions observed.' },
  { date: '18 Mar 2025', time: '10:15 AM', author: 'Dr. Ananya Sharma', category: 'Treatment Note', pinned: false, tint: '#EDE9FE', fg: '#6D28D9', icon: 'FlaskConical', text: 'Prescribed saline nasal drops and steam inhalation for cold & congestion.' },
  { date: '12 Feb 2025', time: '04:05 PM', author: 'Dr. Ananya Sharma', category: 'Observation', pinned: false, tint: '#EAF0FE', fg: '#2B6FF0', icon: 'FileText', text: 'Appetite normal. Sleep pattern good. No concerns from parent.' },
];

/** Stored separately — the reference's donut does not match the list above. */
export const NOTE_CATEGORY_COUNTS = [
  { label: 'Clinical Note', color: '#8B5CF6', count: 2, pct: 40 },
  { label: 'General Note', color: '#2B6FF0', count: 1, pct: 20 },
  { label: 'Follow-up Note', color: '#12A150', count: 1, pct: 20 },
  { label: 'Treatment Note', color: '#EF4444', count: 1, pct: 20 },
  { label: 'Observation', color: '#94A3B8', count: 0, pct: 0 },
];

export const NOTES_THIS_MONTH = 2;
