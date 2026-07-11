// Builds the per-baby context snapshot injected into the assistant's system
// prompt: age, growth percentile trend, vaccine status, recent skin notes.
import type { Types } from 'mongoose';
import { GrowthLog } from '../models/GrowthLog.js';
import { VaccineDose } from '../models/VaccineDose.js';
import { SkinLog } from '../models/SkinLog.js';
import { FoodLog } from '../models/FoodLog.js';
import { SleepLog } from '../models/SleepLog.js';
import { MilestoneAchievement } from '../models/MilestoneAchievement.js';
import { DoctorProfile } from '../models/DoctorProfile.js';
import { User } from '../models/User.js';
import { milestones } from '../milestones/milestones.js';
import { computePercentile } from '../growth/percentile.js';
import type { Sex } from '../growth/percentile.js';
import { doseStatus, istToday } from '../vaccines/schedule.js';
import { ageInWholeMonthsIST } from '../lib/ist.js';

const DAY = 86_400_000;
const MS_PER_MONTH = DAY * 30.4375;

export function babyAge(dob: Date, now: Date = new Date()): { ageDays: number; ageMonths: number } {
  return {
    ageDays: Math.floor((now.getTime() - dob.getTime()) / DAY),
    ageMonths: (now.getTime() - dob.getTime()) / MS_PER_MONTH,
  };
}

function ageLabel(ageDays: number, ageMonths: number): string {
  if (ageDays < 14) return `${ageDays} day${ageDays === 1 ? '' : 's'} old`;
  if (ageMonths < 2) return `${Math.floor(ageDays / 7)} weeks old`;
  if (ageMonths < 24) return `${Math.floor(ageMonths)} months old`;
  return `${Math.floor(ageMonths / 12)} year(s) old`;
}

function ordinal(n: number): string {
  const v = n % 100;
  const s = ['th', 'st', 'nd', 'rd'];
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

interface BabyLike {
  _id: Types.ObjectId;
  name: string;
  dob: Date;
  sex: string;
}

export async function buildBabyContext(baby: BabyLike): Promise<string> {
  const { ageDays, ageMonths } = babyAge(baby.dob);
  const sex = baby.sex as Sex;
  const lines: string[] = [`Baby: ${baby.name}, ${baby.sex}, ${ageLabel(ageDays, ageMonths)} (${ageDays} days old).`];

  // Growth — percentile trend, never absolute targets.
  const growth = await GrowthLog.find({ babyId: baby._id }).sort({ loggedAt: 1 });
  const withWeight = growth.filter((g) => g.weightG != null);
  if (withWeight.length > 0) {
    const last = withWeight[withWeight.length - 1];
    const amLast = (last.loggedAt.getTime() - baby.dob.getTime()) / MS_PER_MONTH;
    const pLast = computePercentile('weight', sex, amLast, last.weightG! / 1000).percentile;
    let trend = '';
    if (withWeight.length >= 2) {
      const prev = withWeight[withWeight.length - 2];
      const amPrev = (prev.loggedAt.getTime() - baby.dob.getTime()) / MS_PER_MONTH;
      const pPrev = computePercentile('weight', sex, amPrev, prev.weightG! / 1000).percentile;
      const d = pLast - pPrev;
      trend = Math.abs(d) < 7 ? ', tracking steadily along the curve' : d > 0 ? ', trending upward' : ', trending downward';
    }
    lines.push(`Weight is around the ${ordinal(Math.round(pLast))} percentile${trend}.`);
  } else {
    lines.push('No growth measurements logged yet.');
  }

  // Vaccines.
  const doses = await VaccineDose.find({ babyId: baby._id });
  if (doses.length > 0) {
    const today = istToday();
    let overdue = 0;
    let due = 0;
    let next: (typeof doses)[number] | null = null;
    for (const d of doses) {
      const s = doseStatus(d, today);
      if (s === 'overdue') overdue++;
      else if (s === 'due') due++;
      if (s !== 'done' && (next === null || d.dueDate.getTime() < next.dueDate.getTime())) next = d;
    }
    const parts: string[] = [];
    if (overdue) parts.push(`${overdue} overdue`);
    if (due) parts.push(`${due} due now`);
    let v = parts.length > 0 ? `Vaccinations: ${parts.join(', ')}.` : 'Vaccinations are up to date.';
    if (next) v += ` Next due: ${next.vaccineName} (${next.doseLabel}).`;
    lines.push(v);
  }

  // Recent skin notes.
  const skin = await SkinLog.find({ babyId: baby._id }).sort({ loggedAt: -1, createdAt: -1 }).limit(3);
  if (skin.length > 0) {
    lines.push(`Recent skin notes: ${skin.map((s) => `${s.area} (${s.severity})`).join('; ')}.`);
  }

  // Recent foods — descriptive context only, so guidance can be specific. Never
  // used to recommend a product or brand (IMS Act, brand-neutral feeding).
  const food = await FoodLog.find({ babyId: baby._id }).sort({ loggedAt: -1, createdAt: -1 }).limit(5);
  if (food.length > 0) {
    const items = food
      .map((f) => {
        const flags = [
          f.isNewFood ? 'new' : '',
          f.reaction && f.reaction !== 'none' ? `reaction: ${f.reaction}` : '',
        ].filter(Boolean);
        return `${f.foodName}${flags.length ? ` (${flags.join(', ')})` : ''}`;
      })
      .join('; ');
    lines.push(`Recent foods (newest first): ${items}.`);
  } else if (ageInWholeMonthsIST(baby.dob) >= 6) {
    // Whole-calendar IST months — same gate the food tracker shows the parent.
    lines.push('No complementary foods logged yet (baby is past 6 months).');
  }

  // Recent sleep — descriptive context only.
  const sleep = await SleepLog.find({ babyId: baby._id }).sort({ loggedAt: -1, createdAt: -1 }).limit(7);
  if (sleep.length > 0) {
    const parts: string[] = [];
    const lastNight = sleep.find((s) => s.kind === 'night');
    if (lastNight) parts.push(`last night ~${Math.round((lastNight.durationMin / 60) * 10) / 10}h`);
    const naps = sleep.filter((s) => s.kind === 'nap').length;
    if (naps) parts.push(`${naps} recent nap${naps === 1 ? '' : 's'} logged`);
    if (parts.length) lines.push(`Sleep: ${parts.join(', ')}.`);
  }

  // Developmental milestones whose typical window has fully passed without being
  // logged — a gentle nudge only. NEVER a diagnosis (hard rule 1).
  const achievements = await MilestoneAchievement.find({ babyId: baby._id });
  const achievedIds = new Set(achievements.map((a) => a.milestoneId));
  const watching = milestones.filter((m) => !achievedIds.has(m.id) && ageMonths > m.windowEndMonth);
  if (watching.length > 0) {
    lines.push(
      `Milestones to gently watch (typical window passed, not yet logged): ${watching.map((m) => m.label).join('; ')}. This is not a diagnosis — gently suggest mentioning it to the pediatrician if the parent is concerned.`,
    );
  }

  // Mateo doctors the parent can book a paid consultation with. The assistant
  // guides the parent to "Find a doctor"; it never books or takes payment.
  const doctors = await DoctorProfile.find({ status: 'approved' }).sort({ experienceYears: -1 }).limit(5);
  if (doctors.length > 0) {
    const docUsers = await User.find({ _id: { $in: doctors.map((d) => d.userId) } }).select('name');
    const nameById = new Map(docUsers.map((u) => [u.id, u.name]));
    const list = doctors
      .map((d) => `Dr. ${nameById.get(d.userId.toString()) ?? 'Doctor'} — ${d.specialization} (₹${d.consultationFee})`)
      .join('; ');
    lines.push(`Mateo doctors available for a paid consultation (parent books via "Find a doctor"): ${list}.`);
  } else {
    lines.push('No Mateo doctors are listed for booking right now.');
  }

  return lines.join('\n');
}
