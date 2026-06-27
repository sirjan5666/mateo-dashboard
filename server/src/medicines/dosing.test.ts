import { describe, expect, it } from 'vitest';
import { checkDose } from './dosing.js';
import { getDrug } from '../data/drug-dosing.js';

const paracetamol = getDrug('paracetamol')!;
const ibuprofen = getDrug('ibuprofen')!;
const amoxicillin = getDrug('amoxicillin')!;
const aspirin = getDrug('aspirin')!;
const codeine = getDrug('codeine')!;

describe('dosing — paracetamol (weight-based)', () => {
  it('a correct dose for 10 kg is OK', () => {
    const r = checkDose(paracetamol, { weightKg: 10, ageMonths: 12, doseMg: 150, dosesPerDay: 4 });
    expect(r.level).toBe('ok');
    expect(r.recommendedSingleMg).toEqual({ min: 100, max: 150 });
    expect(r.recommendedDailyMaxMg).toBe(600); // min(60*10, 4000)
  });

  it('flags a 650 mg tablet (Dolo 650) for a 10 kg baby — over the usual single dose AND the daily max', () => {
    const r = checkDose(paracetamol, { weightKg: 10, ageMonths: 12, doseMg: 650, dosesPerDay: 3 });
    expect(r.level).toBe('danger'); // 1950 mg/day > 600 mg/day
    expect(r.messages.some((m) => /day exceeds the daily maximum/i.test(m.text))).toBe(true);
  });

  it('flags an under-dose', () => {
    const r = checkDose(paracetamol, { weightKg: 10, ageMonths: 12, doseMg: 50 });
    expect(r.level).toBe('warning');
    expect(r.messages.some((m) => /below the usual single dose/i.test(m.text))).toBe(true);
  });

  it('flags over the absolute single-dose cap', () => {
    const r = checkDose(paracetamol, { weightKg: 90, ageMonths: 200, doseMg: 1200 });
    expect(r.level).toBe('danger');
    expect(r.messages.some((m) => /maximum single dose \(1000 mg\)/i.test(m.text))).toBe(true);
  });

  it('asks for weight when it is missing', () => {
    const r = checkDose(paracetamol, { ageMonths: 12, doseMg: 150 });
    expect(r.needsWeight).toBe(true);
    expect(r.recommendedSingleMg).toBeUndefined();
    expect(r.messages.some((m) => /log the baby’s weight/i.test(m.text))).toBe(true);
  });

  it('passes standing contraindications through without inflating the level', () => {
    const r = checkDose(paracetamol, { weightKg: 10, ageMonths: 12, doseMg: 150, dosesPerDay: 4 });
    expect(r.level).toBe('ok');
    expect(r.contraindications).toContain('Severe hepatic impairment');
  });
});

describe('dosing — age contraindications', () => {
  it('ibuprofen under 3 months is danger', () => {
    expect(checkDose(ibuprofen, { weightKg: 5, ageMonths: 2, doseMg: 25 }).level).toBe('danger');
  });
  it('ibuprofen at 8 months with a correct dose is OK', () => {
    const r = checkDose(ibuprofen, { weightKg: 8, ageMonths: 8, doseMg: 50, dosesPerDay: 3 });
    expect(r.level).toBe('ok');
  });
  it('aspirin in a 2-year-old is danger (Reye’s)', () => {
    const r = checkDose(aspirin, { weightKg: 12, ageMonths: 24, doseMg: 100 });
    expect(r.level).toBe('danger');
    expect(r.messages.some((m) => /Reye/i.test(m.text))).toBe(true);
  });
  it('codeine under 12 years is danger', () => {
    expect(checkDose(codeine, { weightKg: 18, ageMonths: 60 }).level).toBe('danger');
  });
});

describe('dosing — antibiotics', () => {
  it('amoxicillin within range is OK', () => {
    const r = checkDose(amoxicillin, { weightKg: 10, ageMonths: 18, doseMg: 100, dosesPerDay: 3 });
    expect(r.level).toBe('ok');
    expect(r.recommendedSingleMg).toEqual({ min: 70, max: 150 });
  });
  it('amoxicillin under-dose is flagged', () => {
    expect(checkDose(amoxicillin, { weightKg: 10, ageMonths: 18, doseMg: 30 }).level).toBe('warning');
  });
});
