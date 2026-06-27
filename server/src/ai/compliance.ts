// Deterministic IMS-Act-1992 compliance guard for assistant output.
//
// CLAUDE.md hard rule 4: the app must NEVER recommend or normalize infant
// formula / breast-milk substitutes, and feeding guidance must stay
// brand-neutral and breastfeeding-first. The system prompt (system-prompt.ts)
// already forbids this, but the LLM can still slip — exactly like the red-flag
// gate (hard rule 2), we therefore ENFORCE it deterministically AFTER
// generation rather than trusting the model. This runs on every assistant
// reply (chat) and every per-tracker insight before the text reaches the user.
//
// Erring toward caution is intentional: a parenting/baby-health assistant has
// no legitimate reason to print the word "formula", so scrubbing a stray use is
// always safe. Unit-tested in compliance.test.ts.

// ── Detection ────────────────────────────────────────────────────────────────
// Plain (non-global) patterns — used only with .test(), so no lastIndex state.
// Covers the bare word ("formula"/"formulas", which also catches "infant
// formula", "baby formula", "formula milk"), the IMS term "milk substitute" in
// its common forms, and formula/packaged-baby-food brand names sold in India.
const DETECT: RegExp[] = [
  /\bformulas?\b/i,
  /\b(infant|breast[-\s]?milk|milk)\s+substitutes?\b/i,
  /\b(cerelac|lactogen|nan\s?pro|nanpro|similac|enfamil|dexolac|nestogen|aptamil|farex|nusobee)\b/i,
];

/** True if the text mentions infant formula, a milk substitute, or such a brand. */
export function mentionsFormula(text: string): boolean {
  return DETECT.some((p) => p.test(text));
}

// ── Scrubbing ────────────────────────────────────────────────────────────────
// Ordered replacements: the conjunction phrases ("breastmilk or formula") are
// collapsed FIRST so the result reads naturally and stays breastfeeding-first,
// then phrase forms and brands, then the bare word as a guaranteed catch-all so
// nothing slips through. Each replacement is plain text (no quotes), so this is
// also safe to run over the JSON the insight path produces.
const SCRUBS: { pattern: RegExp; replace: string }[] = [
  // "breastmilk or formula (milk)" → just breastmilk (the confirmed slip case).
  { pattern: /\bbreast[-\s]?milk\s+or\s+(?:infant\s+|baby\s+)?formula(?:\s+(?:milk|feeds?))?\b/gi, replace: 'breastmilk' },
  // "formula (milk) or breastmilk" → breastmilk.
  { pattern: /\b(?:infant\s+|baby\s+)?formula(?:\s+(?:milk|feeds?))?\s+or\s+breast[-\s]?milk\b/gi, replace: 'breastmilk' },
  // "breastfeeding or formula feeding" → breastfeeding.
  { pattern: /\bbreast[-\s]?feeding\s+or\s+formula[-\s]?feeding\b/gi, replace: 'breastfeeding' },
  // Phrase forms.
  { pattern: /\b(?:infant|baby|milk)\s+formula\b/gi, replace: 'breastmilk' },
  { pattern: /\bformula\s+(?:milk|feeds?|powder)\b/gi, replace: 'breastmilk' },
  { pattern: /\b(?:infant|breast[-\s]?milk)\s+substitutes?\b/gi, replace: 'breastmilk' },
  { pattern: /\bmilk\s+substitutes?\b/gi, replace: 'breastmilk' },
  // IMS-restricted formula / packaged-baby-food brand names.
  { pattern: /\b(?:cerelac|lactogen|nan\s?pro|nanpro|similac|enfamil|dexolac|nestogen|aptamil|farex|nusobee)\b/gi, replace: 'breastmilk' },
  // Bare word, last — guarantees no "formula"/"formulas" survives.
  { pattern: /\bformulas?\b/gi, replace: 'breastmilk' },
];

/**
 * Remove every formula / milk-substitute / brand mention, softening to
 * brand-neutral breastfeeding guidance. Guarantees `mentionsFormula` is false
 * for the returned text.
 */
export function scrubFormula(text: string): string {
  let out = text;
  for (const { pattern, replace } of SCRUBS) out = out.replace(pattern, replace);
  // Tidy any double spaces left by a collapsed phrase.
  return out.replace(/[ \t]{2,}/g, ' ');
}

// ── Plain-text formatting ─────────────────────────────────────────────────────
// The chat shows the assistant reply as RAW TEXT (no markdown renderer) and the
// voice mode reads it aloud, so any markdown the model emits despite the system
// prompt (**bold**, ## headings, `code`, [links](url)) shows as literal symbols
// (and gets spoken as "asterisk"). Strip it deterministically so replies stay
// clean plain text. NOTE: apply on the CHAT path only — the per-tracker insight
// path returns JSON and must not be run through this.
export function stripMarkdown(text: string): string {
  let out = text;
  // [label](url) -> label
  out = out.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  // bold **x** / __x__ (may span newlines)
  out = out.replace(/(\*\*|__)(.+?)\1/gs, '$2');
  // italic *x* / _x_ — content must not begin/end with whitespace, so "- " and
  // "* " bullets are left intact.
  out = out.replace(/(?<![A-Za-z0-9])\*(?=\S)([^*\n]+?)(?<=\S)\*(?![A-Za-z0-9])/g, '$1');
  out = out.replace(/(?<![A-Za-z0-9])_(?=\S)([^_\n]+?)(?<=\S)_(?![A-Za-z0-9])/g, '$1');
  // inline code `x` -> x
  out = out.replace(/`([^`]+)`/g, '$1');
  // heading + blockquote markers at line start
  out = out.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  out = out.replace(/^\s{0,3}>\s?/gm, '');
  // normalise "* " / "+ " bullets to "- "
  out = out.replace(/^(\s*)[*+]\s+/gm, '$1- ');
  // nuke any stray leftover double-markers, then tidy blank lines
  out = out.replace(/\*\*|__/g, '').replace(/\n{3,}/g, '\n\n');
  return out.trim();
}

// Stronger instruction appended to the system prompt when a first reply slipped,
// to give the model one chance to self-correct before we scrub deterministically.
export const COMPLIANCE_REMINDER =
  '\n\nCOMPLIANCE (IMS Act 1992 — non-negotiable): Your previous answer mentioned infant ' +
  'formula, a milk substitute, or a baby-milk/baby-food brand. Rewrite it WITHOUT any such ' +
  'mention. Speak only of breastfeeding / breastmilk (expressed breastmilk if direct feeding ' +
  "isn't possible) and, from 6 months, freshly prepared homemade complementary foods. Do not " +
  'name or imply any brand. Keep the same warm, helpful tone and format.';
