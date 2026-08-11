/**
 * Vaccination records for PT-0002486 (Clinic OS spec 07).
 *
 * ⚠ PLACEHOLDER DATA — not wired to the API yet.
 *
 * The four overview numbers are DOSE counts, not row counts: 11 vaccine rows
 * account for 23 doses. Each row therefore declares how many of its doses are
 * given / still due / overdue, and the panel sums those — so the header, the tab
 * labels and the table can never disagree.
 *
 * Two rows are worth reading twice:
 *  • MR is "1 of 2" and Completed, yet still carries a Next Due — dose 1 is
 *    given, dose 2 is counted as upcoming.
 *  • Hepatitis A shows "2 of 2" with no Given On date but an Overdue status.
 *    Reproduced from the reference; its 2 doses count as given and the row
 *    contributes the single overdue entry.
 */

export type VaccinationStatus = 'completed' | 'upcoming' | 'overdue';

export interface VaccinationRecord {
  vaccine: string;
  /** null renders an em dash (Influenza carries no dose count). */
  dose: string | null;
  dueDate: string;
  givenOn: string | null;
  ageAtDose: string;
  status: VaccinationStatus;
  nextDue: { date: string; age: string } | null;
  pill: { bg: string; fg: string };
  // Dose accounting — summed for the overview panel and tab counts.
  dosesGiven: number;
  dosesUpcoming: number;
  dosesOverdue: number;
}

export const VACCINATIONS: VaccinationRecord[] = [
  {
    vaccine: 'BCG',
    dose: '1 of 1',
    dueDate: 'At Birth',
    givenOn: '12 Jan 2021',
    ageAtDose: 'At Birth',
    status: 'completed',
    nextDue: null,
    pill: { bg: '#DCF5E9', fg: '#0E7A55' },
    dosesGiven: 1,
    dosesUpcoming: 0,
    dosesOverdue: 0,
  },
  {
    vaccine: 'Hepatitis B',
    dose: '3 of 3',
    dueDate: '12 Jan 2021',
    givenOn: '12 Jan 2021',
    ageAtDose: 'At Birth',
    status: 'completed',
    nextDue: null,
    pill: { bg: '#DCF5EE', fg: '#0E7A6B' },
    dosesGiven: 3,
    dosesUpcoming: 0,
    dosesOverdue: 0,
  },
  {
    vaccine: 'Pentavalent (DPT + HepB + Hib)',
    dose: '3 of 3',
    dueDate: '12 Apr 2021',
    givenOn: '10 Apr 2021',
    ageAtDose: '3m 29d',
    status: 'completed',
    nextDue: null,
    pill: { bg: '#DDEBFC', fg: '#1D5FD1' },
    dosesGiven: 3,
    dosesUpcoming: 0,
    dosesOverdue: 0,
  },
  {
    vaccine: 'IPV (Polio)',
    dose: '3 of 3',
    dueDate: '12 Apr 2021',
    givenOn: '10 Apr 2021',
    ageAtDose: '3m 29d',
    status: 'completed',
    nextDue: null,
    pill: { bg: '#E7E3FD', fg: '#5B4BE0' },
    dosesGiven: 3,
    dosesUpcoming: 0,
    dosesOverdue: 0,
  },
  {
    vaccine: 'Rotavirus',
    dose: '2 of 2',
    dueDate: '12 Mar 2021',
    givenOn: '11 Mar 2021',
    ageAtDose: '1m 27d',
    status: 'completed',
    nextDue: null,
    pill: { bg: '#EDE9FE', fg: '#6D28D9' },
    dosesGiven: 2,
    dosesUpcoming: 0,
    dosesOverdue: 0,
  },
  {
    vaccine: 'PCV (Pneumococcal)',
    dose: '3 of 3',
    dueDate: '12 Apr 2021',
    givenOn: '10 Apr 2021',
    ageAtDose: '3m 29d',
    status: 'completed',
    nextDue: null,
    pill: { bg: '#DDEBFC', fg: '#1D5FD1' },
    dosesGiven: 3,
    dosesUpcoming: 0,
    dosesOverdue: 0,
  },
  {
    vaccine: 'MR (Measles-Rubella)',
    dose: '1 of 2',
    dueDate: '12 Jan 2023',
    givenOn: '15 Jan 2023',
    ageAtDose: '2y 0m',
    status: 'completed',
    nextDue: { date: '12 Jan 2026', age: '2y 11m' },
    pill: { bg: '#DCF5E9', fg: '#0E7A55' },
    dosesGiven: 1,
    dosesUpcoming: 1,
    dosesOverdue: 0,
  },
  {
    vaccine: 'DPT Booster',
    dose: '1 of 2',
    dueDate: '12 Jan 2026',
    givenOn: null,
    ageAtDose: '4y 0m',
    status: 'upcoming',
    nextDue: { date: '12 Jan 2026', age: '4y 0m' },
    pill: { bg: '#E7E3FD', fg: '#5B4BE0' },
    dosesGiven: 0,
    dosesUpcoming: 1,
    dosesOverdue: 0,
  },
  {
    vaccine: 'Typhoid (Vi Conjugate)',
    dose: '1 of 1',
    dueDate: '12 Jul 2025',
    givenOn: null,
    ageAtDose: '4y 6m',
    status: 'upcoming',
    nextDue: { date: '12 Jul 2025', age: '4y 6m' },
    pill: { bg: '#DDEBFC', fg: '#1D5FD1' },
    dosesGiven: 0,
    dosesUpcoming: 1,
    dosesOverdue: 0,
  },
  {
    vaccine: 'Influenza (Annual)',
    dose: null,
    dueDate: '12 Oct 2025',
    givenOn: null,
    ageAtDose: '4y 9m',
    status: 'upcoming',
    nextDue: { date: '12 Oct 2025', age: '4y 9m' },
    pill: { bg: '#EDE9FE', fg: '#6D28D9' },
    dosesGiven: 0,
    dosesUpcoming: 1,
    dosesOverdue: 0,
  },
  {
    vaccine: 'Hepatitis A',
    dose: '2 of 2',
    dueDate: '12 Jul 2024',
    givenOn: null,
    ageAtDose: '3y 6m',
    status: 'overdue',
    nextDue: { date: '12 Jul 2024', age: '3y 6m' },
    pill: { bg: '#FCE0E0', fg: '#E03131' },
    dosesGiven: 2,
    dosesUpcoming: 0,
    dosesOverdue: 1,
  },
];

const sum = (pick: (r: VaccinationRecord) => number) => VACCINATIONS.reduce((t, r) => t + pick(r), 0);

export const VAX_COMPLETED = sum((r) => r.dosesGiven); // 18
export const VAX_UPCOMING = sum((r) => r.dosesUpcoming); // 4
export const VAX_OVERDUE = sum((r) => r.dosesOverdue); // 1
export const VAX_TOTAL = VAX_COMPLETED + VAX_UPCOMING + VAX_OVERDUE; // 23
export const VAX_PERCENT = Math.round((VAX_COMPLETED / VAX_TOTAL) * 100); // 78

export const VAX_STATUS_META: Record<VaccinationStatus, { label: string; bg: string; fg: string }> = {
  completed: { label: 'Completed', bg: '#DCF7E6', fg: '#12A150' },
  upcoming: { label: 'Upcoming', bg: '#FDEBD0', fg: '#E8890B' },
  overdue: { label: 'Overdue', bg: '#FCE0E0', fg: '#E03131' },
};
