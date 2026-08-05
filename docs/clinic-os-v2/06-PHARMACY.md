# SPEC 18–20, 26–31 — Pharmacy & inventory control
Prepend **00-FOUNDATION.md** · Module hue **amber `#F59E0B`** throughout

> **The reconciliation that must hold across all nine screens** (§9.8):
> **15 low + 3 out of stock = 18 items needing attention**, and the dashboard's alert row says the same.
> 168 SKUs · stock value ₹2,41,800 · ₹14,200 expiring within 90 days · Rahul Distributors owed ₹8,000
> on invoice RD-8871 (₹10,000 billed, ₹2,000 paid).

---

# SPEC 18 — Pharmacy dashboard
`/doctor/pharmacy`

## 1. Page header
H1 **"Pharmacy"** + location chip. Subtitle **"Stock, purchases, sales and payments."**
Right: **"＋ Enter purchase bill"** secondary · **"＋ New sale / bill"** gradient primary
(`linear-gradient(135deg,#F59E0B,#F97316)`).

## 2. KPI row — 5 cards
| # | Accent | Label | Metric | Second line |
|---|---|---|---|---|
| 1 | `#F59E0B` | Stock value | **₹2,41,800** | 168 SKUs · 412 batches |
| 2 | `#4F63F5` | Sales today | **₹18,420** | 14 bills |
| 3 | `#F59E0B` | Low stock | **15** | at or below reorder level |
| 4 | `#EF4444` | Out of stock | **3** | pulsing red dot · `Reorder now →` |
| 5 | `#F43F5E` | Expiring ≤90 days | **11** batches | **₹14,200** at risk |

## 3. Alert strip
Full-width, `bg #FEF2F2`, 3px `#EF4444` left border, `rounded-[12px]`, padding `12px 16px`:
`AlertCircle` 18px red · **"3 items are out of stock"** (13/700/`#B91C1C`) ·
`— Amoxicillin 250 mg capsule, ORS sachets, Salbutamol respules` (12/500/`#64748B`) ·
`ml-auto` **"Reorder now"** button (`bg #EF4444`, white, h-34) → spec 30.

## 4. Stock table
Filter bar: search **"Search medicine, salt or batch…"**; pills `Category: All` · `Stock status: All` ·
`Distributor: All` · `Expiry: All`.
Segment tabs: `[ All 168 ] [ Low 15 ] [ Out of stock 3 ] [ Expiring 11 ] [ Fast movers 24 ]`

Columns: **ITEM** · **BATCH** · **DISTRIBUTOR** · **EXPIRY** · **PURCHASE RATE** · **MRP** ·
**IN STOCK** · **STATUS** · **ACTIONS**

- ITEM: a 30px `#FFFBEB` `rounded-[8px]` tile with an amber `Pill` glyph, then name (13/600) over
  strength + form (11/500/`#64748B`).
- EXPIRY: colour-coded — green `#16A34A` (>90 days), amber `#B45309` with `in 43 days`, red `#B91C1C`
  with `EXPIRED`.
- **IN STOCK: the number (13/700, tabular) with a `StockLevelBar` beneath** — a 4px track `#EEF1F8`,
  fill coloured by status, and a 2px `#64748B` vertical **reorder-level marker pin** at the threshold
  position. This bar is the component that makes "how much is left" readable at a glance.
- STATUS: `In stock` green · `Low` amber · `Out of stock` red.
- ACTIONS: `＋ Add stock` ghost · `− Dispense` ghost · 3-dot (Open stock card · Adjust · View movements ·
  Reorder).

| Item | Batch | Distributor | Expiry | Rate | MRP | In stock | Reorder at | Status |
|---|---|---|---|---|---|---|---|---|
| Paracetamol 250 mg/5 ml syrup | PB2417 | Rahul Distributors | 09/2027 | ₹42 | ₹65 | **142** | 40 | In stock |
| Amoxicillin 125 mg/5 ml syrup | AM1188 | MedPlus Agencies | 02/2027 | ₹58 | ₹92 | **42** | 25 | In stock |
| Amoxicillin 250 mg capsule | AC0921 | MedPlus Agencies | 11/2026 | ₹64 | ₹98 | **0** | 20 | **Out of stock** |
| ORS sachet (WHO formula) | OR3312 | Sun Pharma Depot | 07/2026 | ₹9 | ₹15 | **0** | 100 | **Out of stock** |
| Salbutamol respules 2.5 mg | SR7740 | MedPlus Agencies | 05/2026 | ₹18 | ₹28 | **0** | 40 | **Out of stock** |
| Cetirizine 5 mg/5 ml syrup | CT4402 | Rahul Distributors | 06/2025 | ₹46 | ₹78 | **9** | 20 | Low |
| Multivitamin drops 15 ml | MV2251 | Rahul Distributors | 01/2027 | ₹50 | ₹140 | **14** | 25 | Low |
| Zinc 20 mg/5 ml syrup | ZN5510 | Sun Pharma Depot | 04/2027 | ₹52 | ₹83 | **18** | 30 | Low |

The three out-of-stock rows carry `bg #FEF2F2` and a 3px red left border.

## 5. Right rail
- **"Fast movers (30 days)"** — 5 horizontal amber bars: Paracetamol syrup 96 · ORS sachet 74 ·
  Cetirizine syrup 52 · Amoxicillin syrup 41 · Multivitamin drops 33.
- **"Stock by category"** — a donut over ₹2,41,800: Antibiotics ₹78,600 (32.5%) ·
  Analgesics & antipyretics ₹54,400 (22.5%) · Vitamins & supplements ₹41,900 (17.3%) ·
  Vaccines ₹38,200 (15.8%) · Consumables ₹28,700 (11.9%). Sum ✓ = ₹2,41,800, percentages = 100.0%.

## 6. Deliverables
```
src/pages/Pharmacy.tsx
src/components/pharmacy/{PharmacyKpis,StockTable,OutOfStockBanner,FastMovers,CategoryDonut}.tsx
src/components/shared/StockLevelBar.tsx
```

---

# SPEC 19 — Purchase entry & distributor ledger
`/doctor/pharmacy/purchases/new`

`grid grid-cols-[58fr_42fr] gap-5`.

## 1. Left — "New purchase entry"
**Distributor selector** — a bordered row, h-56: a 36px initials avatar `RD`, **"Rahul Distributors"**
(14/700), `GSTIN 07AABCR1234M1Z5` mono (11/500/`#64748B`), and right-aligned an amber chip
**"₹8,000 outstanding"**. A `ChevronDown` opens a searchable list.

**Bill meta** — three fields in a row: `Invoice no.` = **RD-8871** · `Invoice date` = **08 May 2025** ·
`Due date` = **12 May 2025**.
Beneath: a file-drop zone, dashed `#D9DFEC`, h-72, `UploadCloud` 20px +
**"Attach purchase bill (PDF or photo)"** + a `meta` line `Max 10 MB`.

**Item table** — columns: `Item` (autocomplete) · `Batch` · `Expiry` · `Qty` · `Rate` · `GST%` · `Amount`.
Row height 52. A dashed **"＋ Add item"** row closes it.

| # | Item | Batch | Expiry | Qty | Rate | GST | Amount |
|---|---|---|---|---|---|---|---|
| 1 | Paracetamol 250 mg/5 ml syrup | PB2417 | 09/2027 | 20 | ₹42 | 12% | **₹840** |
| 2 | Dolo 650 tablet (strip of 15) | DL5521 | 08/2027 | 100 | ₹28 | 12% | **₹2,800** |
| 3 | Amoxicillin 125 mg/5 ml syrup | AM1204 | 02/2027 | 30 | ₹58 | 12% | **₹1,740** |
| 4 | ORS sachet (WHO formula) | OR3401 | 07/2027 | 200 | ₹9 | 5% | **₹1,800** |
| 5 | Multivitamin drops 15 ml | MV2288 | 01/2027 | 40 | ₹50 | 12% | **₹2,000** |

**Totals block**, right-aligned, `bg #F6F7FB`, `rounded-[12px]`, padding `16px`:

| Line | Value |
|---|---|
| Subtotal | ₹9,180 |
| GST | ₹1,102 |
| Discount | −₹282 |
| **GRAND TOTAL** | **₹10,000** (22 / 800, amber) |

`840 + 2,800 + 1,740 + 1,800 + 2,000 = ₹9,180` ✓ · GST is computed per line and rounded to the rupee at
the invoice level · `9,180 + 1,102 − 282 = ₹10,000` ✓

**Payment section** — `border-t #ECEEF4`, padding-top 16px:
- Mode chips: `Cash` · `UPI` **(selected, amber filled)** · `Cheque` · `Credit`.
- **"Amount paid now"** input, value **₹2,000**.
- A live amber chip: **"Balance due ₹8,000"** (13/700) with `due 12 May 2025` beneath.
- A 6px progress bar: 20% amber fill, labelled **"₹2,000 of ₹10,000 paid"**.

Footer: **"Save draft"** ghost · **"Save & add to stock"** gradient primary. On save, five stock movements
of type *Purchase in* are written (spec 27) and each item's quantity increases.

## 2. Right — "Distributor ledger — Rahul Distributors"
- Three mini stats: **Total purchased ₹1,24,000** · **Paid ₹1,16,000** · **Outstanding ₹8,000** (amber).
  `1,24,000 − 1,16,000 = 8,000` ✓
- A 8px progress bar at **93.5%** labelled **"93.5% settled"**.
- **Ledger table** — Date · Type · Reference · Debit · Credit · **Balance** (running, right-aligned mono) ·
  Status. Type chips: `Purchase` amber · `Payment` green.

| Date | Type | Reference | Debit | Credit | Balance |
|---|---|---|---|---|---|
| 08 May 2025 | Purchase | RD-8871 | ₹10,000 | — | ₹10,000 |
| 08 May 2025 | Payment | UPI ····4471 | — | ₹2,000 | **₹8,000** |
| 22 Apr 2025 | Payment | NEFT ····1180 | — | ₹34,000 | ₹0 |
| 22 Apr 2025 | Purchase | RD-8702 | ₹34,000 | — | ₹34,000 |
| 04 Apr 2025 | Payment | UPI ····9903 | — | ₹28,500 | ₹0 |
| 04 Apr 2025 | Purchase | RD-8544 | ₹28,500 | — | ₹28,500 |

Read bottom-up: each purchase raises the balance, each payment clears it. Only RD-8871 is open, at
**₹8,000** ✓
- Footer: **"Record payment"** gradient primary · **"Download statement PDF"** ghost.

## 3. Deliverables
```
src/pages/PurchaseEntry.tsx
src/components/pharmacy/{DistributorPicker,PurchaseItemTable,TotalsBlock,PaymentSection,DistributorLedger}.tsx
```

---

# SPEC 20 — Sale, invoice & receipt
`/doctor/pharmacy/sales/new`

`grid grid-cols-[55fr_45fr] gap-5`.

## 1. Left — "New bill"
- **Customer row**: a patient selector showing **"Aarav Mehta · PID-2419"** with a 30px avatar, and a
  toggle **"Walk-in customer"** to its right (off).
- **Item search**: h-52, `bg #F7F8FC`, `ScanLine` 18px + placeholder **"Scan or search medicine…"**.
  Dropdown **open**, 420px, each row: name (13/600) · batch + expiry (11/500/`#64748B`) · MRP ·
  a right-aligned stock chip (`42 in stock` green / `9 left` amber / `Out of stock` red, the last
  disabled and struck through).
- **Cart table** — Item · Batch · Qty (a `−  n  +` stepper) · MRP · Disc% · Amount.

| Item | Batch | Qty | MRP | Amount |
|---|---|---|---|---|
| Paracetamol 250 mg/5 ml syrup 60 ml | PB2417 | 2 | ₹65 | ₹130 |
| Amoxicillin 125 mg/5 ml syrup 30 ml | AM1188 | 2 | ₹92 | ₹184 |
| Multivitamin drops 15 ml | MV2251 | 1 | ₹140 | ₹140 |
| ORS sachet | OR3401 | 20 | ₹15 | ₹300 |
| Zinc 20 mg/5 ml syrup | ZN5510 | 2 | ₹83 | ₹166 |
| Digital thermometer | — | 1 | ₹320 | ₹320 |

- **Totals stack**, right-aligned: `Subtotal ₹1,240` · `GST ₹148` · `Discount −₹100` ·
  **`PAYABLE ₹1,288`** (30 / 800).
  `130+184+140+300+166+320 = ₹1,240` ✓ · `1,240 + 148 − 100 = ₹1,288` ✓
  *(This is receipt RC-10426 in spec 17 — the same bill, the same split.)*
- **Payment**: mode chips with `UPI` selected, revealing a 96px QR block and the UPI id
  `tilaknagarclinic@okaxis`. **"Amount received"** = **₹800**. A **"Partial payment"** toggle is ON,
  showing an amber line **"Paid ₹800 · Balance ₹488"** and a due-date picker (**15 May 2025**).
  `1,288 − 800 = ₹488` ✓
- Footer: **"Generate invoice & print"** gradient primary, full width, h-52.

On generate: six stock movements of type *Sale out* are written and each item's quantity decreases —
Paracetamol goes **144 → 142** (spec 27's ledger must show exactly this).

## 2. Right — invoice preview
An A4 sheet, sticky, `shadow-[0_16px_48px_-16px_rgba(10,27,77,.28)]`:
1. Gradient letterhead — clinic name, address, `Drug Licence No. DL-20B-4471 / DL-21B-4472`, GSTIN.
2. **"TAX INVOICE"** centred, 16/800, letter-spaced.
3. Invoice meta: `PH-1042` · `08 May 2025 · 10:06 AM` · `Counter 1 · Vikram Yadav`.
4. Bill-to block: `Aarav Mehta · PID-2419 · +91 98xxx xx210 · B-14, Tilak Nagar`.
5. Item table with `HSN`, `Batch`, `Exp`, `Qty`, `MRP`, `Disc`, `GST%`, `Amount`.
6. Totals, then **"Rupees One Thousand Two Hundred Eighty-Eight Only"** in italic 11px.
7. A rotated **"PARTIALLY PAID"** stamp, `#B45309` at 12% opacity, behind the totals.
8. Terms footnote: *"Medicines once sold are not returnable. Prescription retained."*

Toolbar above: **"Download PDF"** · **"Print"** · **"WhatsApp"** · **"Email"**.

Beneath the invoice, peeking 40% into view, a **payment receipt** card: `RCPT-2210` ·
**"₹800 received"** (18/800/green) · mode `UPI` · a rotated green **"RECEIPT"** stamp ·
**"Download PDF"**.

## 3. Deliverables
```
src/pages/NewSale.tsx
src/components/pharmacy/{ItemSearch,CartTable,PaymentPanel,InvoiceSheet,ReceiptCard}.tsx
```

---

# SPEC 26 — Medicine stock card
`/doctor/pharmacy/items/:id`

## 1. Item header
Card with an amber gradient wash (`linear-gradient(135deg,#FFFBEB,#FFFFFF)`), padding `22px 24px`:
- 52px amber `rounded-[12px]` tile + `Pill` white glyph · **"Paracetamol 250 mg/5 ml Syrup"**
  (24 / 800) · chips beneath: `Syrup · 60 ml` · `Antipyretic` · `HSN 3004` · `GST 12%` ·
  a red `Rx` chip · `Micro Labs`.
- Right: **142** (`metricLg` 40/800) over **"bottles in stock"** (12/500/`#64748B`), a 160px
  `StockLevelBar` with the reorder pin at 40, and a green **"Healthy"** chip.
- Actions: **"＋ Add stock"** secondary · **"− Dispense"** secondary · **"Adjust"** ghost · 3-dot.

## 2. Metric row — 5 tiles
| Tile | Value | Note |
|---|---|---|
| Stock value | **₹5,964** | 142 × ₹42 ✓ |
| Purchase rate | **₹42** | ▲ ₹2 vs last purchase |
| MRP | **₹65** | — |
| Margin | **35%** | (65 − 42) / 65 = 35.4% |
| Avg. monthly use | **96** | 30-day sparkline |

## 3. Batches table
Columns: **BATCH** · **EXPIRY** · **RECEIVED** · **DISTRIBUTOR** · **QTY IN** · **QTY LEFT** · **RATE** ·
**VALUE** · **ACTIONS**

| Batch | Expiry | Received | Distributor | Qty in | Qty left | Rate | Value |
|---|---|---|---|---|---|---|---|
| PB2417 | 09/2027 (green) | 08 May 2025 | Rahul Distributors | 20 | **20** | ₹42 | ₹840 |
| PB2388 | 03/2027 (green) | 12 Apr 2025 | Rahul Distributors | 60 | **48** | ₹42 | ₹2,016 |
| PB2340 | 06/2025 (amber · in 43 days) | 04 Mar 2025 | MedPlus Agencies | 80 | **62** | ₹42 | ₹2,604 |
| PB2291 | 04/2025 (red · **EXPIRED**) | 18 Jan 2025 | Rahul Distributors | 40 | **12** | ₹42 | ₹504 |

`20 + 48 + 62 + 12 = 142` ✓ · `840 + 2,016 + 2,604 + 504 = ₹5,964` ✓
The expired row: `bg #FEF2F2`, 3px red left border, and a **"Write off"** mini button in Actions.
Above the table, a chip: `Info` 13px + **"Dispensed oldest-expiry-first (FEFO)"**.

## 4. Bottom cards
**"Stock on hand (90 days)"** — a Recharts stepped `AreaChart`, amber, with green up-steps annotated
`Purchase +100` / `Purchase +20` and red down-steps `Sale −2`, plus a dashed `#94A3B8`
`ReferenceLine` at **40** labelled **"Reorder level"**.

**"Purchase history"** — Date · Distributor · Qty · Rate (with a ▲/▼ vs previous) · Invoice no.

| Date | Distributor | Qty | Rate | Invoice |
|---|---|---|---|---|
| 08 May 2025 | Rahul Distributors | 20 | ₹42 ▲ ₹2 | RD-8871 |
| 12 Apr 2025 | Rahul Distributors | 60 | ₹40 ▬ | RD-8702 |
| 04 Mar 2025 | MedPlus Agencies | 80 | ₹40 ▼ ₹1 | MP-3319 |
| 18 Jan 2025 | Rahul Distributors | 40 | ₹41 | RD-8544 |

## 5. Deliverables
```
src/pages/StockCard.tsx
src/components/pharmacy/{ItemHeader,BatchTable,StockOnHandChart,PurchaseHistory}.tsx
```

---

# SPEC 27 — Stock movements
`/doctor/pharmacy/movements`

The screen that proves stock changes by itself. Every row answers: what moved, by how much, from what to
what, because of which document, and who (or what) did it.

## 1. Page header
H1 **"Stock movements"**, subtitle **"Every unit in and out, automatically recorded."**
Right: **"Export CSV"** ghost + location chip.

## 2. Movement-type chips
`[ All 1,911 ]` · `Purchase in 128` emerald · `Sale out 1,204` indigo · `Dispensed to patient 386` purple ·
`Return to distributor 12` amber · `Damage / expiry 9` red · `Manual adjustment 4` slate ·
`Opening stock 168` cyan.
`128 + 1,204 + 386 + 12 + 9 + 4 + 168 = 1,911` ✓

## 3. Filter bar
Search **"Search medicine, batch or reference…"**; a `DateRangePicker`; pills `Movement type: All` ·
`Medicine: All` · `Batch: All` · `Recorded by: All` · `Location: Tilak Nagar`.

## 4. The ledger
Grouped by day with a sticky sub-header **"Today · 8 May 2025"** (12/700 + a count chip).

Row layout (64px): a 28px circular direction icon (`ArrowDownToLine` on `#ECFDF5` for in,
`ArrowUpFromLine` on `#FEF2F2` for out) · medicine name (13/600) + batch mono chip · a movement sentence
(12/500/`#475569`) · **QTY DELTA pill** (14/800 tabular, `+20` on `#ECFDF5`/`#15803D`, `−2` on
`#FEF2F2`/`#B91C1C`) · **BEFORE → AFTER** (`124 → 144`, 12/600 tabular, the arrow `#94A3B8`) ·
recorded-by (22px avatar + name + role chip, or a `Zap` 14px in a cyan circle + **"System"**) ·
timestamp (12/500/`#64748B`).

| Time | Medicine · batch | Sentence | Δ | Before → After | By |
|---|---|---|---|---|---|
| 11:42 AM | Paracetamol 250 mg/5 ml · PB2417 | Dispensed 2 bottles to Aarav Mehta · PID-2419 · Bill PH-1042 | **−2** | 144 → **142** | **System** |
| 11:42 AM | ORS sachet · OR3401 | Dispensed 20 sachets to Aarav Mehta · PID-2419 · Bill PH-1042 | **−20** | 200 → 180 | **System** |
| 10:15 AM | Paracetamol 250 mg/5 ml · PB2417 | Received 20 bottles from Rahul Distributors · Invoice RD-8871 | **+20** | 124 → 144 | Vikram Yadav · Pharmacy |
| 10:15 AM | Dolo 650 tablet · DL5521 | Received 100 strips from Rahul Distributors · Invoice RD-8871 | **+100** | 46 → 146 | Vikram Yadav · Pharmacy |
| 09:38 AM | Cetirizine 5 mg/5 ml · CT4402 | Dispensed 1 bottle to Myra Kapoor · PID-2402 · Bill PH-1039 | **−1** | 10 → 9 | **System** |
| 09:04 AM | Amoxicillin 250 mg capsule · AC0921 | Dispensed 10 capsules to Kabir Singh · PID-2388 · Bill PH-1036 | **−10** | 10 → **0** | **System** |

The Paracetamol chain reads `124 → 144 → 142`, matching spec 26's batch and spec 20's sale exactly.
The last row is highlighted `bg #FEF2F2` because it took an item to zero, with an inline red chip
**"Now out of stock"**.

**The most recent row** carries a soft cyan glow and a **"just now"** pulse for 6 seconds after mount.

## 5. Right rail
**"Today's movement"** — two counters, `In 120 units` (green, `ArrowDownToLine`) and `Out 33 units`
(red, `ArrowUpFromLine`), plus a 12px stacked bar in those proportions and a `meta` line
**"Across 9 items."**

## 6. Deliverables
```
src/pages/StockMovements.tsx
src/components/pharmacy/{MovementRow,MovementTypeChips,TodaysMovement}.tsx
```

---

# SPEC 28 — Distributors, payables & receivables
`/doctor/pharmacy/distributors`

## 1. Page header
H1 **"Distributors & payments"**. A `SegmentedControl` **[ Payables | Receivables | All ]** —
**Payables** active. Right: **"＋ Record payment"** gradient primary.

## 2. KPI row — 5 cards
| Card | Hue | Value | Sub-line |
|---|---|---|---|
| Total payable | Amber | **₹1,84,000** | to 14 distributors |
| Overdue payable | Red | **₹42,000** | 5 invoices · oldest 74 days |
| Paid this month | Green | **₹96,000** | 11 payments |
| Receivable from patients | Rose | **₹46,200** | 23 patients |
| Distributors | Indigo | **14** | 9 active this month |

## 3. Ageing band
A full-width 28px stacked bar, `rounded-full`, four segments with amounts labelled beneath each:

| Segment | Colour | Amount | Share |
|---|---|---|---|
| Current (not yet due) | `#16A34A` | ₹98,000 | 53.3% |
| 0–30 days | `#F59E0B` | ₹44,000 | 23.9% |
| 31–60 days | `#F97316` | ₹28,000 | 15.2% |
| 60+ days | `#EF4444` | ₹14,000 | 7.6% |

`98,000 + 44,000 + 28,000 + 14,000 = ₹1,84,000` ✓ · shares = 100.0% ✓

## 4. Distributors table
Columns: **DISTRIBUTOR** (initials avatar + name + phone + GSTIN mono) · **TOTAL PURCHASED** ·
**PAID** · **OUTSTANDING** (13/700 amber, right-aligned) · **SETTLED** (a 4px bar + %) ·
**OLDEST DUE** · **LAST PAYMENT** · **ACTIONS**

| Distributor | Purchased | Paid | Outstanding | Settled | Oldest due |
|---|---|---|---|---|---|
| Rahul Distributors | ₹1,24,000 | ₹1,16,000 | **₹8,000** | 93.5% | 0 days (due 12 May) |
| MedPlus Agencies | ₹2,18,400 | ₹1,76,400 | **₹42,000** | 80.8% | **74 days** ⚠ |
| Sun Pharma Depot | ₹96,200 | ₹68,200 | **₹28,000** | 70.9% | 46 days |
| Cipla Direct | ₹1,44,000 | ₹1,10,000 | **₹34,000** | 76.4% | 22 days |
| Delhi Surgicals | ₹62,800 | ₹40,800 | **₹22,000** | 65.0% | 18 days |
| Nova Diagnostics | ₹38,000 | ₹22,000 | **₹16,000** | 57.9% | 9 days |
| Others (8 distributors) | ₹2,84,600 | ₹2,50,600 | **₹34,000** | 88.1% | — |

`8,000 + 42,000 + 28,000 + 34,000 + 22,000 + 16,000 + 34,000 = ₹1,84,000` ✓
The MedPlus row renders `bg #FEF2F2` with a red left border — it is the 60+ bucket.

**One row expanded** (Rahul Distributors) into an inline sub-panel, `bg #F9FAFC`, listing the bills:

| Invoice | Date | Amount | Paid | Balance | Status |
|---|---|---|---|---|---|
| RD-8871 | 08 May 2025 | ₹10,000 | ₹2,000 | **₹8,000** | `Partial` amber + a 20% mini bar |
| RD-8702 | 22 Apr 2025 | ₹34,000 | ₹34,000 | ₹0 | `Paid` green |
| RD-8544 | 04 Apr 2025 | ₹28,500 | ₹28,500 | ₹0 | `Paid` green |

with a **"Pay ₹8,000"** gradient button on the open row.

## 5. Right rail
**"Payment schedule"** — a 14-day calendar strip with amber dots on due dates, and a list beneath:
`12 May · ₹8,000 · Rahul Distributors` · `16 May · ₹22,000 · Delhi Surgicals` ·
`21 May · ₹34,000 · Cipla Direct`.

## 6. Receivables tab
Same table shape, but rows are **patients** with unpaid bills: Patient (avatar + name + PID) · Bills ·
Total billed · Paid · Outstanding · Oldest · Actions (`Send reminder`, `Record payment`).
Header total must equal **₹46,200** across **23 patients**, and the first row is
`Aarav Mehta · PID-2419 · PH-1042 · ₹1,288 billed · ₹800 paid · ₹488 due` — the same bill as specs 17
and 20.

## 7. Deliverables
```
src/pages/Distributors.tsx
src/components/pharmacy/{AgeingBar,DistributorTable,BillBreakdown,PaymentSchedule,RecordPaymentModal}.tsx
```

---

# SPEC 29 — Adjustments, expiry & stock take
`/doctor/pharmacy/adjustments`

## 1. Expiry board
Four columns (`grid grid-cols-4 gap-5`), each a column header with a count chip and hue, then stacked
item cards.

| Column | Hue | Count | Value at risk |
|---|---|---|---|
| Expired | `#EF4444` | **4** | ₹2,100 |
| Expiring ≤30 days | `#F97316` | **2** | ₹1,800 |
| Expiring ≤90 days | `#F59E0B` | **5** | ₹10,300 |
| Safe | `#16A34A` | **401** | — |

`4 + 2 + 5 = 11 batches` ✓ (§9.8) and `2,100 + 1,800 + 10,300 = ₹14,200` ✓
`4 + 2 + 5 + 401 = 412 batches` ✓ (§18 KPI 1)

Item card: medicine name (12/600) · batch mono · expiry date · `Qty 12` · `₹504 at risk` ·
two mini buttons **"Return to distributor"** / **"Write off"**.
A banner above the board: **"₹14,200 of stock at risk in the next 90 days."**

## 2. New adjustment form
- **Item picker** showing the current stock inline (`Paracetamol 250 mg/5 ml · 142 in stock`).
- **Reason tiles**, `grid grid-cols-6 gap-3`, each with an icon and hue:
  `Damaged` rose · `Expired` red · `Return to distributor` amber · `Lost / theft` slate ·
  `Count correction` indigo · `Free sample in` green. **Damaged is selected** (2px rose border,
  `bg #FFF1F2`, check badge).
- **Batch selector** (`PB2291 · exp 04/2025 · 12 left`), **Quantity** stepper = **4**.
- A computed line, 14/700: **"Stock after adjustment: 142 → 138"** with `142` in `#64748B` and `138` in
  `#B91C1C`.
- **Notes** textarea + a photo-attach drop zone.
- A red primary **"Record adjustment"** with a `meta` warning beneath:
  **"This is permanently logged in the audit trail."**

## 3. Stock take card
- Header: **"Physical stock count"** + `Started 6 May 2025 by Vikram Yadav` + a `In progress` amber chip.
- A 72px `ProgressRing` at **67%** with the centre **112/168**.
- **Variance table** — Item · System qty · Counted qty · Variance · Value impact.

| Item | System | Counted | Variance | Value impact |
|---|---|---|---|---|
| Paracetamol 250 mg/5 ml | 142 | 140 | **−2** red | −₹84 |
| ORS sachet | 180 | 180 | 0 | ₹0 |
| Cetirizine 5 mg/5 ml | 9 | 10 | **+1** green | +₹46 |
| Zinc 20 mg/5 ml | 18 | 16 | **−2** red | −₹104 |

Net impact **−₹142**. Footer: **"Reconcile & post variances"** primary — posting writes four
*Manual adjustment* movements to spec 27.

## 4. Adjustment history
Date · Item · Batch · Reason chip · Qty delta pill · Value · Recorded by (avatar + role chip) ·
Approved by. 6 rows.

## 5. Deliverables
```
src/pages/Adjustments.tsx
src/components/pharmacy/{ExpiryBoard,AdjustmentForm,StockTakeCard,AdjustmentHistory}.tsx
```

---

# SPEC 30 — Reorder & purchase orders
`/doctor/pharmacy/reorder`

## 1. Page header
H1 **"Reorder"**, subtitle **"18 items at or below their reorder level."** *(15 low + 3 out — §9.8.)*
Right: **"＋ Blank purchase order"** ghost · **"Generate purchase orders"** gradient primary.

## 2. Suggestion table
A `select all` checkbox in the header; **12 of 18 rows checked**. Out-of-stock rows carry a 3px red left
border and are checked by default.

Columns: ☑ · **ITEM** · **CURRENT** · **REORDER AT** · **AVG/MONTH** · **DAYS OF COVER** ·
**SUGGESTED QTY** (an editable stepper) · **DISTRIBUTOR** · **LAST RATE** · **EST. COST**

| ☑ | Item | Current | Reorder at | Avg/mo | Cover | Suggested | Distributor | Rate | Est. cost |
|---|---|---|---|---|---|---|---|---|---|
| ✔ | Amoxicillin 250 mg capsule | **0** | 20 | 62 | **0 days** red | 120 | MedPlus Agencies | ₹64 | ₹7,680 |
| ✔ | ORS sachet | **0** | 100 | 74 | **0 days** red | 300 | Sun Pharma Depot | ₹9 | ₹2,700 |
| ✔ | Salbutamol respules 2.5 mg | **0** | 40 | 38 | **0 days** red | 100 | MedPlus Agencies | ₹18 | ₹1,800 |
| ✔ | Cetirizine 5 mg/5 ml syrup | 9 | 20 | 52 | **5 days** amber | 80 | Rahul Distributors | ₹46 | ₹3,680 |
| ✔ | Multivitamin drops 15 ml | 14 | 25 | 33 | **13 days** amber | 60 | Rahul Distributors | ₹50 | ₹3,000 |
| ✔ | Zinc 20 mg/5 ml syrup | 18 | 30 | 41 | **13 days** amber | 80 | Sun Pharma Depot | ₹52 | ₹4,160 |

Days of cover = current ÷ (avg per month ÷ 30), rounded down. Check row 4: 9 ÷ (52/30) = 9 ÷ 1.733 =
**5.2 → 5 days** ✓ Compute it, never hand-type it.

## 3. Grouped preview panel — right
**"3 purchase orders will be created"**, then three mini cards grouped by distributor:

| Distributor | Items | Value |
|---|---|---|
| MedPlus Agencies | 5 items | ₹18,400 |
| Rahul Distributors | 4 items | ₹9,200 |
| Sun Pharma Depot | 3 items | ₹8,600 |

Total **₹36,200** across 12 items ✓ (matches the 12 checked rows).
Each card has an expand chevron and three send-channel icon buttons: `MessageCircle` (WhatsApp),
`Mail`, `Download`.

Beneath: a **purchase order PDF preview** — A4, gradient letterhead, **"PURCHASE ORDER"**, `PO-2025-0114`,
the distributor block, an item table, and **"Deliver by 12 May 2025"**.

## 4. Deliverables
```
src/pages/Reorder.tsx
src/components/pharmacy/{ReorderTable,PoGroupPanel,PurchaseOrderSheet}.tsx
```

---

# SPEC 31 — Pharmacy sub-user workspace
`/doctor` **as seen by Vikram Yadav (Pharmacy role)** — proves role scoping is real

## 1. Sidebar — visibly reduced
Only six live items, no section groups except **PHARMACY** and **RESTRICTED**:
`Dashboard` · `Stock` · `Purchases` · `Sales` · `Payments` · `Adjustments`.
Active item uses the **amber** pill (`#F59E0B`) rather than indigo — the role recolours the accent.

Then a **RESTRICTED** group of three items at **35% opacity**, non-interactive, each with a 13px `Lock`
after the label: `Patients 🔒` · `Prescriptions 🔒` · `Revenue 🔒`. Hovering shows a tooltip
**"Not available for the Pharmacy role"**.

Sidebar footer: avatar **"Vikram Yadav"** + an amber `PHARMACY` role chip + a location chip
`Tilak Nagar`.

## 2. Top bar
The location switcher shows **"Tilak Nagar Clinic"** with a 13px `Lock` replacing the chevron; it is not
clickable, and its tooltip reads **"You have access to 1 location"**. Search placeholder narrows to
**"Search medicines, bills or distributors…"**. The bell remains; the doctor's avatar is replaced by
Vikram's.

## 3. Access banner
Full-width, `bg #FFFBEB`, 3px `#F59E0B` left border, `rounded-[12px]`, `ShieldCheck` 16px amber +
**"Pharmacy access — clinical patient records are not visible to this role."** (12/600/`#B45309`).

## 4. Content
**KPI row — 4 cards:** Today's sales **₹18,420** (amber) · Bills today **14** (indigo) ·
Low stock **15** (amber) · Out of stock **3** (red, pulsing dot).

**Two action tiles**, `grid grid-cols-2 gap-5`, h-120, amber gradient, white text, large icon + label +
a `meta` sub-line: **"＋ New sale / bill"** (*"Scan or search to start"*) and
**"＋ Enter purchase bill"** (*"Record stock received"*).

**"Recent bills"** table — Bill no. · Time · Customer · Items · Amount · Payment.
**The customer column shows `Aarav M. · PID-2419` — the surname is masked to an initial, and there is no
diagnosis, no prescription and no visit-reason column.** That masking is the visible proof of the
permission matrix in spec 04.

| Bill | Time | Customer | Items | Amount | Payment |
|---|---|---|---|---|---|
| PH-1042 | 10:06 AM | Aarav M. · PID-2419 | 6 | ₹1,288 | `Partial` amber |
| PH-1041 | 09:52 AM | Walk-in customer | 2 | ₹210 | `Paid` green |
| PH-1039 | 09:38 AM | Myra K. · PID-2402 | 3 | ₹446 | `Paid` green |
| PH-1036 | 09:04 AM | Kabir S. · PID-2388 | 4 | ₹892 | `Paid` green |

**"Needs attention"** list — three rows with coloured left rails:
red **"3 items out of stock"** → Reorder · amber **"₹8,000 due to Rahul Distributors on 12 May"** →
Record payment · amber **"4 batches expired — ₹2,100 at risk"** → Write off.

## 5. Deliverables
```
src/pages/PharmacyStaffHome.tsx
src/components/pharmacy/{StaffSidebar,AccessBanner,ActionTiles,RecentBills,NeedsAttention}.tsx
src/lib/permissions.ts   // the role → visible-modules map, shared with spec 04's matrix
```
