# Mateo Clinic OS — build spec pack

31 screens, specified to the level of the Screen 01 handoff. Design phase only — **no app code has been
changed.**

## How to use

Every screen spec assumes **`00-FOUNDATION.md`**. To build one screen, paste:

```
00-FOUNDATION.md  →  the screen's section  →  "build it"
```

The foundation carries the tokens, the shell (sidebar + top bar + location switcher), shared components,
motion, accessibility and — most importantly — **§9, the canonical dataset**. Every number on every screen
derives from §9. If a screen shows a total, that total equals the sum of its parts.

## Files

| File | Screens | Contents |
|---|---|---|
| `00-FOUNDATION.md` | — | Tokens · shell · location switcher · shared components · a11y · **canonical dataset** |
| `01-DASHBOARD.md` | 01 | Dashboard *(corrected — see below)* |
| `02-LOCATIONS-AND-TEAM.md` | 02–05 | Location switcher open · Locations · Team & Roles · Create sub-user |
| `03-PATIENTS.md` | 06–12 | Roster · Vaccination peek · Growth peek · Register · Patient ID · Workspace · Book → live consultation |
| `04-PRESCRIPTION-AND-CHARTS.md` | 13–14 | **Prescription builder + live PiP windows** · Growth & Vaccines page |
| `05-DRILLDOWNS.md` | 15–17 | Appointments · Patients today · Revenue |
| `06-PHARMACY.md` | 18–20, 26–31 | Stock · Purchase + ledger · Sale/invoice · Stock card · **Movements** · Distributors · Adjustments · Reorder · Pharmacy staff view |
| `07-STAFF-AND-LOGS.md` | 21–24 | Staff & attendance · Payroll · Audit logs · Email logs |
| `08-RESPONSIVE.md` | 25 | Mobile shell + three reference screens + tablet rules |

## Corrections carried in from the Screen 01 review

1. **KPI row** = Upcoming Appointments · **Ongoing Appointments** · Total Patients · Total Revenue ·
   Today's Revenue, per the brief. Low Stock Items moved into the Alerts card, where the same 18 items
   were already reported.
2. **New vs Returning curves swapped.** Returning (1,236) is the upper series; New (482) is lower. The
   draft drew New on top while stating New < Returning — arithmetically impossible over 31 days.
3. **No Show = 9.5%** (4 / 42 = 9.52%). The draft's 9.6% was nudged to force the four percentages to sum
   to exactly 100.0.
4. **Top 5 visit reasons re-based** on the 1,718 monthly visits. The draft's counts implied a ~2,300 total
   that appeared nowhere else.
5. **Contrast:** `#94A3B8` on white is 2.56:1 and fails WCAG AA. It is now restricted to icons, dots and
   dividers; **all text under 14px uses `#64748B`** (4.85:1).
6. **Component reuse:** `panel/kit.tsx` already exports `Donut`, `AreaTrend`, `BarRow`, `Kpi`,
   `SectionCard`, `Sparkline`, and `layout/Sidebar.tsx`, `layout/Topbar.tsx`, `ui/Card.tsx` already exist
   and are shared with the Admin and Patient panels. §5.1 of the foundation maps every need to the file
   that already provides it.
7. **Palette:** applied by re-tuning the existing `[data-theme='pro'][data-panel='doctor']` CSS variables,
   not by adding a parallel `brand.*` Tailwind scale. One source of truth.

## Requirements → screens

| Requirement | Screens |
|---|---|
| Sub-users for Reception / OPD / Accounts / HR / Pharmacy | 04, 05, 31 |
| Multi-clinic with per-location data + Overall | 02, 03, and the switcher in every screen |
| 5 clickable dashboard KPIs → detail pages | 01 → 15, 16, 17 |
| Patient graphs instead of a revenue trend | 01 (age mix, vaccination status, new vs returning) |
| Remove Add Patient / New Invoice; track existing patients | 01 |
| Per-patient prescription generation | 06, 11, 13 |
| Revamped registration (baby name required, parents optional) + Patient ID | 09, 10 |
| Patient workspace: repeat visits, visit/last/next dates, no status, no archive | 06, 11 |
| Prescription with diagnosis, vitals, multi-medicine, recommended tests | 13 |
| Vaccination & growth popups from the 3-dot menu | 07, 08 |
| Picture-in-picture charts updating live while prescribing | 13, 14 |
| Pharmacy: stock, purchases, sales, invoices, partial payments, receipts | 18, 19, 20, 26, 27, 28, 29, 30 |
| Stock auto-decrement on dispense | 27 |
| Staff management, attendance, month-end salary | 21, 22 |
| Audit logs | 23 |
| Email logs | 24 |

## Open question

The ₹10,000 partial-payment example described stock purchased **from** Rahul but said Rahul **pays**
₹2,000. This pack treats Rahul as a **distributor the clinic owes** (a payable) — spec 19's ledger and
spec 28's ageing. Spec 28 also carries a Receivables tab for credit owed *to* the clinic. If Rahul is
meant to be a customer, only the default tab changes.
