# Mateo Parenting Dashboard

## What this project is
A web dashboard for Indian parents (primary user: mothers) to track their baby's
health, paired with an AI assistant that gives age-aware guidance and escalates
to a doctor when needed. Built by Mateo (mateocare.com), a natural baby skincare
brand. See PROJECT_SPEC.md for full scope, data models, and AI agent rules.

## Tech stack
- Frontend: React 18 + Vite, TypeScript, Tailwind CSS, React Router v7
- Backend: Node.js + Express (TypeScript), REST API
- Database: MongoDB with Mongoose
- Auth: JWT (httpOnly cookies) + bcrypt
- AI: server-side LLM, model name via env var (never hardcoded). Provider is
  auto-selected — DeepSeek (OpenAI-compatible) if DEEPSEEK_API_KEY is set, else
  Anthropic. See `server/src/ai/provider.ts`.
- Email: Nodemailer + SMTP via `server/src/lib/mailer.ts`, OPTIONAL — it no-ops
  without SMTP config. Used for admin order notifications (which always land
  in-app regardless) and credential-invite emails for doctor-added parents
  (`server/src/lib/inviteEmail.ts`; when SMTP is unset the doctor UI shows the
  credentials once instead). No cron/scheduled email exists yet.
- Payments (shop): Razorpay — the server creates the order and verifies the
  HMAC signature (`server/src/lib/razorpay.ts`); when keys are unset, checkout
  falls back to a clearly-labelled mock payment so dev works end-to-end.
- Photo uploads (skin tracker): multer → Cloudinary (URL stored in MongoDB)

## Project structure (monorepo)
- `client/` — Vite React app
  - `src/pages/` — routes: growth, vaccines, skin, chat (React Router v7)
  - `src/components/` — UI, one folder per tracker
  - `src/api/` — typed fetch helpers for the backend
- `server/` — Express app
  - `src/routes/` — auth, babies, growth, vaccines, skin, food, sleep, milestones, health, account, chat
  - `src/models/` — Mongoose schemas
  - `src/ai/` — system prompt, context builder, red-flags.ts, provider.ts
  - `src/food/` — feeding.ts (complementary-feeding guidance, age stages)
  - `src/milestones/` — milestones.ts (WHO motor + general developmental milestones)
  - `src/data/` — iap-schedule.json, complementary-feeding.json, who-milestones.json, WHO growth LMS tables
  - `src/lib/` — ist.ts (Asia/Kolkata calendar helpers)
  - `src/jobs/` — node-cron job for vaccine reminder emails
  - `src/middleware/` — auth middleware, error handler

## Hard rules — never violate
1. The AI assistant NEVER diagnoses or prescribes. It informs, guides, and
   recommends seeing a pediatrician. This wording must survive every refactor.
2. Red-flag escalation logic lives in `server/src/ai/red-flags.ts` as
   deterministic TypeScript — NOT inside the LLM prompt. It runs on every user
   message BEFORE the LLM API call. If triggered, return the urgent-care
   response regardless of what the model would say.
3. Growth feedback uses WHO percentile bands and trends. Never tell a parent
   their baby "should weigh X kg." Flag percentile *crossing* or flat growth.
4. The AI assistant and ALL feeding/tracker guidance NEVER recommend or
   normalize infant formula or milk substitutes (IMS Act 1992). Feeding guidance
   stays brand-neutral and breastfeeding-first; the deterministic formula guard
   in `server/src/ai/compliance.ts` scrubs it from every LLM reply and must
   survive every refactor. Mateo's own skincare products MAY be suggested in the
   skin tracker only.
   CARVE-OUT (owner decision, 2026-06-19): the storefront (`/shop`) lists the
   partner brand Neucomed's infant formula under strict IMS-Act gating — a
   mandatory statutory-warning interstitial before the section, factual
   non-promotional copy, the "Mother's milk is best" notice on every product,
   and NO discounts/inducements/superiority claims. The shop is the ONLY place
   formula may appear; the assistant, per-tracker insights and feeding trackers
   stay formula-free.
5. This is children's health data. Every API route (except auth) requires a
   valid JWT, and every query is scoped to the authenticated user's babies —
   never trust a babyId from the client without checking ownership. No
   analytics/tracking on health records. Consent screen before any data is
   stored (DPDP Act). The LLM provider API key (DeepSeek/Anthropic) lives ONLY
   on the server; the client never calls the LLM provider directly.

## Conventions
- All dates stored as UTC Date objects; display in Asia/Kolkata on the client
- Baby ages computed from DOB at read time — never store "age"
- Every AI response in the UI carries the disclaimer footer component
- Validate all request bodies with zod before touching the database
- Run `npm run lint && npm run typecheck` in both client/ and server/
  before considering a task done

## Pull requests & deploys — always follow (main auto-deploys to PRODUCTION)
A merge to `main` AUTO-DEPLOYS to production (https://app.mateocare.com on AWS
Lightsail) via `.github/workflows/deploy.yml`: gate (typecheck·lint·build for
client+server) → SSH → `git pull` → build → restart mateo + Caddy → health check. So
opening/merging a PR = shipping to real families. Whenever you create a PR:
1. **Green before it ships.** `npm run lint && npm run typecheck` in BOTH client/ and
   server/ + a passing build. The CI gate blocks deploy on any failure; never merge a
   red gate. Verify the change actually WORKS end-to-end (drive the flow) — it goes
   live, so types/tests passing is not enough.
2. **Scope the PR to just its change.** The working tree often has large unrelated WIP
   — never sweep it in. `git add` only the intended files and confirm with
   `git diff --cached --name-only` before committing.
3. **Branch → PR against `main`.** Never push straight to `main`, never `--no-verify` /
   skip hooks, never hand-edit the production box.
4. **Preserve the hard rules above** — any PR touching AI replies, red-flags,
   formula/IMS-Act compliance, growth percentiles, or route auth/ownership must keep
   them intact; call it out explicitly in the PR body.
5. **Secrets/keys stay out of the repo and out of chat** — never commit `.env`, tokens,
   or SSH keys; deploy secrets live only in GitHub Actions secrets.
6. PR title + body: state what ships and how it was verified; note the prod impact.
   Co-author the commit and end the PR body with the Claude Code footer.

## Current phase
V1 = auth + baby profile + the following per-baby trackers, plus an AI assistant
(mateo.ai) with red-flag escalation: vaccinations, growth, food
(complementary-feeding, 6m+), feeds (0-6m milk: breast/expressed/water,
brand-neutral/IMS-compliant), sleep, diapers (wet/dirty + a gentle concerning-
stool-colour hint), symptoms/fever (age-aware red-flag → "talk to a doctor"),
medicines (dose checklist from doctor prescriptions), skin, milestones, and
health records/appointments. Also: 3-panel system (admin/parent/doctor),
consultations (mock payment) + doctor↔parent chat + Google-Meet links +
prescriptions, community feed, refer & earn, a printable PDF report, and EN/हिन्दी
i18n. Feeding stays brand-neutral/homemade-first; the app NEVER records or
recommends formula. Maternal wellbeing remains out of scope — do not build it.
(Diapers were moved into scope at the owner's request on 2026-06-14.)
Storefront added 2026-06-19 (`/shop`): Mateo skincare + Neucomed infant formula
with cart, Razorpay checkout (mock fallback), shipping-address checkout, per-order
status + tracking, and admin order management + new-order notifications (in-app +
optional email). The Neucomed/formula section sits behind a mandatory IMS-Act
statutory-warning popup and is presented factually with no promotions — see hard
rule 4's carve-out. Catalog: `server/src/data/shop-catalog.ts` (static; placeholder
prices to replace with real MRP). Routes: `server/src/routes/shop.ts`.
Subscription + doctor→parent onboarding added 2026-06-28: the trackers, Tara AI
and the PDF report sit behind the paid "Mateo plan"; doctor access,
consultations, shop, community and settings stay free. Enforcement is
server-side (402 `subscription_required` from
`server/src/middleware/subscription.ts`, applied PER-ROUTE — never router.use,
the tracker routers share one `/api` mount) plus a client guard
(`RequireSubscribed` → `/subscribe`, Razorpay checkout with a labelled mock
fallback in dev; plan prices in `server/src/routes/subscription.ts` are
PLACEHOLDERS). GRANDFATHER RULE (load-bearing): a parent User with NO
`subscription` sub-doc is subscribed (source `mateo`) — pre-paywall accounts
never lock; admin-created parents are granted `mateo`; doctor-invited parents
start unsubscribed (source `doctor`). Only three places may write the sub-doc:
admin parent-create, the invite flow, and subscription checkout/verify.
Doctor→parent bridge: `POST /api/doctor/patients/:id/invite-parent` creates the
parent-app account + Baby (one-time copy of the patient's demographics, IAP
schedule synced), links `Patient.parentUserId/babyId`, emails credentials, and
sets `consentPending` → the parent personally confirms the DPDP consent screen
on first login before the app renders. The "First 2000 Days" journey band lives
on the PARENT dashboard (`client/src/components/journey/`), not DoctorHome.
