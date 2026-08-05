# SPEC 01 — Dashboard  *(corrected)*
`/doctor` · Prepend **00-FOUNDATION.md**

> **Changes from the first draft, and why.** Four defects are fixed here — do not reintroduce them:
> 1. **KPI row** now carries the five cards from the brief: Upcoming Appointments, **Ongoing
>    Appointments**, Total Patients, Total Revenue, Today's Revenue. "Low Stock Items" was displacing
>    Ongoing; it moves to the Alerts card, where the same 18 items were already being reported.
> 2. **New vs Returning curves are swapped.** Returning (1,236) is the upper series; New (482) is lower.
>    The draft drew New on top while stating New < Returning.
> 3. **No Show is 9.5%** (4/42 = 9.52%), not 9.6%.
> 4. **Top 5 visit reasons** are re-based on the 1,718 monthly visits; the draft's counts implied a
>    ~2,300 total that existed nowhere else.

---

## 1. PAGE HEADER

Left:
- `h1` **"Good morning, Dr. Ananya"** (`display`) with an inline amber `Sun` icon 20px after the text.
- `p` **"Here's what's happening at Tilak Nagar Clinic today."** (14 / 400 / `#64748B`, margin-top 6px).
  The clinic name is bound to the active location; when **All Locations** is active the line reads
  **"Here's what's happening across all 3 locations today."**

Right (`ml-auto`, gap 12px):
- **Date picker** — width 246px, h-44, white, `rounded-[10px]`, `border #E2E6F0`; `Calendar` 17px
  `#3B4FE0` + **"Thursday, 8 May 2025"** (14 / 600) + `ChevronDown` far right.
- **Filter** — h-44, padding-x 18px, white, `rounded-[10px]`, `border #E2E6F0`;
  `SlidersHorizontal` 16px `#3B4FE0` + **"Filter"** (14 / 600).

---

## 2. KPI ROW — 5 cards

`grid grid-cols-5 gap-5`, margin-top 22px. Each card: white, `rounded-[14px]`, `border #ECEEF4`,
padding `18px 20px 14px`, plus a **3px full-width accent bar flush to the top edge** inheriting the top
corner radius. **The entire card is a link** (§5.3 drill-down contract).

Anatomy, top to bottom:
1. Row: 46×46 `rounded-[12px]` icon tile (left) + column with label (13 / 600 / `#64748B`) and metric
   (30 / 800 / `#0F172A`, margin-top 2px).
2. Delta line, margin-top 10px: `ArrowUp` 13px + bold coloured % + comparison text (12 / 500 / `#64748B`).
3. 1px `#F1F3F9` divider at margin-top 12px.
4. Footer link row, padding-top 10px: 13 / 600 in the accent colour + `ArrowRight` 14px.

| # | Accent | Icon tile | Label | Metric | Second line | Footer link → |
|---|---|---|---|---|---|---|
| 1 | `#8B5CF6` | `#F5F0FF` tint / `CalendarClock` purple | Upcoming Appointments | **13** | `Next at 11:00 AM` (no arrow, `#64748B`) | View appointments → `/doctor/appointments` |
| 2 | `#22D3EE` | `#22D3EE` solid / `Activity` **white** | Ongoing Appointments | **2** | a 7px pulsing cyan dot + `In consultation now` | View consultations → `/doctor/consultations` |
| 3 | `#4F63F5` | `#EEF2FF` tint / `Users` indigo | Total Patients | **2,486** | ↑ **12.6%** `vs last month` (green) | View patients → `/doctor/patients` |
| 4 | `#16A34A` | `#16A34A` solid / `IndianRupee` **white** | Total Revenue (MTD) | **₹8,76,430** | ↑ **18.4%** `vs last month` (green) | View revenue → `/doctor/revenue` |
| 5 | `#0EA5A5` | `#0EA5A5` solid / `Wallet` **white** | Today's Revenue | **₹1,24,560** | ↑ **14.2%** `vs yesterday` (green) | View today's revenue → `/doctor/revenue?range=today` |

Cards 1 and 3 use pale tinted tiles with coloured glyphs; cards 2, 4, 5 use solid tiles with white glyphs.
Card 2's dot animates `opacity .4 → 1` on a 1.6s loop (disabled under `prefers-reduced-motion`).

When **All Locations** is active the metrics become the Overall figures from §9.2: Total Patients
**3,560**, and each card gains a 10px sub-caption **"across 3 locations"** in `meta` grey.

---

## 3. MIDDLE ROW — 3 columns

`grid grid-cols-[1.06fr_1.15fr_0.95fr] gap-5`, margin-top 20px. Columns 1 and 2 are single cards of
matching height (~318px); column 3 is a stack of two cards (gap 20px) summing to the same height.

### 3.1 "Patient Demographics"
- Header: `Users` 16px in a 28×28 `#EEF2FF` `rounded-[8px]` tile + title + 14px `Info` outline
  `#94A3B8`. Right: select pill **"This Month ▾"** (h-32, `border #E2E6F0`, 12 / 600).
- **Left — Recharts donut.** `outerRadius 78`, `innerRadius 56`, `startAngle 90`, `endAngle -270`,
  `paddingAngle 0`, no stroke. Centre: **2,486** (24 / 800) over **"Total Patients"** (11 / 500 /
  `#64748B`).
- **Right — legend**, 4 rows at 36px: 9px dot + age label (13 / 500 / `#475569`) left; **count**
  (13 / 700 / `#0F172A`) + `(pct)` (12 / 500 / `#64748B`) right-aligned.
- Data: **§9.4** verbatim.
- **Footer strip** inside the card: full-width `#F6F7FB` band, `rounded-[10px]`, padding `10px 14px`.
  Left: indigo `UsersRound` badge + **"Most patients in:"** (12 / 500 / `#64748B`) + **"1 – 5 years"**
  (12 / 700 / `#0F172A`). Right: **"View full report →"** (12 / 600 / `#3B4FE0`).

### 3.2 "New vs Returning Patients"
- Header: `TrendingUp` white in a 28×28 solid `#3B4FE0` tile + title + `Info`. Right: **"This Month ▾"**.
- Legend row: `● Returning Patients` (`#22C55E`) · `● New Patients` (`#3B4FE0`) — 12 / 500 / `#475569`,
  gap 20px. **Returning is listed first because it is the upper series.**
- **Chart:** Recharts `AreaChart`, height 190px, 31 daily points, two `type="monotone"` series, 2px
  strokes, a dot at every point (`r=3`, filled with the series colour, 1.5px white stroke), gradient
  fills fading to transparent:
  - **Returning** — stroke `#22C55E`, fill `#22C55E` 18% → 0%. **Upper curve.** Range 18–72, four rising
    waves, peaking near 72 around 22 May, ending near 66. Sums to **1,236**.
  - **New** — stroke `#3B4FE0`, fill `#3B4FE0` 22% → 0%. **Lower curve.** Range 6–28, gently rising,
    ending near 24. Sums to **482**.
- Y axis ticks `0, 20, 40, 60, 80`, 11px `#64748B`, no axis line. Horizontal dashed grid `#EEF1F6`,
  no vertical grid.
- X axis ticks **1 May, 8 May, 15 May, 22 May, 31 May** (11px `#64748B`).
- Tooltip: white, `rounded-[8px]`, shadow, showing the date and both series values.
- **Footer** above a 1px `#F1F3F9` divider: **"Total Returning:"** **1,236** (`#16A34A`, 700) ·
  **"Total New:"** **482** (`#3B4FE0`, 700) on the left; **"View analytics →"** on the right.
- Below the totals, a `meta` line: **"71.9% of visits this month were returning patients."**

### 3.3 "Today's Schedule (8 May)"
- Header: 28×28 `#EEF2FF` tile + `CalendarClock` + title; right link **"View all →"**.
- 5 rows at 30px, separated by 1px `#F4F6FA`. Row: 7px hue dot · **time** (12 / 700 / `#0F172A`, fixed
  70px) · **name** (12 / 600) · **age** (12 / 500 / `#64748B`) · **type** (12 / 500 / `#64748B`) ·
  right-aligned status chip (10 / 600, `rounded-[6px]`, padding `3px 8px`).

| Time | Patient | Age | Type | Status chip |
|---|---|---|---|---|
| 09:00 AM | Myra Kapoor | 2y | Follow-up | `Completed` — `bg #DCFCE7` `#15803D` |
| 10:00 AM | Aarav Mehta | 4y | Consultation | `Completed` — `bg #DCFCE7` `#15803D` |
| 11:00 AM | Kabir Singh | 6y | Vaccination | `Ongoing` — `bg #CFFAFE` `#0E7490`, with a pulsing dot |
| 12:00 PM | Siya Patel | 3y | Consultation | `Confirmed` — `bg #EEF2FF` `#3B4FE0` |
| 01:00 PM | Ishaan Gupta | 5y | Follow-up | `Confirmed` — `bg #EEF2FF` `#3B4FE0` |

*(The draft marked all five "Confirmed", which contradicted a KPI reporting 20 completed and 2 ongoing.
Statuses must reflect §9.3.)*

### 3.4 "Alerts & Reminders" *(sits under 3.3)*
- Header: red `BellRing` 16px (no tile) + title; right link **"View all →"**.
- Three rows, gap 8px. Each: `rounded-[10px]`, padding `10px 12px`, tinted background + 3px left accent
  border, an 18px solid circular status icon, two text lines, `ChevronRight` 16px right.

| Tint | Accent / icon | Line 1 (12 / 600, colour = accent) | Line 2 (11 / 500 / `#64748B`) | → |
|---|---|---|---|---|
| `#FEF2F2` | `#EF4444` `AlertCircle` | 3 appointments pending confirmation | Tap to review | `/doctor/appointments?status=pending` |
| `#FFF7ED` | `#F59E0B` `AlertTriangle` | 18 medicine items need attention | 3 out of stock · 15 running low | `/doctor/pharmacy` |
| `#F0FDF4` | `#16A34A` `CalendarCheck` | 12 follow-ups due today | Tap to view list | `/doctor/patients?filter=followup-due` |

Row 2 carries the low-stock signal displaced from the KPI row, and its sub-line makes the 3 + 15 = 18
split explicit so it reconciles with §9.8. Row 3's icon is `CalendarCheck`, not `CheckCircle2` — a
follow-up due is a task, not a success.

---

## 4. BOTTOM ROW — 3 columns

`grid grid-cols-[0.92fr_1.08fr_1.30fr] gap-5`, margin-top 20px, all ~215px tall.

### 4.1 "Today's Appointments Overview"
- Header: 28×28 `#EEF2FF` tile + `CalendarCheck` + title.
- Left: donut, `outerRadius 62` / `innerRadius 42`, centre **42** (22 / 800) over **"Total"**
  (11 / `#64748B`).
- Right: 5 legend rows — dot + status (12 / 500) left; **count** (12 / 700) + `(pct)` (11 / `#64748B`)
  right.
- Data: **§9.3** verbatim, including **No Show 4 (9.5%)** and the **Ongoing 2 (4.8%)** row the draft
  omitted.
- Footer link right-aligned: **"View all appointments →"**.

### 4.2 "Top 5 Visit Reasons (This Month)"
- Header: 28×28 `#EEF2FF` tile + `ClipboardList` + title.
- 5 rows at 26px. Each is a 3-part grid: **label** (12 / 500 / `#475569`, fixed 92px) · **track**
  (`flex-1`, h-8, `bg #EEF1F8`, `rounded-full`, inner fill `#4F82F5` `rounded-full`) · **value**
  right-aligned (count 12 / 700 / `#0F172A`, `(pct)` 11 / `#64748B`).
- Data and bar widths: **§9.6** verbatim.
- A `meta` footnote under the last row: **"of 1,718 visits this month"**.
- Footer link right-aligned: **"View full report →"**.

### 4.3 "Recent Patients"
- Header: 28×28 `#EEF2FF` tile + `Users` + title. Right: a small search input (h-32, width 160px,
  placeholder "Search…") and the link **"Track patients →"**.
- Borderless table, 5 rows at 30px, 1px `#F4F6FA` dividers, no visible header row.
- Columns: **initials avatar** (26px circle, tinted bg, 10 / 700) · **name** (12 / 600) · **age**
  (12 / `#64748B`) · `•` · **gender** (12 / `#64748B`) · **current status chip** · **date**
  (12 / 500 / `#475569`) · **time** · `MoreHorizontal` 16px.

| Initials | Name | Age | Gender | Status chip | Date | Time |
|---|---|---|---|---|---|---|
| AM | Aarav Mehta | 4y | Male | `Prescribed` `#DCFCE7`/`#15803D` | 08 May 2025 | 10:00 AM |
| MK | Myra Kapoor | 2y | Female | `Prescribed` `#DCFCE7`/`#15803D` | 08 May 2025 | 09:00 AM |
| KS | Kabir Singh | 6y | Male | `In consultation` `#CFFAFE`/`#0E7490` | 08 May 2025 | 11:00 AM |
| RV | Reyansh Verma | 3y | Male | `Follow-up due` `#F5F0FF`/`#7C3AED` | 07 May 2025 | 03:15 PM |
| SI | Siya Patel | 5y | Female | `Prescribed` `#DCFCE7`/`#15803D` | 07 May 2025 | 02:00 PM |

The status chip is the "current status" the brief asked for — it replaces nothing, it is an added column.
Avatar tints cycle: `#EEF2FF`/`#3B4FE0`, `#F5F0FF`/`#8B5CF6`, `#ECFDF5`/`#16A34A`, `#FFF7ED`/`#F59E0B`,
`#EFF6FF`/`#2563EB`.

**3-dot menu** (identical to spec 06): View patient · Book consultation · Generate prescription ·
divider · Vaccination record ⤢ · Growth record ⤢ · divider · Share summary.
There is **no** Edit, **no** Archive, **no** Open record.

---

## 5. WHAT MUST NOT APPEAR

- No "Add Patient" button. No "New Invoice" button. Anywhere on this screen.
- No revenue trend line chart — the middle slot is patient analytics by design.
- No patient "status: active/closed" anywhere.

---

## 6. RESPONSIVE

Inherits §10 of the foundation, plus: at ≤1279px the KPI row wraps 3 + 2 and the Ongoing card keeps the
first position in the second row. At <768px the two donuts stack their legends beneath the chart and
"Top 5 Visit Reasons" keeps its bars (they compress; the label column drops to 72px).

---

## 7. DELIVERABLES

```
src/
  data/dashboard.ts
  pages/Dashboard.tsx
  components/dashboard/
    KpiRow.tsx
    PatientDemographics.tsx
    NewVsReturning.tsx
    TodaysSchedule.tsx
    AlertsReminders.tsx
    AppointmentsOverview.tsx
    TopVisitReasons.tsx
    RecentPatients.tsx
```

Reuse `shared/KpiCard`, `shared/PageHeader`, `shared/DrilldownLink`, and — inside the Mateo repo —
`panel/kit.tsx`'s `Donut`, `AreaTrend`, `BarRow`, `SectionCard` rather than authoring new chart wrappers.
