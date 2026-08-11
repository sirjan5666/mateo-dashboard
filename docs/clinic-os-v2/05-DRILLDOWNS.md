# SPEC 15–17 — KPI drill-downs
Prepend **00-FOUNDATION.md**

Every one of these is reached by clicking a dashboard KPI card. Each must open with the *same* period and
location the card was showing — carry `?range=` and the active location through, and echo them back in the
filter bar as removable chips so the doctor can see why the numbers differ from the dashboard.

---

# SPEC 15 — Appointments
`/doctor/appointments` — from **Upcoming Appointments** and **Ongoing Appointments**

## 1. Page header
H1 **"Appointments"** + a purple count chip **"13 upcoming"**.
Subtitle **"Thursday, 8 May 2025 · Tilak Nagar Clinic"**.
Right: a `SegmentedControl` **[ List | Day | Week | Month ]** (List active) · **"＋ New appointment"**
gradient primary.

## 2. Filter bar
Search placeholder **"Search patient, PID or mobile…"**, then the **DateRangePicker shown OPEN** — this is
the screen that specifies it:

**DateRangePicker popover** — 640px, `rounded-[16px]`, modal shadow, `grid grid-cols-[168px_1fr]`:
- **Left rail** — preset rows (h-36, `rounded-[8px]`, 13/500, hover `bg #F6F7FB`, active `bg #EEF2FF` +
  `#3B4FE0`): `Today` · `Tomorrow` · `Next 7 days` **(active)** · `This month` · `Last 30 days` ·
  `This quarter` · `Custom range`.
- **Right** — two month grids side by side (May 2025, June 2025), 34px cells. The selected range
  `8 May – 14 May` renders with filled `#3B4FE0` endpoints and a `#EEF2FF` band between them.
  Hovering extends a preview band.
- Footer: the resolved range in 12/600 on the left (`8 May 2025 – 14 May 2025 · 7 days`), then
  **"Cancel"** ghost + **"Apply"** primary.

Remaining pills: `Status: All` · `Visit type: All` · `Mode: All` · `Location: Tilak Nagar` ·
`Doctor: Dr. Ananya Sharma`.

## 3. Segment tabs
From **§9.3** — the counts must match the dashboard donut exactly:

`[ Upcoming 13 ]` purple **(active)** · `[ Ongoing 2 ]` cyan · `[ Completed 20 ]` green ·
`[ Cancelled 3 ]` red · `[ No show 4 ]` slate

## 4. Table
Columns: **TIME** · **PATIENT** · **REASON** · **MODE** · **LOCATION** · **STATUS** · **ACTIONS**

- TIME: `11:30 AM` (15 / 700, tabular) over `30 min` (11 / 500 / `#64748B`).
- PATIENT: avatar · name · `PID` mono chip · `4y · Male` beneath.
- MODE: an icon chip — `MapPin` In-person / `Video` Video / `Phone` Phone (11/600, hue-tinted).
- LOCATION: hue chip.
- STATUS: pill per §9.3 colours.
- ACTIONS: on the next-up row a **"Start consultation"** gradient mini-button; elsewhere a 3-dot
  (Reschedule · Mark no-show · Cancel appointment · ─ · Open patient).

Rows (9 shown of the day's 42):

| Time | Dur | Patient | Reason | Mode | Status |
|---|---|---|---|---|---|
| 09:00 AM | 20 min | Myra Kapoor · PID-2402 | Follow-up | In-person | Completed |
| 09:30 AM | 20 min | Anaya Bhatt · PID-2331 | Vaccination | In-person | Completed |
| 10:00 AM | 30 min | Aarav Mehta · PID-2419 | Consultation | In-person | Completed |
| 11:00 AM | 30 min | Kabir Singh · PID-2388 | Vaccination | In-person | **Ongoing** |
| 11:15 AM | 15 min | Vihaan Rao · PID-2318 | Weight check | In-person | **Ongoing** |
| 11:30 AM | 30 min | Siya Patel · PID-2355 | Consultation | In-person | Upcoming ← **"Start consultation"** |
| 12:00 PM | 20 min | Ishaan Gupta · PID-2340 | Follow-up | Video | Upcoming |
| 12:30 PM | 20 min | Reyansh Verma · PID-2371 | Follow-up | Phone | Upcoming |
| 01:00 PM | 30 min | Aadhya Menon · PID-2296 | Consultation | In-person | Upcoming |

**The two Ongoing rows** carry `bg #ECFEFF`, a 3px `#22D3EE` left border, and a pulsing cyan dot before
the time. This is what the dashboard's "Ongoing 2" card links to.

## 5. Right rail — "Day at a glance"
A 320px card: a vertical hour rail 09:00 → 18:00 (each hour a 12/500 `#64748B` label with a hairline),
overlaid with appointment blocks positioned and sized by time. Block colours follow status. Gaps of
≥30 min render as a dashed `#D9DFEC` band labelled **"Free 45 min"** (12/600/`#64748B`), clickable to
create an appointment at that slot.

## 6. Deliverables
```
src/pages/Appointments.tsx
src/components/appointments/{AppointmentsTable,DayRail,NewAppointmentSlideOver}.tsx
src/components/shared/DateRangePicker.tsx
```

---

# SPEC 16 — Patients drill-down
`/doctor/patients?range=today` — from **Total Patients**

Distinct from spec 06: that is the roster of *everyone*; this is *who came in*, on a date range.

## 1. Page header
H1 **"Patients"**, subtitle **"Who visited, and when."**
Right: `SegmentedControl` **[ Today 42 | This week | This month | All time 2,486 ]** — **Today** active.

## 2. Mini KPI strip
Four small cards (`grid grid-cols-4 gap-5`, h-96):

| Card | Hue | Value | Sub-line |
|---|---|---|---|
| Today's patients | Indigo | **42** | 38 seen · 4 no-show |
| New registrations | Purple | **3** | 7.1% of today |
| Follow-ups | Teal | **16** | 38.1% of today |
| Vaccination visits | Mint | **9** | 21.4% of today |

`3 + 16 + 9 = 28` of 42 — the remaining 14 are new complaints/reviews, so **do not** present these four as
a complete partition. Label the card group **"Today's mix"** and add a `meta` line:
**"14 other visit types not shown."**

## 3. Filter bar
Search placeholder **"Search by name, mobile number or Patient ID…"**; a closed `DateRangePicker` pill
reading **"08 May 2025"**; pills `Age band: All` · `Sex: All` · `Visit type: All` ·
`Vaccination: All` · `Location: Tilak Nagar` · `Registered by: All`.

## 4. Table
Columns: **TIME IN** · **PATIENT** · **AGE** · **PARENT & MOBILE** · **VISIT TYPE** · **ATTENDING** ·
**QUEUE STATUS** · **ACTIONS**

Queue status pills: `Waiting` amber · `In consultation` cyan (pulsing dot) · `Done` green ·
`No show` slate.

| Time in | Patient | Age | Parent / mobile | Visit type | Queue |
|---|---|---|---|---|---|
| 08:52 AM | Myra Kapoor | 2y | Divya Kapoor · +91 99xxx xx144 | Follow-up | Done |
| 09:21 AM | Anaya Bhatt | 1y | Sara Bhatt · +91 98xxx xx778 | Vaccination | Done |
| 09:48 AM | Aarav Mehta | 4y | Neha Mehta · +91 98xxx xx210 | Consultation | Done |
| 10:44 AM | Kabir Singh | 6y | Manpreet Singh · +91 98xxx xx067 | Vaccination | In consultation |
| 11:02 AM | Vihaan Rao | 8m | Tanvi Rao · +91 99xxx xx205 | Weight check | In consultation |
| 11:19 AM | Siya Patel | 5y | Riya Patel · +91 98xxx xx839 | Consultation | Waiting |
| 11:26 AM | Aadhya Menon | 3y | Leena Menon · +91 97xxx xx430 | Consultation | Waiting |
| — | Reyansh Verma | 3y | Pooja Verma · +91 97xxx xx512 | Follow-up | No show |

Actions: **"Open workspace"** ghost + 3-dot (the standard menu from spec 06).

## 5. Right rail
- **"Today by hour"** — a rounded `BarChart`, indigo, 09:00–18:00 buckets:
  `09:00 → 6`, `10:00 → 7`, `11:00 → 8`, `12:00 → 5`, `13:00 → 3`, `14:00 → 0`, `15:00 → 0`,
  `16:00 → 5`, `17:00 → 6`, `18:00 → 2`. Sum = **42** ✓
- **"Today by visit type"** — a donut: Consultation 14 (33.3%) · Follow-up 16 (38.1%) ·
  Vaccination 9 (21.4%) · Other 3 (7.1%). Sum = **42** ✓, percentages = 99.9% (state the rounding note).

## 6. Deliverables
```
src/pages/PatientsToday.tsx
src/components/patients/{TodayKpiStrip,QueueTable,HourlyBars,VisitTypeDonut}.tsx
```

---

# SPEC 17 — Revenue
`/doctor/revenue` — from **Total Revenue** and **Today's Revenue** (`?range=today`)

## 1. Page header
H1 **"Revenue"** + a location chip. Subtitle **"May 2025 · Tilak Nagar Clinic"**.
Right: `SegmentedControl` **[ Today | 7d | 30d | Quarter | Custom ]` — **30d** active by default;
arriving from the Today's Revenue card preselects **Today** and adds a removable chip
`From: Today's revenue ×`.
Then **"Export"** ghost.

## 2. KPI row — 4 cards
| Card | Hue | Value | Delta / sub-line | Sparkline |
|---|---|---|---|---|
| Total collected (MTD) | Green `#16A34A` | **₹8,76,430** | ↑ 18.4% vs last month | 30-point green |
| Today's revenue | Teal `#0EA5A5` | **₹1,24,560** | ↑ 14.2% vs yesterday · 9 payments | 24-point teal |
| Outstanding | Amber `#F59E0B` | **₹46,200** | 23 patients · oldest 34 days | 30-point amber |
| Refunds (MTD) | Rose `#F43F5E` | **₹3,100** | 2 refunds | 30-point rose |

## 3. Charts row — `grid grid-cols-[1fr_1fr] gap-5`

**"Revenue by service"** — a horizontal rounded `BarChart`, one hue per service, `barSize 20`,
`radius [0,8,8,0]`, value labels at the bar end in 12/700:

| Service | Hue | Amount | % of ₹8,76,430 | Bar width |
|---|---|---|---|---|
| Consultation | `#4F63F5` | ₹3,84,200 | 43.8% | 100% |
| Pharmacy | `#F59E0B` | ₹2,41,800 | 27.6% | 63% |
| Vaccination | `#14B8A6` | ₹1,32,400 | 15.1% | 34% |
| Procedures | `#8B5CF6` | ₹78,030 | 8.9% | 20% |
| Lab | `#0EA5E9` | ₹40,000 | 4.6% | 10% |

Sum = **₹8,76,430** ✓ · percentages = 100.0% ✓ · bar widths are each amount ÷ 3,84,200.

**"Payment mode"** — a donut, centre **₹8,76,430** over **"collected"**:
UPI ₹4,89,800 (55.9%) `#4F63F5` · Cash ₹2,19,100 (25.0%) `#16A34A` · Card ₹1,14,930 (13.1%) `#8B5CF6` ·
Insurance ₹52,600 (6.0%) `#0EA5A5`. Sum = **₹8,76,430** ✓, percentages = 100.0% ✓

## 4. Transactions table — the detail the brief asked for
Filter bar above it: search **"Search patient, receipt no. or service…"**, a `DateRangePicker`, and pills
`Service: All` · `Payment mode: All` · `Status: All` · `Location: Tilak Nagar`.

Columns: **DATE & TIME** · **RECEIPT NO.** · **PATIENT** · **SERVICE** · **DOCTOR** · **AMOUNT** ·
**MODE** · **STATUS** · **ACTIONS**

- RECEIPT NO. in mono, `RC-` prefixed.
- AMOUNT right-aligned, 13/700, tabular.
- STATUS: `Paid` green · `Partial` amber **with a 4px mini progress bar and the split beneath**
  (e.g. `₹2,000 of ₹4,500`) · `Due` red.
- ACTIONS: 3-dot → Download receipt · Email receipt · Record payment *(partial/due only)* · ─ ·
  Open patient.

| Date & time | Receipt | Patient | Service | Amount | Mode | Status |
|---|---|---|---|---|---|---|
| 08 May 2025 · 11:42 AM | RC-10428 | Kabir Singh · PID-2388 | Vaccination | ₹2,400 | UPI | Paid |
| 08 May 2025 · 10:18 AM | RC-10427 | Aarav Mehta · PID-2419 | Consultation | ₹800 | UPI | Paid |
| 08 May 2025 · 10:06 AM | RC-10426 | Aarav Mehta · PID-2419 | Pharmacy | ₹1,288 | Cash | **Partial — ₹800 of ₹1,288** |
| 08 May 2025 · 09:34 AM | RC-10425 | Anaya Bhatt · PID-2331 | Vaccination | ₹3,200 | Card | Paid |
| 08 May 2025 · 09:12 AM | RC-10424 | Myra Kapoor · PID-2402 | Consultation | ₹800 | UPI | Paid |
| 07 May 2025 · 04:48 PM | RC-10423 | Reyansh Verma · PID-2371 | Lab | ₹1,450 | UPI | **Due** |
| 07 May 2025 · 03:22 PM | RC-10422 | Siya Patel · PID-2355 | Consultation | ₹800 | Cash | Paid |
| 07 May 2025 · 02:05 PM | RC-10421 | Ishaan Gupta · PID-2340 | Procedure | ₹4,500 | Card | Paid |

## 5. Receipt slide-over
480px from the right, opened by a row. Contains a rendered receipt on white: the gradient letterhead,
**"PAYMENT RECEIPT"**, receipt no. + date, a bill-to block, an itemised table, a totals stack, the
amount in words, and a rotated **"PAID"** stamp in `#16A34A` at 12% opacity behind the totals
(**"PARTIALLY PAID"** in amber where applicable). Footer: **"Download PDF"** primary ·
**"Email"** ghost · **"WhatsApp"** ghost.

## 6. Deliverables
```
src/pages/Revenue.tsx
src/components/revenue/{RevenueKpis,ServiceBars,PaymentModeDonut,TransactionsTable,ReceiptSlideOver}.tsx
src/components/shared/MoneyCell.tsx
```
