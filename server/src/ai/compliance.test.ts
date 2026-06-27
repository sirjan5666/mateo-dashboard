import { describe, expect, it } from 'vitest';
import { mentionsFormula, scrubFormula, stripMarkdown } from './compliance.js';

// A scrubbed reply must (1) read without any formula/substitute/brand mention
// and (2) provably pass the detector — that round-trip is the real guarantee.
function scrubsClean(input: string) {
  const out = scrubFormula(input);
  expect(mentionsFormula(out), `"${out}" should be clean after scrub`).toBe(false);
  expect(out).not.toMatch(/\bformulas?\b/i);
  return out;
}

describe('compliance — mentionsFormula detects violations', () => {
  it('the confirmed slip', () =>
    expect(mentionsFormula('he should get all his fluids from breastmilk or formula — no water is needed')).toBe(true));
  it('bare word', () => expect(mentionsFormula('you can give formula if you like')).toBe(true));
  it('plural', () => expect(mentionsFormula('there are many formulas available')).toBe(true));
  it('infant formula', () => expect(mentionsFormula('infant formula is an option')).toBe(true));
  it('formula milk', () => expect(mentionsFormula('try some formula milk at night')).toBe(true));
  it('milk substitute', () => expect(mentionsFormula('a milk substitute can be used')).toBe(true));
  it('infant milk substitute', () => expect(mentionsFormula('an infant milk substitute may help')).toBe(true));
  it('brand: Lactogen', () => expect(mentionsFormula('Lactogen works for some babies')).toBe(true));
  it('brand: Similac', () => expect(mentionsFormula('many parents use Similac')).toBe(true));
  it('brand: NAN Pro', () => expect(mentionsFormula('NAN Pro is widely sold')).toBe(true));
});

describe('compliance — mentionsFormula stays quiet on safe text', () => {
  it('breastfeeding advice', () =>
    expect(mentionsFormula('keep breastfeeding on demand; expressed breastmilk is fine too')).toBe(false));
  it('complementary food', () =>
    expect(mentionsFormula('at 7 months you can offer mashed dal, rice and soft fruit')).toBe(false));
  it('no milk talk at all', () => expect(mentionsFormula('tummy time helps her neck get stronger')).toBe(false));
});

describe('compliance — scrubFormula removes violations and reads naturally', () => {
  it('collapses "breastmilk or formula" to just breastmilk', () => {
    const out = scrubsClean('he should get all his fluids from breastmilk or formula — no water is needed');
    expect(out).toBe('he should get all his fluids from breastmilk — no water is needed');
  });
  it('collapses "formula or breastmilk"', () => {
    const out = scrubsClean('give infant formula or breastmilk');
    expect(out).toContain('breastmilk');
  });
  it('replaces "formula milk" without leaving a double "milk"', () => {
    const out = scrubsClean('try some formula milk at night');
    expect(out).not.toMatch(/breastmilk milk/i);
  });
  it('softens "breastfeeding or formula feeding"', () => {
    const out = scrubsClean('continue breastfeeding or formula feeding');
    expect(out).toContain('breastfeeding');
  });
  it('scrubs bare word', () => scrubsClean('you can give formula if you like'));
  it('scrubs a milk substitute', () => scrubsClean('a milk substitute can be used'));
  it('scrubs a brand name', () => scrubsClean('many parents use Similac at night'));
  it('leaves safe text untouched', () => {
    const safe = 'keep breastfeeding on demand and offer mashed dal at 7 months';
    expect(scrubFormula(safe)).toBe(safe);
  });
});

describe('compliance — stripMarkdown returns clean plain text', () => {
  it('removes bold', () => expect(stripMarkdown('Keep her **hydrated** and warm')).toBe('Keep her hydrated and warm'));
  it('removes italic', () => expect(stripMarkdown('that is *usually* fine')).toBe('that is usually fine'));
  it('removes headings', () => expect(stripMarkdown('## Feeding\nfeed on demand')).toBe('Feeding\nfeed on demand'));
  it('removes inline code', () => expect(stripMarkdown('a temp of `38C` is a fever')).toBe('a temp of 38C is a fever'));
  it('unwraps links to their label', () => expect(stripMarkdown('see [a doctor](https://x.test) soon')).toBe('see a doctor soon'));
  it('normalises bullets and keeps list dashes', () => expect(stripMarkdown('* one\n- two')).toBe('- one\n- two'));
  it('leaves plain text untouched', () => {
    const plain = 'Feed on demand and keep her close. If the fever rises, see a doctor.';
    expect(stripMarkdown(plain)).toBe(plain);
  });
});
