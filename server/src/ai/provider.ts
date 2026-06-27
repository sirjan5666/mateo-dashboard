// Assistant LLM provider abstraction. The chat route stays provider-agnostic;
// the deterministic red-flag gate (red-flags.ts) always runs BEFORE this.
// Provider is chosen from env: DeepSeek (OpenAI-compatible) if its key is set,
// otherwise Anthropic. Model names are never hardcoded — they come from env.
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env.js';
import { mentionsFormula, scrubFormula, COMPLIANCE_REMINDER } from './compliance.js';

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

const MAX_TOKENS = 800;
const FALLBACK = 'Sorry, I could not put together a reply just now. Please try again.';

export function assistantProvider(): 'deepseek' | 'anthropic' | null {
  if (env.DEEPSEEK_API_KEY) return 'deepseek';
  if (env.ANTHROPIC_API_KEY && env.ANTHROPIC_MODEL) return 'anthropic';
  return null;
}

export function assistantConfigured(): boolean {
  return assistantProvider() !== null;
}

// Prescription-photo OCR needs a vision model. Only Anthropic (Claude) vision is
// wired here; DeepSeek's default chat model is text-only. When false, the OCR
// endpoint degrades to "please type the medicines".
export function assistantVisionAvailable(): boolean {
  return !!(env.ANTHROPIC_API_KEY && env.ANTHROPIC_MODEL);
}

export interface ExtractedMedicine {
  medicine: string;
  dosage: string;
  frequency: string;
  duration: string;
}

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

// Transcribe (NOT interpret) the medicines visible in a prescription photo. The
// model is told to only transcribe and never add/recommend — the parent then
// reviews+edits before anything is saved.
export async function extractPrescriptionItems(imageBase64: string, mediaType: string): Promise<ExtractedMedicine[]> {
  if (!assistantVisionAvailable()) throw new Error('Vision not available');
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const prompt =
    "You are reading a doctor's prescription image so a parent can track the medicines. Transcribe ONLY the medicines clearly written. " +
    'Return a JSON array; each element: {"medicine": string, "dosage": string, "frequency": string, "duration": string}. ' +
    'Use "" for any field you cannot read. Do NOT add, infer, correct, or recommend anything. If it is not a readable prescription, return []. ' +
    'Return ONLY the JSON array — no prose, no code fences.';
  const completion = await client.messages.create({
    model: env.ANTHROPIC_MODEL!,
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType as ImageMediaType, data: imageBase64 } },
          { type: 'text', text: prompt },
        ],
      },
    ],
  });
  const text = completion.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  const json = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((p) => {
      const o = (p ?? {}) as Record<string, unknown>;
      return {
        medicine: String(o.medicine ?? '').slice(0, 120),
        dosage: String(o.dosage ?? '').slice(0, 80),
        frequency: String(o.frequency ?? '').slice(0, 80),
        duration: String(o.duration ?? '').slice(0, 80),
      };
    })
    .filter((x) => x.medicine)
    .slice(0, 30);
}

/**
 * Generate one assistant reply from a system prompt + alternating history.
 *
 * After the model returns, a DETERMINISTIC IMS-Act-1992 guard runs (hard rule 4,
 * mirroring the red-flag gate's "don't trust the model" stance): if the reply
 * mentions infant formula / a milk substitute / a brand, we regenerate ONCE with
 * a stronger instruction and, if it still slips, scrub the text to brand-neutral
 * breastfeeding guidance. Both the chat and per-tracker-insight paths call this,
 * so both inherit the guard.
 */
export async function generateAssistantReply(system: string, history: ChatTurn[]): Promise<string> {
  const first = await rawReply(system, history);
  if (!mentionsFormula(first)) return first;

  const second = await rawReply(system + COMPLIANCE_REMINDER, history);
  return mentionsFormula(second) ? scrubFormula(second) : second;
}

/** Single provider call, no compliance pass — use generateAssistantReply instead. */
async function rawReply(system: string, history: ChatTurn[]): Promise<string> {
  switch (assistantProvider()) {
    case 'deepseek':
      return deepseekReply(system, history);
    case 'anthropic':
      return anthropicReply(system, history);
    default:
      throw new Error('Assistant is not configured');
  }
}

async function anthropicReply(system: string, history: ChatTurn[]): Promise<string> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const completion = await client.messages.create({
    model: env.ANTHROPIC_MODEL!,
    max_tokens: MAX_TOKENS,
    system,
    messages: history,
  });
  return (
    completion.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim() || FALLBACK
  );
}

interface DeepSeekResponse {
  choices?: { message?: { content?: string } }[];
}

// DeepSeek uses the OpenAI chat-completions shape: a single messages array with
// the system prompt as the first message (role: 'system').
async function deepseekReply(system: string, history: ChatTurn[]): Promise<string> {
  const baseUrl = env.DEEPSEEK_BASE_URL.replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.DEEPSEEK_MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.6, // calm, consistent — this is a children's-health assistant
      stream: false,
      messages: [{ role: 'system', content: system }, ...history],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`DeepSeek API ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as DeepSeekResponse;
  return data.choices?.[0]?.message?.content?.trim() || FALLBACK;
}
