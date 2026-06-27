// Deterministic emergency escalation. This runs on EVERY chat message BEFORE the
// Anthropic call (CLAUDE.md hard rule 2). If a rule fires we return the urgent
// response and STOP — the model is never consulted. Erring toward caution is
// intentional: advising a parent to see a doctor is never harmful.
//
// Rules match English AND common Hinglish / Hindi phrasings. Doctor must review
// before launch. Unit-tested in red-flags.test.ts.

export type RedFlagSeverity = 'emergency' | 'soft';

export interface RedFlagContext {
  ageMonths?: number;
  ageDays?: number;
}

export interface RedFlagResult {
  triggered: boolean;
  severity?: RedFlagSeverity;
  category?: string;
  response?: string;
}

interface Rule {
  category: string;
  severity: RedFlagSeverity;
  patterns: RegExp[];
  // Optional gate (e.g. age limits, negation guards). Default: always applies.
  appliesIf?: (ctx: RedFlagContext, msg: string) => boolean;
  reason: string;
}

function urgent(reason: string): string {
  return (
    `${reason} This needs a doctor's attention right away — please call your pediatrician now or ` +
    `go to the nearest emergency care. Kripya turant apne bachche ke doctor ko dikhayein ya ` +
    `nazdeeki hospital jayein. If your baby is struggling to breathe or is unresponsive, seek ` +
    `emergency help immediately.`
  );
}

const RULES: Rule[] = [
  {
    category: 'breathing',
    severity: 'emergency',
    reason: 'Trouble breathing, grunting, or a bluish colour in a baby is an emergency.',
    patterns: [
      /(difficulty|trouble|hard|struggl\w*)\s+(to\s+|in\s+)?breath/,
      /can'?t\s+breathe|not\s+breathing|stopped\s+breathing/,
      /\bgrunting\b/,
      /blue\s+(lips|skin|face|tongue)|turning\s+blue|bluish/,
      /gasping|choking|chest\s+(sinking|pulling)/,
      /saans\s*(lene)?\s*(me|mein|men)?\s*(dikkat|takleef|taklif|problem|nahi)/,
      /dam\s*ghut|saans\s*ruk/,
      /साँस|सांस/,
    ],
  },
  {
    category: 'unresponsive_seizure',
    severity: 'emergency',
    reason:
      'A seizure, or a baby who is unresponsive, floppy, or crying in a high-pitched, inconsolable way, needs urgent care.',
    patterns: [
      /seizure|convuls|having\s+a\s+fit|had\s+a\s+fit/,
      /jhatke|jhatka|daura|दौरा|मिर्गी/,
      /unresponsive|won'?t\s+wake|not\s+waking|can'?t\s+wake|no\s+response|not\s+responding/,
      /gone\s+limp|\blimp\b|floppy|lifeless/,
      /behosh|बेहोश/,
      /high[-\s]?pitched\s+(cry|cri|scream)/,
      /inconsolable/,
    ],
  },
  {
    category: 'dehydration',
    severity: 'emergency',
    reason:
      'Signs of dehydration — no wet nappy for many hours, a sunken soft spot, or no tears — need prompt medical care.',
    patterns: [
      /no\s+wet\s+(diaper|nappy)|dry\s+(diaper|nappy)\s+for|hasn'?t\s+(peed|weed|urinat)|not\s+(peed|urinat\w*|passing\s+urine)/,
      /sunken\s+(fontanelle|soft\s*spot|eyes)/,
      /no\s+tears/,
      /peshab\s*nahi|peshaab\s*nahi|sukha\s*diaper/,
    ],
  },
  {
    category: 'vomiting_severe',
    severity: 'emergency',
    reason: 'Vomiting that is green or bloody, or blood in the stool, needs a doctor right away.',
    patterns: [
      /(green|bile|yellow[-\s]?green)\s+vomit|vomit\w*\b.{0,10}\b(green|blood|bile)/,
      /projectile\s+vomit/,
      /\bblood\w*\b.{0,15}\b(vomit|stool|poop|poo|motion|nappy|diaper|potty)\b/,
      /\b(vomit|stool|poop|motion|potty)\b.{0,15}\bblood/,
      /khoon\s*.{0,10}(ulti|tatti|potty|latrine|stool)|hari\s*ulti/,
    ],
  },
  {
    category: 'ingestion',
    severity: 'emergency',
    reason: 'If your baby may have swallowed medicine, a chemical, or a small object, treat it as an emergency.',
    patterns: [
      /swallow(ed)?\s+\w*\s*(medicine|pill|tablet|poison|chemical|battery|coin|object|cleaner|phenyl|kerosene)/,
      /ate\s+\w*\s*(medicine|pill|poison|chemical|soap|detergent)/,
      /drank\s+\w*\s*(phenyl|kerosene|cleaner|poison|chemical|detergent)/,
      /\bingest\w*\b/,
      /nigal\s*(liya|gaya|li|gayi)|kuch\s*nigal/,
    ],
  },
  {
    category: 'jaundice',
    severity: 'emergency',
    reason: 'Yellowing of the skin or eyes in a newborn, or yellowing that is spreading, should be checked urgently.',
    appliesIf: (ctx, msg) =>
      (ctx.ageDays != null && ctx.ageDays < 14) ||
      /spread|increasing|worse|more\s+yellow|badh\s*rah|phail/.test(msg),
    patterns: [
      /jaundice|piliya|peelia|पीलिया/,
      /yellow\w*\s+(skin|eyes|body)|skin\s+\w*\s*yellow|eyes\s+\w*\s*yellow|peela\s*pan|peelapan/,
    ],
  },
  {
    category: 'injury',
    severity: 'emergency',
    reason: 'A head injury, burn, or possible fracture needs to be seen by a doctor.',
    patterns: [
      /head\s+(injury|hit|knock|trauma)|hit\s+\w*\s*head|banged?\s+\w*\s*head|fell\s+\w*\s*(on\s+)?(the\s+)?head/,
      /\bburn(ed|t|s)?\b|scald/,
      /fracture|broken\s+(bone|arm|leg|hand)|haddi\s*toot|toot\s*gay/,
      /fell\s+(from|off)\s+(the\s+)?(bed|stairs|height|sofa|cot|table)|gir\s*gaya|sar\s*(pe|par)\s*chot/,
    ],
  },
  {
    category: 'rash_with_fever',
    severity: 'emergency',
    reason:
      "A rash together with fever, or a rash that doesn't fade when you press it, needs urgent medical attention.",
    patterns: [
      /rash\w*\s+\w*\s*(and|with|\+)?\s*(fever|bukhar|temperature)/,
      /(fever|bukhar)\s+\w*\s*(and|with|\+)?\s*rash/,
      /daane?\s+\w*\s*(bukhar|fever)|bukhar\s+\w*\s*daane?/,
      /rash\s+\w*\s*(doesn'?t|won'?t|not)\s+(fade|blanch|disappear|go)/,
      /non[-\s]?blanching|petechiae|purple\s+(spots|rash|dots)/,
    ],
  },
  {
    category: 'fever_under_3_months',
    severity: 'emergency',
    reason: 'A fever in a baby under 3 months old is always treated as an emergency.',
    appliesIf: (ctx, msg) =>
      ctx.ageMonths != null &&
      ctx.ageMonths < 3 &&
      !/(no|without|nahi|bina)\s+\w{0,8}?(fever|bukhar)|fever\s+(gone|over|utar\w*|gaya|theek)|bukhar\s+(utar\w*|gaya|theek|nahi)/.test(
        msg,
      ),
    patterns: [
      /\bfever\b|\btemperature\b|running\s+a\s+temp|high\s+temp/,
      /\b(100\.[4-9]|10[1-9]|1[01][0-9])\s*°?\s*f/,
      /\b(38|39|40|41)(\.\d)?\s*°?\s*c/,
      /bukhar|tez\s*bukhar|garam\s*(hai|badan)|बुखार/,
    ],
  },
];

function normalize(message: string): string {
  return message
    .toLowerCase()
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

export function checkRedFlags(message: string, ctx: RedFlagContext = {}): RedFlagResult {
  const msg = normalize(message);
  for (const rule of RULES) {
    if (rule.appliesIf && !rule.appliesIf(ctx, msg)) continue;
    if (rule.patterns.some((p) => p.test(msg))) {
      return {
        triggered: true,
        severity: rule.severity,
        category: rule.category,
        response: urgent(rule.reason),
      };
    }
  }
  return { triggered: false };
}
