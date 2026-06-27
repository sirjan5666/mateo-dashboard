// Tara — Mateo's baby-care AI assistant. One place for her name + the rotating
// prompts so the dashboard ask-bar, the floating launcher and the chat page all
// stay in sync. Questions are brand-neutral and breastfeeding-first (never
// formula), and age-agnostic so they fit any baby.
export const ASSISTANT_NAME = 'Tara';
export const ASSISTANT_BY = 'by Mateo';
export const ASSISTANT_TAGLINE = 'a gentle guide, never a diagnosis';

// Full-length prompts for the self-typing placeholder.
export const SUGGESTED_QUESTIONS = [
  'Is my baby’s weight on track?',
  'How many naps should she have at this age?',
  'What foods can I start at 6 months?',
  'How do I care for dry baby skin?',
  'When is the next vaccine due?',
  'Tips for more restful night sleep?',
  'Is this rash anything to worry about?',
  'How much tummy time does she need?',
  'Why does she cry after feeds?',
];

// Short chips for compact spaces (dashboard card, launcher panel).
export const QUICK_CHIPS = [
  'Weight on track?',
  'Foods at 6 months',
  'Better night sleep',
  'Dry skin care',
  'Next vaccine',
];

// Build the chat deep-link that hands a question straight into a fresh thread.
// `speak` (set when the question was asked by voice) makes the chat read the
// reply aloud.
export function askTaraLink(babyId: string, question: string, opts?: { speak?: boolean }): string {
  const base = `/babies/${babyId}/chat?q=${encodeURIComponent(question.trim())}`;
  return opts?.speak ? `${base}&speak=1` : base;
}
