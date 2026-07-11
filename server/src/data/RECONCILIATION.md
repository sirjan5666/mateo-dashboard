# Clinical data reconciliation — workbook spine vs existing reference data

**Date:** 2026-07-11 · **Branch:** `feat/trackers-journeys` · **Phase 0**
**Owner rule:** the First-2000-Days workbook is the canonical spine; it wins on conflict.
**BUT:** every item below is pre-sign-off. Vaccine *timing* changes re-seed every baby's doses
(`syncDosesForBaby`), so **no clinical timing has been edited** — this note documents the diffs and
proposed resolutions for the pediatrician to arbitrate before any data file changes.

Newly generated (no existing equivalent, safe, already committed to `server/src/data/`):
- `timeline-2000.json` — 82 day-indexed milestone anchors (vision/cognitive/growth-snapshot/doctor-flag).
- `daily-notifications.json` — 2,000 daily push notifications, EN + Hinglish, typed by content.

---

## 1. Vaccines — `iap-schedule.json` vs workbook "India – Vaccination Schedule"  ⚠️ CONFLICTS — DO NOT EDIT YET

Material differences (workbook = proposed canonical, **pending pediatrician sign-off**):

| Topic | Existing `iap-schedule.json` | Workbook | Proposed resolution |
|---|---|---|---|
| **Hepatitis B** | 4 doses: birth, 6wk(42), 10wk(70), 14wk(98) | 3 doses: birth, 6wk, **6mo(183)** | Clarify: HepB in Pentavalent is given 6/10/14wk in practice. Confirm whether to model HepB as birth+penta or birth/6wk/6mo. |
| **OPV** | birth only (`opv_0`) | birth, **OPV-1 @6mo**, **OPV-2 @9mo** | Add OPV-1 (183d) and OPV-2 (274d). |
| **OPV booster** | none | **@4–6yr** | Add OPV booster (~1460d). |
| **TCV (typhoid)** | @6mo (180d) | **@9–12mo** | Move TCV to ~9–12mo (274–365d). |
| **Typhoid booster** | none | **@2yr** | Add typhoid booster (~730d). |
| **Varicella dose 2** | @18mo (540d) | **@4–6yr** | Move Varicella-2 to 4–6yr (standard IAP). |
| **MR/MMR dose 2** | `mmr_2` @15mo (450d) | MMR-2 @15mo (IAP) / MR-2 @16mo (govt) | Keep 15mo (IAP); note govt UIP gives MR-2 at 16mo with DPT booster. |
| **PCV booster** | @12–15mo | @12–15mo (IAP) / ~9mo (UIP) | Keep IAP 12–15mo; flag UIP variance (already noted). |
| **HPV** | female only, 9–15yr | girls 9–14 (2-dose); "can offer boys too" | Keep female default; owner decision whether to offer boys. |

Agreements (no change): BCG/HepB-1/OPV-0 at birth; DTP/IPV/Hib/PCV/Rota primary series at 6/10/14wk;
Rotavirus 3-dose; HepA 12mo + 18mo; DTP/IPV boosters at 15–18mo and 4–6yr; annual influenza.

**Action:** pediatrician reviews the table → we then update `iap-schedule.json` in one reviewed pass
and re-run `syncDosesForBaby` semantics. Note: the daily-notification vaccine overlays already reflect
the workbook timing, so a mismatch would show until the schedule is reconciled — keep them aligned.

---

## 2. Complementary feeding — `complementary-feeding.json` vs workbook "Food Introduction"  ✅ AGREES; additive only

Existing file is strong and IMS-compliant, matching the workbook on: exclusive BF to 6mo; 6–8 / 9–11 /
12–24mo stages; textures/frequency; the never-feed list (honey, choking hazards, added salt/sugar,
juices, unpasteurised milk); homemade-first, brand-neutral, no formula.

Proposed additive enrichments (safe, but still clinical — include on sign-off, don't silently add):
- **Dedicated 6–8mo allergen-introduction window** (egg, well-cooked/thinned peanut, fish; one at a time,
  3–5 days apart; LEAP-study framing). Existing file mentions allergens only in 9–11mo tips.
- **2–5yr balanced-diet split** (~50% carbs / 25% protein / 25% fruit-veg) + "limit packaged/sugary/salty."
- Cow's milk as a *drink* only from 12mo (already implied; make explicit).

No conflicts. No destructive change.

---

## 3. Growth — WHO LMS tables (`who-growth/*.json`) vs workbook "Growth Reference"  ✅ NO CONFLICT; one gap

The workbook medians match the WHO LMS `M` values to 2 decimals (same WHO 2006 source). The LMS tables
are strictly richer — they enable full percentile-band plotting; the workbook has medians only. **Keep the
LMS tables canonical.** The workbook median strings are already captured per-age in `timeline-2000.json`
(`growthSnapshot`) for display.

⚠️ **Gap:** `who-growth/*.json` cover **0–24 months only**; the journey runs to 60 months. Beyond 2yr
there is no LMS data, so percentile plotting/z-scores can't be computed for 24–60mo.
**Action:** source WHO Child Growth Standards LMS for 24–60mo (wfa/lfa/hcfa, boys/girls) and extend the
tables, OR show median-only reference (from the workbook) beyond 24mo with no percentile band. Recommend
extending the LMS from the official WHO tables (do not fabricate values).

---

## 4. Milestones — `who-milestones.json` vs `timeline-2000.json`  ✅ COMPLEMENTARY; no conflict

- `who-milestones.json` (8 entries) = the **tickable** milestone list with rigorous WHO Windows of
  Achievement (1st–99th pct) for motor + typical ranges for social/language. **Keep as canonical for the
  "tick when achieved" checklist.**
- `timeline-2000.json` (82 entries, 15 milestone checkpoints) = narrative context, vision + cognitive
  sub-milestones, parent tips, and "talk to doctor if" flags. **Drives the journey narrative + notifications.**

The Phase 2 Development journey reads **both**: WHO windows for the checklist, timeline for the surrounding
"what's happening now" + doctor-flags. The workbook does **not** supersede `who-milestones.json`.
Optional later: enrich `who-milestones.json` with vision/cognitive tick items derived from the timeline
(new entries, additive) — pending sign-off.

---

## Summary of Phase 0 status

| Data | Status | Action owner |
|---|---|---|
| `timeline-2000.json` | ✅ generated | — |
| `daily-notifications.json` | ✅ generated | — |
| `iap-schedule.json` | ⚠️ conflicts documented, **not edited** | pediatrician → then one reviewed edit |
| `complementary-feeding.json` | ✅ agrees; additive proposals | pediatrician → optional additive edit |
| `who-growth/*.json` | ✅ no conflict; **24–60mo gap** | source WHO 24–60mo LMS |
| `who-milestones.json` | ✅ complementary; keep canonical | optional additive enrichment |
