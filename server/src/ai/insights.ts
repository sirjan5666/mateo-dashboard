// Per-tracker "mateo.ai's take" insight. Given one tracker's logged data, it
// returns a short, warm read on whether what's logged looks typical for the
// baby's age, plus one gentle suggestion.
//
// Hard rule from CLAUDE.md: the assistant NEVER diagnoses or prescribes — we
// reuse the very same SYSTEM_PROMPT the chat uses, so that wording is inherited,
// not rewritten.
import type { Types } from 'mongoose';
import { buildBabyContext } from './context.js';
import { SYSTEM_PROMPT } from './system-prompt.js';
import { generateAssistantReply } from './provider.js';
import { scrubFormula } from './compliance.js';

export const INSIGHT_TRACKERS = [
  'growth',
  'food',
  'sleep',
  'milestones',
  'skin',
  'vaccines',
] as const;
export type InsightTracker = (typeof INSIGHT_TRACKERS)[number];

// Human label injected into the prompt so the model knows which log to focus on.
const TRACKER_LABEL: Record<InsightTracker, string> = {
  growth: 'growth (weight / length / head circumference)',
  food: 'complementary feeding / solid foods',
  sleep: 'sleep (naps and night sleep)',
  milestones: 'developmental milestones',
  skin: 'skin',
  vaccines: 'vaccinations',
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

  return insight;
}
