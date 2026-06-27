// Asia/Kolkata (IST) calendar helpers. The app stores dates as UTC but the
// user's calendar day is IST, so age-gates and "not in the future" checks must
// reason about the IST calendar day — not a raw UTC instant. Computing in IST on
// the server also makes whole-month ages agree with the (IST) client regardless
// of the server's own timezone.
const istYMDFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 'YYYY-MM-DD' for the given instant, in IST. */
export function istDateString(d: Date): string {
  return istYMDFormat.format(d);
}

function istParts(d: Date): { y: number; m: number; day: number } {
  const [y, m, day] = istDateString(d).split('-').map(Number);
  return { y, m, day };
}

/** Whole calendar months between dob and now, both read on the IST calendar. */
export function ageInWholeMonthsIST(dob: Date, now: Date = new Date()): number {
  const a = istParts(dob);
  const b = istParts(now);
  let months = (b.y - a.y) * 12 + (b.m - a.m);
  if (b.day < a.day) months -= 1;
  return Math.max(0, months);
}

/** True if d's IST calendar day is strictly after today's IST calendar day. */
export function isFutureISTDate(d: Date, now: Date = new Date()): boolean {
  return istDateString(d) > istDateString(now);
}
