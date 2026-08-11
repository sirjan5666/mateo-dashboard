# SPEC 13–14 — Prescription builder & the floating charts
Prepend **00-FOUNDATION.md**

---

# SPEC 13 — Prescription builder + live PiP charts
`/doctor/prescriptions/new?patient=PID-2419` — **the flagship screen**

Two things happen here that exist nowhere else in the product: the prescription is composed from vitals
the doctor is typing, and those same vitals redraw a growth curve **live, in a floating window that stays
on top while the doctor keeps working**. Build the PiP mechanics properly — they are the feature.

## 1. Layout
`grid grid-cols-[58fr_42fr] gap-5`. Left = the form, right = a sticky live A4 preview
(`position: sticky; top: 100px`).

Page header: H1 **"New prescription"** + patient chip (avatar · Aarav Mehta · `PID-2419` · 4y · Male).
Right: **"Save draft"** ghost · **"Print"** ghost · **"Generate prescription"** gradient primary.

## 2. Left column — five numbered sections
Each section is its own card with a numbered hue badge + title, exactly as spec 09.

### ① Diagnosis — indigo
- **"Chief complaint / diagnosis"** — full-width textarea, 3 rows, 14px.
  Value: `Acute viral fever with sore throat — day 3`
- Suggestion chips beneath (h-30, `rounded-[8px]`, `bg #EEF2FF`, `#3B4FE0`, 12/600, prefixed `+`):
  `Acute viral fever` · `URTI` · `Gastroenteritis` · `Otitis media` · `Allergic rhinitis`
- **"ICD-10 tag"** — a narrow autocomplete, value `J06.9`, with the resolved label
  `Acute upper respiratory infection, unspecified` in 11/500 `#64748B` beneath.

### ② Vitals — teal
Four tiles in a row (`grid grid-cols-4 gap-3`), each `rounded-[12px]`, `border #ECEEF4`, padding `14px`:
a 28px hue tile + label (11/600/`#64748B`), a large editable number (26 / 800, tabular), a unit chip, and
a delta chip vs the last visit.

| Tile | Icon / hue | Value | Unit | Delta | Note |
|---|---|---|---|---|---|
| Weight | `Weight` sky | **16.2** | kg | ▲ 0.4 (green) | drives the growth PiP |
| Height | `Ruler` sky | **103** | cm | ▲ 1.2 (green) | drives the growth PiP |
| Head circumference | `CircleDot` sky | **50.1** | cm | ▲ 0.2 (green) | drives the growth PiP |
| Temperature | `Thermometer` red | **101.2** | °F | ▲ 2.8 (red) | tile border `#FCA5A5`, bg `#FEF2F2`, an `AlertTriangle` 13px + caption **"Febrile"** |

**Live binding (required):** every keystroke in Weight / Height / Head circumference updates the growth
PiP window within 150ms (debounced), moving the last point on the curve and recomputing the percentile
label. This is not decorative — wire real state.

### ③ Medicines — purple
A repeatable row builder. Each row is a sub-card: `rounded-[12px]`, `border #ECEEF4`, padding `14px`,
with a `GripVertical` 16px `#94A3B8` drag handle on the left and an `X` 16px delete on the right.

Row fields (`grid grid-cols-[2fr_1fr_1.4fr_1fr_1fr]` gap-3): **Medicine** (autocomplete with a `Pill`
14px prefix) · **Dose** · **Frequency** · **Duration** · **Route**. A full-width **Notes** input spans
beneath.

Frequency renders as selectable chips inside the field: `OD` · `BD` · `TDS` · `QDS` · `SOS` · `1-0-1`.

Three filled rows:

| # | Medicine | Dose | Frequency | Duration | Route | Notes |
|---|---|---|---|---|---|---|
| 1 | Paracetamol syrup 250 mg/5 ml | 5 ml | QDS | 3 days | Oral | Only if temp above 100 °F |
| 2 | Cetirizine syrup 5 mg/5 ml | 2.5 ml | OD | 5 days | Oral | At bedtime |
| 3 | *(autocomplete open)* `Amoxicillin` | — | — | — | Oral | — |

Row 3 shows the **autocomplete dropdown open**, 320px, `rounded-[12px]`, modal shadow, four options —
each: name (13/600), strength + form (11/500/`#64748B`), and a right-aligned stock chip:
`Amoxicillin 125 mg/5 ml syrup` · `42 in stock` green ·
`Amoxicillin 250 mg/5 ml syrup` · `3 left` amber ·
`Amoxicillin 250 mg capsule` · `Out of stock` red ·
`Amoxiclav 228 mg/5 ml syrup` · `18 in stock` green.
Stock counts come from §9.8 — the builder reads the pharmacy, which is the point of having both.

A dashed **"＋ Add another medicine"** row closes the section.

**Dose-check chip**, right-aligned above the rows: `bg #ECFDF5`, `#0F766E`, `ShieldCheck` 13px,
**"Dose check passed for 16.2 kg"**, with a `meta` tooltip:
*"Paracetamol 15 mg/kg/dose = 243 mg; 5 ml of 250 mg/5 ml delivers 250 mg. Daily total 1,000 mg is within
the 60 mg/kg (972 mg) guidance — review."*
If a dose exceeds the weight-based maximum the chip turns amber and names the drug. **The chip never
blocks submission — it informs.**

### ④ Recommended tests — amber
- A multi-select field, h-auto, min-h-48, containing already-added chips (h-28, `bg #FFFBEB`, `#B45309`,
  `rounded-[8px]`, with an `X` 12px): **CBC** · **Urine routine** · **CRP**.
- The dropdown is **open**, 340px, listing checkbox rows grouped by category:
  *Haematology* → `CBC` ✔, `ESR`, `Peripheral smear`;
  *Biochemistry* → `CRP` ✔, `LFT`, `RFT`;
  *Microbiology* → `Blood culture`, `Urine routine` ✔, `Stool routine`, `Widal`;
  *Imaging* → `Chest X-ray`, `USG abdomen`.
- **"Lab notes"** — a single-line input: `Sample after 6 hours of fever spike`.
- **"Preferred lab"** — a select, value `In-house`.

### ⑤ Advice & follow-up — green
- **"Advice"** textarea, 3 rows, value:
  `Plenty of oral fluids. Sponge with lukewarm water if temperature crosses 102 °F. Rest at home for 2 days.`
- Quick-add chips: `+ Plenty of fluids` · `+ Sponge if >102 °F` · `+ Light diet` · `+ Return if drowsy`.
- **"Follow-up date"** — a date picker with quick pills `+3 days` · `+1 week` · `+2 weeks` · `+1 month`.
  Selected value **22 May 2025** (`+2 weeks`), with an inline `meta` echo: *"Adds a follow-up reminder to
  the patient's record."*

## 3. Right column — live A4 preview
A white sheet at the A4 ratio (1 : 1.414), `shadow-[0_16px_48px_-16px_rgba(10,27,77,.28)]`, scaled to fit
the column, re-rendering on every form change.

Sheet contents, top to bottom:
1. **Letterhead** — a 72px band, `linear-gradient(135deg,#4F63F5,#8B5CF6)`, white: clinic name
   **"Tilak Nagar Clinic"**, address line, `Reg. No. DL-PED-2019-4471`, and on the right
   **"Dr. Ananya Sharma"** / `MBBS, MD (Paediatrics)` / `DMC Reg. 42117`.
2. **Patient strip** — `bg #F6F7FB`: `Aarav Mehta · PID-2419 · 4y 1m · Male` on the left,
   `Date: 08 May 2025` on the right.
3. **Vitals row** — four inline items: `Wt 16.2 kg · Ht 103 cm · HC 50.1 cm · Temp 101.2 °F`
   (the temperature in `#DC2626`).
4. **Diagnosis** — label + the text, with the `J06.9` tag in mono.
5. **℞** — a 28px serif glyph, then the medicine table: `#`, Medicine, Dose, Frequency, Duration, Notes.
6. **Recommended tests** — a bulleted list of the three chips.
7. **Advice** — the paragraph.
8. **Follow-up** — `Review on 22 May 2025`.
9. **Signature block**, bottom-right: a 1px rule, `Dr. Ananya Sharma`, and a `meta` line
   *"Digitally generated — valid without signature."*

Toolbar above the sheet: `Download PDF` · `Print` · `WhatsApp` · a zoom stepper `− 100% +`.

## 4. THE PiP WINDOWS — build these properly
Two floating windows, `position: fixed`, default docked bottom-right at `right: 24px`, stacked with
16px between them. Each **320 × 240**, `rounded-[16px]`,
`bg rgba(255,255,255,.86)`, `backdrop-filter: blur(14px)`, `border 1px rgba(255,255,255,.6)`,
`shadow-[0_24px_60px_-18px_rgba(10,27,77,.45)]`, `z-index: 60`.

**Title bar** (36px, the module hue at 100%, white text, `rounded-t-[16px]`):
`GripHorizontal` 14px drag affordance · title (12 / 700) · `ml-auto` three 22×22 ghost buttons —
`Minus` (minimise), `Maximize2` (expand to the full page, spec 14), `X` (close).

**Behaviour — all required:**
- **Draggable** by the title bar, constrained to the viewport, `transform: translate3d`, 180ms ease-out on
  release. Position persists to `localStorage` per window.
- **Minimise** collapses to just the 36px title bar (width 200px) and docks bottom-right; the icon flips to
  `Plus`. Restoring animates height over 200ms.
- **Stays on top** of page scroll and of modals below `z-60`.
- **Keyboard:** when the title bar has focus, arrow keys move the window 16px per press; `Esc` closes.
- **Reduced motion:** drag still works, transitions drop to 0ms.
- Below 768px both windows dock to the bottom edge, full width, height 200px, and become swipe-dismissible.

**PiP #1 — "Growth — Aarav"** (sky `#0EA5E9` title bar)
A miniature of the spec 08 chart: percentile ribbons at reduced opacity, the child's sky line, no axes
labels except a compact `kg` on the Y edge. **The final point is the live one** — 6px, filled sky, with a
2px white stroke and an animated ring (`scale 1 → 1.8`, `opacity .6 → 0`, 1.4s loop). A callout chip
beside it: **"16.2 kg · P52"** followed by a small pulsing **"live"** dot. When the doctor edits the
Weight field, the point and the chip move; a 300ms sky flash sweeps the chart border to confirm the update.
A tab strip is not shown at this size — a 3-dot in the title bar switches metric.

**PiP #2 — "Vaccination — Aarav"** (mint `#14B8A6` title bar)
A compact checklist, 5 rows at 30px: vaccine name (11/600) + a state chip on the right.
Rows: `DTwP-3 ✓ Given` · `IPV-3 ✓ Given` · `Rotavirus-3 ⚠ Overdue` · `Hep A-1 ⚠ Overdue` ·
`MMR-2 · Due soon`. **One row is mid-transition:** `MMR-2`'s amber "Due soon" chip is morphing into a mint
"Given ✓" chip — a 400ms cross-fade plus a mint ripple expanding from the chip's centre — demonstrating
that marking a vaccine reflects immediately. A footer line inside the window: **"19 of 22 · 86%"** with a
4px mint progress bar. *(Marking MMR-2 moves the count from 18/22 to 19/22 — the transition and the
number must agree.)*

**Discoverability:** on first render, a 220px tooltip appears near PiP #1 for 4 seconds —
`bg #0F172A`, white 11/500, `rounded-[8px]` — reading **"Drag to move · stays on top while you work"**,
with a "Got it" dismiss that sets a `localStorage` flag.

## 5. Deliverables
```
src/pages/PrescriptionBuilder.tsx
src/components/prescription/{DiagnosisSection,VitalsSection,MedicineRows,TestsSection,AdviceSection}.tsx
src/components/prescription/PrescriptionSheet.tsx
src/components/shared/PipWindow.tsx
src/components/pip/{GrowthPip,VaccinationPip}.tsx
src/hooks/{useDraggable,usePipState,useLiveVitals}.ts
src/data/{drugs,labTests}.ts
```

---

# SPEC 14 — Growth & Vaccines (full page)
`/doctor/charts?patient=PID-2419`

## 1. Page header
Patient identity strip (avatar · name · PID · age · location chip) on the left.
Centre-right: a `SegmentedControl` **[ Growth | Vaccination | Both ]** with **Both** active.
Right: **"Pop out ⤢"** secondary button with a `meta` caption beneath: *"Open as a floating window"* —
clicking it collapses the page into the two PiP windows of spec 13 and returns the doctor to their
previous route.

## 2. Body — `grid grid-cols-[60fr_40fr] gap-5`

### 2.1 Left — Growth
- Tab strip `[ Weight | Height | Head circumference | BMI ]`, Weight active.
- The full spec 08 chart at 380px height, with axis labels, the P3–P97 ribbon legend at the right edge,
  and a `Brush` beneath for scrubbing the age range.
- Under the chart, a measurements table (6 rows): Date · Age · Weight · Height · HC · BMI · Percentile ·
  Recorded by. Right-aligned tabular values.

| Date | Age | Weight | Height | HC | BMI | Percentile |
|---|---|---|---|---|---|---|
| 08 May 2025 | 4y 1m | 16.2 kg | 103 cm | 50.1 cm | 15.3 | P52 |
| 24 Apr 2025 | 4y 1m | 15.8 kg | 101.8 cm | 49.9 cm | 15.2 | P51 |
| 14 Mar 2025 | 4y 0m | 15.4 kg | 101 cm | 49.8 cm | 15.1 | P50 |
| 08 Nov 2024 | 3y 7m | 14.6 kg | 98 cm | 49.4 cm | 15.2 | P52 |
| 02 Aug 2024 | 3y 4m | 14.0 kg | 96 cm | 49.1 cm | 15.2 | P53 |
| 14 Mar 2024 | 3y 0m | 13.2 kg | 94 cm | 48.8 cm | 14.9 | P49 |

BMI = kg / m². Check the top row: 16.2 / 1.03² = 16.2 / 1.0609 = **15.27 → 15.3** ✓. Compute the column,
never hand-type it.

### 2.2 Right — Vaccination
- A 96px `ProgressRing` at **82%** with the centre reading `18/22`, and three chips beneath:
  `Given 18` mint · `Due soon 2` amber · `Overdue 2` red.
- The age-grouped schedule from spec 07, rendered as full rows rather than chips: milestone header,
  then one row per vaccine — name (13/600) · date or due-date (12/500/`#64748B`) · state chip ·
  a **"Mark given"** ghost on pending rows.

## 3. "Visit correlation" band
Full width, margin-top 20px, height 180px. A Recharts `ComposedChart` sharing one X axis of visit dates:
- A sky `Line` for weight (left Y axis, kg).
- Mint `Scatter` markers on the X axis for vaccines administered that day, sized by dose count, each with
  a tooltip naming the vaccines.
- Purple vertical `ReferenceLine`s for follow-up dates.
Legend below. Caption in `meta`: **"Weight, vaccinations and follow-ups on one timeline."**

## 4. Minimised state
In the lower-right corner of this page, render both PiP windows **in their minimised state** — two 200px
title-bar-only pills, sky **"Growth ⤢"** and mint **"Vaccination ⤢"**, stacked with 12px between them.
This demonstrates the toggle: the same windows, collapsed.

## 5. Deliverables
```
src/pages/GrowthAndVaccines.tsx
src/components/charts/{WhoPercentileChart,VaccinationSchedule,VisitCorrelation,MeasurementsTable}.tsx
```
