// Pure schedule data + derivations. No database access here so it can be unit
// tested and reused by the reminder job (step 4) and the chat context builder.
import scheduleData from '../data/iap-schedule.json' with { type: 'json' };

export type Sex = 'male' | 'female';
export type DoseStatus = 'done' | 'upcoming' | 'due' | 'overdue';

export interface ScheduleEntry {
  id: string;
  vaccine: string;
  doseLabel: string;
  series: string;
  dueDay: number;
  windowStartDay: number;
  windowEndDay: number;
  protectsAgainst: string;
  applicableTo: 'all' | 'male' | 'female';
  notes: string;
}

interface RawEntry {
  id: string;
  vaccine: string;
  dose_label: string;
  series: string;
  due_day: number;
  window_start_day: number;
  window_end_day: number;
  protects_against: string;
  applicable_to: string;
  notes: string;
}

const MS_PER_DAY = 86_400_000;

export const scheduleEntries: ScheduleEntry[] = (scheduleData.vaccines as RawEntry[]).map((v) => ({
  id: v.id,
  vaccine: v.vaccine,
  doseLabel: v.dose_label,
  series: v.series,
  dueDay: v.due_day,
  windowStartDay: v.window_start_day,
  windowEndDay: v.window_end_day,
  protectsAgainst: v.protects_against,
  applicableTo: v.applicable_to === 'male' || v.applicable_to === 'female' ? v.applicable_to : 'all',
  notes: v.notes,
}));

export const scheduleById: Map<string, ScheduleEntry> = new Map(
  scheduleEntries.map((e) => [e.id, e]),
);

/** Entries that apply to a baby of the given sex (sex-specific doses, e.g. HPV, are filtered out). */
export function applicableEntries(sex: Sex): ScheduleEntry[] {
  return scheduleEntries.filter((e) => e.applicableTo === 'all' || e.applicableTo === sex);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** Whole days between two UTC-midnight dates (later - earlier). */
export function daysBetween(earlier: Date, later: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / MS_PER_DAY);
}

/**
 * The current calendar day in Asia/Kolkata, as a UTC-midnight Date. DOBs are
 * stored as UTC midnight of the IST calendar date the parent picked, so this
 * keeps due/overdue comparisons aligned to the parent's local day.
 */
export function istToday(now: Date = new Date()): Date {
  const istDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return new Date(`${istDate}T00:00:00.000Z`);
}

export function doseStatus(
  dose: { administeredOn: Date | null; windowStart: Date; windowEnd: Date },
  today: Date = istToday(),
): DoseStatus {
  if (dose.administeredOn) return 'done';
  if (today.getTime() < dose.windowStart.getTime()) return 'upcoming';
  if (today.getTime() > dose.windowEnd.getTime()) return 'overdue';
  return 'due';
}

/** Human age label for a days-after-birth offset, used to group the UI by visit age. */
export function ageLabelForOffsetDays(days: number): string {
  if (days <= 0) return 'At birth';
  if (days < 180) return `${Math.round(days / 7)} weeks`;
  if (days < 730) return `${Math.round(days / 30.44)} months`;
  return `${Math.round(days / 365.25)} years`;
}

/**
 * Remove internal pediatrician-review markers (e.g. "PEDIATRICIAN: verify.")
 * from a note so only parent-facing guidance is surfaced.
 */
export function sanitizeNote(notes: string): string {
  return notes
    .split(/(?<=\.)\s+/)
    .filter((part) => !/pediatrician/i.test(part))
    .join(' ')
    .trim();
}
