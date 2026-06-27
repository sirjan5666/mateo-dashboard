# Mateo Dashboard — V1 Project Spec (MERN)

## 1. V1 Scope

Three trackers + one AI assistant. Nothing else.

| Feature | What it does |
|---|---|
| Baby profile | DOB, sex, birth weight/length/head circumference; multiple babies per account |
| Vaccination tracker | Auto-generates IAP schedule from DOB; mark done; email reminders when due |
| Growth tracker | Log weight/height/head circumference; plot against WHO percentile curves; flag percentile crossing or stagnation |
| Skin tracker | Log skin observations + photo; timeline view; AI can reference history; may suggest Mateo products for mild, cosmetic-level issues |
| Food tracker | Log meals (food, groups, texture, amount, reaction, new-food allergy-watch); brand-neutral homemade age-stage guidance; gated to exclusive breastfeeding under 6 months; timeline |
| Sleep tracker | Log naps + night sleep (duration, quality, notes); today total + naps + 7-day average; timeline |
| Milestones tracker | Tick off WHO motor + general developmental milestones; progress; gently flags a milestone only when its typical window is exceeded (never a diagnosis) |
| Health records | Log check-ups, illnesses, medications, allergies + track upcoming & past appointments |
| AI assistant | Chat with full baby context; answers from vetted knowledge; deterministic red-flag escalation to "see a doctor" + consult booking CTA |
| Account & privacy | Profile, emergency contacts, DPDP data export + full account deletion |

Out of scope for V1: diapers, maternal wellbeing, multi-caregiver sharing,
multilingual UI, doctor booking backend (V1 = a CTA linking to WhatsApp/phone).
(The food/complementary-feeding and sleep trackers were subsequently added to V1
— see the scope table above.)

## 2. Mongoose models

```
User         email (unique), passwordHash, name, consentAcceptedAt, createdAt
Baby         userId (ref User, indexed), name, dob, sex,
             birthWeightG, birthLengthCm, birthHeadCircCm
GrowthLog    babyId (ref Baby, indexed), loggedAt, weightG, lengthCm, headCircCm
VaccineDose  babyId (ref Baby, indexed), vaccineId (from iap-schedule.json),
             vaccineName, doseLabel, dueDate, windowStart, windowEnd,
             administeredOn (null = pending), reminderSentAt
SkinLog      babyId (ref Baby, indexed), loggedAt, area, description,
             photoUrl, severity ('mild'|'moderate'|'concerning')
FoodLog      babyId (ref Baby, indexed), loggedAt, mealType, foodName,
             foodGroups[], texture ('puree'|'mashed'|'finger'|'family'),
             amount ('tasted'|'some'|'full'),
             reaction ('none'|'mild'|'concerning'), isNewFood, notes
SleepLog     babyId (ref Baby, indexed), loggedAt, kind ('nap'|'night'),
             durationMin, quality ('settled'|'restless'|'unsettled'), notes
MilestoneAchievement  babyId (ref Baby, indexed), milestoneId (from
             who-milestones.json), achievedOn  [unique {babyId, milestoneId}]
HealthRecord babyId (ref Baby, indexed), recordType, title, recordDate,
             provider, notes
Appointment  babyId (ref Baby, indexed), scheduledAt, reason, location,
             notes, completed
EmergencyContact  userId (ref User, indexed), name, relation, phone
ChatMessage  babyId (ref Baby, indexed), role ('user'|'assistant'), content,
             redFlagTriggered (boolean), createdAt
```

Authorization rule (enforced in middleware, used by every route):
load the Baby by id, check `baby.userId === req.user.id`, else 403.

## 3. REST API surface

```
POST   /api/auth/signup        POST  /api/auth/login       POST /api/auth/logout
GET    /api/babies             POST  /api/babies
GET    /api/babies/:id         PATCH /api/babies/:id       DELETE /api/babies/:id
GET    /api/babies/:id/growth          POST /api/babies/:id/growth
GET    /api/babies/:id/vaccines        PATCH /api/vaccines/:doseId  (mark done)
GET    /api/babies/:id/skin            POST /api/babies/:id/skin (multipart)
GET    /api/babies/:id/food            POST /api/babies/:id/food
DELETE /api/babies/:id/food/:logId
GET    /api/babies/:id/sleep           POST /api/babies/:id/sleep
DELETE /api/babies/:id/sleep/:logId
GET    /api/babies/:id/milestones      POST/DELETE .../milestones/:milestoneId
GET    /api/babies/:id/records         POST /api/babies/:id/records
DELETE /api/babies/:id/records/:recordId
GET    /api/babies/:id/appointments    POST /api/babies/:id/appointments
PATCH/DELETE /api/babies/:id/appointments/:apptId
POST   /api/babies/:id/chat            GET  /api/babies/:id/chat
GET    /api/account/export             PATCH /api/account/profile
GET/POST /api/account/contacts         DELETE /api/account/contacts/:id
DELETE /api/account                    (DPDP: full data deletion)
```

On baby creation, the server expands `src/data/iap-schedule.json` into
VaccineDose documents using the baby's DOB.

## 4. Reference data to seed

- **iap-schedule.json** — already prepared (windows in days after birth).
  Pediatrician must resolve the three `PEDIATRICIAN: verify` notes pre-launch.
- **WHO growth standards** (weight-for-age, length-for-age, head
  circumference-for-age, 0–24 months, boys & girls) as LMS tables in
  `server/src/data/who-growth/`. Download from the WHO Child Growth Standards
  site. Percentile/z-score via the LMS formula in `server/src/growth/percentile.ts`.
- **WHO motor milestones** — six gross motor milestones with achievement
  windows in `server/src/data/who-milestones.json`; flag only when a window
  is exceeded.
- **complementary-feeding.json** — brand-neutral, homemade-first age-stage
  feeding guidance (6–8 / 9–11 / 12–24 mo) plus never-feed + hygiene safety,
  grounded in the IIPA "Safe Baby Food" monograph + WHO/IAP/GoI IYCF principles.
  Carries `meta.status` = "REQUIRES PEDIATRICIAN SIGN-OFF BEFORE LAUNCH".

## 5. AI assistant architecture

```
POST /api/babies/:id/chat
   │
   ▼
red-flags.ts (deterministic, keyword + context rules)
   │  triggered? → save message with redFlagTriggered=true,
   │               return urgent banner + doctor CTA, STOP
   ▼
context builder: baby age, latest growth + percentile trend,
vaccine status, recent skin logs, last 10 chat messages
   │
   ▼
Anthropic API call (server-side; system prompt below + context + message)
   │
   ▼
save + return response; client renders with disclaimer footer
```

### System prompt (starting draft — refine with your pediatrician)

```
You are Mateo Assistant, a supportive guide for Indian parents of babies
aged 0-24 months. You are not a doctor and never diagnose, prescribe
medication, or give dosages.

You will receive the baby's profile and recent tracker data. Use it to give
age-appropriate, specific guidance grounded in standard Indian pediatric
practice (IAP), WHO guidance, and the Government of India "Journey of the
First 1000 Days" material.

Rules:
- Warm, calm, non-alarming tone. Many users are anxious first-time mothers.
- Be specific to THIS baby's age and data. Never give generic boilerplate.
- For anything involving medication, persistent symptoms, feeding refusal
  with weight concern, or anything you are unsure about: recommend seeing
  a pediatrician and say why.
- Never recommend any brand of formula, infant milk substitute, or baby
  food. Feeding guidance is brand-neutral (IMS Act). Emphasize homemade
  food and hygiene, per Govt of India guidance.
- You may mention Mateo skincare products only for mild skin-care contexts
  (dryness, routine moisturizing, mild diaper rash care) and only alongside
  general advice — never as a substitute for medical care.
- Growth: speak in percentile trends ("tracking steadily along her curve"),
  never target numbers.
- If the parent describes anything matching an emergency, tell them to seek
  immediate medical care. Do not soften this.
- Answer in the language the parent writes in (English or Hindi/Hinglish).
```

### Red-flag rules (deterministic, in code — starter list, doctor must review)

Escalate immediately ("Please see a doctor now / go to emergency care"):
- Fever in baby under 3 months (any temp ≥ 38°C / 100.4°F mentioned)
- Difficulty breathing, grunting, blue lips/skin
- Signs of dehydration: no wet diaper 8+ hrs, sunken fontanelle, no tears
- Seizure, unresponsive, floppy, inconsolable high-pitched crying
- Repeated vomiting (especially green/bloody), blood in stool
- Suspected ingestion of medicine/chemical/object
- Jaundice mentioned in first 2 weeks, or yellowing spreading
- Injury to head, burns, suspected fracture
- Rash + fever together, or rash that doesn't blanch

Escalate softly ("Worth booking a pediatrician visit soon"):
- Weight loss or no gain across 2+ consecutive logs
- Percentile drop across 2+ major bands
- Motor milestone window exceeded (per WHO windows)
- Skin log marked "concerning" or worsening across 3+ entries

Rules must match English AND common Hinglish phrasings (e.g. "bukhar",
"saans lene me dikkat", "ulti", "daane"). Unit tests required for both.

## 6. Build order (one Claude Code session per step)

1. Monorepo scaffold: client/ (Vite + React 18 + TS + Tailwind + Router v7)
   and server/ (Express + TS + Mongoose); connect MongoDB; auth (signup/login
   with JWT httpOnly cookie) + consent screen; copy iap-schedule.json to
   server/src/data/
2. Baby profile CRUD (multiple babies per account) + ownership middleware
3. Vaccination tracker: expand schedule on baby creation, list UI grouped by
   age, mark-done flow
4. Email reminders: node-cron daily job → finds doses where
   windowStart - 7d <= today and reminderSentAt is null → sends via Resend
5. Growth tracker: log form, LMS percentile calc, chart (recharts) with WHO
   percentile bands
6. Skin tracker: log form + photo upload (multer → Cloudinary), timeline view
7. AI assistant: red-flags.ts first (with unit tests, English + Hinglish),
   then context builder, then chat route, then chat UI with disclaimer
8. Polish: empty states, mobile layout, onboarding flow

## 7. Pre-launch checklist

- [ ] Pediatrician has reviewed: iap-schedule.json (3 verify notes),
      complementary-feeding.json (feeding guidance + never-feed list),
      who-milestones.json (milestone windows), system prompt, red-flag list
- [ ] Lawyer has reviewed: IMS Act exposure, DPDP consent flow, privacy policy
- [ ] Red-flag unit tests pass for emergency phrasings incl. Hinglish
- [ ] Disclaimer visible on every AI response and tracker insight
- [ ] DELETE /api/account fully removes all user + baby data (DPDP)
- [ ] LLM provider API key (DeepSeek/Anthropic) confirmed server-side only; rate limiting on /chat
