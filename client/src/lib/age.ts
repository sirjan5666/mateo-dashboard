// Ages are always computed from DOB at read time — never stored (CLAUDE.md).

const MS_PER_DAY = 86_400_000;

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

export function formatAge(dobIso: string): string {
  const dob = new Date(dobIso);
  const now = new Date();
  const days = Math.floor((now.getTime() - dob.getTime()) / MS_PER_DAY);

  if (days <= 0) return 'Born today';
  if (days < 14) return `${plural(days, 'day')} old`;

  // Whole calendar months elapsed since DOB
  let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1;

  if (months < 2) return `${plural(Math.floor(days / 7), 'week')} old`;
  if (months < 12) return `${plural(months, 'month')} old`;

  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (remMonths === 0) return `${plural(years, 'year')} old`;
  return `${plural(years, 'year')} ${plural(remMonths, 'month')} old`;
}

// Whole calendar months since DOB — for age-gating features (e.g. complementary
// feeding starts at 6 months). Matches formatAge's month calc so both agree.
export function ageInMonths(dobIso: string, now: Date = new Date()): number {
  const dob = new Date(dobIso);
  let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1;
  return Math.max(0, months);
}

// Dates are stored as UTC and displayed in Asia/Kolkata (CLAUDE.md).
const istDateFormat = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function formatDateIST(iso: string): string {
  return istDateFormat.format(new Date(iso));
}

// "10:30 am" in Asia/Kolkata — for consultation slot times.
const istTimeFormat = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

export function formatTimeIST(iso: string): string {
  return istTimeFormat.format(new Date(iso));
}

export function formatDateTimeIST(iso: string): string {
  return `${istDateFormat.format(new Date(iso))}, ${istTimeFormat.format(new Date(iso))}`;
}

// 'YYYY-MM-DD' in Asia/Kolkata, for <input type="date"> values.
const istDateInputFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function toDateInputValueIST(iso: string): string {
  return istDateInputFormat.format(new Date(iso));
}

// Difference in IST calendar days: today = 0, tomorrow = 1, yesterday = -1.
export function dayDiffIST(iso: string, now: Date = new Date()): number {
  const a = istDateInputFormat.format(new Date(iso));
  const b = istDateInputFormat.format(now);
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((da - db) / MS_PER_DAY);
}

// Friendly countdown for an upcoming slot ("Today, 10:00 am", "Tomorrow…", "In 3 days").
export function relativeUpcomingIST(iso: string): string {
  const d = dayDiffIST(iso);
  if (d === 0) return `Today, ${formatTimeIST(iso)}`;
  if (d === 1) return `Tomorrow, ${formatTimeIST(iso)}`;
  if (d > 1 && d <= 7) return `In ${d} days`;
  return formatDateTimeIST(iso);
}

// Short relative label for a past slot ("Yesterday", "5 days ago", "3 weeks ago").
export function relativePastIST(iso: string): string {
  const d = Math.abs(dayDiffIST(iso));
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d} days ago`;
  const w = Math.round(d / 7);
  if (w < 5) return `${plural(w, 'week')} ago`;
  const m = Math.round(d / 30);
  return `${plural(m, 'month')} ago`;
}

export function todayInputValueIST(): string {
  return istDateInputFormat.format(new Date());
}

// "Thursday, 12 June 2026" in Asia/Kolkata, for dashboard chrome.
const istLongFormat = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function todayLongIST(now: Date = new Date()): string {
  return istLongFormat.format(now);
}

const istHourFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  hourCycle: 'h23',
});

export function greetingIST(now: Date = new Date()): string {
  const hour = parseInt(istHourFormat.format(now), 10);
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

// Single-letter weekday labels for the last 7 IST days, oldest → today.
// Lives here (not in component render) so the time read stays out of React's
// purity-checked render path — same convention as the relative-time helpers.
export function last7WeekdayLabelsIST(now: Date = new Date()): string[] {
  const fmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'narrow' });
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(now.getTime() - (6 - i) * MS_PER_DAY)));
}

// Is the current instant within [start, end]? For "live now" indicators.
export function isOngoing(startIso: string, endIso: string, now: number = Date.now()): boolean {
  return now >= Date.parse(startIso) && now <= Date.parse(endIso);
}

// The Asia/Kolkata hour (0–23) of an instant. Used to bucket appointment slots
// into Morning/Afternoon/Evening — MUST read the IST hour, never the raw UTC
// hour (the +5:30 shift would mislabel a 10:00 IST slot). Kept here, out of the
// React render path, matching the other IST time helpers.
const istSlotHourFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  hourCycle: 'h23',
});
export function istHour(iso: string): number {
  return Number(istSlotHourFormat.format(new Date(iso)));
}
