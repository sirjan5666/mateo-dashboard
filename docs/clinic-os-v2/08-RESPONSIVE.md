# SPEC 25 — Mobile & tablet
Prepend **00-FOUNDATION.md**

Desktop specs 01–24 and 26–31 each carry a short responsive note. This document is the mobile
**system** — build these three reference screens, and the patterns below apply everywhere else.

---

## 1. THE MOBILE SHELL

### 1.1 Top bar — 60px, sticky, white
`Menu` 22px (opens the sidebar as an off-canvas drawer) · the 32px logo mark · **the location switcher,
front and centre** as a compact pill showing only the hue dot + a truncated name + chevron (max-width
150px) · `ml-auto` `Search` icon button · avatar 30px.
The location switcher keeps prime position on mobile because it changes the meaning of every number below
it — never demote it into the drawer.

### 1.2 Sidebar drawer
280px, slides from the left over a `rgba(10,27,77,.45)` scrim, same gradient and nav groups as desktop,
plus the doctor card pinned at the bottom. Closes on scrim tap, `Esc`, or a swipe left.

### 1.3 Bottom tab bar — 64px, fixed, white, `border-t #ECEEF4`
Five destinations: **Home** (`LayoutGrid`) · **Patients** (`Users`) · **[FAB]** · **Pharmacy** (`Pill`) ·
**More** (`MoreHorizontal`).
The centre **FAB** is a 56px circle raised 18px above the bar, `linear-gradient(135deg,#4F63F5,#8B5CF6)`,
white `Plus` 24px, `shadow-[0_10px_24px_-8px_rgba(79,99,245,.8)]`. Tapping it opens a bottom-sheet action
menu: `New prescription` · `Book consultation` · `Register patient` · `New sale / bill`.
Active tab: hue icon + a 3px hue underline at the top edge of the tab. Labels 10/600.
`padding-bottom: env(safe-area-inset-bottom)`.

### 1.4 Universal mobile rules
- **Tables become stacked cards.** Row → a `rounded-[12px]` card: line 1 primary (13/600) + right-aligned
  value; line 2 secondary (11/500/`#64748B`); a chip row; a 3-dot at the top-right. Never horizontally
  scroll a data table on mobile — the attendance grid (spec 21) is the single exception and gets an
  explicit scroll affordance.
- **Filter bars collapse** into one full-width **"Filters (2)"** button that opens a bottom sheet; the
  search input stays visible above it.
- **Donut legends** move beneath the chart as a 2-column grid.
- **Modals become bottom sheets** — full width, `rounded-t-[20px]`, a 36×4 `#D9DFEC` grab handle,
  max-height 92vh, swipe-down to dismiss.
- **Slide-overs become full-screen** pages with a back chevron in place of the `X`.
- Minimum tap target **44×44**. Body text never below 13px.
- Sticky page actions collapse into a bottom action bar above the tab bar.

---

## 2. REFERENCE SCREEN A — Mobile dashboard
Spec 01 at 375px

1. **Greeting block** — "Good morning, Dr. Ananya" (20/700), subtitle 12/400, then a full-width date pill.
2. **KPI carousel** — the five cards from spec 01 in a horizontal snap-scroll row
   (`scroll-snap-type: x mandatory`), each **248px wide**, with the 6th edge peeking to signal more.
   Below the row: 5 dot indicators. Each card keeps its 3px accent, icon tile, metric, delta and footer
   link; the card remains the tap target.
3. **Patient Demographics** — the donut at `outerRadius 68`, legend beneath as a 2-column grid.
4. **New vs Returning** — the area chart at 160px height, X ticks reduced to `1 · 15 · 31 May`.
   Returning stays the upper series.
5. **Today's Schedule** — 5 stacked rows, each a `rounded-[10px]` card: time (13/700) + name + status chip
   on line 1, age + visit type on line 2.
6. **Alerts & Reminders** — unchanged, full width.
7. **Recent Patients** — stacked cards with the status chip inline.
8. Bottom padding 88px so the tab bar never covers content.

---

## 3. REFERENCE SCREEN B — Mobile patient workspace
Spec 11 at 375px

1. **Patient header** — the gradient card, full width: 52px avatar, name 20/800, PID chip, then the
   age/sex/location chips wrapping to a second line. The parents/phone/address line becomes a
   two-line 11/500 block.
2. **Date strip** — the three tiles become a horizontal snap-scroll row of 132px cards
   (Visit date · Last visit · Next follow-up). Still no "Date joined".
3. **Tab strip** — horizontally scrollable, `scroll-snap`, with a right-edge fade mask indicating more
   tabs. Active tab keeps its 2px underline.
4. **Visit timeline** — the rail moves to a 12px left inset; each entry's "Preview prescription" button
   becomes a full-width ghost row at the card's foot. Vitals chips wrap to two rows.
5. **Prescription thumbnails** — a horizontal snap-scroll row of 3 sheets at 128 × 181.
6. **Right rail cards** (At a glance, Growth, Vaccination, Upcoming, Billing) stack beneath the timeline
   in that order, full width.
7. **Sticky bottom action bar**, 68px, above the tab bar, `border-t #ECEEF4`, white:
   **"Book consultation"** gradient primary (60% width) + **"Prescribe"** secondary (40%).

---

## 4. REFERENCE SCREEN C — Mobile prescription builder + PiP
Spec 13 at 375px

1. **Sticky sub-header** — patient chip + a step indicator `2 of 5`.
2. **Sections as accordions** — ① Diagnosis, ② Vitals, ③ Medicines, ④ Tests, ⑤ Advice. Only one open at a
   time; completed sections collapse to a summary line with a green `Check`
   (e.g. *"② Vitals — 16.2 kg · 103 cm · 101.2 °F"*).
3. **Vitals as a 2×2 tile grid** — Weight, Height, Head circumference, Temperature. The temperature tile
   keeps its red febrile treatment. Numeric inputs use `inputMode="decimal"`.
4. **Medicines** — each row becomes its own `rounded-[12px]` card: medicine name full width, then
   Dose / Frequency / Duration in a 3-column grid, then Notes. The frequency chips wrap.
   Drag-to-reorder uses a long-press handle.
5. **A4 preview** is not inline — it opens as a full-screen sheet from a sticky
   **"Preview prescription"** ghost button, with pinch-zoom.
6. **PiP windows dock to the bottom edge**, full width, height 200px, above the action bar,
   `rounded-t-[16px]`. Only **one** is expanded at a time; the other collapses to a 36px title bar
   stacked above it. Swipe down dismisses; a small floating **"Growth ⤢"** chip re-opens it.
   The live growth point and its `16.2 kg · P52` callout still update as vitals are typed — this is the
   feature, and it must survive the small screen.
7. **Bottom action bar** — **"Generate prescription"** gradient primary, full width.

---

## 5. TABLET (768–1023px)

- Sidebar is the 76px icon rail; labels appear in a tooltip on long-press.
- Bottom tab bar is **not** used — navigation stays in the rail.
- Two-column card rows throughout; the KPI row wraps 3 + 2.
- Tables keep their table form but drop the least-important two columns per screen (marked in each spec's
  responsive note; where unmarked, drop `Location` first, then the secondary date column).
- PiP windows stay floating, sized 280 × 210, docked bottom-right.
- Modals stay centred modals, max-width 92vw.

---

## 6. WHAT TO RENDER FOR REVIEW

Produce the three reference screens **side by side** on a `#F6F7FB` background, each as a rounded-rectangle
screen canvas at 375 × 812 with a soft shadow — **no phone bezels, no device frames, no hands**. Label
each beneath in 12/600 `#64748B`: `Dashboard` · `Patient workspace` · `Prescription builder`.

---

## 7. DELIVERABLES

```
src/components/layout/{MobileTopBar,MobileDrawer,BottomTabBar,Fab}.tsx
src/components/shared/{ResponsiveTable,BottomSheet,FilterSheet,KpiCarousel}.tsx
src/hooks/useBreakpoint.ts
```

`ResponsiveTable` is the important one: it takes the same column definitions as `DataTable` and renders a
table above `md` and stacked cards below it, so no screen maintains two markup trees.
