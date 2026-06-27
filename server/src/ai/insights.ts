// Per-tracker "mateo.ai's take" insight. Given one tracker's logged data, it
// returns a short, warm read on whether what's logged looks typical for the
// baby's age, plus one gentle suggestion.
//
// Two hard rules from CLAUDE.md shape this:
//  1. The assistant NEVER diagnoses or prescribes — we reuse the very same
//     SYSTEM_PROMPT the chat uses, so that wording is inherited, not rewritten.
//  2. Emergency/red-flag escalation is DETERMINISTIC, not the model's call. So a
//     symptom entry that assesses as "urgent", or a concerning stool colour,
//     short-circuits to a "see a doctor" insight BEFORE any LLM call.
import type { Types } from 'mongoose';
import { SymptomLog } from '../models/SymptomLog.js';
import { DiaperLog, CONCERNING_COLORS } from '../models/DiaperLog.js';
import { assessSymptoms } from '../health/symptoms.js';
import { buildBabyContext } from './context.js';
import { SYSTEM_PROMPT } from './system-prompt.js';
import { generateAssistantReply } from './provider.js';
import { scrubFormula } from './compliance.js';

export const INSIGHT_TRACKERS = [
  'growth',
  'food',
  'feeds',
  'sleep',
  'diapers',
  'symptoms',
  'milestones',
  'skin',
  'vaccines',
  'allergies',
] as const;
export type InsightTracker = (typeof INSIGHT_TRACKERS)[number];

// Human label injected into the prompt so the model knows which log to focus on.
const TRACKER_LABEL: Record<InsightTracker, string> = {
  growth: 'growth (weight / length / head circumference)',
  food: 'complementary feeding / solid foods',
  feeds: 'milk feeds (breast / expressed)',
  sleep: 'sleep (naps and night sleep)',
  diapers: 'nappies (wet / dirty, stool)',
  symptoms: 'fever / symptoms',
  milestones: 'developmental milestones',
  skin: 'skin',
  vaccines: 'vaccinations',
  allergies: 'known allergies',
};

export type InsightStatus = 'ok' | 'watch' | 'doctor';

export interface Insight {
  status: InsightStatus;
  observation: string;
  suggestion: string;
  source: 'rule' | 'ai';
}

interface BabyLike {
  _id: Types.ObjectId;
  name: string;
  dob: Date;
  sex: string;
}

// ── Deterministic safety gate ───────────────────────────────────────────────
// Returns a rule-based insight when a tracker's data carries a signal we never
// leave to the model (hard rule 2). null → fall through to the LLM.
async function deterministicInsight(baby: BabyLike, tracker: InsightTracker): Promise<Insight | null> {
  if (tracker === 'symptoms') {
    const latest = await SymptomLog.findOne({ babyId: baby._id }).sort({ loggedAt: -1, createdAt: -1 });
    if (!latest) return null;
    const ageDaysAtLog = Math.floor((latest.loggedAt.getTime() - baby.dob.getTime()) / 86_400_000);
    const { level, reasons } = assessSymptoms({
      temperatureC: latest.temperatureC,
      symptoms: latest.symptoms,
      ageDays: ageDaysAtLog,
    });
    if (level === 'urgent') {
      return {
        status: 'doctor',
        observation: reasons[0] ?? 'A symptom in your latest entry can be serious in a baby.',
        suggestion: "Please see your pediatrician right away — don't wait. For trouble breathing or unresponsiveness, seek emergency care now.",
        source: 'rule',
      };
    }
  }

  if (tracker === 'diapers') {
    const recent = await DiaperLog.find({ babyId: baby._id }).sort({ loggedAt: -1, createdAt: -1 }).limit(8);
    const flagged = recent.find((d) => d.color && CONCERNING_COLORS.includes(d.color));
    if (flagged) {
      return {
        status: 'doctor',
        observation: `A recent nappy was logged as ${flagged.color} — that's a stool colour doctors like to check.`,
        suggestion: 'Please mention this to your pediatrician. It is often harmless, but worth a quick look.',
        source: 'rule',
      };
    }
  }

  return null;
}

// Insight-specific directive appended to the shared SYSTEM_PROMPT. Asks for a
// tight, structured read on ONE tracker.
function insightDirective(label: string): string {
  return `\n\nINSIGHT MODE: The parent is looking at their "${label}" log. Using ONLY this baby's ${label} data from the context above (and the baby's age), give a brief proactive insight:
1) whether what's logged looks typical / on track for this age (warm, specific, never alarming), and
2) ONE gentle, practical suggestion or next step.

Reply as STRICT JSON on a single line, no prose, no code fences:
{"status":"ok|watch|doctor","observation":"...","suggestion":"..."}
- status "ok" = looks typical / on track; "watch" = fine, but a tip or something to keep an eye on; "doctor" = worth mentioning to a pediatrician.
- observation and suggestion: each one short sentence (max ~160 characters), plain text, in the parent's language.
- Never diagnose or name any medicine/dosage. Feeding stays brand-neutral (never mention formula or brands). Growth speaks in percentile trends, never target weights.
- If there is no data logged for this tracker yet, use status "ok" and gently encourage the parent to start logging.`;
}

function languageDirective(language?: 'en' | 'hi'): string {
  if (language === 'hi') {
    return '\n\nThe parent\'s app language is Hindi — write observation and suggestion in clear, simple, warm Hindi (Devanagari).';
  }
  return '';
}

function clip(v: unknown, max: number): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

// Tolerant parse of the model's JSON. Falls back to showing the raw text as the
// observation (status "ok") so a non-JSON reply still surfaces something useful.
function parseInsight(text: string): Insight {
  const stripped = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      const o = JSON.parse(stripped.slice(start, end + 1)) as Record<string, unknown>;
      const status: InsightStatus = o.status === 'doctor' ? 'doctor' : o.status === 'watch' ? 'watch' : 'ok';
      const observation = clip(o.observation, 240);
      const suggestion = clip(o.suggestion, 240);
      if (observation || suggestion) return { status, observation, suggestion, source: 'ai' };
    } catch {
      /* fall through to plain-text fallback */
    }
  }
  return { status: 'ok', observation: clip(text, 240), suggestion: '', source: 'ai' };
}

/** Build a per-tracker insight: deterministic safety gate first, else the LLM. */
export async function buildTrackerInsight(
  baby: BabyLike,
  tracker: InsightTracker,
  language?: 'en' | 'hi',
): Promise<Insight> {
  const ruled = await deterministicInsight(baby, tracker);
  if (ruled) return ruled;

  const context = await buildBabyContext(baby);
  const system = `${SYSTEM_PROMPT}\n\nThis baby's current tracker data:\n${context}${insightDirective(TRACKER_LABEL[tracker])}${languageDirective(language)}`;
  const text = await generateAssistantReply(system, [
    { role: 'user', content: `Give me your insight on the ${TRACKER_LABEL[tracker]} log for ${baby.name}.` },
  ]);
  const insight = parseInsight(text);

  // Belt-and-braces (IMS Act 1992 — hard rule 4): generateAssistantReply already
  // guards the raw text, but scrub the parsed fields too so the structured
  // insight can never surface "formula" / a milk substitute regardless of how
  // the JSON was extracted.
  insight.observation = scrubFormula(insight.observation);
  insight.suggestion = scrubFormula(insight.suggestion);

  // Belt-and-braces: if the deterministic layer saw a "watch"-level symptom
  // reading, never let the model downgrade it below "watch".
  if (tracker === 'symptoms' && insight.status === 'ok') {
    const latest = await SymptomLog.findOne({ babyId: baby._id }).sort({ loggedAt: -1, createdAt: -1 });
    if (latest) {
      const ageDaysAtLog = Math.floor((latest.loggedAt.getTime() - baby.dob.getTime()) / 86_400_000);
      const { level } = assessSymptoms({ temperatureC: latest.temperatureC, symptoms: latest.symptoms, ageDays: ageDaysAtLog });
      if (level === 'watch') insight.status = 'watch';
    }
  }

  return insight;
}
