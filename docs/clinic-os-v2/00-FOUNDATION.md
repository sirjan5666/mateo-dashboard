# Mateo Clinic OS — SPEC 00: FOUNDATION
## Prepend this to every screen spec

Every screen spec in this folder (`01`–`31`) assumes this document. Paste **this file first**, then the
screen spec, then say "build it".

---

## 0. ROLE & OBJECTIVE

You are a senior front-end engineer. Build **pixel-accurate, production-quality, fully responsive** screens
for a clinic management SaaS called **Mateo — Clinic OS** (doctor-facing panel of an Indian paediatric
practice-management platform).

**Stack:** React 18 + TypeScript + Vite, Tailwind CSS v4, `lucide-react` for icons, `recharts` for all
charts, `Inter` (400/500/600/700/800) + `Plus Jakarta Sans` (700/800) from Google Fonts.

**Rules**
- Static UI. No backend. All data comes from typed mock files under `src/data/`.
- Use the **exact** copy, numbers and percentages given. Do not invent, round, or "improve" any value.
- No lorem ipsum. No extra sections. Do not add features not described.
- Desktop-first at **1672 × 941 px** reference viewport, then responsive down to 375 px.
- Everything reusable. No inline magic numbers where a token exists.
- Every number must reconcile with **§9 Canonical dataset**. If a screen shows a total, that total must
  equal the sum of its parts.

---

## 1. DESIGN TOKENS

```js
// tailwind.config.js -> theme.extend.colors
brand: {
  50:  '#EEF2FF',
  100: '#E0E7FF',
  500: '#4F63F5',
  600: '#3B4FE0',   // primary action / active nav
  700: '#2B3FD0',
  900: '#0B1740',
},
navy:    '#0A1B4D',   // sidebar gradient start
royal:   '#1B49D4',   // sidebar gradient end
canvas:  '#F6F7FB',   // page background
card:    '#FFFFFF',
line:    '#ECEEF4',   // card border / dividers
ink:     '#0F172A',   // headings
body:    '#475569',   // body text
muted:   '#64748B',   // secondary TEXT  (see §8 — never #94A3B8 for text)
hairline:'#94A3B8',   // icons, dots, dividers ONLY
success: '#16A34A',
teal:    '#0EA5A5',
amber:   '#F59E0B',
danger:  '#EF4444',
purple:  '#8B5CF6',
rose:    '#F43F5E',
cyan:    '#22D3EE',
sky:     '#0EA5E9',
mint:    '#14B8A6',
slate:   '#64748B',
```

### 1.1 Module hue map — load-bearing
Every module owns one hue. It appears as the card's 3px top accent, the icon-tile fill, the KPI delta and
the footer link. **Never** use a module's hue on another module's screen except in shared chips.

| Module | Hue | Hex |
|---|---|---|
| Patients / clinical core | Indigo | `#4F63F5` |
| Appointments / schedule | Purple | `#8B5CF6` |
| Consultations (live) | Cyan | `#22D3EE` |
| Total revenue | Green | `#16A34A` |
| Today's revenue | Teal | `#0EA5A5` |
| Pharmacy / inventory | Amber | `#F59E0B` |
| Staff / HR / payroll | Rose | `#F43F5E` |
| Growth charts | Sky | `#0EA5E9` |
| Vaccination | Mint | `#14B8A6` |
| Audit logs | Slate | `#64748B` |
| Email logs | Cyan | `#22D3EE` |
| Danger / overdue | Red | `#EF4444` |

### 1.2 Typography scale
| Token | Size / LH / Weight | Font | Used for |
|---|---|---|---|
| `display` | 24 / 32 / 700 | Plus Jakarta | Page H1 |
| `metric` | 30 / 36 / 800 | Plus Jakarta | KPI numbers |
| `metricLg` | 40 / 44 / 800 | Plus Jakarta | Hero numbers (stock card, payroll) |
| `cardTitle` | 15 / 20 / 700 | Plus Jakarta | Card headings |
| `label` | 13 / 18 / 600 | Inter | KPI labels, table headers |
| `body` | 13 / 20 / 400 | Inter | Body / list rows |
| `meta` | 11 / 16 / 500 | Inter | Deltas, chips, footnotes |
| `navSection` | 11 / 16 / 700 / `.08em` / uppercase | Inter | TODAY, PATIENTS, OPERATIONS, ADMIN |
| `mono` | 12 / 16 / 600 | `ui-monospace` | Patient IDs, batch nos., invoice nos. |

All numerals in metrics, tables and money use `font-variant-numeric: tabular-nums`.

### 1.3 Elevation / shape
- **Card:** `bg-white rounded-[14px] border border-[#ECEEF4]`
  `shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]`
- **Card hover:** `shadow-[0_12px_28px_-14px_rgba(16,24,40,.18)]`, `transition: 180ms ease`
- **Modal / slide-over:** `rounded-[20px]`, `shadow-[0_24px_64px_-20px_rgba(10,27,77,.35)]`
- Page gutter `32px` L/R, `28px` top. Grid gap between cards `20px`.

### 1.4 Money & date formatting
- Currency: Indian grouping, no decimals — `₹8,76,430`, `₹1,24,560`, `₹8,000`.
- Dates: `08 May 2025` in tables, `Thursday, 8 May 2025` in headers, `8 May` in chart axes.
- Times: 12-hour with meridiem, IST — `09:00 AM`. Never show a timezone label except in Audit/Email logs,
  which append ` IST`.
- Relative time is secondary, always in `meta` grey: `7 days ago`, `in 8 days`.

---

## 2. GLOBAL LAYOUT

```
┌───────────┬────────────────────────────────────────────┐
│           │  TOP BAR  (h 74px, sticky, white, border-b #ECEEF4)
│  SIDEBAR  ├────────────────────────────────────────────┤
│  w 234px  │  SCROLLABLE CONTENT  (bg #F6F7FB)          │
│  fixed    │  padding: 28px 32px 32px                   │
└───────────┴────────────────────────────────────────────┘
```

Sidebar `position: fixed`, full height, does not scroll with content. Top bar sticky, spans `left: 234px`
to viewport right.

---

## 3. SIDEBAR (fixed, 234px)

**Background:** `linear-gradient(180deg, #0A1B4D 0%, #12309A 55%, #1B49D4 100%)`. All text white.

### 3.1 Logo block (padding 20px)
- 44×44 `rounded-[12px]` tile, gradient `135deg, #7C5CFF → #3B82F6`, white **M** (24px / 800) centred,
  soft outer glow.
- Right of it: **"Mateo"** (24 / 800 / white, tight tracking) over **"CLINIC OS"**
  (11 / 700 / uppercase / `.14em` / `#22D3EE`).

### 3.2 Nav groups
Four groups. Section label uses `navSection`, colour `rgba(255,255,255,.55)`, padding-left 20px,
margin 18px top / 8px bottom. Groups separated by a 1px `rgba(255,255,255,.12)` divider inset 20px.

**TODAY**
| Icon (lucide) | Label | Route |
|---|---|---|
| `LayoutGrid` | Dashboard | `/doctor` |
| `CalendarDays` | Appointments | `/doctor/appointments` |
| `Stethoscope` | Consultations | `/doctor/consultations` |

**PATIENTS**
| Icon | Label | Route |
|---|---|---|
| `Users` | Patients | `/doctor/patients` |
| `FileText` | Prescriptions | `/doctor/prescriptions` |
| `Activity` | Growth & Vaccines | `/doctor/charts` |
| `MessageSquare` | Messages *(badge 3)* | `/doctor/messages` |

**OPERATIONS** — these three use *filled coloured icon tiles* (26×26, `rounded-[8px]`) not line icons:
| Tile | Icon | Label | Route |
|---|---|---|---|
| amber `#F59E0B` | `BriefcaseMedical` | Pharmacy | `/doctor/pharmacy` |
| green `#16A34A` | `IndianRupee` | Revenue | `/doctor/revenue` |
| rose `#F43F5E` | `Users` | Staff | `/doctor/staff` |

**ADMIN**
| Icon | Label | Route |
|---|---|---|
| `Building2` (line) | Locations | `/doctor/locations` |
| `ShieldPlus` (line) | Team & Roles | `/doctor/team` |
| indigo tile `#6366F1` + `AlignLeft` | Audit Logs | `/doctor/audit` |
| cyan tile `#22D3EE` + `Mail` | Email Logs | `/doctor/email-logs` |
| `Settings` (line) | Settings | `/doctor/settings` |

**Nav item spec** — h 40px, padding-x 16px, `rounded-[10px]`, side margin 12px, icon 18px, gap 12px to a
14/600 label. Default `rgba(255,255,255,.88)`. Hover `bg rgba(255,255,255,.08)`.
**Active:** solid `#2B4FF0` pill, white text, `box-shadow: 0 6px 16px -6px rgba(43,79,240,.9)`.
Badge (Messages): 18px pill, `bg #EF4444`, white 10/700, right-aligned in the row.

### 3.3 Footer
Above a 1px `rgba(255,255,255,.12)` divider: a 28px circular outlined button with `ChevronLeft`, then
**"Collapse"** (14 / 500 / `rgba(255,255,255,.8)`). Collapsing animates the rail to **76px** over 200ms —
icons only, labels hidden, active pill becomes a square.

---

## 4. TOP BAR (74px) — identical on every screen

Left → right, vertically centred, 24px horizontal padding:

**1. Location switcher** (the signature control) — pill button `h-40 rounded-[10px] border-[#E2E6F0]
bg-white px-[14px]`, width ≈ 258px. Contents: an 8px **status dot** in the location's hue, label
(14 / 600 / `#0F172A`), `ChevronDown` 16px `#94A3B8`.

- When one location is active: dot in that location's hue, label = location name.
- When **Overall** is active: the dot is a 3-stop conic gradient (indigo → purple → amber) and the label
  reads **"All Locations"**.

**Open state** — a 380px panel, `rounded-[20px]`, white, modal shadow, anchored under the pill:
- Micro-label **"SWITCH LOCATION"** (`meta`, uppercase, `.1em`, `#64748B`), padding `14px 16px 8px`.
- Row height 64px, padding-x 16px, `rounded-[12px]`, hover `bg #F6F7FB`. Each row: hue dot · name
  (14 / 600) over address (12 / 500 / `#64748B`) · right-aligned patient-count chip · a check in a filled
  hue circle when selected (selected row also gets a 6% hue-tinted background).
- Rows, in order: **All Locations (Overall)**, then the three locations from §9.2.
- Divider, then a full-width ghost row **"＋ Manage locations"** with a `Settings2` icon → `/doctor/locations`.

**Behaviour:** changing the location re-scopes **every** page — patients, appointments, revenue, pharmacy,
staff — and persists to `localStorage` under `mateo:activeLocation`. "All Locations" aggregates. Where a
figure cannot be aggregated (e.g. a single clinic's OPD timings), show an em-dash and the tooltip
"Select a single location".

**2. Search field** — centred, width 486px, `h-40 rounded-[10px] bg-[#F7F8FC] border-[#E8EBF3]`.
`Search` 16px `#94A3B8`, placeholder **"Search patients, appointments, invoices…"** (14 / `#64748B`).
Right keycap chip **"Ctrl + K"** — 11 / 600 / `#64748B`, white, `border #E2E6F0`, `rounded-[6px]`,
padding `3px 8px`.

**3. Right cluster** (`ml-auto`, gap 14px)
- `Bell` icon button 38×38 `rounded-[10px]`, hover `#F1F3F9`; badge **6** — 17px circle `#EF4444`,
  white 10/700, offset top-right.
- `Mail` icon button, badge **3**, `bg #3B4FE0`.
- Vertical divider 1px × 28px `#E5E8F0`.
- Avatar 40px circle, 2px white ring; then **"Dr. Ananya Sharma"** (14 / 700 / `#0F172A`) over
  **"Paediatrician"** (12 / 500 / `#3B4FE0`); then `ChevronDown` 18px `#94A3B8`.

---

## 5. SHARED COMPONENTS

### 5.1 Reuse, do not recreate
If you are building **inside the existing Mateo repo**, these already exist — import them, do not author
new versions. Recreating them forks the design system and breaks the Admin and Patient panels, which
share the same files.

| Need | Existing file |
|---|---|
| Card shell | `client/src/components/ui/Card.tsx` |
| Sidebar / Topbar | `client/src/components/layout/Sidebar.tsx`, `Topbar.tsx` |
| KPI, SectionCard, Donut, AreaTrend, BarTrend, BarRow, Sparkline, skeletons, EmptyState | `client/src/components/panel/kit.tsx` |
| Status pill | `client/src/components/ui/StatusPill.tsx` |
| Table primitives | `client/src/components/ui/Table.tsx` |
| Modal / Drawer / DropdownMenu / Tabs / Pagination / Avatar / SegmentedControl / DatePicker / Tooltip | `client/src/components/ui/` |
| Doctor theme tokens | `client/src/index.css` → `[data-theme='pro'][data-panel='doctor']` |

**Palette note:** the existing doctor skin themes through CSS variables (navy `#1e3a8a`, canvas
`#f9fafb`). This spec's palette (`#3B4FE0` / `#F6F7FB`) is a *re-tune of the same slots*. Apply it by
editing the values inside that `[data-panel='doctor']` block — **not** by adding a parallel `brand.*`
Tailwind scale. One source of truth.

If you are building a **standalone prototype**, author them fresh under `src/components/` using the file
list at the end of each screen spec.

### 5.2 New shared components (build once, used by many screens)
| Component | Purpose | First used |
|---|---|---|
| `LocationSwitcher` | §4 control + dropdown | 01 |
| `PageHeader` | H1 + subtitle + right action cluster | all |
| `FilterBar` | search + date range + filter pills + active-chip row | 06, 15, 16, 17, 23, 24 |
| `DateRangePicker` | dual-month popover with presets down the left | 15, 16, 17 |
| `DataTable` | sticky header, 56px rows, hairline dividers, sort, 3-dot column | 06, 15–24, 26–31 |
| `KpiCard` | §6 of spec 01 | 01, 16–24, 26–31 |
| `DrilldownLink` | the "View x →" footer link | all KPI cards |
| `PeekModal` | 720px modal with minimise-to-PiP / expand / close trio | 07, 08 |
| `PipWindow` | draggable, resizable floating chart window | 13, 14 |
| `RoleChip` | the 5 sub-user role chips with their hues | 04, 05, 21, 22, 23, 31 |
| `MoneyCell` | tabular ₹ with optional partial-payment mini bar | 17, 19, 20, 22, 28 |
| `StockLevelBar` | qty bar with a reorder-level marker pin | 18, 26, 30 |
| `PrescriptionSheet` | the A4 preview | 11, 13 |

### 5.3 Recurring patterns
**Page header row** — H1 `display` + subtitle (14 / 400 / `#64748B`, margin-top 6px) on the left;
`ml-auto` gap-12px action cluster on the right (h-44 buttons, `rounded-[10px]`, `border #E2E6F0`).

**Filter bar card** — full-width white card, padding `14px 16px`, containing: a `flex-1` search input
(h-40), a `DateRangePicker` pill, then filter pills (h-36, `rounded-[8px]`, `border #E2E6F0`, 12/600,
each with a `ChevronDown`). Below, an "active filters" row of removable chips (hue-tinted, 11/600, with
an `X` 12px) plus a **"Clear all"** text link.

**Data table** — sticky white header, header cells `label` uppercase `.06em` `#64748B`; rows 56px with
1px `#F4F6FA` dividers; first column always avatar + primary (13/600/`#0F172A`) + secondary
(12/500/`#64748B`); money and counts right-aligned tabular; final column a `MoreHorizontal` 3-dot button.
Row hover `bg #FAFBFF`. Zebra striping is **not** used.

**Drill-down contract** — every KPI card is a link. Card hover raises the shadow and shifts the footer
link's arrow 3px right. The whole card is the click target; the footer link is `aria-hidden` decoration.

**Segment tabs** — a row of pills above a table: label + a hue-tinted count badge. Active pill = solid
hue at 10% tint with the hue as text and a 2px underline in the hue.

---

## 6. STATES

Every screen must implement all four:
- **Loading:** skeletons matching the final layout (`SkeletonKpi`, `SkeletonChart`, `SkeletonRows`).
  Never a spinner on a full page.
- **Empty:** centred icon in a 48px tinted circle, a 15/700 line, a 13/400 `#64748B` line, and one primary
  action. Copy is given per screen where it is non-obvious.
- **Error:** an inline red-tinted band inside the card with the message and a "Retry" ghost button.
  Never replace the whole page.
- **Populated:** as specified.

---

## 7. INTERACTION & MOTION

- Cards: hover raises shadow, 180ms ease.
- Links, chips, buttons: `cursor-pointer`, `focus-visible:ring-2 ring-brand-500 ring-offset-2`.
- Charts animate once on mount (`isAnimationActive`, 700ms ease-out); donuts sweep clockwise, areas fade
  and rise, bars grow width `0 → target` over 600ms with 60ms stagger.
- Modals: scrim fades 150ms, panel scales `0.98 → 1` + fades over 200ms ease-out.
- Slide-overs: translate from the right, 240ms `cubic-bezier(.22,1,.36,1)`.
- PiP windows: spring-free 180ms transform on drag release; minimise collapses to the title bar over 200ms.
- Respect `prefers-reduced-motion: reduce` — disable all entrance animation and chart animation, keep
  opacity changes only.

---

## 8. ACCESSIBILITY — non-negotiable

- **Contrast rule (corrected):** `#94A3B8` on white measures **2.56:1** and fails WCAG AA. Use it only for
  icons, dots and dividers. **All text below 14px on white uses `#64748B`** (4.85:1). Verify every
  text/background pair meets AA 4.5:1 (3:1 for ≥18px or ≥14px bold).
- Semantic landmarks: `<aside>` nav, `<header>` top bar, `<main>` content. Nav is `<nav><ul><li>` with
  `aria-current="page"` on the active item.
- Every icon-only button has an `aria-label`. Badges announce as "6 unread notifications".
- Every chart is accompanied by a visually-hidden `<table>` carrying the same data.
- Colour is never the only signal — status chips carry text, alert rows carry an icon plus text.
- Modals trap focus, close on `Esc`, restore focus to the trigger. PiP windows are keyboard-movable with
  arrow keys when focused.
- Tables: `<caption class="sr-only">`, `scope="col"` on headers, sortable headers expose `aria-sort`.

---

## 9. CANONICAL DATASET — every screen must agree with this

> The single most common defect in the first draft was numbers that contradicted each other across cards.
> These figures are the source of truth. `src/data/` must derive from them, not restate them.

### 9.1 Context
- Doctor: **Dr. Ananya Sharma**, Paediatrician.
- "Today" is **Thursday, 8 May 2025**. Current month = May 2025 (31 days).
- Active location on first load: **Tilak Nagar Clinic**.

### 9.2 Locations
| Location | Hue | Address | Patients | Appts today |
|---|---|---|---|---|
| Tilak Nagar Clinic | Indigo `#4F63F5` | B-14, Tilak Nagar, New Delhi 110018 | **2,486** | 42 |
| Janakpuri OPD | Purple `#8B5CF6` | C-2/45, Janakpuri West, New Delhi 110058 | **786** | 18 |
| Rajouri Garden Clinic | Amber `#F59E0B` | Shop 22, Rajouri Garden, New Delhi 110027 | **288** | 0 *(closed today)* |
| **All Locations (Overall)** | conic | — | **3,560** | **60** |

`2,486 + 786 + 288 = 3,560` ✓  ·  `42 + 18 + 0 = 60` ✓

### 9.3 Tilak Nagar — today's 42 appointments
| Status | Colour | Count | % |
|---|---|---|---|
| Completed | `#22C55E` | 20 | 47.6% |
| Upcoming | `#4F63F5` | 13 | 31.0% |
| Ongoing | `#22D3EE` | 2 | 4.8% |
| Cancelled | `#EF4444` | 3 | 7.1% |
| No Show | `#94A3B8` | 4 | 9.5% |

`20 + 13 + 2 + 3 + 4 = 42` ✓ · `47.6 + 31.0 + 4.8 + 7.1 + 9.5 = 100.0` ✓
*(The first draft used 9.6% for No Show; 4/42 = 9.52% → **9.5%**. Percentages are rounded half-up to one
decimal and may sum to 99.9–100.1; never nudge a value to force 100.)*

### 9.4 Patient demographics — Tilak Nagar (2,486)
| Segment | Colour | Count | % |
|---|---|---|---|
| 0 – 1 year | `#3B4FE0` | 556 | 22.4% |
| 1 – 5 years | `#4F63F5` | 1,024 | 41.2% |
| 5 – 12 years | `#6366F1` | 642 | 25.8% |
| 12+ years | `#A5C4F5` | 264 | 10.6% |

`556 + 1,024 + 642 + 264 = 2,486` ✓

### 9.5 Visits this month — Tilak Nagar
- **New patients: 482** · **Returning patients: 1,236** · **Total visits: 1,718**
- **Returning is the UPPER curve.** 1,236 ÷ 31 days ≈ 39.9/day (range 18–72);
  482 ÷ 31 ≈ 15.5/day (range 6–28). *(The first draft drew New on top while stating New = 482 and
  Returning = 1,236 — arithmetically impossible. Returning on top is correct.)*
- Returning share: 1,236 / 1,718 = **71.9%**

### 9.6 Top visit reasons — of 1,718 visits
| Reason | Count | % of 1,718 | Bar width (vs 412) |
|---|---|---|---|
| Fever | 412 | 24.0% | 100% |
| Cough & Cold | 358 | 20.8% | 87% |
| Vaccination | 296 | 17.2% | 72% |
| Routine Checkup | 241 | 14.0% | 58% |
| Stomach Pain | 187 | 10.9% | 45% |
| *Other (not charted)* | 224 | 13.0% | — |

`412 + 358 + 296 + 241 + 187 + 224 = 1,718` ✓

### 9.7 Revenue — Tilak Nagar
- Total revenue MTD **₹8,76,430** (↑18.4% vs last month)
- Today's revenue **₹1,24,560** (↑14.2% vs yesterday), 9 payments received
- Outstanding from patients **₹46,200** · Refunds MTD **₹3,100**
- By service: Consultation ₹3,84,200 · Pharmacy ₹2,41,800 · Vaccination ₹1,32,400 ·
  Procedures ₹78,030 · Lab ₹40,000 → **₹8,76,430** ✓

### 9.8 Pharmacy — Tilak Nagar
- SKUs **168** · Stock value **₹2,41,800**
- **Low stock 15** + **Out of stock 3** = **18 items need attention** *(the dashboard alert "18 medicine
  items running low" and the pharmacy KPIs must agree — the first draft said 18 in one place and 12+4 in
  another)*
- Expiring within 90 days: 11 batches, **₹14,200** at risk
- Distributor **Rahul Distributors**: purchased ₹1,24,000 · paid ₹1,16,000 · **outstanding ₹8,000**
  (current invoice RD-8871 = ₹10,000, ₹2,000 paid, ₹8,000 due 12 May 2025)
- Total payable across 14 distributors **₹1,84,000** = Current ₹98,000 + 0–30d ₹44,000 + 31–60d ₹28,000
  + 60+d ₹14,000 ✓

### 9.9 Staff — Tilak Nagar
- 14 members · present today 11 · on leave 2 · absent 1 ✓
- May payroll: gross **₹5,02,000** − deductions **₹16,000** = net **₹4,86,000** ✓
- Roles: Reception 3 · OPD 2 · Accounts 1 · HR 1 · Pharmacy 2 · Nursing 4 · Housekeeping 1 = 14 ✓

### 9.10 Recurring people (use these names everywhere)
| Patient | PID | Age | Sex | Parents |
|---|---|---|---|---|
| Aarav Mehta | `PID-2419` | 4y | Male | Rohit & Neha Mehta |
| Myra Kapoor | `PID-2402` | 2y | Female | Arjun & Divya Kapoor |
| Kabir Singh | `PID-2388` | 6y | Male | Manpreet Singh |
| Reyansh Verma | `PID-2371` | 3y | Male | Sameer & Pooja Verma |
| Siya Patel | `PID-2355` | 5y | Female | Nikhil & Riya Patel |
| Ishaan Gupta | `PID-2340` | 5y | Male | Vikas & Anjali Gupta |

Staff: Priya Nair (Reception) · Vikram Yadav (Pharmacy) · Meera Joshi (Accounts) · Sunil Rao (HR) ·
Farah Khan (OPD).

---

## 10. GLOBAL RESPONSIVE BEHAVIOUR

| Breakpoint | Behaviour |
|---|---|
| ≥1536px | As specified. |
| 1280–1535px | Reduced card padding; 3-column rows → 2 columns with the narrowest card moving full-width below. |
| 1024–1279px | Sidebar auto-collapses to the 76px rail. 5-up KPI rows → 3-up (wraps 3+2). All multi-column rows → 2 columns. |
| 768–1023px | Sidebar becomes an off-canvas drawer opened by a hamburger. Search collapses to an icon. Location switcher keeps its dot but truncates the label. All rows → 2 columns. |
| <768px | Single column. Top bar keeps logo + search icon + avatar. KPI cards full width. Donut legends stack under the chart. **Tables become stacked cards** (primary line, secondary line, right-aligned value, 3-dot). Filter bars collapse into a "Filters (3)" button opening a bottom sheet. PiP windows dock to the bottom edge full-width. |

---

## 11. PER-SCREEN DELIVERABLE CONVENTION

Each screen spec ends with a file list. Follow this structure:

```
src/
  data/<screen>.ts          // typed mock, derived from §9
  pages/<Screen>.tsx
  components/<domain>/…     // screen-specific components only
```

Shared components from §5.2 live in `src/components/shared/`. Return complete, runnable code — no `// ...`
elisions, no TODOs.
