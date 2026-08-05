# Mateo — Doctor Panel v2 ("Clinic OS") — Image-generation prompt pack

Purpose: paste these into ChatGPT (GPT-image / DALL·E) to generate high-fidelity UI mockups for the
redesigned doctor dashboard, before any code is written.

---

## HOW TO USE THIS PACK (read once)

1. **One screen per image.** Never ask for "all screens". Image models collapse under multi-screen requests.
2. **Every request = BLOCK A (style system) + ONE screen block.** Block A locks the visual identity so all
   24 images look like one product.
3. **Image #1 sets the style.** Generate `SCREEN 01 — Dashboard` first. For every image after that, attach
   image #1 as a reference and start with: *"Use the exact same design system, palette, sidebar, typography
   and card language as the attached reference image. Now render: …"*
4. **Aspect ratio:** desktop screens `16:9` (say "1920×1080 desktop UI, wide"), mobile screens `9:16`.
5. **Expect garbled micro-text.** Image models cannot render 40 rows of real text. That is fine — you are
   buying *layout, hierarchy, colour and component language*, not copy. Always add: *"labels may be
   simplified; keep all text large enough to read, no dense paragraphs."*
6. **Iterate with edits, not restarts:** "same image, but make the KPI row 5 cards instead of 4."

---

## BLOCK A — MASTER STYLE PREAMBLE
> Paste this **verbatim** at the top of every image request, then append one SCREEN block.

```text
You are a senior product designer creating a pixel-perfect, high-fidelity UI mockup for a desktop web app.

PRODUCT: "Mateo Clinic OS" — the doctor-facing panel of an Indian paediatric practice-management platform.
Users are paediatricians in India running 1–3 clinics/OPDs, plus their reception, accounts, HR and pharmacy
staff. Everything is in ₹ (INR), times in IST, Indian names (Dr. Ananya Sharma, Aarav Mehta, Myra Kapoor,
Kabir Singh, Rahul Distributors).

ART DIRECTION: "Advanced colourful clinical" — a vivid, modern, confident SaaS dashboard. NOT the grey
enterprise-hospital look, NOT sterile white-on-white. Think Linear/Stripe/Vercel structural discipline
crossed with a warm, saturated, colour-coded medical product. Rich but calm. Data-dense but breathable.

CANVAS + CHROME
- App background: #F5F7FC (very light cool grey-blue), with a faint 2% noise/grain texture.
- Left sidebar, 248px, deep indigo→navy vertical gradient #0F1B47 → #1E3A8A, rounded outer corner,
  white 90% icons+labels, the active item is a white 12% glass pill with a 3px vivid cyan #22D3EE left rail
  and a soft glow.
- Top header bar: white, 72px, subtle bottom hairline #E6EAF3, floats above content with a soft shadow.
- Content cards: pure white #FFFFFF, 18px radius, 1px #E9EDF6 border, layered soft shadow
  (0 1px 2px rgba(16,27,71,.06), 0 12px 32px rgba(16,27,71,.06)). Generous 24–28px padding.

COLOUR SYSTEM — every functional domain owns a hue (this is what makes it "colourful"):
- Patients / clinical core .... Indigo  #4F46E5
- Appointments / schedule ..... Violet  #7C3AED
- Total revenue .............. Emerald #059669
- Today's revenue ............ Teal    #0D9488
- Pharmacy / inventory ....... Amber   #F59E0B
- Staff / HR / payroll ....... Rose    #F43F5E
- Growth charts .............. Sky     #0EA5E9
- Vaccination ................ Mint    #14B8A6
- Audit logs ................. Slate   #64748B
- Email logs ................. Cyan    #06B6D4
- Danger / overdue / alert ... Red     #EF4444
- Warning / pending .......... Amber   #F59E0B
Each KPI/stat card uses its hue as: a 3px top rail, a 10% tinted 135° gradient wash inside the card, a
saturated 40px rounded-square icon chip (white glyph on the full-strength hue), and the metric's delta pill.

TYPOGRAPHY
- Display/headings: "Plus Jakarta Sans" ExtraBold, tight tracking (-0.02em).
- Body/UI: "Inter", 14px, #475569; labels 11px uppercase, 0.12em tracking, semi-bold, muted.
- Big numbers: 32–40px ExtraBold, tabular figures, near-black #0F172A.

COMPONENT LANGUAGE
- Pills/chips: fully rounded, 10% tinted background + full-strength text of their hue.
- Buttons: primary = indigo→violet 135° gradient, white text, 12px radius, soft coloured shadow.
  Secondary = white, 1px border, dark text. Ghost = tinted.
- Tables: zebra-free, 56px rows, hairline dividers, sticky white header with uppercase micro-labels,
  avatar + name + sub-label in the first column, right-aligned tabular numbers, a 3-dot menu at row end.
- Charts: rounded-cap bars, gradient area fills fading to transparent, 3px smooth lines with glow dots,
  donuts with rounded caps and a centred big number. Soft dashed #EEF2F7 gridlines only.
- Overlays/modals: 20px radius, white, heavy soft shadow, over a blurred indigo-tinted scrim.
- Empty/loading states are not needed — show realistic populated data.

AVOID: stock photography, 3D bevels, glossy skeuomorphism, neon-on-black gaming look, drop shadows that
look 2010, lorem-ipsum paragraph walls, illegible 6px text, browser chrome/URL bar, phone bezels on
desktop shots, watermarks.

OUTPUT: a single flat 2D UI mockup, straight-on, edge to edge, 1920×1080 desktop, crisp vector-like
rendering, no perspective, no device frame, no人 people. Keep all text large enough to be legible;
simplified labels are acceptable.
```

*(Delete the stray characters `no人` → write `no people` when you paste — noted so you don't miss it.)*

---

## BLOCK B — THE GLOBAL SHELL (referenced by every screen)

> This describes the sidebar + header that must appear identically in **all** desktop screens.
> Append it to Block A once, and thereafter just say "same shell as reference".

```text
GLOBAL SHELL (identical on every screen):

LEFT SIDEBAR (248px, indigo→navy gradient), containing, top to bottom:
- Logo lockup: rounded-square gradient mark + wordmark "Mateo" with tiny "CLINIC OS" caption.
- Section label "TODAY": Dashboard (grid icon), Appointments (calendar-clock), Consultations (stethoscope).
- Section label "PATIENTS": Patients (users), Prescriptions (file-text), Growth & Vaccines (activity),
  Messages (message-square, with a red "3" badge).
- Section label "PRACTICE": Revenue (indian-rupee), Pharmacy (pill), Staff (user-cog), Reports (bar-chart).
- Section label "ADMIN": Locations (map-pin), Team & Roles (shield-check), Audit Logs (scroll-text),
  Email Logs (mail).
- Bottom: doctor avatar card — circular photo-less initials avatar "AS", "Dr. Ananya Sharma",
  "Paediatrician", a small chevron.

TOP HEADER (72px, white):
- Left: page title (Plus Jakarta ExtraBold, 22px) + a small breadcrumb line above it.
- Centre-left: LOCATION SWITCHER — the signature control. A pill-shaped button, white with a 1px border
  and a coloured dot, reading "◉ Tilak Nagar Clinic ▾" with a tiny "12 patients today" sub-label. When
  the active location is "Overall", the dot is a rainbow/multi-hue gradient and the label reads
  "◎ All Locations ▾".
- Right: a rounded search field with ⌘K hint, a bell with a red dot, a language toggle "EN / हिं",
  and the doctor's avatar.
```

---

# SCREEN PROMPTS

Each block below goes **after** Block A (+ Block B for the first few).

---

## SCREEN 01 — Dashboard Home (generate this FIRST; it is the style anchor)

```text
RENDER: The doctor Dashboard home screen, location switcher set to "Tilak Nagar Clinic".

Layout, top to bottom inside the content area (32px page padding, 24px gaps):

1) GREETING STRIP — "Good morning, Dr. Sharma" ExtraBold 28px, sub-line "Monday, 3 August · Tilak Nagar
   Clinic · 12 appointments today". On the right, a segmented control: [ Today | This week | This month ].

2) KPI ROW — exactly FIVE clickable stat cards in one row, equal width, each with a coloured top rail,
   tinted gradient wash, icon chip, a huge tabular number, a label, a delta pill, and a small "View all →"
   affordance in the bottom-right corner that makes the card obviously clickable (cards also show a subtle
   lift/hover shadow on the 2nd card to hint interactivity):
   • Upcoming Appointments — Violet #7C3AED — "08" — "Next at 11:30 AM" — calendar-clock icon.
   • Ongoing Appointments — Cyan #06B6D4 — "02" — a small live pulsing dot + "In consultation" — activity icon.
   • Total Patients — Indigo #4F46E5 — "1,284" — "+38 this month" — users icon.
   • Total Revenue — Emerald #059669 — "₹8,42,500" — "+12.4% vs last month" — indian-rupee icon.
   • Today's Revenue — Teal #0D9488 — "₹18,400" — "9 payments received" — wallet icon.

3) MAIN GRID — two columns, 62% / 38%:

   LEFT COLUMN:
   a) "Patient Mix" card with TWO charts side by side (NOT a revenue line chart):
      - Age-wise distribution: a vertical rounded-bar chart, 6 bars, sky-blue gradient bars, x-labels
        "0–6m, 6–12m, 1–2y, 2–5y, 5–8y, 8y+".
      - Vaccination status: a donut with rounded caps, centre reads "86%" / "up to date", legend chips
        "Up to date (mint) 1,104 · Due soon (amber) 118 · Overdue (red) 62".
   b) "Recent Patients & Current Status" card — a compact table, 6 rows:
      columns = Patient (avatar + name + "PID-2419" mono chip + age), Last Visit, Reason,
      Status-of-care chip ("In consultation" cyan / "Waiting" amber / "Prescribed" emerald /
      "Follow-up due" violet), and a right-side pair of tiny actions: a "Prescribe" gradient mini-button
      and a 3-dot menu. Header of the card has a small search input and a "Track patients →" text link.

   RIGHT COLUMN:
   a) "Today's Schedule" timeline card — vertical rail with time labels 09:00 → 17:00, coloured appointment
      blocks (violet = upcoming, cyan = ongoing with a pulse, emerald = completed, grey = done/cancelled),
      each block showing avatar + name + reason + mode icon (in-person/video/phone).
   b) "New vs Returning" mini card — a horizontal stacked bar (indigo/violet) with "62% returning".
   c) "Alerts" card — 3 rows with coloured left rails: red "2 vaccinations overdue", amber
      "5 pharmacy items low on stock", violet "3 follow-ups unconfirmed".

IMPORTANT: there must be NO "Add Patient" button and NO "New Invoice" button anywhere on this screen.
The primary actions are "Track patients" and "Prescribe".
```

---

## SCREEN 02 — Location switcher, open

```text
RENDER: The same Dashboard screen, dimmed slightly, with the LOCATION SWITCHER dropdown OPEN in the header
— this is the hero shot for multi-clinic support.

The dropdown panel (380px wide, white, 20px radius, heavy soft shadow, anchored under the header pill):
- Micro-label "SWITCH LOCATION".
- Row 1 — "◎ All Locations (Overall)" with a multi-hue gradient dot, sub-label
  "Combined data from 3 locations", a right-side chip "1,284 patients". Currently NOT selected.
- Row 2 — "Tilak Nagar Clinic" indigo dot, address sub-line "B-14, Tilak Nagar, New Delhi 110018",
  chips "712 patients · 12 today", a checkmark in an indigo circle = SELECTED, and the whole row has a
  soft indigo tinted background.
- Row 3 — "Janakpuri OPD" violet dot, "C-2/45, Janakpuri West, New Delhi 110058", "489 patients · 6 today".
- Row 4 — "Rajouri Garden Clinic" amber dot, "Shop 22, Rajouri Garden, New Delhi 110027",
  "83 patients · 0 today", plus a small grey "Closed today" chip.
- Divider, then a full-width ghost row: "＋ Manage locations" with a settings icon.

Add a small floating tooltip/callout near the switcher: "Switching changes every page — patients, revenue,
appointments and pharmacy — to this location."
```

---

## SCREEN 03 — Locations management page

```text
RENDER: The "Locations" admin page.

- Page header: title "Locations", sub-line "Clinics and OPDs where you practise", right side a gradient
  primary button "＋ Add location".
- A row of 3 LOCATION CARDS (each 1/3 width), each with a bold coloured top band in its own hue
  (indigo / violet / amber), and containing:
  • The location name + a type chip ("CLINIC" or "OPD"), a 3-dot menu.
  • Full address block with a map-pin icon, phone, and a tiny embedded static map thumbnail (abstract,
    stylised map shapes — no real map imagery, no logos).
  • OPD timing rows: "Mon–Sat · 10:00–14:00, 17:00–20:00", "Sun · Closed".
  • A 3-up mini stat strip: Patients / Appts today / Revenue this month, each with its coloured number.
  • Footer: assigned staff avatars (stacked circles, +3 overflow) and a "Set as active" ghost button.
- A 4th dashed-border "＋ Add another clinic or OPD" placeholder card with a large plus.
- Below: a wide "Compare locations" card — grouped rounded bar chart, 3 colour-coded series
  (indigo/violet/amber) across "Patients, Appointments, Revenue, New patients".
```

---

## SCREEN 04 — Team & Roles (sub-users)

```text
RENDER: The "Team & Roles" admin page — where the doctor creates sub-user accounts.

1) ROLE CARDS ROW — five cards, each a distinct hue, each showing an icon chip, role name, member count,
   and 3 example permissions as tiny ticked lines:
   • Reception — Sky #0EA5E9 — "3 members" — Book appointments · Register patients · View schedule
   • OPD Assistant — Violet #7C3AED — "2 members" — Record vitals · Queue management · View prescriptions
   • Accounts — Emerald #059669 — "1 member" — Billing · Payments · Revenue reports
   • HR — Rose #F43F5E — "1 member" — Staff records · Attendance · Payroll
   • Pharmacy — Amber #F59E0B — "2 members" — Stock · Purchases · Sales & invoices

2) MEMBERS TABLE — columns: Member (avatar + name + email), Role (coloured chip), Locations (small
   coloured location chips, e.g. "Tilak Nagar" + "Janakpuri", or a rainbow "All"), Last active,
   Status (green "Active" / amber "Invite pending"), and a 3-dot menu. 7 rows of realistic Indian names.
   Above the table: a search field, a "Role: All ▾" filter, a "Location: All ▾" filter, and a gradient
   primary button "＋ Create sub-user".

3) RIGHT SIDE (or below): a compact PERMISSION MATRIX card — rows = modules (Patients, Prescriptions,
   Appointments, Revenue, Pharmacy, Staff, Audit Logs), columns = the 5 roles, cells = a filled coloured
   check, a hollow "view only" eye, or a grey dash. Colour-coded by role column.
```

---

## SCREEN 05 — Create sub-user modal

```text
RENDER: The "Create sub-user" modal, centred over a blurred, dimmed Team & Roles page.

Modal, 640px, white, 20px radius, big soft shadow:
- Header: icon chip + "Create sub-user account", sub-line "They will receive login credentials by email",
  an × close.
- A horizontal 3-step progress indicator: ① Details ② Role & access ③ Review — step ② is active
  (gradient fill), ① is a completed emerald check.
- Form, 2-column:
  • Full name, Mobile number (+91 prefix chip), Email, Employee ID.
- ROLE PICKER — five selectable tiles in a row, each with its hue icon chip and label
  (Reception, OPD, Accounts, HR, Pharmacy). "Pharmacy" is SELECTED: amber tinted background, 2px amber
  border, a check badge.
- LOCATION ACCESS — a row of toggle chips: "All Locations" (off), "Tilak Nagar" (ON, indigo filled),
  "Janakpuri OPD" (ON, violet filled), "Rajouri Garden" (off).
- PERMISSIONS — a compact list of toggle switches with labels: "Manage stock" (on), "Record sales" (on),
  "Enter purchase bills" (on), "Record payments" (on), "Generate invoices" (on), "View patient clinical
  records" (OFF, with a small grey lock icon and helper text "Clinical data stays with the doctor").
- Footer: "Cancel" ghost + "Create account & send invite" gradient primary.
```

---

## SCREEN 06 — Patients roster

```text
RENDER: The "Patients" page — the roster. There is NO "Status: active/closed" column anywhere.

- Header: title "Patients" + count chip "712 at Tilak Nagar", right side a gradient button
  "＋ Register patient" and a ghost "Export".
- FILTER BAR card: a wide search input with placeholder "Search by name, mobile number or Patient ID…",
  then filter pills: "Date range: Last 30 days ▾" (with a small calendar icon), "Age: All ▾",
  "Visit type: All ▾", "Vaccination: All ▾", "Location: Tilak Nagar ▾", a "＋ More filters" ghost, and a
  "Saved: Follow-ups due" chip with a star. Below the bar, 2 active filter chips with × remove buttons.
- Quick segment tabs above the table: [ All 712 | Today 12 | Follow-up due 34 | New this month 38 |
  Vaccination overdue 9 ] each with a coloured count badge.
- TABLE, 8 rows, columns:
  Patient (avatar + bold name + mono "PID-2419" chip + "1y 4m · Male"),
  Parents ("Rohit & Neha Mehta" small grey),
  Mobile ("+91 98xxx xxx21"),
  Last Visit ("28 Jul 2026" + tiny "6 days ago"),
  Visit Date / Next Follow-up ("12 Aug 2026" with a violet dot; overdue ones in red with a warning icon),
  Visits ("4th visit" chip),
  Actions: a "Book consultation" small gradient button + a 3-DOT MENU.
- ONE row has its 3-dot menu OPEN, showing exactly these items with icons:
  "View patient", "Book consultation", "Generate prescription", divider,
  "Vaccination record ⤢" (mint icon), "Growth record ⤢" (sky icon), divider, "Share summary".
  There is NO Edit, NO Archive, NO "Open record" item.
- Footer: pagination + "Showing 1–8 of 712".
```

---

## SCREEN 07 — Vaccination quick-peek popup

```text
RENDER: The Patients roster (blurred, dimmed behind) with a VACCINATION POPUP open — the "parent called
to ask which vaccines their child has had" view.

Popup, 720px, white, 20px radius, mint #14B8A6 accent:
- Header: child avatar + "Aarav Mehta" + mono "PID-2419" + "1y 4m · Male", right side a mint chip
  "86% complete", plus small icon buttons: minimise to picture-in-picture (⤡), open full page (⤢), close (×).
- A slim mint progress bar with "18 of 21 doses given".
- Three summary chips: "Given 18" (mint), "Due soon 2" (amber), "Overdue 1" (red).
- The main body is a VERTICAL IAP SCHEDULE TIMELINE grouped by age milestone
  (Birth · 6 weeks · 10 weeks · 14 weeks · 6 months · 9 months · 12 months · 15 months):
  each milestone is a row with a coloured node on a vertical rail; inside, vaccine chips
  (BCG, OPV-0, Hep B-1, DTwP-1, Hib-1, Rotavirus-1, PCV-1, IPV-1, MMR-1, Typhoid…) —
  given ones are mint-filled with a check and a tiny date "14 Mar 2025", due-soon ones amber outlined,
  the overdue one red with a warning icon and "Due 18 Jul 2026 · 16 days overdue".
- Each pending vaccine chip has a small "Mark given" button.
- Footer: "Print record", "Share on WhatsApp", and a mint primary "Mark as administered".
```

---

## SCREEN 08 — Growth quick-peek popup

```text
RENDER: Same pattern as the vaccination popup, but the GROWTH RECORD popup, sky #0EA5E9 accent, open over
a dimmed Patients roster.

- Header: child identity, chip "On track · P52 weight-for-age", the same minimise-to-PiP / expand / close
  icon trio.
- Tab strip: [ Weight | Height | Head circumference | BMI ] — "Weight" active with a sky underline.
- MAIN CHART: a WHO percentile growth chart — five soft grey percentile band curves (P3, P15, P50, P85, P97)
  as translucent layered ribbons, and the child's plotted line in vivid sky blue with round dots and a
  gradient fill underneath. Axis: age in months (x), kg (y). The latest point has a callout bubble
  "9.4 kg · 4 Aug 2026 · P52".
- Right rail: three mini stat tiles — Weight 9.4 kg (+0.4 since last visit), Height 78 cm, Head circ. 46 cm,
  each with a tiny sparkline in its hue.
- Below: a horizontal strip of the last 6 measurement records as small cards (date + the 4 values).
- Footer: "Print chart", "Compare with siblings", sky primary "Add measurement".
```

---

## SCREEN 09 — Register patient (revamped form)

```text
RENDER: The "Register patient" form — a clean, spacious, single-purpose page (not a cramped modal).
This form is intentionally SHORT: only the fields listed.

Layout: a centred 880px form card on the app canvas, with a left mini-stepper.

- Top: an indigo icon chip + "Register a new patient", sub-line "A Patient ID is generated automatically
  and is used to track the child's entire history."
- SECTION 1 "Child details" (indigo section header with a small numbered badge ①):
  • "Child's name *" — a large, prominent input, marked required with a red asterisk and helper
    "As it should appear on prescriptions."
  • "Date of birth *" — a date input with a calendar icon; beside it a live-computed chip "Age: 1 y 4 m".
  • "Sex" — three selectable pills: Male / Female / Not specified.
- SECTION 2 "Parents (optional)" (violet header ②) with a small grey "Optional" chip:
  • "Mother's name" and "Father's name" side by side, plus a helper line
    "Add either or both — this is optional."
  • A small "Primary contact" radio pair: Mother / Father.
- SECTION 3 "Contact (required)" (teal header ③):
  • "Mobile number *" with a "+91" prefix chip.
  • "Address *" — a full-width 3-line textarea, plus "City", "PIN code".
- SECTION 4 "Location" (amber header ④): location selector chips — "Tilak Nagar" selected (indigo filled),
  "Janakpuri OPD", "Rajouri Garden".
- Footer bar (sticky, white, soft top shadow): "Cancel" ghost, "Save & register another" secondary,
  "Register patient" gradient primary.

Do NOT include: status, category, tags, insurance, blood group, referral source, or any other field.
Show a small inline note under the form: "That's all we need — everything else is captured during visits."
```

---

## SCREEN 10 — Patient registered (Patient ID confirmation)

```text
RENDER: A success confirmation modal over the dimmed registration page.

- A large emerald check inside a soft concentric glow.
- "Patient registered".
- A prominent PATIENT ID card: a gradient indigo→violet rounded card with a subtle card-texture, showing
  a large monospace "PID-2419" with a copy icon, the child name "Aarav Mehta", DOB, "Tilak Nagar Clinic",
  and a small QR code block in the corner (abstract QR pattern).
- Helper line: "Use this ID to pull up the child's full history, prescriptions, growth and vaccination
  record at any location."
- Three action buttons in a row: "Book consultation now" (gradient primary), "Open patient workspace"
  (secondary), "Print ID card" (ghost).
```

---

## SCREEN 11 — Patient Workspace (the core screen)

```text
RENDER: The Patient detail page, rebranded as the clinical WORKSPACE. This is the densest, most important
screen — treat it as the product's centrepiece. NO status (active/closed) field anywhere.

TOP: a wide PATIENT HEADER card with a soft indigo→violet gradient wash:
- Large avatar, "Aarav Mehta" 28px ExtraBold, mono chip "PID-2419", chips: "1 y 4 m", "Male",
  "Tilak Nagar", and a violet chip "4th visit · Follow-up".
- Second line: "Mother: Neha Mehta · Father: Rohit Mehta · +91 98xxx xxx21 · B-14, Tilak Nagar, New Delhi".
- A right-side DATE STRIP of three mini tiles, colour-coded:
  "Visit date — 4 Aug 2026" (indigo) · "Last visit — 28 Jul 2026 · 7 days ago" (slate) ·
  "Next follow-up — 12 Aug 2026 · in 8 days" (violet).
  There is NO "Date joined" tile.
- Actions on the right: gradient primary "Book consultation", secondary "Generate prescription",
  and a 3-dot menu OPEN showing only: "Vaccination record ⤢", "Growth record ⤢", "Share summary",
  "Print history". (No Edit, no Archive, no Open record.)

BODY: two columns, 66% / 34%.

LEFT — a tab strip [ Overview | Visits & History | Prescriptions | Growth | Vaccination | Reports | Messages ]
with "Overview" active, containing:
 a) "Visit history" VERTICAL TIMELINE — 5 entries, each a card on a coloured rail:
    date + visit-type chip ("First visit" indigo / "Follow-up" violet / "6-month review" teal /
    "Vaccination" mint / "Sick visit" amber), the diagnosis line, recorded vitals as 4 tiny chips
    (Wt 9.4kg · Ht 78cm · HC 46cm · Temp 98.6°F), the prescribing doctor, and a right-side
    "Preview prescription 👁" ghost button.
 b) "Recent prescriptions" — a horizontal row of 3 PRESCRIPTION PREVIEW THUMBNAILS: each is a small
    A4-proportioned paper card with a faint miniature of the prescription (header band, ℞ symbol, 3 medicine
    lines), overlaid on hover with an eye icon; below each, the date and diagnosis. Plus a "View all 7 →".
 c) "Clinical notes" — 2 collapsed accordion rows.

RIGHT rail — stacked cards:
 • "At a glance": allergies (red chip "Dust · Penicillin"), blood group, birth weight, delivery type.
 • "Growth" mini card: a small sky sparkline + "9.4 kg · P52" + "Open chart ⤢".
 • "Vaccination" mini card: mint ring at 86% + "1 overdue" red chip + "Open record ⤢".
 • "Upcoming": next appointment card with date/time and a "Reschedule" ghost.
 • "Billing": "₹4,200 collected · ₹0 due" with a tiny emerald bar.
```

---

## SCREEN 12 — Book consultation → live consultation view

```text
RENDER: A split composition showing the booking flow resolving into the live consultation.

LEFT 40%: the "Book consultation" panel sliding in from the right of the patient workspace —
- Patient chip at top (avatar + name + PID).
- Location selector chips (Tilak Nagar selected).
- A compact calendar month grid with density dots under dates, "4 Aug" selected in indigo.
- IST time-slot groups: "Morning" / "Afternoon" / "Evening" as sections of pill-shaped slots; taken slots
  are greyed with a strike, "11:30 AM" is selected (gradient filled).
- Visit type pills: Follow-up (selected, violet) / New complaint / Vaccination / Review.
- Mode pills: In-person (selected) / Video / Phone.
- Footer: "Book & start consultation now" gradient primary, plus a subtle "Book for later" ghost.

RIGHT 60%: the LIVE CONSULTATION view that opens immediately after —
- A cyan "LIVE · 04:12" pill with a pulsing dot, and the patient header condensed.
- Three stacked panels: "Complaint & history" (with the previous visit's diagnosis quoted in a tinted
  blockquote), "Vitals" (4 input tiles: Weight, Height, Head circumference, Temperature, each with unit
  chips and a tiny trend arrow vs last visit), and "Prescription" (a collapsed section with a gradient
  "Open prescription builder →" button).
- A right edge strip showing two small floating chips: "Growth ⤢" (sky) and "Vaccination ⤢" (mint) —
  hinting the picture-in-picture windows.
```

---

## SCREEN 13 — Prescription builder (with live PiP charts) — HERO SHOT

```text
RENDER: The full-screen PRESCRIPTION BUILDER with TWO FLOATING PICTURE-IN-PICTURE CHART WINDOWS docked
over it. This is the flagship image of the whole redesign — make it impressive.

BACKGROUND (the builder itself), two columns:

LEFT 58% — the form, as coloured sections:
 ① "Diagnosis" (indigo header): a large "Chief complaint / diagnosis" textarea with 3 suggestion chips
    below ("Acute viral fever", "URTI", "Gastroenteritis"), plus an "ICD tag" small input.
 ② "Vitals" (teal header): FOUR input tiles in a row, each with an icon chip, a large editable number,
    a unit chip and a delta vs last visit:
    Weight 9.4 kg (+0.4 ▲ emerald) · Height 78 cm (+1 ▲) · Head circumference 46 cm (+0.3 ▲) ·
    Temperature 101.2 °F (in RED with a warning icon, "febrile").
 ③ "Medicines" (violet header): a repeatable medicine row builder — 3 filled rows, each row a rounded
    sub-card with: medicine name (with a small pill icon and an autocomplete dropdown open on row 3
    showing "Paracetamol (Dolo) 250mg/5ml", "Paracetamol drops"), Dose, Frequency (chips 1-0-1 / OD / BD /
    TDS / SOS), Duration ("5 days"), Route, Notes, a drag handle and a delete ×. A dashed
    "＋ Add another medicine" row. A small amber "Dose check: safe for 9.4 kg" validation chip.
 ④ "Recommended tests" (amber header): a multi-select field with chips already added — "CBC",
    "Urine routine", "CRP" — and a dropdown open listing more ("Blood culture", "Chest X-ray",
    "Stool routine", "Widal"), each with a checkbox; plus a "Lab notes" input.
 ⑤ "Advice & follow-up" (emerald header): an advice textarea with quick chips ("Plenty of fluids",
    "Sponge if >102°F"), and a follow-up date picker showing "12 Aug 2026".

RIGHT 42% — a LIVE A4 PRESCRIPTION PREVIEW: a realistic white A4 sheet with a soft shadow, showing a
gradient clinic letterhead (clinic name, "Tilak Nagar Clinic", address, reg. no.), patient line with PID
and date, a vitals strip, the ℞ symbol, the medicine table, the recommended tests list, advice, follow-up
date, and a signature line. Above it: "Save draft", "Print", and a gradient "Generate prescription" button.

FLOATING PIP WINDOWS (the key feature) — two small, draggable, glassy windows floating above the
bottom-right of the page, each ~320×240, 16px radius, frosted white with heavy shadow and a coloured
title bar, each with drag-dots, a minimise (–), an expand (⤢) and a close (×):
 • PiP #1 "Growth — Aarav" (sky title bar): a miniature WHO percentile chart. The child's sky line has a
   BRIGHT NEW POINT at the end, glowing, with a small animated-looking ring and a callout "9.4 kg · P52
   (live)" — visually communicating that it updated in real time as the vitals were typed.
 • PiP #2 "Vaccination — Aarav" (mint title bar): a compact vaccine checklist, 5 rows, where one row is
   mid-transition — an amber "Due" chip morphing into a mint "Given ✓" chip with a soft ripple —
   communicating that marking a vaccine reflects instantly.
Add a subtle dotted motion trail and a tiny "drag to move · stays on top" tooltip near one PiP window.
```

---

## SCREEN 14 — Growth & Vaccination charts page (full page)

```text
RENDER: The dedicated "Growth & Vaccines" page for one patient.

- Header: patient identity strip + a segmented control [ Growth | Vaccination | Both ] with "Both" active,
  and a right-side "Pop out ⤢" button with the caption "Open as floating window".
- LEFT 60% "Growth": a large WHO percentile chart (soft grey P3–P97 ribbons, vivid sky patient line with
  gradient fill, dots at each visit), a tab strip above it (Weight / Height / Head circumference / BMI),
  and a legend. Below the chart, a horizontal scroll strip of measurement cards.
- RIGHT 40% "Vaccination": a mint-accented schedule with a big 86% progress ring at top, then age-grouped
  vaccine rows with mint/amber/red state chips and dates, and a "Mark given" affordance on pending rows.
- BOTTOM: a full-width "Visit correlation" band — a timeline where each visit tick shows both the weight
  point and any vaccines given that day, tying the two datasets together.
- In the lower-right corner, show the SAME two PiP windows in their minimised state — collapsed to two
  small coloured title-bar pills reading "Growth ⤢" and "Vaccination ⤢" — to show the toggle/minimise
  behaviour.
```

---

## SCREEN 15 — Upcoming Appointments page (from the KPI card)

```text
RENDER: The "Appointments" page reached by clicking the "Upcoming Appointments" KPI card.

- Header: title "Appointments", a violet count chip "8 upcoming", view toggle [ List | Day | Week | Month ],
  and a gradient "＋ New appointment".
- ADVANCED FILTER BAR: a search input ("Search patient, PID or mobile…"), a DATE RANGE control shown OPEN
  as a dual-month calendar popover with a selected range highlighted in violet and quick presets down the
  left side (Today, Tomorrow, Next 7 days, This month, Custom). Plus filter pills: Status, Visit type, Mode,
  Location, Doctor.
- STATUS SEGMENT TABS with coloured counts: [ Upcoming 8 | Ongoing 2 | Completed 46 | Cancelled 3 | No-show 1 ].
- TABLE, 9 rows: Time (large tabular "11:30 AM" + "30 min"), Patient (avatar + name + PID + age),
  Reason, Mode (icon chip: in-person / video / phone), Location (coloured chip), Status chip,
  Actions ("Start consultation" gradient mini-button on the next one; a 3-dot elsewhere).
  The "ongoing" row is highlighted with a cyan tinted background and a pulsing live dot.
- A right rail "Day at a glance" card: a vertical hour rail 09:00–18:00 with coloured blocks and gaps
  labelled "Free 45 min".
```

---

## SCREEN 16 — Total Patients drill-down

```text
RENDER: The page reached by clicking the "Total Patients" KPI card.

- Header: "Patients" + toggle chips [ Today 12 | This week | This month | All time 1,284 ], "Today" active.
- A 4-card mini KPI strip: Today's patients 12 (indigo) · New registrations 3 (violet) ·
  Follow-ups 6 (teal) · Vaccination visits 3 (mint).
- ADVANCED FILTERS: a prominent search bar, a date-range picker (shown as a closed pill "1 Aug – 4 Aug 2026"),
  and filter pills for Age band, Sex, Visit type, Vaccination status, Location, Registered by.
- TABLE of today's patients: Time in, Patient (avatar + name + PID), Age, Parent + mobile,
  Visit type chip, Attending doctor, Queue status chip (Waiting amber / In consultation cyan /
  Done emerald), Actions ("Open workspace" ghost + 3-dot).
- RIGHT rail: two small charts — "Today by hour" (rounded bars, indigo) and "Today by visit type"
  (donut, four hues).
```

---

## SCREEN 17 — Revenue detail

```text
RENDER: The "Revenue" page reached by clicking the Total Revenue / Today's Revenue KPI cards.

- Header: "Revenue" + a location chip, and a period segmented control [ Today | 7d | 30d | Quarter | Custom ].
- KPI ROW of 4 emerald/teal-family cards: Total collected ₹8,42,500 · Today ₹18,400 · Outstanding ₹46,200
  (amber) · Refunds ₹3,100 (rose). Each with a sparkline.
- MAIN CHARTS: left — a "Revenue by service" horizontal rounded bar chart with distinct hues per service
  (Consultation, Vaccination, Procedures, Pharmacy, Lab). Right — a "Payment mode" donut
  (UPI / Cash / Card / Insurance) with a centre total.
- TRANSACTIONS TABLE (the "detailed information" requirement): columns = Date & time, Receipt no. (mono),
  Patient (avatar + name + PID), Service (coloured chip), Doctor, Amount (right-aligned, bold),
  Payment mode chip, Status chip (Paid emerald / Partial amber "₹2,000 of ₹10,000" with a mini progress bar /
  Due red), and a 3-dot with "Download receipt".
  Above the table: search, a date-range picker, and filters for Service, Payment mode, Status, Location.
- A right-side slide-over preview (partially visible at the edge) showing a PAYMENT RECEIPT: clinic
  letterhead, receipt number, patient, itemised lines, total in bold, "PAID" emerald stamp, and a
  "Download PDF" button.
```

---

## SCREEN 18 — Pharmacy: inventory dashboard

```text
RENDER: The "Pharmacy" page — inventory control, amber #F59E0B as the primary accent.

- Header: "Pharmacy" + a location chip, right side buttons: "＋ New purchase" (secondary),
  "＋ New sale / bill" (gradient primary).
- KPI ROW of 5: Stock value ₹2,41,800 (amber) · SKUs 168 (indigo) · Low stock 12 (amber warning) ·
  Out of stock 4 (red, with a pulsing dot) · Expiring in 60 days 7 (rose).
- ALERT STRIP: a red-tinted band "4 items are out of stock — Amoxicillin 250mg, ORS sachets, …" with a
  "Reorder now" button.
- STOCK TABLE: Item (pill icon + name + strength + form), Batch, Distributor, Expiry (colour-coded:
  green / amber "in 43 days" / red), Purchase rate, MRP, QTY IN STOCK shown as a number PLUS a thin
  horizontal stock-level bar (green healthy / amber low / red empty) against a reorder threshold marker,
  Status chip (In stock / Low / Out of stock), Actions (＋ Add stock, − Dispense, 3-dot).
  Include at least one red "Out of stock — 0 units" row and two amber low rows.
- RIGHT rail: "Fast movers" (top 5 horizontal bars), and "Stock by category" donut
  (Antibiotics / Analgesics / Vitamins / Vaccines / Consumables).
```

---

## SCREEN 19 — Pharmacy: purchase entry + partial payments ledger

```text
RENDER: A two-panel screen: recording stock purchased from a distributor, and tracking partial payment.

LEFT — "New purchase entry" form card (amber accent):
- Distributor selector showing "Rahul Distributors" with a small avatar and "Ledger balance ₹8,000 due"
  in amber.
- Invoice no., invoice date, a file-drop zone "Attach purchase bill (PDF/photo)".
- An ITEM TABLE being filled: rows for "Paracetamol 250mg syrup — qty 20 — rate ₹42 — MRP ₹65 —
  batch PB2417 — expiry 09/2027 — GST 12% — total ₹840" and "Dolo 650 tablet — qty 100 …", plus a
  dashed "＋ Add item" row.
- A totals block on the right: Subtotal, GST, Discount, GRAND TOTAL ₹10,000 in large bold amber.
- A PAYMENT section: mode chips (Cash / UPI / Cheque / Credit), "Amount paid now" input showing
  "₹2,000", and a live-computed amber balance chip "Balance due ₹8,000" plus a "Due date" picker.
- Footer: "Save & add stock" gradient primary.

RIGHT — "Distributor ledger — Rahul Distributors" card:
- Three mini stats: Total purchased ₹1,24,000 · Paid ₹1,16,000 · Outstanding ₹8,000 (amber).
- A payment-progress bar: 20% amber fill for the current bill, labelled "₹2,000 of ₹10,000 paid".
- A ledger table: Date, Type chip (Purchase / Payment), Reference, Debit, Credit, Balance (running,
  right-aligned mono), Status chip (Paid / Partial / Due).
- A "Record payment" gradient button and a "Download statement PDF" ghost.
```

---

## SCREEN 20 — Pharmacy: billing, invoice & receipt

```text
RENDER: The pharmacy point-of-sale / billing screen with a generated invoice preview.

LEFT 55% — "New bill":
- A patient/customer selector at top: "Aarav Mehta · PID-2419" (with a "Walk-in customer" toggle).
- A large item search "Scan or search medicine…" with a dropdown open showing matching items and their
  live stock counts as coloured chips ("42 in stock" green, "3 left" amber).
- A cart table: item, batch, qty stepper, MRP, discount %, amount. 4 rows.
- A right-aligned totals stack: Subtotal ₹1,240 · GST ₹148 · Discount −₹100 · PAYABLE ₹1,288 (huge, bold).
- Payment: mode chips (UPI selected, showing a small QR block), "Amount received" input, "Change" line,
  and a "Split / partial payment" toggle that reveals "Paid ₹800 · Balance ₹488" in amber.
- Big gradient button "Generate invoice & print".

RIGHT 45% — the generated A4 INVOICE PDF preview: white sheet, soft shadow, gradient letterhead with
clinic + pharmacy licence no., "TAX INVOICE" title, invoice no. + date, bill-to block, an itemised table
with HSN/GST columns, totals, amount-in-words line, a "PARTIALLY PAID" amber stamp, terms footer and a
signature area. Above the sheet: a toolbar with "Download PDF", "Print", "WhatsApp", "Email".
Below, a smaller PAYMENT RECEIPT card peeking (receipt no., ₹800 received, emerald "RECEIPT" stamp).
```

---

## SCREEN 21 — Staff management & attendance

```text
RENDER: The "Staff" page, rose #F43F5E accent.

- Header: "Staff" + count "14 members", right side "＋ Add staff" gradient button and a month picker
  "August 2026".
- KPI ROW: Total staff 14 (rose) · Present today 11 (emerald) · On leave 2 (amber) · Absent 1 (red) ·
  Monthly payroll ₹4,86,000 (indigo).
- ATTENDANCE GRID — the centrepiece: rows = staff members (avatar + name + role chip), columns = days
  1…31 of the month, each cell a small rounded square colour-coded: emerald = present, amber = half-day,
  red = absent, violet = paid leave, grey = weekly off. A legend below. The current day column is
  outlined. Include a right-side summary column "P 24 · HD 2 · A 1 · L 2".
- Below/right: a STAFF TABLE — Member (avatar + name + employee ID), Role chip (Reception / OPD / Accounts /
  HR / Pharmacy — matching the sub-user hues), Location chip, Joining date, Monthly salary (₹ right-aligned),
  Attendance % (a thin bar), Actions (Mark attendance, 3-dot).
- A small "Today's check-ins" card with time-stamped rows (09:02 AM ✓).
```

---

## SCREEN 22 — Payroll (month-end salary)

```text
RENDER: The "Payroll" screen for August 2026, rose/indigo accents.

- Header: "Payroll · August 2026" with a month stepper, a status chip "Auto-calculated on 31 Aug",
  and a gradient "Process payroll" button.
- SUMMARY ROW: Gross ₹5,02,000 · Deductions ₹16,000 · NET PAYABLE ₹4,86,000 (large, indigo) ·
  Paid ₹0 of 14 (amber progress ring).
- SALARY TABLE — Member (avatar + name + role chip), Base salary, Days present (e.g. "24 / 26"),
  a small attendance bar, Deductions (amber, with a tooltip icon "1 absent, 2 half-days"),
  Bonus/incentive (emerald editable chip), NET PAY (bold, right-aligned tabular),
  Status chip (Pending amber / Paid emerald), Actions ("Pay" mini gradient button + "Slip" ghost).
  Show a calculation formula hint under the header: "Net = Base ÷ working days × days present
  − deductions + bonus".
- RIGHT rail: "Payroll by role" donut (five role hues), and a "Payslip preview" mini A4 card with a
  "Download all payslips (PDF)" button.
```

---

## SCREEN 23 — Audit Logs

```text
RENDER: The "Audit Logs" page, slate #64748B base with vivid per-action accents.

- Header: "Audit logs", sub-line "Every action across your practice", right side "Export CSV" ghost.
- FILTER BAR: search ("Search user, patient, action or record ID…"), a date-range picker,
  and filter pills: User, Role, Action type, Module, Location, IP.
- ACTION-TYPE chips row with counts, each in its own hue: Created (emerald 128) · Viewed (slate 1,942) ·
  Updated (indigo 341) · Deleted (red 12) · Logged in (cyan 88) · Exported (violet 17) ·
  Permission changed (amber 5).
- The log itself as a VERTICAL TIMELINE grouped by day ("Today · 4 August 2026"), each entry a row with:
  a coloured circular action icon on a rail, a bold sentence
  ("Priya (Reception) booked an appointment for Aarav Mehta · PID-2419"),
  a monospace record id, a location chip, the timestamp "11:42 AM IST", the IP/device in tiny grey,
  and a "View details" chevron. Include one RED destructive entry with a red rail
  ("Dr. Sharma deleted prescription RX-1187") and one AMBER security entry
  ("Owner changed permissions for Vikram (Pharmacy)").
- One entry is EXPANDED, showing a before/after diff card: two columns, red-tinted "Before" and
  green-tinted "After", with changed fields highlighted.
- A right rail: "Most active users" (avatars + bars) and "Actions over time" (small area chart).
```

---

## SCREEN 24 — Email Logs

```text
RENDER: The "Email Logs" page, cyan #06B6D4 accent.

- Header: "Email logs", right side "Resend failed" secondary and a "Delivery settings" ghost.
- KPI ROW of 5: Sent 1,246 (cyan) · Delivered 1,203 (emerald) · Opened 812 (indigo, "65%") ·
  Bounced 28 (amber) · Failed 15 (red). Each with a sparkline and a delta.
- A "Delivery over time" wide area chart with two stacked gradient series (delivered emerald /
  failed red) over 30 days.
- FILTER BAR: search ("Search recipient, subject or message ID…"), date range, and pills for
  Status, Template type, Location, Triggered by.
- TABLE: Sent at (date + time IST), Recipient (avatar + name + email + a small role/parent chip),
  Subject, Template chip (colour-coded: "Appointment reminder" violet / "Vaccination due" mint /
  "Invoice" amber / "Credentials invite" indigo / "Prescription" teal / "Payroll slip" rose),
  Status chip (Delivered emerald ✓✓ / Opened indigo with an eye / Bounced amber / Failed red with a
  warning), Opens count, Actions (Preview, Resend, 3-dot).
  Include 2 failed rows with a red-tinted background and an inline error reason
  ("Mailbox does not exist").
- A right-side slide-over (partially visible) previewing the actual EMAIL: a phone-width rendered
  email with the Mateo gradient header, greeting, an appointment card, and a CTA button.
```

---

## SCREEN 25 — Mobile / tablet responsive set

```text
RENDER: Three mobile screens side by side on a clean light background, 9:16 each, no phone bezels — just
rounded-rectangle screen canvases with soft shadows. Same design system, condensed:

1) MOBILE DASHBOARD: sticky header with the location switcher pill front and centre, a horizontally
   scrollable row of the 5 colour-coded KPI cards (peeking 6th), the vaccination donut, and a
   "Recent patients" list. A bottom tab bar: Home / Patients / Appointments / Pharmacy / More, with a
   centre floating gradient action button.
2) MOBILE PATIENT WORKSPACE: gradient patient header, the three date tiles stacked as a compact strip,
   a horizontally scrollable tab strip, the visit timeline, and a sticky bottom bar with
   "Book consultation" + "Prescribe".
3) MOBILE PRESCRIPTION BUILDER: the vitals as a 2×2 tile grid, a medicine row card, and the growth PiP
   window docked as a small draggable card in the lower right with its live sky chart.
```

---

# PHARMACY DEEP-DIVE (SCREENS 26–31)

> Generate these straight after 18–20. Screens 18–20 show the *surface* of the pharmacy (stock list,
> purchase, billing). These six show the **inventory-control mechanics**: how a number changes, who
> changed it, who is owed money, and what the pharmacy staff member sees.

---

## SCREEN 26 — Medicine stock card (single item)

```text
RENDER: The detail page for ONE medicine — the "stock card". Amber #F59E0B accent. This is where a doctor
or pharmacist answers "how much of this do I actually have, in which batches, and what's it worth?"

TOP — item header card with an amber gradient wash:
- A large pill/bottle icon chip, "Paracetamol 250mg/5ml Syrup" 26px ExtraBold, and chips underneath:
  "Syrup · 60ml", "Antipyretic", "HSN 3004", "GST 12%", "Rx" (red chip), "Manufacturer: Micro Labs".
- Right side: a big stock readout — "142" in 40px tabular bold with the unit "bottles" beneath, a
  horizontal stock-level bar with a REORDER MARKER pin at 40 and a "Healthy" emerald chip.
- Action buttons: "＋ Add stock" secondary, "− Dispense" secondary, "Adjust" ghost, 3-dot.

METRIC ROW — 5 small tiles: Stock value ₹5,964 (amber) · Purchase rate ₹42 · MRP ₹65 ·
Margin 35% (emerald) · Avg. monthly consumption 96 (indigo, with a tiny sparkline).

BATCHES TABLE (the core of inventory control) — columns: Batch no. (mono "PB2417"), Expiry
(colour-coded: "09/2027" green, "11/2026" amber "in 43 days", "07/2026" red "EXPIRED"),
Received on, Distributor, Qty received, Qty remaining (bold), Purchase rate, Value.
4 rows. The expired row has a red-tinted background and a "Write off" mini button. Above the table a
small note chip: "Dispensed oldest-expiry-first (FEFO)".

BOTTOM — two cards side by side:
 a) "Stock movement" — a stepped area chart in amber showing quantity on hand over 90 days, with green
    up-steps labelled "Purchase +100" and red down-steps labelled "Sale −2", and a dashed reorder-level
    line across the chart.
 b) "Purchase history" — a small table: date, distributor, qty, rate (with a tiny ▲/▼ vs previous rate),
    invoice no.
```

---

## SCREEN 27 — Stock movement ledger (the auto-decrement trail)

```text
RENDER: The "Stock movements" page — the live proof that every dispense reduces stock automatically.
This is a feed, not a form. Amber base with per-movement-type hues.

- Header: "Stock movements", sub-line "Every unit in and out, automatically recorded", right side
  "Export CSV" ghost and a location chip.
- MOVEMENT-TYPE chips with counts, each its own hue: Purchase in (emerald 128) · Sale out (indigo 1,204) ·
  Dispensed to patient (violet 386) · Return to distributor (amber 12) · Damage/expiry write-off (red 9) ·
  Manual adjustment (slate 4) · Opening stock (cyan 168).
- FILTER BAR: search ("Search medicine, batch or reference…"), date range, and pills for
  Movement type, Medicine, Batch, Distributor, Recorded by, Location.
- THE LEDGER — a table grouped by day ("Today · 4 August 2026"), each row:
  • A coloured circular direction icon (↓ emerald in, ↑ red out).
  • Medicine name + strength + a mono batch chip.
  • A movement sentence: "Dispensed 1 bottle to Aarav Mehta · PID-2419 · Bill PH-1042"
    or "Received 20 bottles from Rahul Distributors · Invoice RD-8871".
  • A QTY DELTA pill — "−1" in red or "+20" in emerald, large and tabular.
  • BEFORE → AFTER columns showing the running stock: "143 → 142", with the arrow tinted.
  • Recorded by: avatar + "Vikram (Pharmacy)" with an amber role chip, or "System" with a bolt icon
    for auto-decrements triggered by a sale.
  • Timestamp "11:42 AM IST".
- Highlight ONE row with a soft cyan glow and a small "just now" pulse, to communicate real-time updates.
- RIGHT rail: "Today's movement" mini card — two counters, "In 40 units" (emerald) / "Out 23 units" (red),
  and a tiny stacked bar.
```

---

## SCREEN 28 — Distributors, payables & receivables

```text
RENDER: The "Distributors & payments" page — money owed BOTH ways. Amber for payables (money the clinic
owes distributors), emerald/rose for receivables (money owed TO the clinic).

- Header: "Distributors & payments", a segmented control [ Payables | Receivables | All ] with
  "Payables" active, right side "＋ Record payment" gradient button.
- KPI ROW: Total payable ₹1,84,000 (amber) · Overdue payable ₹42,000 (red) · Paid this month ₹96,000
  (emerald) · Receivable from patients ₹46,200 (rose) · Distributors 14 (indigo).
- AGEING BAND — a wide horizontal stacked bar split into four segments with labels underneath:
  "Current ₹98,000" (emerald) · "0–30 days ₹44,000" (amber) · "31–60 days ₹28,000" (orange) ·
  "60+ days ₹14,000" (red). Each segment labelled with its amount.
- DISTRIBUTORS TABLE: Distributor (initials avatar + "Rahul Distributors" + phone + GSTIN mono),
  Total purchased ₹1,24,000, Paid ₹1,16,000, OUTSTANDING ₹8,000 (bold amber, right-aligned),
  a thin payment-progress bar per row ("93% settled"), Oldest due ("18 days" with an amber clock),
  Last payment date, Actions ("Record payment" mini gradient button + "Statement" ghost + 3-dot).
  8 rows; one row is red-tinted with "60+ days overdue".
- ONE ROW EXPANDED into an inline sub-panel showing that distributor's bill-by-bill breakdown:
  Invoice no., date, amount, paid, balance, a status chip (Paid emerald / Partial amber
  "₹2,000 of ₹10,000" with a mini bar / Overdue red), and a "Pay ₹8,000" button.
- RIGHT rail: "Payment schedule" — a small calendar strip with amber dots on due dates, and
  "Upcoming: ₹8,000 to Rahul Distributors, due 12 Aug".
```

---

## SCREEN 29 — Stock adjustment, expiry & stock take

```text
RENDER: The "Adjustments" page — how stock changes without a sale or purchase. Red/rose accents for loss,
slate for corrections.

Three zones:

1) EXPIRY BOARD (top) — a horizontal row of four columns like a mini kanban, each headed with a count and
   hue: "Expired 4" (red) · "Expiring ≤30 days 6" (orange) · "Expiring ≤90 days 11" (amber) ·
   "Safe 147" (emerald). The first three columns contain small item cards: medicine name, batch,
   expiry date, qty, value at risk (₹), and two mini buttons "Return to distributor" / "Write off".
   A total banner: "₹14,200 of stock at risk in the next 90 days".

2) NEW ADJUSTMENT form card (middle-left) — an item picker showing current stock, a REASON selector as
   tiles each with an icon and hue: Damaged (rose) · Expired (red) · Return to distributor (amber) ·
   Lost/theft (slate) · Count correction (indigo) · Free sample in (emerald). "Damaged" is selected.
   Then: batch selector, quantity stepper, a computed "Stock after adjustment: 142 → 138" line with the
   before/after tinted, a notes field, a photo-attach zone, and a red "Record adjustment" button with a
   small warning line "This is permanently logged in the audit trail."

3) STOCK TAKE card (middle-right) — "Physical stock count · started 2 Aug by Vikram", a progress ring
   "112 of 168 items counted", and a variance table: Item, System qty, Counted qty, Variance
   ("−2" red / "0" grey / "+1" emerald), Value impact. A footer "Reconcile & post variances" button.

4) ADJUSTMENT HISTORY (bottom) — a compact table: date, item, batch, reason chip, qty delta pill,
   value, recorded by (avatar + role chip), approved-by chip.
```

---

## SCREEN 30 — Reorder & purchase orders

```text
RENDER: The "Reorder" screen reached from the "Reorder now" alert on the pharmacy dashboard. Amber accent.

- Header: "Reorder", sub-line "16 items at or below their reorder level", right side "＋ Blank purchase
  order" ghost and a gradient "Generate purchase orders".
- SUGGESTION TABLE — Item (icon + name + strength), Current stock (red "0" / amber "3"), Reorder level,
  Avg. monthly use, Days of cover left (a red "0 days" / amber "9 days" chip),
  SUGGESTED QTY (an editable stepper pre-filled, e.g. "60"), Preferred distributor (a small chip with
  avatar), Last rate ₹42, Estimated cost. Checkboxes on the left with a "select all" in the header;
  12 of 16 rows are checked. Out-of-stock rows have a red left rail.
- A GROUPED PREVIEW panel on the right: "3 purchase orders will be created", as three stacked mini cards
  grouped by distributor — "Rahul Distributors · 7 items · ₹18,400", "MedPlus Agencies · 3 items · ₹6,200",
  "Sun Pharma Depot · 2 items · ₹4,800" — each with an expand chevron and small send-channel icons
  (WhatsApp, Email, Download PDF).
- Bottom of the right panel: a PURCHASE ORDER PDF preview — a clean A4 sheet with the clinic letterhead,
  "PURCHASE ORDER" title, PO number, distributor block, an itemised table and a delivery-by date.
```

---

## SCREEN 31 — Pharmacy sub-user workspace (restricted view)

```text
RENDER: The app as seen by a PHARMACY SUB-USER (Vikram), not the doctor — proving that role scoping is
real. Same design system, visibly narrower.

Differences to make obvious:
- The SIDEBAR is short and amber-tinted at the active item: only Dashboard, Stock, Purchases, Sales,
  Payments, Adjustments. Below them, three GREYED-OUT locked items with small padlock icons —
  "Patients 🔒", "Prescriptions 🔒", "Revenue 🔒" — visually dimmed to 35%.
- The sidebar footer avatar reads "Vikram Yadav" with an amber "PHARMACY" role chip and a location chip
  "Tilak Nagar".
- The HEADER location switcher is present but shows only "Tilak Nagar Clinic" with a small padlock and a
  tooltip "You have access to 1 location".
- A slim amber banner across the top of the content: "Pharmacy access · clinical patient records are not
  visible to this role."

CONTENT — a pharmacy-only dashboard:
- 4 KPI cards: Today's sales ₹4,280 · Bills today 14 · Low stock 12 · Out of stock 4 (red, pulsing).
- Two big primary action tiles side by side, gradient amber: "＋ New sale / bill" and
  "＋ Enter purchase bill".
- "Recent bills" table: bill no., time, customer (shown as "Aarav M. · PID-2419" — name partially masked,
  with NO diagnosis, NO prescription column), items count, amount, payment chip.
- "Needs attention" list: out-of-stock items, a "₹8,000 due to Rahul Distributors" amber row, and
  "3 batches expiring this month".
```

---

## BLOCK Z — CONSISTENCY & ITERATION TRICKS

```text
• Style lock (use from image #2 onward):
  "Use the attached image as the exact style reference: identical sidebar, header, card radius, shadows,
   typography, spacing scale and the same colour-per-module system. Change only the content of the main
   area. Now render: <SCREEN BLOCK>."

• If a screen comes out too plain:
  "Increase visual richness: add the coloured top rails, tinted gradient washes inside cards, saturated
   icon chips, and coloured status pills. Keep it clean — colour comes from data, not decoration."

• If text is unreadable:
  "Reduce the number of table rows to 6 and increase all font sizes by 30%. Fewer elements, larger type."

• If it drifts corporate-grey:
  "Too grey and enterprise. Restore the vivid module hues (indigo, violet, emerald, teal, amber, rose,
   sky, mint, cyan) and the indigo→navy gradient sidebar."

• For dark mode variants:
  "Same screen in dark mode: canvas #0B1220, cards #131C33 with #1F2A44 borders, keep every accent hue
   at full saturation with a soft outer glow."

• Recommended generation order (each builds on the last):
  01 → 02 → 06 → 09 → 11 → 13 → 07/08 → 15/16/17 → 03/04/05 →
  18/19/20 → 26/27/28/29/30/31 (pharmacy deep-dive) → 21/22 → 23/24 → 25
```

---

## APPENDIX — What changes vs today's panel (for your own reference, not for ChatGPT)

| Area | Today | v2 |
|---|---|---|
| Header | Title + search + avatar | **+ Location switcher (Tilak Nagar / Janakpuri / Overall)** |
| Dashboard hero | "Add Patient" + "New Invoice" buttons | **Removed** → "Track patients" + "Prescribe" |
| Dashboard KPIs | 4 KPIs + revenue trend line | **5 clickable KPIs** + patient age-mix & vaccination-status charts |
| Sidebar (8 items) | Home, Patients, Messages, Consultations, Analytics, Reports, Billing, Profile | **+ Pharmacy, Staff, Locations, Team & Roles, Audit Logs, Email Logs, Growth & Vaccines** |
| Patients roster | Status column, archive toggle, Edit/Archive/Open-record menu | **No status, no archive**; visit/last-visit/next-follow-up dates; menu = View · Book · Prescribe · Vaccination ⤢ · Growth ⤢ |
| Patient record | 6 tabs, "date joined" | Workspace: visit-date / last-visit / next-follow-up, repeat-visit timeline, prescription previews, Book consultation |
| Add patient | Name, DOB, sex, phone, status, template | Child name (required), DOB, **parents optional**, address, phone → **auto Patient ID** |
| Prescription | diagnosis + medicine/dosage/frequency/duration + advice | **+ vitals (wt/ht/HC/temp), multi-medicine builder, recommended tests, A4 preview** |
| Charts | Full-page only | **Picture-in-picture floating windows, live-updating while prescribing** |
| New modules | — | Sub-users & roles, Pharmacy/inventory, Staff & payroll, Audit logs, Email logs |

### Stock management — where each requirement lands

| Your requirement | Screen |
|---|---|
| Manage stock, see current quantities | 18 (roster + level bars), 26 (per-item stock card) |
| Highlight out-of-stock items | 18 (red alert strip + red rows), 30 (red rails), 31 (pulsing KPI) |
| Receive qty of Paracetamol/Dolo from distributor Rahul | 19 (purchase entry), 26 (batch table + purchase history) |
| Dispense a unit → stock decreases automatically | **27** (before → after running balance, "System" actor) |
| Billing + invoice PDF + payment receipt | 20 |
| Partial payment (₹10,000 → ₹2,000 paid → ₹8,000 due) | 19 (ledger), **28** (bill-by-bill + ageing) |
| Pharmacy staff sub-user access | 04/05 (create + permissions), **31** (what they actually see) |
| Batches, expiry, damage, write-offs, stock take | **29** |
| Reordering low stock | **30** |

**One ambiguity, resolved by covering both:** your example said stock was purchased *from* Rahul but
that *Rahul pays* ₹2,000. Those are opposite directions. Screen 19 treats Rahul as a **distributor the
clinic owes** (payable), which is the normal pharmacy case — and screen 28 adds a Payables/Receivables
toggle so credit owed *to* the clinic is handled too. If Rahul is meant to be a customer, say so and the
default flips; nothing else in the design changes.
