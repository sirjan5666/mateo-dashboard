/**
 * The clinic day, in IST whole hours — ONE definition.
 *
 * The booking wizard generated slots from 09:00 to 20:00 while the calendar
 * drew rows only up to 18:00, so a 19:00 booking was accepted and then had no
 * row to appear in. Both now read from here, so the two cannot disagree.
 *
 * TODO(settings): these belong in per-clinic settings — a practice with evening
 * OPD or a Sunday half-day cannot express that here. `DoctorProfile.workingHours`
 * already exists and is the intended source; this constant is the seam it will
 * plug into, so the calendar and the wizard keep sharing one answer.
 */
export const DAY_START_HOUR = 9;
export const DAY_END_HOUR = 20;

const H12 = (h: number) => (h % 12 === 0 ? 12 : h % 12);

/** "09:00 AM" — the row key the calendar grids use, and the bucket appointments land in. */
export const hourLabel = (h: number) => `${String(H12(h)).padStart(2, '0')}:00 ${h < 12 ? 'AM' : 'PM'}`;

/**
 * Every hour row the calendar draws. The last row is DAY_END_HOUR - 1, because
 * a booking that STARTS at 20:00 would end after closing and is never offered.
 */
export const CLINIC_HOURS: string[] = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR },
  (_, i) => hourLabel(DAY_START_HOUR + i),
);
