# SPEC 21–24 — Staff, payroll, audit & email logs
Prepend **00-FOUNDATION.md**

---

# SPEC 21 — Staff & attendance
`/doctor/staff` · Module hue **rose `#F43F5E`**

## 1. Page header
H1 **"Staff"** + a rose chip **"14 members"**. Subtitle **"Attendance, records and payroll."**
Right: a month stepper **`‹ May 2025 ›`** (h-44, white, `border #E2E6F0`) · **"＋ Add staff"** gradient
primary (`linear-gradient(135deg,#F43F5E,#EC4899)`).

## 2. KPI row — 5 cards
| Card | Hue | Value | Sub-line |
|---|---|---|---|
| Total staff | Rose | **14** | 9 with app access |
| Present today | Green | **11** | 78.6% attendance |
| On leave | Amber | **2** | 1 paid · 1 unpaid |
| Absent | Red | **1** | Ramesh Kumar |
| Monthly payroll | Indigo | **₹4,86,000** | net for May 2025 |

`11 + 2 + 1 = 14` ✓ · `11 / 14 = 78.6%` ✓ · "9 with app access" reconciles with spec 04's 9 sub-users.

## 3. Attendance grid — the centrepiece
A card with horizontal scroll. Rows = staff, columns = days **1 … 31** of May 2025.

- Left frozen column, 220px: 32px avatar + name (13/600) + role chip (11/600, role hue).
- Day header: the date numeral (11/700) over the weekday initial (10/500/`#64748B`). Sundays and the
  1 May holiday get a `bg #F6F7FB` column tint. **Today (8)** has a 2px `#3B4FE0` outline down the column.
- Cells: 24×24 `rounded-[6px]`, 2px gap.

| State | Colour | Legend label |
|---|---|---|
| Present | `#16A34A` | Present |
| Half day | `#F59E0B` | Half day |
| Absent | `#EF4444` | Absent |
| Paid leave | `#8B5CF6` | Paid leave |
| Weekly off / holiday | `#E2E6F0` | Off |

- **Right frozen summary column**, 160px: `P 24 · HD 2 · A 1 · L 2` as four micro-chips, then an
  attendance % (12/700).
- A legend row beneath the grid, and a `meta` note: **"26 working days in May 2025 (4 Sundays and 1 May
  holiday excluded)."**

## 4. Staff table
Columns: **MEMBER** (avatar + name + `EMP-014` mono) · **ROLE** (hue chip) · **LOCATION** ·
**JOINED** · **MONTHLY SALARY** (right-aligned) · **ATTENDANCE** (a 4px bar + %) ·
**APP ACCESS** (a green `Check` or a grey dash) · **ACTIONS** (`Mark attendance` ghost + 3-dot).

| # | Member | Emp ID | Role | Joined | Salary | Attendance | App access |
|---|---|---|---|---|---|---|---|
| 1 | Priya Nair | EMP-001 | Reception | 12 Feb 2023 | ₹26,000 | 92% | ✓ |
| 2 | Rohit Bansal | EMP-002 | Reception | 04 Jul 2023 | ₹22,000 | 100% | ✓ |
| 3 | Anita Desai | EMP-003 | Reception | 18 Mar 2025 | ₹22,000 | 96% | ✓ (pending) |
| 4 | Farah Khan | EMP-004 | OPD Assistant | 22 Aug 2022 | ₹32,000 | 100% | ✓ |
| 5 | Deepa Iyer | EMP-005 | OPD Assistant | 09 Jan 2024 | ₹30,000 | 96% | ✓ |
| 6 | Meera Joshi | EMP-006 | Accounts | 05 May 2021 | ₹46,000 | 100% | ✓ |
| 7 | Sunil Rao | EMP-007 | HR | 14 Nov 2020 | ₹52,000 | 96% | ✓ |
| 8 | Vikram Yadav | EMP-008 | Pharmacy | 27 Jun 2022 | ₹36,000 | 100% | ✓ |
| 9 | Karan Mehra | EMP-009 | Pharmacy | 03 Feb 2024 | ₹32,000 | 100% | ✓ |
| 10 | Anu Thomas | EMP-010 | Nursing | 19 Sep 2019 | ₹50,000 | 100% | — |
| 11 | Reena Das | EMP-011 | Nursing | 11 Apr 2021 | ₹48,000 | 96% | — |
| 12 | Jyoti Kaur | EMP-012 | Nursing | 28 Oct 2022 | ₹46,000 | 100% | — |
| 13 | Lata Pillai | EMP-013 | Nursing | 07 Mar 2024 | ₹44,000 | 100% | — |
| 14 | Ramesh Kumar | EMP-014 | Housekeeping | 15 Jan 2023 | ₹16,000 | 50% | — |

Salaries sum to **₹5,02,000** — the gross in spec 22. Verify in code, do not hand-type the total.
Roles: Reception 3 · OPD 2 · Accounts 1 · HR 1 · Pharmacy 2 · Nursing 4 · Housekeeping 1 = **14** ✓
App access: rows 1–9 = **9** ✓ matching spec 04.

## 5. "Today's check-ins" card — right rail
Rows of `avatar · name · 09:02 AM · a green Check`. Latest first, 6 shown, then **"View all →"**.
Two rows at the bottom are amber `On leave` and one is red `Absent — no check-in`.

## 6. Deliverables
```
src/data/staff.ts
src/pages/Staff.tsx
src/components/staff/{AttendanceGrid,StaffTable,CheckInsCard,MarkAttendanceModal}.tsx
```

---

# SPEC 22 — Payroll
`/doctor/staff/payroll`

## 1. Page header
H1 **"Payroll · May 2025"** with a month stepper. A chip **"Auto-calculated on 31 May"**
(`bg #EEF2FF`, `#3B4FE0`, `Sparkles` 13px). Right: **"Download all payslips"** ghost ·
**"Process payroll"** gradient primary.

## 2. Summary row — 4 cards
| Card | Hue | Value |
|---|---|---|
| Gross | Slate | **₹5,02,000** |
| Deductions | Amber | **−₹16,000** |
| **Net payable** | Indigo | **₹4,86,000** (`metricLg` 40/800) |
| Paid | Amber ring | **₹0 of 14** — a 56px `ProgressRing` at 0% |

`5,02,000 − 16,000 = ₹4,86,000` ✓

## 3. Formula hint
A `bg #F6F7FB` band under the header, `rounded-[10px]`, `Calculator` 14px + mono text:
**`Net = (Base ÷ 26 working days × days present) − deductions + bonus`**

## 4. Salary table
Columns: **MEMBER** · **BASE** · **DAYS PRESENT** (`24 / 26` + a 4px bar) · **DEDUCTIONS** ·
**BONUS** (an editable green chip) · **NET PAY** (13/700, right-aligned) · **STATUS** · **ACTIONS**

Deductions carry an `Info` 12px tooltip naming the reason.

| Member | Base | Days | Deductions | Bonus | Net pay | Status |
|---|---|---|---|---|---|---|
| Priya Nair | ₹26,000 | 24 / 26 | **−₹2,000** *(2 days absent @ ₹1,000)* | ₹0 | **₹24,000** | Pending |
| Rohit Bansal | ₹22,000 | 26 / 26 | ₹0 | ₹0 | **₹22,000** | Pending |
| Anita Desai | ₹22,000 | 26 / 26 | ₹0 | ₹0 | **₹22,000** | Pending |
| Farah Khan | ₹32,000 | 26 / 26 | ₹0 | ₹0 | **₹32,000** | Pending |
| Deepa Iyer | ₹30,000 | 26 / 26 | ₹0 | ₹0 | **₹30,000** | Pending |
| Meera Joshi | ₹46,000 | 26 / 26 | ₹0 | ₹0 | **₹46,000** | Pending |
| Sunil Rao | ₹52,000 | 25 / 26 | **−₹2,000** *(1 day absent @ ₹2,000)* | ₹0 | **₹50,000** | Pending |
| Vikram Yadav | ₹36,000 | 26 / 26 | ₹0 | ₹0 | **₹36,000** | Pending |
| Karan Mehra | ₹32,000 | 26 / 26 | **−₹4,000** *(salary advance recovery)* | ₹0 | **₹28,000** | Pending |
| Anu Thomas | ₹50,000 | 26 / 26 | ₹0 | ₹0 | **₹50,000** | Pending |
| Reena Das | ₹48,000 | 26 / 26 | ₹0 | ₹0 | **₹48,000** | Pending |
| Jyoti Kaur | ₹46,000 | 26 / 26 | ₹0 | ₹0 | **₹46,000** | Pending |
| Lata Pillai | ₹44,000 | 26 / 26 | ₹0 | ₹0 | **₹44,000** | Pending |
| Ramesh Kumar | ₹16,000 | 13 / 26 | **−₹8,000** *(13 days absent @ ₹615.38)* | ₹0 | **₹8,000** | Pending |

Base sums to **₹5,02,000** ✓ · deductions to **₹16,000** ✓ · net to **₹4,86,000** ✓
Rows with a deduction carry a soft amber row tint.

**ACTIONS:** a **"Pay"** rose mini-button + a **"Slip"** ghost. Once paid, the status chip flips to green
`Paid` with the payment date, and the summary ring advances.

## 5. Right rail
- **"Payroll by role"** — a donut over ₹5,02,000, one slice per role hue:
  Nursing ₹1,88,000 (37.5%) · Reception ₹70,000 (13.9%) · Pharmacy ₹68,000 (13.5%) ·
  OPD ₹62,000 (12.4%) · HR ₹52,000 (10.4%) · Accounts ₹46,000 (9.2%) ·
  Housekeeping ₹16,000 (3.2%). Sum = **₹5,02,000** ✓, shares = 100.1% (rounding — note it).
- **"Payslip preview"** — a mini A4 card: gradient letterhead, employee block, an earnings/deductions
  two-column table, net pay in bold, and **"Download all payslips (PDF)"**.

## 6. Deliverables
```
src/pages/Payroll.tsx
src/components/staff/{PayrollSummary,SalaryTable,PayrollDonut,PayslipSheet}.tsx
src/lib/payroll.ts   // the net-pay formula — computed, never hard-coded
```

---

# SPEC 23 — Audit Logs
`/doctor/audit` · Module hue **slate `#64748B`** with vivid per-action accents

## 1. Page header
H1 **"Audit logs"**, subtitle **"Every action across your practice."**
Right: a `DateRangePicker` · **"Export CSV"** ghost.

## 2. Action-type chips
A wrapped row, each chip: a 7px dot + label + a count badge.

| Action | Hue | Count |
|---|---|---|
| Created | `#16A34A` | 128 |
| Viewed | `#64748B` | 1,942 |
| Updated | `#4F63F5` | 341 |
| Deleted | `#EF4444` | 12 |
| Logged in | `#22D3EE` | 88 |
| Exported | `#8B5CF6` | 17 |
| Permission changed | `#F59E0B` | 5 |

`128 + 1,942 + 341 + 12 + 88 + 17 + 5 = 2,533` — show that total in the header as
**"2,533 events in the last 30 days."**

## 3. Filter bar
Search **"Search user, patient, action or record ID…"**; pills `User: All` · `Role: All` ·
`Action: All` · `Module: All` · `Location: All` · `IP: All`.

## 4. The log — a vertical timeline
Grouped by day with a sticky sub-header **"Today · 8 May 2025"** + a count chip. A 2px `#ECEEF4` rail runs
down the left; each entry has a 32px circular action icon on the rail in its action hue at 12% tint with a
full-strength glyph.

Entry layout: a bold sentence (13/500/`#0F172A` with the **actor name in 600** and the **object in 600**)
· a mono record id chip · a location hue chip · timestamp `11:42 AM IST` (12/500/`#64748B`) ·
device/IP in 11/500 `#64748B` · a `ChevronRight` "View details".

| Time | Icon / hue | Entry |
|---|---|---|
| 11:47 AM | `Trash2` red | **Dr. Ananya Sharma** deleted prescription **RX-1187** · `RX-1187` · Tilak Nagar · Chrome on Windows · 49.36.x.x |
| 11:42 AM | `ShoppingCart` green | **Vikram Yadav** (Pharmacy) generated bill **PH-1042** for **Aarav Mehta** · `PID-2419` · Tilak Nagar |
| 11:42 AM | `Plus` green | **System** recorded 6 stock movements from bill **PH-1042** |
| 10:58 AM | `ShieldAlert` amber | **Dr. Ananya Sharma** changed permissions for **Vikram Yadav** — added *Record payments* |
| 10:15 AM | `Plus` green | **Vikram Yadav** (Pharmacy) entered purchase bill **RD-8871** — ₹10,000 from Rahul Distributors |
| 09:31 AM | `CalendarPlus` green | **Priya Nair** (Reception) booked an appointment for **Aarav Mehta** · `PID-2419` |
| 09:12 AM | `Eye` slate | **Dr. Ananya Sharma** viewed the growth record for **Myra Kapoor** · `PID-2402` |
| 08:46 AM | `LogIn` cyan | **Meera Joshi** (Accounts) signed in · Safari on macOS · 103.21.x.x |

The red row carries `bg #FEF2F2` + a 3px red left rail; the amber permission row carries `bg #FFFBEB` +
an amber rail. Destructive and security events must be visually separable at a glance.

## 5. Expanded entry — the diff
One entry (the permission change) is **expanded**, revealing an inline card, `bg #F9FAFC`,
`rounded-[12px]`, `grid grid-cols-2 gap-4`:
- **Before** — `bg #FEF2F2`, `border #FECACA`, header "Before" in `#B91C1C`, then key/value rows in mono
  12px. Changed keys are highlighted.
- **After** — `bg #F0FDF4`, `border #BBF7D0`, header "After" in `#15803D`.

```
Before                          After
role: pharmacy                  role: pharmacy
locations: [tilak-nagar]        locations: [tilak-nagar]
permissions:                    permissions:
  manage_stock: true              manage_stock: true
  record_sales: true              record_sales: true
  record_payments: false  ←       record_payments: true   ←
  view_clinical: false            view_clinical: false
```

Plus a footer line: `Changed by Dr. Ananya Sharma · 8 May 2025, 10:58 AM IST · Request 7f3a…c19`.

## 6. Right rail
- **"Most active users"** — 5 rows of avatar + name + a horizontal bar + count:
  Priya Nair 612 · Vikram Yadav 488 · Dr. Ananya Sharma 431 · Meera Joshi 274 · Farah Khan 198.
- **"Actions over time"** — a 30-day slate area chart.

## 7. Rules
Audit entries are **append-only and never editable** — the 3-dot offers only *View details*, *Copy
request id*, *Export this entry*. Say so in a `meta` footnote under the timeline:
**"Audit entries cannot be edited or removed."**

## 8. Deliverables
```
src/pages/AuditLogs.tsx
src/components/audit/{ActionChips,AuditTimeline,AuditEntry,DiffCard,MostActiveUsers}.tsx
```

---

# SPEC 24 — Email Logs
`/doctor/email-logs` · Module hue **cyan `#22D3EE`**

## 1. Page header
H1 **"Email logs"**, subtitle **"Delivery status for every message the app sent."**
Right: **"Resend failed (15)"** secondary · **"Delivery settings"** ghost.

## 2. KPI row — 5 cards
| Card | Hue | Value | Sub-line |
|---|---|---|---|
| Sent | Cyan | **1,246** | last 30 days |
| Delivered | Green | **1,203** | 96.5% of sent |
| Opened | Indigo | **812** | 67.5% of delivered |
| Bounced | Amber | **28** | 2.2% of sent |
| Failed | Red | **15** | 1.2% of sent |

`1,203 + 28 + 15 = 1,246` ✓ · `1,203 / 1,246 = 96.5%` ✓ · `812 / 1,203 = 67.5%` ✓
**The open rate is stated against *delivered*, not sent** — label it that way in the card, or the number
is misleading.

## 3. "Delivery over time"
A wide `AreaChart`, 30 days, two stacked gradient series: **Delivered** `#16A34A` and
**Failed + bounced** `#EF4444`. Y axis = messages/day. A `meta` caption:
**"Spike on 1 May — monthly vaccination reminders."**

## 4. Filter bar
Search **"Search recipient, subject or message ID…"**; a `DateRangePicker`; pills `Status: All` ·
`Template: All` · `Location: All` · `Triggered by: All`.

## 5. Table
Columns: **SENT AT** · **RECIPIENT** · **SUBJECT** · **TEMPLATE** · **STATUS** · **OPENS** · **ACTIONS**

- RECIPIENT: 30px avatar + name (13/600) + email (11/500/`#64748B`) + a small role/parent chip.
- TEMPLATE chips, hue-coded: `Appointment reminder` purple · `Vaccination due` mint · `Invoice` amber ·
  `Credentials invite` indigo · `Prescription` teal · `Payslip` rose.
- STATUS: `Delivered` green with a double `Check`; `Opened` indigo with an `Eye`; `Bounced` amber;
  `Failed` red with an `AlertTriangle`.
- ACTIONS: `Preview` ghost · `Resend` ghost · 3-dot.

| Sent at | Recipient | Subject | Template | Status | Opens |
|---|---|---|---|---|---|
| 08 May · 11:44 AM | Neha Mehta · parent | Your prescription from Dr. Sharma | Prescription | Opened | 2 |
| 08 May · 10:08 AM | Neha Mehta · parent | Invoice PH-1042 — ₹1,288 | Invoice | Delivered | 0 |
| 08 May · 09:34 AM | Divya Kapoor · parent | Myra's vaccination is due on 15 May | Vaccination due | Opened | 1 |
| 08 May · 09:02 AM | anita.d@mateo.in · staff | Your Mateo Clinic OS login | Credentials invite | Delivered | 0 |
| 07 May · 06:10 PM | sameer.verma@… · parent | Reminder: follow-up on 8 May | Appointment reminder | **Bounced** | — |
| 07 May · 05:55 PM | pooja.v@oldmail.co · parent | Reyansh's follow-up is overdue | Appointment reminder | **Failed** | — |
| 07 May · 04:20 PM | riya.patel@… · parent | Your prescription from Dr. Sharma | Prescription | Opened | 3 |
| 06 May · 09:00 AM | staff@mateo.in · staff | April payslips are ready | Payslip | Delivered | 0 |

The two failure rows render `bg #FEF2F2` with a 3px red left rail and an **inline error line** beneath the
subject, 11/500 `#B91C1C`: **"550 5.1.1 — mailbox does not exist"** (Failed) and
**"552 — recipient mailbox full"** (Bounced). Without the reason the row is not actionable.

## 6. Preview slide-over
440px from the right. Renders the actual email at phone width on a `#F6F7FB` backdrop: the Mateo gradient
header with the clinic name, a greeting, a content card (for the Prescription template: the patient line,
diagnosis, the medicine list, follow-up date), a gradient CTA button **"Open in Mateo"**, and a footer
with the clinic address and an unsubscribe line.
Above the preview: metadata rows — `Message ID` mono · `To` · `From` · `Sent` · `Delivered` · `Opened`
(with a small open-events list: `8 May 11:46 AM · Android` / `8 May 07:12 PM · Chrome`).
Footer: **"Resend"** primary · **"Copy message ID"** ghost.

## 7. Deliverables
```
src/pages/EmailLogs.tsx
src/components/email/{EmailKpis,DeliveryChart,EmailTable,EmailPreviewSlideOver}.tsx
```
