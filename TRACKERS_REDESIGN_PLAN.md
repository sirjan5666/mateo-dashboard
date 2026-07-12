# Trackers → Age-Driven "Journeys" + Proactive Notifications — Design Plan

**Status:** DRAFT for owner sign-off (2026-07-11). No code written yet.
**Owner decisions LOCKED (2026-07-11):**
- Notification channels = Dashboard + Email + WhatsApp (no phone push for now).
- Approach = full plan approved before build.
- **Build order = Phases 0→2 first** (data + onboarding + journeys), then Phase 3 (notifications).
- **Hinglish = a real 3rd language** (`en` / `hi` / `hi-en`), not notifications-only.
- **Onboarding vaccines = start all pending; mother checks off what's already done** (no false "done").
- **Data authority = the workbook is canonical spine; it wins over older IAP JSON on conflict** (keep sign-off flag).
- **WhatsApp scope = parent's own number, opt-in, only her baby's reminders; never marketing.**

---

## 0. 2026-07-11 UPDATE — foundation fixed + enriched blueprint folded in

The owner shared an **enriched "Auto-Pilot Trackers" blueprint** ("Set once, we watch the
rest"). It does not replace this plan — it enriches it. Mapping + status:

**Foundation bugs — FIXED & verified (2026-07-11)** (automation needs clean data first):
- Birth measurements now seed a `GrowthLog` at DOB (`routes/babies.ts`) → this IS Phase-1 step 2.
- AI growth context reads weight+length+head, not weight-only (`ai/context.ts`).
- Sidebar validates the URL baby id vs owned babies (no more stale-id "Baby not found").
- Vaccines page trusts the server summary + refetches after a mark (stable counters).

**Blueprint enrichments folded into existing phases:**
- **Phase 1 (baseline):** add `gestationalAgeWeeks` (→ **corrected age**, medically load-bearing),
  `bloodGroup`, feeding type, `knownAllergies`, `pediatricianName/Phone` (one-tap "call your
  doctor" in notifications). OCR auto-fill (discharge summary / vaccine-card photo) reuses the
  existing Claude-vision path — scoped as a Phase-1b add-on, not a blocker.
- **Phase 2 (journeys):** post-vaccine fever check-in; combo-vaccine merge; printable vaccine
  certificate; growth trend-alerts (not single-number) + "before vs now" photo gallery;
  new-food 3-day allergy watch + allergen-intro schedule + iron/protein gap nudge + seasonal
  Indian foods; sleep regression heads-up + nap schedule + safe-sleep/SIDS reminders; milestone
  "activities to encourage" + photo/video capture. **Medicines + Records** join as journeys 7–8.
- **Phase 3 (notifications):** add **digest mode** (one daily summary, not N pings), **quiet
  hours**, **snooze / "remind me tomorrow"**, warm non-judgmental tone (no guilt on late/missed).
- **Phase 4:** the blueprint's **"Aaj ka ek kaam" (Daily Care Card)** = the single-priority
  framing of the "Today for {baby}" hub + a completion **streak**.

**Corrected-age policy (proposed default, standard practice):** for babies born <37 weeks,
subtract prematurity from age when evaluating **growth percentiles and developmental
milestones only** — NOT vaccines or solids (those follow chronological age). Correct until
chronological age 24 months, then use chronological. UI shows chronological age with a
"corrected: X" note while it applies.

**Still open (owner):** OCR-now-vs-later; Bug 1B paywall (may an UNSUBSCRIBED doctor-invited
parent seed baseline vaccines during onboarding, or only after subscribing?).

---

## 1. The core reframe

Move the trackers from **reactive logging** ("mother enters data → system reacts")
to a **self-running, age-driven timeline** ("system knows the baby's age → tells her
what's expected now → she confirms").

The mother enters a **baseline once** at onboarding. From then on each tracker is a
forward-looking *journey* that always shows what's expected at the baby's current age,
even if she hasn't opened it in months. She **confirms/ticks** rather than re-enters.
Anything unmet → tap → **Dai Maa** gives guided next steps. Proactive **notifications**
(dashboard + email + WhatsApp) pull her to the right moment (vaccine due, 6-month solids,
milestone check, monthly growth).

## 2. Source spec (the four files provided 2026-07-11)

Parsed and archived under the session scratchpad.

- **`first_2000_days_timeline_india.xlsx`** — the structured spine:
  - *Timeline* (82 anchor entries, day-indexed): Domain, Description, **Vision Milestone**,
    **Cognitive Milestone**, **Growth Snapshot**, Parent Tip, **"Talk to Doctor If"**,
    Notification Text. Anchor ages align to CDC 2022 milestone-check ages (2,4,6,9,12,15,18,24,30,36,48,60 mo).
  - *India – Vaccination Schedule* — IAP 2025 (ACVIP) reconciled with Govt UIP; free/paid, route, notes.
  - *India – Food Introduction* — exclusive BF to 180 days, first foods, allergen window, first-year avoid-list.
  - *India – Growth Reference* — WHO 2006 medians (50th pct) weight/length/head-circ by age, boys & girls.
- **`first_2000_days_full_bilingual.xlsx`** — everything above **plus** a *Daily Push Notifications*
  sheet: **one notification per day for all 2,000 days**, in **English + Hinglish**, tagged with a
  `Content Type` (Development, Parent tip, Vision fact, Cognitive fact, Phase reminder, Encouragement,
  Growth note, +Vaccine/+Feeding overlays), deterministic rotation, every-100th-day celebration.
- **`Baby_Growth_Development_Journey_0-5_Years.docx`** — the **"6 parallel journeys"** conceptual model:
  1. Growth (weight/height/head-circ) 2. Vaccination 3. Nutrition/Diet 4. Skin Care
  5. Developmental Milestones 6. Health & Preventive Care (sleep, dental, vision, gut & immunity).
  Plus a "Complete Parent Timeline" of age-band checklists (0–6m, 6–12m, 1–2y, 2–5y).
- **`BABY MILESTONES.docx`** — the **10 developmental domains** taxonomy (Gross Motor, Fine Motor,
  Cognitive, Language, Social-Emotional, Vision, Hearing, Physical Growth, Sensory, Adaptive/Self-Help).

**Implication:** the milestone/vaccine/food/growth *content* AND all 2,000 days of notification
*copy* are authored. The engineering work is structure + scheduling + delivery + UX, not content.

## 3. Grounding facts (verified in the codebase, 2026-07-11)

- `Baby` = userId, name, dob, sex, optional birth weight/length/head-circ. Age always computed at read time.
- **Vaccines are materialized per baby**: `POST /api/babies` → `syncDosesForBaby` seeds `VaccineDose`
  rows from `iap-schedule.json`. Growth/milestones/food are **static JSON, computed at read time**
  (`who-growth/*`, `who-milestones.json`, `complementary-feeding.json`); only parent entries + achievements stored.
- **No scheduler exists.** `node-cron` is not a dependency; `server/src/jobs/` does not exist. Only a
  `reminderSentAt` column + schedule math (`vaccines/schedule.ts`) + a data-file annotation exist.
  CLAUDE.md's "jobs/ node-cron" line is aspirational. → **notification engine is greenfield.**
- **No parent notification center.** Only an admin **order** bell (`AdminNotification` + `AdminBell`) and
  unread care-message counters. "What's due" today = `GreetingHero` pills + `UpNextCard` (vaccine/appt only).
- **Onboarding** = single screen `client/src/pages/BabyForm.tsx` (name/dob/sex + optional birth measurements).
- **AI insight pipeline exists** and is reusable: `POST /babies/:id/insight` → `buildTrackerInsight`
  (`server/src/ai/insights.ts`) → deterministic safety gate → `buildBabyContext` + `SYSTEM_PROMPT` +
  per-tracker directive → LLM → **formula-compliance scrub**. Chat hand-off via `askAssistantLink` → `/chat?q=`.
- **i18n = EN/Hindi only** (flat dict + `t()`), **no Hinglish locale**. Email = SMTP best-effort, no-ops
  unconfigured, 2 types today. **No WhatsApp/SMS/push anywhere.**
- **Journey foundation exists**: `lib/journey.ts` (Day N/2000, 5 static stages) + `JourneyTrack` +
  `BabyJourneyCard` (on parent Dashboard only).
- All clinical reference JSON is `status: REQUIRES PEDIATRICIAN SIGN-OFF BEFORE LAUNCH`, draft v0.1.

## 4. Hard rules preserved (non-negotiable, must survive this refactor)

- AI never diagnoses/prescribes; `red-flags.ts` runs deterministically **before** the LLM.
- Growth uses WHO percentile **bands/trends**, never "baby should weigh X kg."
- **Formula/IMS-Act guard** (`ai/compliance.ts`) scrubs every LLM reply; feeding stays breastfeeding-first.
  The authored notification copy is already IMS-compliant — any AI-augmented copy must still pass the guard.
- Every route JWT-protected + ownership-scoped; DPDP consent; LLM key server-only.
- Vaccine + feeding-safety notifications get **priority styling** (time-sensitive/safety-relevant).

---

## 5. Phased plan

> **Phase 0 STATUS (2026-07-11): mostly done.** Generated `timeline-2000.json` (82 anchors) +
> `daily-notifications.json` (2,000 EN/Hinglish). Reconciliation documented in
> `server/src/data/RECONCILIATION.md`. **Two blockers before launch:** (a) pediatrician must arbitrate
> the vaccine-schedule conflicts before `iap-schedule.json` is edited (timing changes re-seed doses);
> (b) WHO growth LMS tables stop at 24mo — need official 24–60mo LMS to plot percentiles across the full
> journey. Food/growth/milestones have no blocking conflicts.

### Phase 0 — Canonical data foundation (server only, no UI)
Turn the workbook into the app's canonical seed data and reconcile with existing draft JSON.
- `server/src/data/timeline-2000.json` — 82 milestone anchors (all columns incl. vision/cognitive/
  growth-snapshot/doctor-flag), day-indexed.
- `server/src/data/daily-notifications.json` — 2,000 rows `{day, ageMonths, contentType, en, hinglish}`
  (compact; this is the notification content library).
- Reconcile: fold the workbook's IAP schedule into `iap-schedule.json`; keep WHO LMS bands for plotting
  and add the workbook medians as a display overlay; merge food stages into `complementary-feeding.json`;
  enrich `who-milestones.json` (or a new richer milestones file) with vision/cognitive + doctor-flags.
- Keep every `REQUIRES PEDIATRICIAN SIGN-OFF` meta flag. Write a short reconciliation note for known
  conflicts (e.g. PCV booster UIP ~9mo vs IAP 12–15mo; medians are 50th-pct only).

### Phase 1 — One-time onboarding wizard ("enter once")
Expand Add-Baby into a short multi-step wizard capturing the baseline that seeds every journey:
1. Name, DOB, sex (existing) + optional photo.
2. Current measurements → seed an initial `GrowthLog`.
3. Vaccinations already received → mark `VaccineDose.administeredOn` (see Decision C).
4. Feeding stage (exclusively breastfeeding / started solids + when) → IMS-compliant baseline.
5. Sleep pattern (rough) → optional baseline.
6. Notification preferences: channels, preferred time, language, **WhatsApp opt-in + number** (Decision D).
   (DPDP consent screen already exists.)
This is the single data-entry moment; everything after is confirmation.

### Phase 2 — Journeys: "what's expected now" per tracker
Rework each tracker page from entry-form-first to **timeline-first**, driven by the baby's Day N:
- **Growth** — expected median range for age + "add this month's measurement" prompt; keep the
  percentile-band chart. Monthly nudge to update.
- **Vaccination** — already age-driven; add timeline framing + clearer due/overdue.
- **Nutrition** — age-stage card ("6 months — ready to start solids?") with confirm + food ideas.
- **Development/Milestones** — the richest: show the current milestone-check window (motor + vision +
  cognitive from the 82-entry timeline); tick achieved; **"not yet" → Dai Maa guidance**; surface the
  "Talk to doctor if…" flags with extra weight.
- **Sleep** — expected hours-for-age vs logged, gently framed.
Shared `JourneyTimeline` pattern building on `lib/journey.ts` so all trackers feel consistent.
Wire "not met → tap → Dai Maa" through the existing insight/chat pipeline with a milestone-specific
prompt (inherits red-flag + compliance guards).

### Phase 3 — Notification engine (greenfield — the core new value)
1. **`Notification` model** — userId, babyId, type, day, title, body {en, hi, hinglish}, contentType,
   channelsSent[], read, scheduledFor, createdAt.
2. **`NotificationPreference`** (sub-doc/model) — enabled channels, preferred send time, language,
   per-content-type mutes (e.g. mute daily facts, keep vaccine reminders).
3. **Scheduler** — add `node-cron` (or lightweight interval). Daily per active baby: compute Day N →
   pull that day's authored notification(s) + any due vaccine/feeding overlays → create in-app rows →
   dispatch to enabled channels at the preferred time. Idempotent (never double-send a day).
   Only send **forward** from adoption date (no backfill spam for existing/older babies).
4. **Channels**:
   - **Dashboard** (always-works): new parent notification **bell + center**; also feed "Today" hub (Phase 4).
   - **Email**: reuse `mailer.ts` (best-effort); new templated reminder emails.
   - **WhatsApp**: **Meta WhatsApp Cloud API**. Pre-registered message **templates** per type
     (vaccine-due, milestone-check, growth-check, feeding-transition). Opt-in + number from onboarding.
     Owner setup tasks (Meta business verification, number, template approval) documented — these live
     outside the code and gate go-live for this channel only.

### Phase 4 — Dashboard as command center
- New **"Today for {baby}"** card aggregating cross-tracker due items (vaccines, milestone checks,
  growth-due, feeding transitions) — the daily hub, replacing the vaccine-only `UpNextCard`.
- Parent notification bell + center.
- Keep the 2,000-days journey band as the emotional anchor.

### Phase 5 — i18n / Hinglish, migration, QA
- Implement the Hinglish decision (Decision A) and add strings.
- Migration for existing babies: backfill default notification prefs; compute Day N; start journeys
  mid-stream, sending only forward.
- QA: EN/Hindi, light/dark, mobile; verify no regressions to subscription gating, compliance, red-flags.

---

## 6. Owner decisions — RESOLVED (2026-07-11)

- **A. Hinglish** → add as a real 3rd language (`hi-en`).
- **B. Data authority** → workbook is canonical spine; wins over older IAP JSON on conflict; keep sign-off flag.
- **C. Onboarding vaccines** → start all pending; mother checks off what's already done.
- **D. WhatsApp scope** → parent's own number, opt-in, only her baby's reminders; never marketing.
- **E. Build order** → Phases 0→2 first, then Phase 3.
