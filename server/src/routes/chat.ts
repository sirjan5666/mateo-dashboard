import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import { z } from 'zod';
import { ChatMessage } from '../models/ChatMessage.js';
import type { IChatMessage } from '../models/ChatMessage.js';
import { ChatSession } from '../models/ChatSession.js';
import type { IChatSession } from '../models/ChatSession.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSubscription } from '../middleware/subscription.js';
import { loadOwnedBaby } from '../middleware/ownership.js';
import { checkRedFlags } from '../ai/red-flags.js';
import { babyAge, buildBabyContext } from '../ai/context.js';
import { SYSTEM_PROMPT } from '../ai/system-prompt.js';
import { assistantConfigured, generateAssistantReply } from '../ai/provider.js';
import { stripMarkdown } from '../ai/compliance.js';

const HISTORY_LIMIT = 20; // messages of context sent to the model
const MAX_SESSIONS = 100; // chat threads returned in the side list
const MAX_THREAD = 500; // messages returned for a single thread

const sendSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  // Omitted/empty → start a fresh conversation; otherwise append to this thread.
  sessionId: z.string().optional(),
  // The parent's app language — the assistant replies in it.
  language: z.enum(['en', 'hi']).optional(),
});

// Extra instruction so the reply matches the parent's chosen app language.
function languageDirective(language?: 'en' | 'hi'): string {
  if (language === 'hi') {
    return '\n\nIMPORTANT: The parent\'s app language is Hindi. Reply in clear, simple, warm Hindi (Devanagari script), even if the question is written in English or Hinglish. You may keep widely-understood English medical terms where that is clearer.';
  }
  return '';
}

function publicMsg(m: IChatMessage & { id: string }) {
  return { id: m.id, role: m.role, content: m.content, redFlagTriggered: m.redFlagTriggered, createdAt: m.createdAt };
}

function publicSession(s: IChatSession & { id: string }) {
  return { id: s.id, title: s.title, lastMessageAt: s.lastMessageAt, createdAt: s.createdAt };
}

// First user message becomes the thread's label in the side list.
function titleFrom(message: string): string {
  const clean = message.replace(/\s+/g, ' ').trim();
  return clean.length > 60 ? `${clean.slice(0, 60)}…` : clean || 'New chat';
}

// Load a session and confirm it belongs to this baby — never trust a sessionId
// from the client without scoping it to the owned baby.
async function loadSession(
  babyId: Types.ObjectId,
  sessionId: string,
): Promise<HydratedDocument<IChatSession> | null> {
  if (!isValidObjectId(sessionId)) return null;
  const session = await ChatSession.findById(sessionId);
  if (!session || session.babyId.toString() !== babyId.toString()) return null;
  return session;
}

// Anthropic requires the conversation to alternate user/assistant and start with
// a user turn. Merge consecutive same-role messages to keep it valid even after
// stretches where the assistant was offline (only user turns saved).
function coalesce(msgs: IChatMessage[]): { role: 'user' | 'assistant'; content: string }[] {
  const out: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of msgs) {
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += `\n${m.content}`;
    else out.push({ role: m.role, content: m.content });
  }
  while (out.length > 0 && out[0].role === 'assistant') out.shift();
  return out;
}

const router = Router();

// List this baby's chat threads, newest activity first, for the side panel.
router.get('/babies/:id/chat/sessions', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const sessions = await ChatSession.find({ babyId: req.baby!._id })
    .sort({ lastMessageAt: -1 })
    .limit(MAX_SESSIONS);
  res.json({ sessions: sessions.map((s) => publicSession(s)), assistantEnabled: assistantConfigured() });
});

// Fetch the messages of a single thread.
router.get('/babies/:id/chat/sessions/:sessionId', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const session = await loadSession(req.baby!._id, String(req.params.sessionId));
  if (!session) {
    res.status(404).json({ error: 'Chat not found' });
    return;
  }
  const messages = await ChatMessage.find({ sessionId: session._id }).sort({ createdAt: 1 }).limit(MAX_THREAD);
  res.json({
    session: publicSession(session),
    messages: messages.map((m) => publicMsg(m)),
    assistantEnabled: assistantConfigured(),
  });
});

// Delete a thread and all of its messages.
router.delete('/babies/:id/chat/sessions/:sessionId', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const session = await loadSession(req.baby!._id, String(req.params.sessionId));
  if (!session) {
    res.status(404).json({ error: 'Chat not found' });
    return;
  }
  await ChatMessage.deleteMany({ sessionId: session._id });
  await session.deleteOne();
  res.json({ ok: true });
});

// Send a message. With no sessionId we open a new thread (titled from this
// message); otherwise we append to the named thread.
router.post('/babies/:id/chat', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const { message, sessionId, language } = sendSchema.parse(req.body);
  const { ageMonths, ageDays } = babyAge(baby.dob);

  // Resolve the thread this message belongs to (creating one if needed). A
  // provided-but-unknown sessionId is rejected rather than silently re-homed.
  let session = sessionId ? await loadSession(baby._id, sessionId) : null;
  if (sessionId && !session) {
    res.status(404).json({ error: 'Chat not found' });
    return;
  }
  if (!session) {
    session = await ChatSession.create({ babyId: baby._id, title: titleFrom(message) });
  }

  const userMsg = await ChatMessage.create({
    babyId: baby._id,
    sessionId: session._id,
    role: 'user',
    content: message,
  });
  session.lastMessageAt = userMsg.createdAt;
  await session.save();

  // 1) Deterministic red-flag escalation — runs BEFORE any model call. If it
  //    fires, we return the urgent response and never consult the model.
  const flag = checkRedFlags(message, { ageMonths, ageDays });
  if (flag.triggered) {
    const reply = await ChatMessage.create({
      babyId: baby._id,
      sessionId: session._id,
      role: 'assistant',
      content: flag.response!,
      redFlagTriggered: true,
    });
    res.json({
      sessionId: session.id,
      session: publicSession(session),
      messages: [publicMsg(userMsg), publicMsg(reply)],
      redFlag: true,
    });
    return;
  }

  // 2) Normal Q&A needs a configured key + model (set in server/.env).
  if (!assistantConfigured()) {
    res.json({
      sessionId: session.id,
      session: publicSession(session),
      messages: [publicMsg(userMsg)],
      assistantEnabled: false,
    });
    return;
  }

  // 3) Build context + this thread's recent history and call the provider.
  try {
    const context = await buildBabyContext(baby);
    const recent = await ChatMessage.find({ sessionId: session._id, redFlagTriggered: false })
      .sort({ createdAt: -1 })
      .limit(HISTORY_LIMIT);
    const history = coalesce(recent.reverse());

    // stripMarkdown: the chat renders raw text (and voice reads it aloud), so any
    // markdown the model emits despite the prompt is removed deterministically.
    const text = stripMarkdown(
      await generateAssistantReply(
        `${SYSTEM_PROMPT}\n\nThis baby's current tracker data:\n${context}${languageDirective(language)}`,
        history,
      ),
    );

    const reply = await ChatMessage.create({
      babyId: baby._id,
      sessionId: session._id,
      role: 'assistant',
      content: text,
      redFlagTriggered: false,
    });
    res.json({
      sessionId: session.id,
      session: publicSession(session),
      messages: [publicMsg(userMsg), publicMsg(reply)],
    });
  } catch (err) {
    console.error('Assistant error:', err);
    // The user message is saved in the thread; surface a retryable error.
    res.status(502).json({
      error: 'The assistant is having trouble right now. Please try again in a moment.',
      sessionId: session.id,
      session: publicSession(session),
      messages: [publicMsg(userMsg)],
    });
  }
});

export default router;
