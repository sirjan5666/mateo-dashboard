# SPEC 06–12 — Patients
Prepend **00-FOUNDATION.md**

> **Three global rules for this domain, from the brief:**
> 1. **No patient `status` field (active/closed) anywhere.** A child who falls ill is brought in
>    regardless — the field carries no meaning. Where the old UI showed status, show *dates* instead.
> 2. **No Archive, anywhere in the product.** Not in menus, not as a filter, not as a bulk action.
> 3. The 3-dot menu is exactly: View patient · Book consultation · Generate prescription · ─ ·
>    Vaccination record ⤢ · Growth record ⤢ · ─ · Share summary. **No Edit, no Archive, no Open record.**

---

# SPEC 06 — Patients roster
`/doctor/patients`

## 1. Page header
H1 **"Patients"** + a hue-tinted count chip **"2,486 at Tilak Nagar"** inline after the title.
Subtitle **"Search, filter and open any child's record."**
Right: **"Export"** ghost + **"＋ Register patient"** gradient primary.

## 2. Filter bar
Full-width white card, padding `14px 16px`, `rounded-[14px]`.
- Search input, `flex-1`, h-40, `bg #F7F8FC`, `border #E8EBF3`, `rounded-[10px]`, `Search` 16px,
  placeholder **"Search by name, mobile number or Patient ID…"**.
- Then pills (h-36, `rounded-[8px]`, `border #E2E6F0`, 12 / 600, each with `ChevronDown` 14px):
  `Date range: Last 30 days` (with a `Calendar` 14px) · `Age: All` · `Visit type: All` ·
  `Vaccination: All` · `Location: Tilak Nagar` · a `＋ More filters` ghost.
- Right end: a **"Saved: Follow-ups due"** chip with a filled amber `Star` 13px.
- **Active-filter row** beneath, margin-top 10px: chips `Last 30 days ×` and `Vaccination: Overdue ×`
  (indigo-tinted, 11 / 600, `X` 12px) then a **"Clear all"** text link (11 / 600 / `#3B4FE0`).

## 3. Segment tabs
Row of 5 pills, margin `16px 0 12px`: label 13 / 600 + a count badge (11 / 700, hue-tinted,
`rounded-full`, padding `1px 7px`).

| Tab | Count | Hue | Active |
|---|---|---|---|
| All | 2,486 | indigo | ✔ |
| Today | 42 | purple | |
| Follow-up due | 34 | amber | |
| New this month | 482 | green | |
| Vaccination overdue | 9 | red | |

## 4. Table
Sticky header, 56px rows. Columns:

| Header | Cell |
|---|---|
| PATIENT | 36px avatar · name (13/600) · `PID-2419` mono chip (`bg #F1F3F9`, `rounded-[5px]`, padding `1px 6px`) · below: `4y · Male` (12/500/`#64748B`) |
| PARENTS | `Rohit & Neha Mehta` (12/500/`#475569`); single parent shows one name; blank shows `—` |
| MOBILE | `+91 98xxx xx210` tabular |
| LAST VISIT | `28 Apr 2025` (13/500) over `10 days ago` (11/500/`#64748B`) |
| NEXT FOLLOW-UP | date with a 7px hue dot. Upcoming = purple. **Overdue = `#EF4444` text + `AlertTriangle` 13px + `12 days overdue`**. None = `—` |
| VISITS | chip `4th visit` (`bg #EEF2FF`, `#3B4FE0`, 11/600). First-timers show `New` in green |
| ACTIONS | **"Book consultation"** small gradient button (h-30, 12/600) + `MoreHorizontal` |

Rows (8):

| Patient | PID | Age/Sex | Parents | Mobile | Last visit | Next follow-up | Visits |
|---|---|---|---|---|---|---|---|
| Aarav Mehta | PID-2419 | 4y · Male | Rohit & Neha Mehta | +91 98xxx xx210 | 08 May 2025 · today | 22 May 2025 | 4th visit |
| Myra Kapoor | PID-2402 | 2y · Female | Arjun & Divya Kapoor | +91 99xxx xx144 | 08 May 2025 · today | 15 May 2025 | 7th visit |
| Kabir Singh | PID-2388 | 6y · Male | Manpreet Singh | +91 98xxx xx067 | 08 May 2025 · today | 08 Nov 2025 | 3rd visit |
| Reyansh Verma | PID-2371 | 3y · Male | Sameer & Pooja Verma | +91 97xxx xx512 | 07 May 2025 · 1 day ago | **26 Apr 2025 · 12 days overdue** | 5th visit |
| Siya Patel | PID-2355 | 5y · Female | Nikhil & Riya Patel | +91 98xxx xx839 | 07 May 2025 · 1 day ago | 21 May 2025 | 2nd visit |
| Ishaan Gupta | PID-2340 | 5y · Male | Vikas & Anjali Gupta | +91 96xxx xx301 | 05 May 2025 · 3 days ago | 12 May 2025 | 6th visit |
| Anaya Bhatt | PID-2331 | 1y · Female | Neel & Sara Bhatt | +91 98xxx xx778 | 02 May 2025 · 6 days ago | 02 Jun 2025 | 2nd visit |
| Vihaan Rao | PID-2318 | 8m · Male | Rakesh & Tanvi Rao | +91 99xxx xx205 | 28 Apr 2025 · 10 days ago | — | New |

**One row (Reyansh Verma) renders with its 3-dot menu OPEN** — 240px, `rounded-[12px]`, modal shadow:

```
👤  View patient
📅  Book consultation
📄  Generate prescription
──────────────────────
💉  Vaccination record        ⤢
📈  Growth record             ⤢
──────────────────────
🔗  Share summary
```
Icons: `User`, `CalendarPlus`, `FilePlus2`, `Syringe` (mint), `TrendingUp` (sky), `Share2`.
The ⤢ glyph is `Maximize2` 12px `#94A3B8`, right-aligned — it signals "opens as a popup you can shrink
to a floating window".

## 5. Footer
Left: **"Showing 1–8 of 2,486"** (12/500/`#64748B`). Right: pagination (`ui/Pagination`).

## 6. Empty state
`UserSearch` in a 48px `#EEF2FF` circle · **"No patients match these filters"** ·
**"Try widening the date range or clearing the vaccination filter."** · **"Clear all filters"** button.

## 7. Deliverables
```
src/data/patients.ts
src/pages/Patients.tsx
src/components/patients/{PatientsTable,PatientRowMenu,SegmentTabs}.tsx
src/components/shared/{FilterBar,DataTable,DateRangePicker}.tsx
```

---

# SPEC 07 — Vaccination quick-peek popup
Overlay, openable from any 3-dot menu

Purpose, in the doctor's words: *a parent phones to ask which vaccinations their child has had.* This must
answer that in under three seconds.

## 1. Shell
Modal **720px**, white, `rounded-[20px]`, modal shadow, over a blurred `rgba(10,27,77,.35)` scrim.
Max height `84vh`, body scrolls, header and footer are sticky.

**Header** (padding `18px 20px`, 1px `#ECEEF4` bottom):
- 40px avatar · **"Aarav Mehta"** (17 / 700) · `PID-2419` mono chip · `4y · Male` (12/500/`#64748B`).
- Right: a mint chip **"86% complete"** (`bg #ECFDF5`, `#0F766E`), then the **control trio** — three
  32×32 `rounded-[8px]` ghost buttons: `Minimize2` (→ becomes a PiP window, spec 13), `Maximize2`
  (→ full page `/doctor/charts?patient=PID-2419&tab=vaccination`), `X`.

## 2. Progress band
Full-width `#F6F7FB` band, `rounded-[10px]`, padding `12px 14px`:
- A 8px mint progress bar at 86% (`bg #ECFDF5` track, `#14B8A6` fill, `rounded-full`).
- Below: **"18 of 21 doses given"** (12 / 700) and three chips right-aligned:
  `Given 18` mint · `Due soon 2` amber · `Overdue 1` red.

`18 + 2 + 1 = 21` ✓ and `18 / 21 = 85.7% → 86%` ✓

## 3. Schedule timeline
Vertical rail (2px `#ECEEF4`) with a node per age milestone. Milestone label on the left
(12 / 700 / `#0F172A`) + a `meta` date. Vaccine chips flow to the right of each node.

Chip states — h-28, `rounded-[8px]`, 11 / 600, padding `0 10px`:
- **Given:** `bg #ECFDF5`, `#0F766E`, `Check` 12px, and the date appended in 10px `#64748B`.
- **Due soon:** `bg #FFFBEB`, `#B45309`, 1px `#FDE68A` border, plus a **"Mark given"** mini button.
- **Overdue:** `bg #FEF2F2`, `#B91C1C`, `AlertTriangle` 12px, plus **"Mark given"**.

| Milestone | Vaccines |
|---|---|
| Birth · 14 Mar 2021 | BCG ✓ · OPV-0 ✓ · Hep B-1 ✓ |
| 6 weeks · 25 Apr 2021 | DTwP-1 ✓ · IPV-1 ✓ · Hep B-2 ✓ · Hib-1 ✓ · Rotavirus-1 ✓ · PCV-1 ✓ |
| 10 weeks · 06 Jun 2021 | DTwP-2 ✓ · IPV-2 ✓ · Hib-2 ✓ · Rotavirus-2 ✓ · PCV-2 ✓ |
| 14 weeks · 18 Jul 2021 | DTwP-3 ✓ · IPV-3 ✓ · Hib-3 ✓ · Rotavirus-3 ✓ |
| 9 months · 14 Dec 2021 | MMR-1 ✓ |
| 12 months · 14 Mar 2022 | Hep A-1 **overdue — due 14 Mar 2022** |
| 15 months · 14 Jun 2022 | MMR-2 **due soon** · Varicella-1 **due soon** |

Given = 3+6+5+4+1 = **19**. To land on 18, mark **Rotavirus-3** as *not administered* (render it as the
overdue chip instead) — or adjust the header to 19/22. **Pick one and keep the arithmetic exact**; the
build must not ship a progress bar that disagrees with the chips it sits above.
Canonical choice for this spec: **Rotavirus-3 is not given** → Given 18, Overdue 2 (Rotavirus-3, Hep A-1),
Due soon 2 → total 22, progress **18 of 22 = 82%**. Update the header chip to **"82% complete"** and the
band to **"18 of 22 doses given"**, chips `Given 18 · Due soon 2 · Overdue 2`.

## 4. Footer
1px top border. Left: **"Print record"** (`Printer` ghost) + **"Share on WhatsApp"** (`Share2` ghost).
Right: **"Mark as administered"** mint primary (`bg #14B8A6`), disabled until a pending chip is selected.

## 5. Deliverables
```
src/components/patients/VaccinationPeek.tsx
src/components/shared/PeekModal.tsx
src/data/vaccination.ts
```

---

# SPEC 08 — Growth quick-peek popup
Same shell as spec 07, sky `#0EA5E9` accent

## 1. Header
Identity row identical. Right chip: **"On track · P52 weight-for-age"** (`bg #F0F9FF`, `#0369A1`).
Same `Minimize2 / Maximize2 / X` trio.

## 2. Tabs
`[ Weight | Height | Head circumference | BMI ]` — 13/600, active has `#0EA5E9` text and a 2px sky
underline; inactive `#64748B`.

## 3. Chart — Weight tab
Recharts `ComposedChart`, height 280px.
- Five WHO percentile bands as translucent `Area` ribbons, all `#0EA5E9` at 6/10/14/10/6% opacity, labelled
  at the right edge: **P3, P15, P50, P85, P97** (10px `#64748B`).
- The child's series: `Line`, stroke `#0EA5E9` 3px, `dot r=4` filled sky with a 2px white stroke, plus an
  `Area` gradient `#0EA5E9` 20% → 0% beneath it.
- X axis: age in months, ticks `0, 6, 12, 18, 24, 30, 36, 42, 48`. Y axis: kg, ticks `0, 4, 8, 12, 16, 20`.
- The final point carries a callout bubble: white, `rounded-[8px]`, shadow, **"16.2 kg · 8 May 2025 · P52"**.

Measurement series (age in months → kg): 0 → 3.1 · 6 → 7.4 · 12 → 9.6 · 18 → 11.0 · 24 → 12.3 ·
36 → 14.4 · 48 → 16.2. Monotonic and plausible for a 4-year-old at P52.

## 4. Right rail
Three mini stat tiles stacked, each `rounded-[12px]`, `border #ECEEF4`, padding `12px`: a 26px hue tile,
the value (20 / 800), the label (11 / 500 / `#64748B`), a delta chip and a 40px sparkline.

| Metric | Value | Delta vs last visit | Percentile |
|---|---|---|---|
| Weight | 16.2 kg | ▲ 0.4 kg | P52 |
| Height | 103 cm | ▲ 1.2 cm | P58 |
| Head circumference | 50.1 cm | ▲ 0.2 cm | P49 |

## 5. Records strip
Below the chart, a horizontally scrolling row of the last 6 measurement cards (140px each,
`rounded-[10px]`, `border #ECEEF4`): the date (11 / 700) over four `12/500` rows —
`Wt 16.2 kg · Ht 103 cm · HC 50.1 cm · Temp 98.4 °F`.

## 6. Footer
**"Print chart"** ghost · **"Compare with siblings"** ghost · **"Add measurement"** sky primary.

## 7. Deliverables
```
src/components/patients/GrowthPeek.tsx
src/components/charts/WhoPercentileChart.tsx
src/data/growth.ts
```

---

# SPEC 09 — Register patient
`/doctor/patients/new`

> The brief is explicit: **these are the only fields.** Do not add blood group, insurance, referral source,
> category, tags or status. Baby's name is mandatory; parents' names are optional.

## 1. Layout
A centred **880px** card on the canvas, with a sticky mini-stepper rail on the left (4 dots + labels,
`position: sticky; top: 100px`).

**Top of card:** a 44×44 `#EEF2FF` tile + `UserPlus` indigo · **"Register a new patient"** (20 / 700) ·
sub-line **"A Patient ID is generated automatically and is used to track the child's entire history."**
(13 / 400 / `#64748B`).

## 2. Sections
Each section: a numbered hue badge (26px circle, hue-tinted, 12/800 numeral) + a section title
(`cardTitle`), then the fields, then a 1px `#F1F3F9` divider.

**① Child details** — indigo
- **"Child's name"** `*` — full width, h-48, 15px input (deliberately larger than the rest).
  Helper: *"As it should appear on prescriptions."*
- **"Date of birth"** `*` — h-44 date input with a `Calendar` icon. To its right, a live chip
  **"Age: 4 y 1 m"** (`bg #EEF2FF`, `#3B4FE0`, 12/700) that recomputes on change.
- **"Sex"** — three pills: `Male` / `Female` / `Not specified`.

**② Parents** — purple, with a grey **"Optional"** chip beside the title
- **"Mother's name"** and **"Father's name"** side by side, h-44.
- Helper under the pair: *"Add either or both — this is optional."*
- **"Primary contact"** — two radios: `Mother` / `Father`, disabled until at least one name is entered.

**③ Contact** — teal, title carries a **"Required"** chip
- **"Mobile number"** `*` — h-44 with a `+91` prefix chip inside the input's left edge.
- **"Address"** `*` — full-width textarea, 3 rows.
- **"City"** and **"PIN code"** side by side.

**④ Location** — amber
- Three selectable chips: `Tilak Nagar` (selected, filled indigo), `Janakpuri OPD`, `Rajouri Garden`.
  Defaults to the active location from the top bar.

## 3. Footer
Sticky inside the card, `border-t #ECEEF4`, padding `16px 20px`: **"Cancel"** ghost ·
**"Save & register another"** secondary · **"Register patient"** gradient primary.

Below the card, outside it, a centred `meta` note:
**"That's all we need — everything else is captured during visits."**

## 4. Validation
- Child's name: required, min 2 chars.
- DOB: required, cannot be in the future, cannot be > 18 years ago (paediatric practice) — the error
  reads *"Date of birth must be within the last 18 years."*
- Mobile: required, exactly 10 digits after `+91`.
- Address: required, min 8 chars.
- Errors render as 11/500 `#DC2626` text beneath the field, with `border-[#FCA5A5]` on the input and
  `aria-invalid`.

## 5. Deliverables
```
src/pages/RegisterPatient.tsx
src/components/patients/{RegisterForm,SectionBlock,AgeChip}.tsx
```

---

# SPEC 10 — Patient registered (confirmation)
Overlay on spec 09

Modal **520px**, centred, `rounded-[20px]`.

1. A 72px `#ECFDF5` circle containing a 36px `#16A34A` `Check`, wrapped in two concentric rings at 8% and
   4% green opacity.
2. **"Patient registered"** (20 / 700), centred.
3. **The Patient ID card** — full width, `rounded-[14px]`, `bg linear-gradient(135deg,#4F63F5,#8B5CF6)`,
   padding `18px`, white text, with a faint diagonal texture at 6% white:
   - Micro-label **"PATIENT ID"** (10 / 700 / `.14em` / `rgba(255,255,255,.7)`).
   - **`PID-2419`** in 30px mono 800, with a `Copy` 16px button right-aligned (copies, then swaps to
     `Check` for 1.5s and announces "Copied" to screen readers).
   - Below: **"Aarav Mehta"** (14 / 700) · **"DOB 14 Mar 2021 · Tilak Nagar Clinic"**
     (11 / 500 / `rgba(255,255,255,.8)`).
   - A 56px white `rounded-[8px]` QR block in the bottom-right corner.
4. Helper line (12 / 500 / `#64748B`, centred): **"Use this ID to pull up the child's full history,
   prescriptions, growth and vaccination record at any location."**
5. Three buttons, full-width stack (gap 8px): **"Book consultation now"** gradient primary ·
   **"Open patient workspace"** secondary · **"Print ID card"** ghost.

## Deliverables
```
src/components/patients/RegisteredModal.tsx
src/components/patients/PatientIdCard.tsx
```

---

# SPEC 11 — Patient Workspace
`/doctor/patients/:pid` — **the core screen of the product**

## 1. Patient header card
Full width, `rounded-[14px]`, background
`linear-gradient(135deg,#EEF2FF 0%,#F5F0FF 55%,#FFFFFF 100%)`, `border #ECEEF4`, padding `22px 24px`.

**Row 1** — 64px avatar · **"Aarav Mehta"** (26 / 800 Plus Jakarta) · `PID-2419` mono chip ·
chips `4y 1m` · `Male` · `Tilak Nagar` · a purple chip **"4th visit · Follow-up"**.
**Row 2** (12 / 500 / `#475569`, margin-top 8px):
`Mother: Neha Mehta · Father: Rohit Mehta · +91 98xxx xx210 · B-14, Tilak Nagar, New Delhi 110018`

**Right cluster** — the **date strip**, three tiles in a row (each `rounded-[10px]`, white, `border
#ECEEF4`, padding `10px 14px`, min-width 132px): a 11/500 `#64748B` label over a 14/700 `#0F172A` value
over an 11/500 relative line.

| Tile | Label | Value | Relative | Accent |
|---|---|---|---|---|
| 1 | Visit date | 08 May 2025 | Today | indigo dot |
| 2 | Last visit | 24 Apr 2025 | 14 days ago | slate dot |
| 3 | Next follow-up | 22 May 2025 | in 14 days | purple dot |

**There is no "Date joined" tile.** If a follow-up is overdue, tile 3 turns red with an `AlertTriangle`.

**Actions**, below the date strip: **"Book consultation"** gradient primary ·
**"Generate prescription"** secondary · `MoreHorizontal` 3-dot.

3-dot menu (open in the reference render): `Vaccination record ⤢` · `Growth record ⤢` · ─ ·
`Share summary` · `Print history`. **No Edit. No Archive. No Open record.**

## 2. Body — `grid grid-cols-[66fr_34fr] gap-5`

### 2.1 Left — tab strip
`[ Overview | Visits & History | Prescriptions | Growth | Vaccination | Reports | Messages ]`
Active = `#3B4FE0` text + 2px indigo underline. Counts as superscript badges on Prescriptions (7),
Reports (3), Messages (2).

**Overview tab contents:**

**(a) Visit history timeline** — a card. Vertical 2px `#ECEEF4` rail, 5 entries. Each entry: a 12px node
in the visit-type hue, then an inner card (`rounded-[12px]`, `border #ECEEF4`, padding `14px`):
- Row 1: date (13 / 700) + visit-type chip + `ml-auto` **"Preview prescription"** ghost with an `Eye` 14px.
- Row 2: diagnosis (13 / 500 / `#0F172A`).
- Row 3: four vitals chips (`bg #F6F7FB`, 11 / 600): `Wt 16.2 kg` · `Ht 103 cm` · `HC 50.1 cm` ·
  `Temp 101.2 °F` — a febrile temperature renders in `#DC2626`.
- Row 4: `Stethoscope` 12px + **"Dr. Ananya Sharma"** (11 / 500 / `#64748B`).

| Date | Visit type (hue) | Diagnosis | Temp |
|---|---|---|---|
| 08 May 2025 | Follow-up (purple) | Acute viral fever — day 3, improving | 101.2 °F |
| 24 Apr 2025 | Sick visit (amber) | Upper respiratory tract infection | 100.4 °F |
| 14 Mar 2025 | Routine checkup (teal) | Well child — 4 year review | 98.4 °F |
| 08 Nov 2024 | Vaccination (mint) | MMR-2 administered | 98.6 °F |
| 02 Aug 2024 | First visit (indigo) | Registration & baseline assessment | 98.2 °F |

**(b) Recent prescriptions** — a card with a horizontal row of **3 A4-proportioned thumbnails**
(148 × 209, `rounded-[10px]`, `border #ECEEF4`, white) showing a miniature: a 14px gradient letterhead
band, three grey text rules, a large faint `℞`, three medicine lines. On hover: a `rgba(15,23,42,.45)`
overlay with a white `Eye` 22px and the label "Preview". Beneath each: date (11 / 700) + diagnosis
(11 / 500 / `#64748B`, truncated). Right of the row: **"View all 7 →"**.

**(c) Clinical notes** — two collapsed accordion rows (`ChevronRight`, title, date).

### 2.2 Right rail — stacked cards, gap 20px

**"At a glance"** — 4 rows, each `label` left / value right:
Allergies → a red chip **"Dust · Penicillin"** · Blood group → `B+` · Birth weight → `3.1 kg` ·
Delivery → `Full term, normal`.

**"Growth"** — sky. A 56px sparkline + **"16.2 kg"** (20 / 800) + `P52` chip + **"Open chart ⤢"** link
opening spec 08.

**"Vaccination"** — mint. An 56px `ProgressRing` at **82%** + `2 overdue` red chip +
**"Open record ⤢"** opening spec 07. *(82% per spec 07's reconciled arithmetic.)*

**"Upcoming"** — the next appointment: `22 May 2025 · 11:30 AM · Follow-up · In-person`, with
**"Reschedule"** ghost.

**"Billing"** — **"₹4,200 collected · ₹0 due"** with a full-width 6px emerald bar at 100% and a
**"View invoices →"** link.

## 3. Deliverables
```
src/pages/PatientWorkspace.tsx
src/components/patients/{PatientHeader,DateStrip,VisitTimeline,PrescriptionThumbs,AtAGlance,RailCards}.tsx
```

---

# SPEC 12 — Book consultation → live consultation
Slide-over on spec 11, then `/doctor/consultations/:id`

## 1. Booking slide-over — 480px from the right
- Header: **"Book consultation"** + patient chip (avatar + name + PID) + `X`.
- **Location** — hue chips, `Tilak Nagar` selected.
- **Calendar** — a month grid (Mon-first), 36px cells, `rounded-[8px]`. Under each date, up to 3 density
  dots (2px, indigo) showing how full that day is; fully booked days are `#64748B` and disabled.
  **8 May** is selected: filled `#3B4FE0`, white numeral.
- **Time slots** — three labelled groups: **Morning** (09:00–12:00), **Afternoon** (12:00–16:00),
  **Evening** (16:00–20:00). Slots are 30-min pills, `grid grid-cols-4 gap-2`, h-36, 12/600.
  Taken slots: `bg #F1F3F9`, `#94A3B8`, strikethrough, disabled. **11:30 AM** selected = gradient filled.
- **Visit type** — pills: `Follow-up` (selected, purple) · `New complaint` · `Vaccination` · `Review`.
- **Mode** — pills with icons: `In-person` (selected, `MapPin`) · `Video` (`Video`) · `Phone` (`Phone`).
- **Notes** — optional 2-row textarea.
- Footer: **"Book & start consultation now"** gradient primary (full width) and, beneath it, a
  **"Book for later"** ghost text link.

## 2. Live consultation view
Route opens immediately on "Book & start".

**Header strip:** a cyan **"LIVE · 04:12"** pill (`bg #CFFAFE`, `#0E7490`, 12/700) with a pulsing 7px dot
and a monospace timer; then the condensed patient row (avatar, name, PID, age); right:
**"End consultation"** danger-ghost and **"Save & prescribe"** gradient primary.

**Three stacked panels:**

**(a) Complaint & history** — a textarea for today's complaint, and beneath it a tinted blockquote
(`bg #F6F7FB`, 3px `#4F63F5` left border, padding `12px 14px`) quoting the previous visit:
> **24 Apr 2025 — Upper respiratory tract infection.** Advised steam, fluids. Follow-up if fever > 3 days.

**(b) Vitals** — four input tiles in a row (`rounded-[12px]`, `border #ECEEF4`, padding `14px`): a 26px
hue tile, a large editable number (24 / 800, tabular), a unit chip, and a delta vs last visit
(`▲ 0.4 kg` green / `▲ 2.8 °F` red).
`Weight 16.2 kg` · `Height 103 cm` · `Head circumference 50.1 cm` · `Temperature 101.2 °F` **(red, with
an `AlertTriangle` and the caption "Febrile")**.

**(c) Prescription** — collapsed, showing only a full-width dashed-border row with
**"Open prescription builder →"** (gradient text button) → spec 13.

**Right edge:** two vertical floating chips, 44px wide, docked at `right: 0`, `rounded-l-[10px]`:
**"Growth ⤢"** (sky) and **"Vaccination ⤢"** (mint), each with its icon rotated 90°. Clicking opens the
corresponding PiP window (spec 13).

## 3. Deliverables
```
src/pages/Consultation.tsx
src/components/consultations/{BookSlideOver,SlotPicker,LiveHeader,VitalsRow,HistoryQuote}.tsx
```
