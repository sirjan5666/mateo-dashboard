import { describe, expect, it } from 'vitest';
import { checkRedFlags } from './red-flags.js';

function fires(message: string, ctx = {}, category?: string) {
  const r = checkRedFlags(message, ctx);
  expect(r.triggered, `expected "${message}" to trigger`).toBe(true);
  expect(r.severity).toBe('emergency');
  if (category) expect(r.category).toBe(category);
  expect(r.response).toMatch(/doctor|pediatrician/i);
}

function quiet(message: string, ctx = {}) {
  expect(checkRedFlags(message, ctx).triggered, `expected "${message}" to stay quiet`).toBe(false);
}

describe('red-flags — emergencies (English)', () => {
  it('difficulty breathing', () => fires('my baby is having difficulty breathing', {}, 'breathing'));
  it('blue lips', () => fires('her lips are turning blue', {}, 'breathing'));
  it('seizure', () => fires('the baby had a seizure this morning', {}, 'unresponsive_seizure'));
  it('unresponsive', () => fires('he is unresponsive and floppy', {}, 'unresponsive_seizure'));
  it('dehydration', () => fires('no wet diaper for 10 hours and a sunken soft spot', {}, 'dehydration'));
  it('green vomit', () => fires('she has green vomit since morning', {}, 'vomiting_severe'));
  it('blood in stool', () => fires('there is blood in his stool', {}, 'vomiting_severe'));
  it('ingestion', () => fires('I think she swallowed a pill', {}, 'ingestion'));
  it('head injury', () => fires('he hit his head when he fell off the bed', {}, 'injury'));
  it('burn', () => fires('the baby got a burn on her hand', {}, 'injury'));
  it('rash with fever', () => fires('rash and fever together since last night', {}, 'rash_with_fever'));
  it('non-blanching rash', () => fires("purple spots that don't fade when pressed", {}, 'rash_with_fever'));
});

describe('red-flags — emergencies (Hinglish / Hindi)', () => {
  it('saans dikkat', () => fires('bachche ko saans lene me dikkat ho rahi hai', {}, 'breathing'));
  it('jhatke', () => fires('baby ko jhatke aa rahe hain', {}, 'unresponsive_seizure'));
  it('behosh', () => fires('bachcha behosh ho gaya', {}, 'unresponsive_seizure'));
  it('peshab nahi', () => fires('subah se peshab nahi kiya', {}, 'dehydration'));
  it('khoon wali ulti', () => fires('khoon wali ulti ho rahi hai', {}, 'vomiting_severe'));
  it('kuch nigal liya', () => fires('bachche ne kuch nigal liya', {}, 'ingestion'));
  it('sar pe chot', () => fires('gir gaya aur sar pe chot lag gayi', {}, 'injury'));
  it('daane aur bukhar', () => fires('daane aur bukhar dono hain', {}, 'rash_with_fever'));
  it('devanagari saans', () => fires('साँस लेने में दिक्कत है', {}, 'breathing'));
});

describe('red-flags — age-gated', () => {
  it('fever under 3 months (English)', () => fires('my baby has a fever', { ageMonths: 1 }, 'fever_under_3_months'));
  it('fever under 3 months (Hinglish)', () => fires('bukhar hai', { ageMonths: 2 }, 'fever_under_3_months'));
  it('temperature 38.5C under 3 months', () => fires('temperature is 38.5 C', { ageMonths: 1 }));
  it('newborn jaundice by age', () => fires('her skin looks yellow', { ageDays: 5 }, 'jaundice'));
  it('jaundice spreading at any age', () => fires('piliya badh raha hai', { ageDays: 60 }, 'jaundice'));

  it('fever in older baby is NOT an emergency', () => quiet('my 8 month old has a fever', { ageMonths: 8 }));
  it('"no fever" under 3 months does not fire', () => quiet('no fever now, just a runny nose', { ageMonths: 1 }));
  it('"bukhar utar gaya" does not fire', () => quiet('bukhar utar gaya hai ab', { ageMonths: 2 }));
  it('mild jaundice question at 2 months does not fire', () => quiet('is a little jaundice normal', { ageDays: 60 }));
});

describe('red-flags — everyday messages stay quiet', () => {
  it('runny nose', () => quiet('my baby has a runny nose and is a bit fussy'));
  it('milk question', () => quiet('how much milk should a 6 month old drink'));
  it('milk question Hinglish', () => quiet('kitna doodh dena chahiye'));
  it('sleeping fine', () => quiet('baby is sleeping well and feeding fine'));
  it('tummy time', () => quiet('when should we start tummy time'));
});
