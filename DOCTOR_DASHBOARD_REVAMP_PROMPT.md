# Doctor Dashboard Revamp — Claude Code Prompt + Feature Ideas

**How to use this file:** Open Claude Code in your project root with the full codebase attached, then paste everything in the **THE PROMPT** block below (from the horizontal rule to the closing rule). The **Feature Suggestions** section at the end is reference material for you — you can fold any of those ideas into the prompt or hand them to Claude Code later.

Your chosen direction is baked in: **premium "data-pro" aesthetic**, **full reimagining** of the doctor panel, **directional design-system guardrails** (Claude Code picks exact fonts/icons within constraints), and **all four priorities** — speed, clinical decision support, at-a-glance awareness, and patient communication.

---

## THE PROMPT

---

You are redesigning and rebuilding the **Doctor Panel** of the Mateo Parenting Dashboard — a pediatric-care web app for Indian families. This is a **full reimagining** of the doctor experience: visuals, information architecture, and workflows. Treat it as a ground-up redesign of how a busy pediatrician works inside the product, not a reskin.

Read `CLAUDE.md` and `PROJECT_SPEC.md` first. They are authoritative. Nothing below overrides the hard rules in `CLAUDE.md`.

### 0. Discovery before code (do this first, then pause)

Before writing any UI, explore and report back:

1. Map every file that powers the doctor panel — routes, pages, components, API helpers, shared UI, theme/Tailwind config, and any design tokens already in use. List the 8 live modules (Growth, Vaccinations, Dose calculator, Development, Lab interpreter, Analytics, Neonatology, Billing) and the core pages (Patients list, Patient detail, Schedule, Messages, Consultations, Profile, Dashboard home).
2. Identify the current component inventory, icon library, fonts, color usage, chart library, and how dark mode is implemented today.
3. Note every place that calls a backend endpoint, so the redesign preserves all existing API contracts and data shapes.
4. Produce a concise **redesign plan**: the new information architecture, the shared design-system primitives you'll build, a component-by-component migration list, and a phased build order. **Show me this plan and wait for approval before implementing.** Keep backend behavior identical unless I approve a change.

### 1. Non-negotiable constraints (must survive the rebuild)

These are from `CLAUDE.md` and are not optional. The redesign is **frontend-first**; do not weaken any of this:

- **Children's health data.** Every API route except auth requires a valid JWT, and every query stays scoped to the authenticated user. Never trust a `babyId`/`patientId` from the client without the existing ownership checks. Do not add analytics or tracking on health records. Do not introduce any client-side call to the LLM provider — the key stays server-only.
- **The parent-facing AI assistant never diagnoses or prescribes**, red-flag escalation stays deterministic in `server/src/ai/red-flags.ts`, and the formula/IMS-Act compliance guard stays intact. You are working on the **doctor** panel, so you likely won't touch these — but if any shared code is in scope, leave these behaviors byte-for-byte intact.
- **Doctor clinical tools keep their existing safety framing.** The dose calculator, lab interpreter, growth charts, and development screen support a clinician's judgment; they must keep showing *recommended ranges, daily maximums, contraindications, WHO percentile bands/trends, and non-diagnostic red flags* exactly as today. Never replace a clinical range with a single "should be X" number. Growth stays percentile/z-score/trend based.
- **Dates** are stored UTC and displayed in Asia/Kolkata. **Ages** are always computed from DOB at read time, never stored.
- **Quality gate:** `npm run lint && npm run typecheck` must pass clean in both `client/` and `server/` before you consider any task done. Keep TypeScript strict; no new `any`. Preserve i18n (EN/हिन्दी) — every new string goes through the existing translation system, no hardcoded copy.

### 2. Design direction — "Premium data-pro, clinically calm"

The target feel is a **high-end clinical analytics console** — think the density and precision of Vercel/Linear/Notion dashboards, applied to pediatric care. Powerful and information-rich, but never noisy. A doctor should feel it respects their time and intelligence.

These are **guardrails, not exact specs** — choose the precise tools yourself, but stay inside them and justify your picks in the plan:

- **Typography.** Pick one modern, highly legible UI sans (a clean grotesque/geometric face) and use **tabular/lining numerals everywhere numbers matter** — doses, weights, percentiles, vitals, money, dates — so digits align in tables and don't jitter on update. Establish a clear type scale (display / heading / body / label / mono-data) and use real hierarchy instead of bold-everything. Optionally a slightly distinct display face for page titles. Self-host fonts; don't add render-blocking external font requests.
- **Icons.** Standardize on a **single consistent line-icon set** with uniform stroke weight (e.g. a Lucide-class library). One icon per concept across the whole panel. No mixed icon styles.
- **Avatars (explicitly requested).** Build a reusable `Avatar` system: supports uploaded photos, falls back to clean initials on a **deterministic color derived from a name hash** (same person → same color everywhere). Doctors get a profile photo in the sidebar and headers. Patients (babies) get a friendly, non-childish identicon/initial avatar shown in lists, detail headers, schedule rows, watchlists, and messages so the doctor recognizes families at a glance. Support avatar groups/stacks where useful (e.g. family members, care team).
- **Color.** Neutral, premium base (a refined slate/zinc ramp), one confident primary (clinical blue), and restrained semantic accents. **Preserve the existing status semantics** so the team isn't retrained: Active = green, Discharged = gray, Follow-up = amber, Monitoring = blue, Clearing = purple, Maintenance = yellow. Use color to encode meaning (status, severity, normal/low/high), never as decoration. Ensure every status is distinguishable without relying on color alone (pair with icon/label) for accessibility.
- **Surfaces & density.** Card-based but disciplined: consistent radii, soft shadows, hairline borders, a single spacing scale (4px base). Aim for **information-dense but breathable** — this is data-pro, so favor compact tables and tight KPI rows, but add a global **Comfortable/Compact density toggle** persisted per doctor.
- **Data visualization.** Use one charting approach consistently. Charts must be clinical-grade: clear axes, gridlines, reference bands (e.g. WHO percentile curves, normal lab ranges), accessible tooltips, and legible at a glance. No 3D, no gratuitous gradients on data. Numbers and trends are the hero.
- **Motion.** Subtle and fast (≈120–200ms), purposeful only: gentle hover/press states, smooth route transitions, quick CountUp on KPI load. No bouncy or attention-seeking animation in a clinical tool. Respect `prefers-reduced-motion`.
- **Dark mode is first-class**, not an afterthought — design tokens for both themes from the start; keep the existing theme toggle. Verify contrast in both.
- **Accessibility (WCAG AA).** Full keyboard navigation, visible focus rings, proper roles/labels, AA contrast, screen-reader-friendly tables and charts, hit targets ≥40px. This is a professional tool used all day — a11y is part of "done."
- **Responsive.** Desktop-first (doctors mostly use larger screens) but fully usable on tablet; sidebar collapses gracefully; tables become responsive cards or horizontally scroll with sticky first column.

Implement this as a **real design system**: centralize tokens (color, type, spacing, radius, shadow, motion) in the Tailwind config / CSS variables, and build a small set of reusable primitives (Button, Card, StatCard, Table, Badge/StatusPill, Avatar, Tabs, Modal/Drawer, Toast, EmptyState, Skeleton, Tooltip, charts) that every page composes from. Consistency comes from these primitives, not per-page styling.

### 3. Information architecture — reimagined (full reimagining)

Goal: **fewer places to look, fewer clicks to act, nothing important missed.** The current sidebar has 14+ flat items (Home, Patients, Schedule, Messages, Consultations, Growth, Vaccines, Dose calc, Neonatology, Development, Labs, Analytics, Billing, Profile). Reorganize and streamline:

- **Group the navigation** into a few labeled sections, e.g. **Today** (Home/Today view), **Patients** (Patients, Schedule, Messages, Consultations), **Clinical tools** (Growth, Vaccines, Dose calc, Development, Labs, Neonatology), and **Practice** (Analytics, Billing, Profile). Collapse rarely-used items; keep the active state obvious.
- **A global command palette (⌘K / Ctrl-K):** jump to any patient, page, or action (start a prescription, add growth entry, open dose calc, book follow-up) by typing. This is the single biggest speed win — make it excellent.
- **Patient-centric, not module-centric.** The clinical modules are powerful but today they're siloed. Make the **patient the hub**: from a patient's detail page a doctor should reach growth, vaccines, dose calc, labs, development, encounters, prescriptions, and messages *in context* (pre-filtered to that child), without re-selecting the patient. The standalone module pages still exist for cross-patient work, but in-patient context is the primary path.
- **Persistent quick-add** (a "+" / command action) to create the common things from anywhere: encounter/SOAP note, prescription, vaccination record, growth entry, lab report, follow-up, video consult.
- **Breadcrumbs + recents:** always show where you are; keep a "recent patients" jump list.

### 4. Solve these four pain points (all in scope)

**A. Speed & fewer clicks.** Command palette; keyboard shortcuts for frequent actions (new note, search, save) with a discoverable shortcut cheat-sheet; quick-add everywhere; inline editing instead of full-page forms; optimistic UI with toasts; sensible defaults pre-filled from patient context (age, weight auto-flow into dose calc and growth); bulk actions in lists; "save and next" flows for repetitive work. Count the clicks for the top 5 doctor tasks before and after — reduce each.

**B. Clinical decision support.** Surface the intelligence the app already computes, proactively and in context: dosing pre-populated from the latest recorded weight with daily-max and contraindication warnings; growth entries instantly flagged for percentile *crossing* / flat trend; lab values auto-classified Low/Normal/High against age-banded ranges with the abnormal ones pulled to the top; vaccination due/overdue computed from DOB and shown as a clear worksheet; development red flags highlighted non-diagnostically; neonatology corrected-age applied automatically for preemies. Make abnormal/actionable items visually unmistakable. Never cross into auto-diagnosing — these assist the doctor's decision.

**C. At-a-glance awareness.** A redesigned **Today view** as the home: today's schedule, who's waiting, follow-ups due, in-observation patients, unread messages, and a **clinical watchlist driven by real signals only** (overdue vaccines, concerning growth trend, flagged labs, pending follow-ups) — never fabricated alerts. KPI row with live counts. A "needs your attention" rail that's empty-states gracefully ("All clear") when nothing's pending. Keep the signature **First 2000 Days journey band** but make it cleaner and more legible.

**D. Patient communication.** A focused two-panel Messages experience with patient context alongside the thread; quick reply templates / canned responses for common guidance; the ability to attach a prescription, lab interpretation, growth snapshot, or follow-up booking directly into a message; clear unread/needs-reply states; and a smooth handoff so what the doctor sends shows up correctly on the parent side. Respect the existing messaging/consultation backend.

### 5. Page-by-page expectations

Rebuild each of these on the new design system. Keep all existing functionality; improve clarity, density, and flow:

- **Today / Home:** hero greeting (time-aware), KPI row with CountUp, redesigned **First 2000 Days journey band**, weekly activity chart, today's schedule, signal-driven watchlist, patients-by-status donut, recent patients with journey-day, quick actions, and the **Clinical Modules grid** (live tiles link; roadmap tiles show a "Soon" chip).
- **Patients list:** fast search, status filter, density-aware table with avatars, inline quick actions, bulk select, saved filters. Empty/loading states.
- **Patient detail (the hub):** clean header (avatar, name, age computed from DOB, status pill, key vitals), tabbed or sectioned context — Overview, Encounters (SOAP), Prescriptions (with dose-check), Growth, Vaccines, Development, Labs, Appointments, Messages — all pre-scoped to this child. Make the most-used actions one click from the header.
- **Schedule:** day/week views, accept/complete, drag-friendly where sensible, clear status colors, quick-book.
- **Messages:** two-panel chat with patient context rail and templates (see 4D).
- **Consultations:** video/in-person, join links, clean states.
- **Growth charts:** WHO 0–24mo percentile curves, plot weight/length/head, show percentile + z, age-banded, trend/crossing flags.
- **Vaccinations:** IAP schedule from DOB grouped by age, due/overdue/upcoming, mark-given worksheet.
- **Dose calculator:** weight/age drug dosing (recommended range, daily max, contraindications) + IV fluids (Holliday-Segar maintenance, deficit, drip rate). Pre-fill from patient context; make warnings prominent.
- **Development:** milestones by domain (motor/language/social), achieved worksheet, non-diagnostic red flags.
- **Lab interpreter:** classify CBC/CRP/TSH/Vit D/ferritin etc. as Low/Normal/High vs age-banded ranges; surface abnormals first.
- **Analytics:** new patients & visit notes per month, age + status distribution, visit types, appointment outcomes, attendance %. Premium chart styling.
- **Neonatology:** corrected age for prematurity + day-of-life fluid/feed planner (breast-milk-first framing preserved).
- **Billing:** invoices with line items, mark paid/cancel, outstanding, today/month collections, daily-collection chart.
- **Profile:** doctor profile + avatar upload, preferences (density, theme, language).

### 6. Build approach

- **Phase 0 — Foundations:** design tokens, Tailwind/theme config, and the shared primitive components (incl. Avatar, StatusPill, StatCard, Table, charts). Get dark mode + density toggle working here.
- **Phase 1 — App shell:** new grouped sidebar, top bar, command palette, breadcrumbs, quick-add.
- **Phase 2 — Today/Home** on the new system.
- **Phase 3 — Patients list + Patient detail hub.**
- **Phase 4 — Clinical modules** (Growth, Vaccines, Dose calc, Development, Labs, Neonatology).
- **Phase 5 — Schedule, Messages, Consultations, Analytics, Billing, Profile.**
- Work in small, reviewable commits. After each phase, run lint + typecheck, and give me a short summary + screenshots (light and dark). Don't move to the next phase until the current one is green.

### 7. Definition of done

- `npm run lint && npm run typecheck` pass clean in `client/` and `server/`.
- No regressions: every existing doctor feature works; all API calls and data scoping unchanged; i18n intact (EN + हिन्दी); dark mode correct.
- Accessibility: keyboard-navigable, visible focus, AA contrast, labeled controls and charts.
- Responsive at desktop and tablet widths.
- All clinical safety framing preserved (ranges/maxes/contraindications/percentile-trends/non-diagnostic flags).
- Provide before/after screenshots of each major page (light + dark) and a brief note on click-count reductions for the top doctor tasks.

When in doubt, prefer clarity and clinician trust over visual flash. Ask me before changing any backend contract, data model, or compliance-related behavior.

---

## END OF PROMPT

---

## New feature suggestions (reference — fold in what you like)

Mapped to your four priorities. Each is designed to respect the app's compliance rules (no AI diagnosis, deterministic safety logic, strict data scoping, WHO/IAP-based clinical content).

### Speed & fewer clicks
- **Command palette (⌘K)** — universal search + actions; the single biggest time-saver. *(Already in the prompt.)*
- **Keyboard-first charting** — shortcuts for new note / save / search / "save & next," with a discoverable cheat-sheet (press `?`).
- **SOAP note templates & smart snippets** — reusable encounter templates per visit type (well-baby, fever, follow-up) that pre-fill structure; doctor edits rather than writes from scratch.
- **Quick-add everywhere** — one action to create a note, prescription, vaccine record, growth entry, lab, or follow-up from any screen, pre-scoped to the current patient.
- **"Up next" queue** — a waiting-room/visit queue so the doctor flows patient→patient without returning to a list.

### Clinical decision support
- **Context-aware dose calculator** — auto-pulls latest weight, flags daily max and contraindications, warns on missing/stale weight. Optional drug-interaction check against the patient's active prescriptions.
- **Proactive growth alerts** — automatic percentile-crossing / flat-trend / faltering-growth flags surfaced on the patient header and watchlist (trend-based, never "should weigh X").
- **Lab abnormals-first view** — auto-classify against age-banded ranges and float the Low/High values to the top with severity coloring.
- **Vaccination catch-up planner** — from DOB + history, compute overdue doses and propose an IAP-compliant catch-up schedule worksheet.
- **Red-flag / triage summary on the patient header** — a deterministic, non-diagnostic "watch" strip (overdue vaccines, concerning trend, flagged labs) so risk is visible the moment a chart opens.
- **Visit-prep brief** — before each appointment, a one-screen auto-summary: age, last visit, open items, due vaccines, recent growth/labs, last messages — so the doctor walks in informed.

### At-a-glance awareness
- **Redesigned Today view** with a signal-driven clinical watchlist (real signals only) and a graceful "All clear" state. *(In the prompt.)*
- **Smarter First 2000 Days journey band** — cleaner, with stage tooltips and quick jump to each child.
- **Daily digest / end-of-day summary** — optional emailed or in-app recap of the day's patients, pending follow-ups, and tomorrow's schedule. (Could reuse the existing node-cron + Resend setup; opt-in only, no health data in email beyond what's already permitted.)
- **Follow-up tracker** — never lose a "see in 2 weeks"; auto-surfaces when due.

### Patient communication
- **Reply templates / canned guidance** — fast, consistent answers to common parent questions, editable before send.
- **Attach clinical artifacts to messages** — drop a prescription, lab interpretation, growth snapshot, or follow-up booking straight into the thread.
- **Shareable visit summary** — generate a clean parent-facing recap (leveraging the existing printable PDF report) and send it after a visit.
- **Needs-reply inbox state** — clear unread/awaiting-doctor flags so nothing sits unanswered.

### Cross-cutting / nice-to-have
- **Density & theme preferences per doctor** (compact/comfortable, light/dark, language) — persisted.
- **Audit-friendly activity log** on a patient (who changed what, when) — supports trust and continuity without adding tracking on the *parent* side.
- **Print/export polish** for charts and reports (growth curve, dosing record) for physical files and referrals.

> Note on scope & compliance: keep every clinical feature **assistive, not diagnostic**; keep escalation/red-flag and formula-compliance logic deterministic and server-side; keep all data strictly scoped to the authenticated doctor's patients; and keep feeding/nutrition content breastfeeding-first and formula-free outside the existing gated storefront.
