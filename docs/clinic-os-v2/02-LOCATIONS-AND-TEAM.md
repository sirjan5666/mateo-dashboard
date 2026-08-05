# SPEC 02–05 — Locations, Sub-users & Roles
Prepend **00-FOUNDATION.md**

---

# SPEC 02 — Location switcher, open state
Not a route. An overlay state of the top bar, buildable and screenshot-able on `/doctor`.

The panel spec lives in **§4 of the foundation** — build it exactly. This screen additionally defines:

**Trigger states**
- Closed pill shows the active location's hue dot + name.
- On open: the pill gets `bg #F1F3F9`, the chevron rotates 180° over 150ms, the panel animates in
  (scale `0.98 → 1`, fade, 200ms ease-out) anchored to the pill's left edge, 8px below.
- The page behind receives a `rgba(10,27,77,.18)` scrim. Clicking it, or `Esc`, closes.

**Panel rows** — data from §9.2:

| Row | Dot | Title | Sub-line | Right chip | State |
|---|---|---|---|---|---|
| 1 | conic gradient | **All Locations (Overall)** | Combined data from 3 locations | `3,560 patients` | — |
| 2 | `#4F63F5` | **Tilak Nagar Clinic** | B-14, Tilak Nagar, New Delhi 110018 | `2,486 · 42 today` | **SELECTED** — 6% indigo tint + a check in a filled indigo circle |
| 3 | `#8B5CF6` | **Janakpuri OPD** | C-2/45, Janakpuri West, New Delhi 110058 | `786 · 18 today` | — |
| 4 | `#F59E0B` | **Rajouri Garden Clinic** | Shop 22, Rajouri Garden, New Delhi 110027 | `288 · 0 today` + a grey `Closed today` chip | — |

Then a 1px `#ECEEF4` divider and a full-width ghost row **"＋ Manage locations"** (`Settings2` 16px,
13 / 600 / `#3B4FE0`) → `/doctor/locations`.

**Explainer callout** — below the last row, inside the panel, a `#F6F7FB` band, `rounded-[10px]`,
padding `10px 12px`, `Info` 14px `#3B4FE0` + text (11 / 500 / `#64748B`):
**"Switching changes every page — patients, appointments, revenue, pharmacy and staff — to this location."**

**Keyboard:** `↑ ↓` move, `Enter` selects, `Esc` closes. The listbox uses `role="listbox"` with
`aria-selected` on rows.

---

# SPEC 03 — Locations
`/doctor/locations`

## 1. Page header
- H1 **"Locations"**, subtitle **"Clinics and OPDs where you practise."**
- Right: primary gradient button **"＋ Add location"** (h-44, `bg linear-gradient(135deg,#4F63F5,#8B5CF6)`,
  white 14/600, `rounded-[10px]`, `shadow-[0_8px_20px_-8px_rgba(79,99,245,.7)]`).

## 2. Location cards
`grid grid-cols-3 gap-5`. Each card is white, `rounded-[14px]`, `border #ECEEF4`, with a **6px full-width
coloured band flush to the top edge** in the location's hue, then padding `20px`.

Card contents, top to bottom:
1. Row: location name (`cardTitle`) + a type chip (`CLINIC` or `OPD` — 10 / 700 / uppercase,
   hue-tinted) on the left; `MoreHorizontal` 3-dot on the right.
2. Address block — `MapPin` 14px `#94A3B8` + address (12 / 500 / `#475569`, 2 lines);
   `Phone` 14px + number (12 / 500).
3. **Timings** — two rows, 12 / 500: `Mon–Sat` → `10:00–14:00, 17:00–20:00`; `Sun` → `Closed`
   (in `#EF4444`).
4. A 3-up mini stat strip on a `#F6F7FB` band, `rounded-[10px]`, padding `12px`: Patients / Appts today /
   Revenue (MTD), each as a 16/800 number in the location hue over an 11/500 `#64748B` label.
5. Footer: stacked staff avatars (26px, −8px overlap, max 4 + a `+N` circle) on the left;
   **"Set as active"** ghost button on the right (or a filled hue chip **"Active"** when it is).

| Card | Type | Patients | Appts today | Revenue MTD | Staff |
|---|---|---|---|---|---|
| Tilak Nagar Clinic (indigo) | CLINIC | 2,486 | 42 | ₹8,76,430 | 9 (+5) |
| Janakpuri OPD (purple) | OPD | 786 | 18 | ₹2,94,120 | 4 (+1) |
| Rajouri Garden Clinic (amber) | CLINIC | 288 | 0 | ₹64,800 | 1 |

A fourth card is a dashed-border placeholder: `border-2 border-dashed #D9DFEC`, `rounded-[14px]`, centred
`Plus` 28px in a 52px `#EEF2FF` circle over **"Add another clinic or OPD"** (13 / 600 / `#64748B`).

## 3. "Compare locations" card
Full width, margin-top 20px, height ~300px.
- Header: `BarChart3` in a 28×28 `#EEF2FF` tile + title. Right: **"This Month ▾"** pill.
- Recharts grouped `BarChart`, 3 series (Tilak Nagar `#4F63F5`, Janakpuri `#8B5CF6`, Rajouri `#F59E0B`),
  `barSize 18`, `radius [6,6,0,0]`, categories on the X axis: **Patients · Appointments · Revenue (₹'000)
  · New patients**. Legend top-right, horizontal dashed grid only.

| Category | Tilak Nagar | Janakpuri | Rajouri Garden |
|---|---|---|---|
| Patients | 2,486 | 786 | 288 |
| Appointments (MTD) | 1,718 | 604 | 142 |
| Revenue (₹'000) | 876 | 294 | 65 |
| New patients (MTD) | 482 | 168 | 39 |

Revenue values are the MTD figures in thousands, rounded — label the axis **"₹ '000"** so the scale is
never ambiguous.

## 4. Add / edit location — slide-over
480px from the right. Fields: Location name · Type (segmented `Clinic | OPD`) · Address line 1 · Line 2 ·
City · PIN code · Phone · Accent colour (a row of 6 hue swatches) · Timings (per-day rows with an open/close
time pair and a "Closed" toggle) · Assign staff (multi-select avatars). Footer: `Cancel` ghost +
`Save location` primary.

## 5. Deliverables
```
src/data/locations.ts
src/pages/Locations.tsx
src/components/locations/{LocationCard,LocationCompareChart,LocationForm}.tsx
src/components/shared/LocationSwitcher.tsx
```

---

# SPEC 04 — Team & Roles
`/doctor/team`

## 1. Page header
H1 **"Team & Roles"**, subtitle **"Sub-user accounts for your clinic staff."**
Right: **"＋ Create sub-user"** gradient primary.

## 2. Role cards — 5 across
`grid grid-cols-5 gap-5`. Each: white card, 3px hue top accent, padding `18px`. Contents: a 40×40 solid
hue `rounded-[10px]` icon tile with a white glyph · role name (`cardTitle`) · member count
(12 / 500 / `#64748B`) · a 1px `#F1F3F9` divider · three permission lines, each `Check` 13px in the hue +
label (11 / 500 / `#475569`).

| Role | Hue | Icon | Members | Permissions shown |
|---|---|---|---|---|
| Reception | `#0EA5E9` | `ConciergeBell` | 3 members | Book appointments · Register patients · View schedule |
| OPD Assistant | `#8B5CF6` | `ClipboardPlus` | 2 members | Record vitals · Manage queue · View prescriptions |
| Accounts | `#16A34A` | `Calculator` | 1 member | Billing · Payments · Revenue reports |
| HR | `#F43F5E` | `UserCog` | 1 member | Staff records · Attendance · Payroll |
| Pharmacy | `#F59E0B` | `BriefcaseMedical` | 2 members | Stock · Purchases · Sales & invoices |

`3 + 2 + 1 + 1 + 2 = 9` sub-user accounts. Note that §9.9's 14 staff includes 4 Nursing and 1 Housekeeping
who have **no** login — the page must therefore say **"9 of 14 staff have app access"** as a `meta` line
under the header, or the two screens will appear to contradict each other.

## 3. Members table
Above it: a search input (`Search members…`), a `Role: All ▾` pill, a `Location: All ▾` pill.

Columns: **Member** (36px avatar + name 13/600 + email 12/500/`#64748B`) · **Role** (hue chip) ·
**Locations** (small hue chips, or a conic-dot `All` chip) · **Last active** · **Status** ·
`MoreHorizontal`.

| Member | Email | Role | Locations | Last active | Status |
|---|---|---|---|---|---|
| Priya Nair | priya.n@mateo.in | Reception | Tilak Nagar | 12 min ago | `Active` green |
| Vikram Yadav | vikram.y@mateo.in | Pharmacy | Tilak Nagar | 4 min ago | `Active` green |
| Meera Joshi | meera.j@mateo.in | Accounts | All | 1 hr ago | `Active` green |
| Sunil Rao | sunil.r@mateo.in | HR | All | Yesterday | `Active` green |
| Farah Khan | farah.k@mateo.in | OPD Assistant | Janakpuri OPD | 3 hr ago | `Active` green |
| Rohit Bansal | rohit.b@mateo.in | Reception | Janakpuri OPD | 2 days ago | `Active` green |
| Anita Desai | anita.d@mateo.in | Reception | Rajouri Garden | — | `Invite pending` amber |
| Karan Mehra | karan.m@mateo.in | Pharmacy | Tilak Nagar | 5 hr ago | `Active` green |
| Deepa Iyer | deepa.i@mateo.in | OPD Assistant | Tilak Nagar | 26 min ago | `Active` green |

9 rows ✓ matches the role counts above.

3-dot menu: Edit access · Reset password · Resend invite *(only on pending)* · divider ·
Suspend account (red).

## 4. Permission matrix card
Right rail or full-width below. Rows = modules, columns = the 5 roles (header cells carry the role hue as
a 3px underline). Cells: a filled hue `Check` circle = full access; a hollow `Eye` outline = view only;
a `#E2E6F0` dash = none.

| Module | Reception | OPD | Accounts | HR | Pharmacy |
|---|---|---|---|---|---|
| Patients | ✓ | ✓ | 👁 | — | 👁 *(name + ID only)* |
| Prescriptions | 👁 | 👁 | — | — | 👁 |
| Appointments | ✓ | ✓ | 👁 | — | — |
| Revenue & billing | 👁 | — | ✓ | — | 👁 |
| Pharmacy | — | — | 👁 | — | ✓ |
| Staff & payroll | — | — | 👁 | ✓ | — |
| Audit logs | — | — | — | 👁 | — |

A `meta` footnote: **"Clinical notes and diagnoses are visible to the doctor only."**

## 5. Deliverables
```
src/data/team.ts
src/pages/Team.tsx
src/components/team/{RoleCard,MembersTable,PermissionMatrix,CreateSubUserModal}.tsx
src/components/shared/RoleChip.tsx
```

---

# SPEC 05 — Create sub-user modal
Overlay on `/doctor/team`

Modal 640px, white, `rounded-[20px]`, modal shadow, over a `rgba(10,27,77,.35)` blurred scrim.

## 1. Header
40×40 `#EEF2FF` `rounded-[10px]` tile + `UserPlus` indigo · **"Create sub-user account"** (`cardTitle` at
17px) over **"They will receive login credentials by email."** (12 / 500 / `#64748B`) · `X` 20px right.

## 2. Stepper
Three steps in a row, connected by 2px `#ECEEF4` rails: ① **Details** ② **Role & access**
③ **Review**. Step 1 = completed (solid `#16A34A` circle with a white `Check`, rail after it green);
step 2 = active (solid `#3B4FE0` circle, white numeral, label 12/700 `#0F172A`); step 3 = pending
(`#F1F3F9` circle, `#64748B` numeral).

## 3. Body — step 2 shown
- **Details recap strip** (`#F6F7FB` band): `Vikram Yadav · vikram.y@mateo.in · +91 98xxx xx210` with an
  `Edit2` link back to step 1.
- **ROLE** — label `label`, then five selectable tiles in a `grid grid-cols-5 gap-3`. Each tile: h-84,
  `rounded-[12px]`, `border #E2E6F0`, a 32×32 hue tile + role name (12 / 600). **Pharmacy is selected:**
  `bg #FFFBEB`, `border-2 #F59E0B`, and a 18px amber `CheckCircle2` badge at the top-right.
- **LOCATION ACCESS** — label, then toggle chips in a row: `All Locations` (off, `border #E2E6F0`),
  `Tilak Nagar` (**ON** — filled `#4F63F5`, white text, `Check` 13px), `Janakpuri OPD` (off),
  `Rajouri Garden` (off).
- **PERMISSIONS** — a bordered list, `rounded-[12px]`, `divide-y #F1F3F9`. Each row 48px: label
  (13 / 500 / `#0F172A`) + optional helper (11 / `#64748B`), a 40×22 toggle right-aligned
  (on = `#F59E0B`, off = `#CBD5E1`).

| Permission | State | Helper |
|---|---|---|
| Manage stock | ON | — |
| Enter purchase bills | ON | — |
| Record sales | ON | — |
| Record payments | ON | — |
| Generate invoices | ON | — |
| View patient clinical records | **OFF**, with a 13px `Lock` before the label | Clinical data stays with the doctor |

The locked row's label is `#64748B` and its toggle is disabled — it cannot be switched on for this role.

## 4. Footer
1px `#ECEEF4` top border, padding `16px 20px`. Left: `ChevronLeft` + **"Back"** ghost. Right: **"Cancel"**
ghost + **"Create account & send invite"** gradient primary.

## 5. States
- Email already in use → inline red helper under the field, submit disabled.
- SMTP unconfigured → after submit, the success state shows the generated credentials **once** in a
  `#F6F7FB` mono block with a copy button and a red `meta` warning: **"Shown once. Copy them now — email
  delivery is not configured."**

## 6. Deliverables
```
src/components/team/CreateSubUserModal.tsx
src/components/team/{RoleTilePicker,PermissionToggleList,Stepper}.tsx
```
