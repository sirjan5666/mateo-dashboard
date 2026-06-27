import { istDateString } from '../lib/ist.js';
import type { IDoctorAvailability } from '../models/DoctorProfile.js';

// How far ahead parents can see and book slots.
export const SLOT_DAYS_AHEAD = 14;

export interface Slot {
  start: string; // ISO
  end: string; // ISO
}

// Turn a doctor's weekly availability into concrete bookable slots for the next
// `days` (IST calendar), skipping past times and anything already booked.
export function generateSlots(
  availability: IDoctorAvailability,
  booked: Set<string>,
  days = SLOT_DAYS_AHEAD,
): { date: string; slots: Slot[] }[] {
  const out: { date: string; slots: Slot[] }[] = [];
  const { days: avDays, startTime, endTime, slotMinutes } = availability;
  if (!avDays || avDays.length === 0 || !slotMinutes) return out;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (endMin <= startMin) return out;

  const nowMs = Date.now();
  for (let i = 0; i < days; i++) {
    const dateStr = istDateString(new Date(nowMs + i * 86_400_000));
    const dow = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
    if (!avDays.includes(dow)) continue;
    const slots: Slot[] = [];
    for (let m = startMin; m + slotMinutes <= endMin; m += slotMinutes) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      const start = new Date(`${dateStr}T${hh}:${mm}:00+05:30`).toISOString();
      const startMs = Date.parse(start);
      if (startMs <= nowMs || booked.has(start)) continue;
      slots.push({ start, end: new Date(startMs + slotMinutes * 60_000).toISOString() });
    }
    if (slots.length) out.push({ date: dateStr, slots });
  }
  return out;
}

// True if slotStartIso is a real, future, availability-aligned slot for this
// doctor (booked-or-not). Used to validate a booking request.
export function slotIsValid(availability: IDoctorAvailability, slotStartIso: string): boolean {
  return generateSlots(availability, new Set()).some((d) => d.slots.some((s) => s.start === slotStartIso));
}

// The slot's end instant, derived from its start + the doctor's slot length.
export function slotEndFor(availability: IDoctorAvailability, slotStartIso: string): string {
  return new Date(Date.parse(slotStartIso) + availability.slotMinutes * 60_000).toISOString();
}
