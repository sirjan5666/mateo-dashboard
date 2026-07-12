# Design Brief — Mateo Shop Flow + "Mateo Sitare" Rewards

**For:** Claude designer (UI/UX generation)
**Product:** Mateo parenting dashboard — parent panel (`/shop` + dashboard)
**Audience:** Indian parents, primary user = mothers of babies 0–2000 days
**Brand feel:** warm, trustworthy, playful-but-clinical. Parent panel uses a
playful **purple** identity, hand-rolled Tailwind (v4), EN/हिन्दी bilingual.
**Assistant in-app:** "Dai Maa" (grandmother figure) — the emotional voice of the brand.

> This is a **design/UX brief**, not an implementation spec. Produce screen
> designs, component layouts, states, and copy. Two workstreams:
> **(A) Shopping flow redesign** and **(B) the "Mateo Sitare" rewards program.**

---

## 0. Non-negotiable compliance guardrails (read first)

This app sells **infant formula (Neucomed)** alongside Mateo skincare, under India's
**IMS Act 1992**. The law forbids any discount, promotion, gift, or **inducement**
tied to infant milk substitutes. A points/rewards currency **is** an inducement.
Therefore, everywhere in this brief:

1. **Formula is invisible to the rewards economy.** Buying formula earns **0
   points**. Reviewing formula earns **0 points**. Points **cannot be redeemed**
   against formula or any cart that contains formula.
2. Formula stays behind its existing **mandatory statutory-warning interstitial**;
   every formula product keeps the **"Mother's milk is best"** notice. No "Stars",
   no discount badges, no "earn X points" labels anywhere near formula.
3. If a cart mixes eligible items + formula, the rewards UI applies points **only to
   the eligible subtotal** and shows a quiet, non-judgmental note explaining formula
   is excluded — never a nudge to buy more formula.
4. No superiority claims, no "best-selling formula", no formula in
   recommendation/upsell rails driven by rewards.

Design the reward surfaces so that removing formula from them looks intentional and clean, not like an error state.

---

## PART A — Shopping flow redesign

**Flow:** `Brands → Categories → Products → Product detail (with reviews & ratings)`.
Make it feel like a modern, delightful D2C store (think Nykaa / FirstCry polish, not
a utilitarian dashboard table).

### A1. Brands landing (shop home)
- Hero band: warm, on-brand, seasonal-swappable. One clear value line.
- **Brand grid/cards**: each brand = logo, one-line descriptor, product count, a
  "shop" affordance. Mateo (skincare, hero brand) featured first and largest.
- Neucomed appears as a brand card **but** tapping it routes through the
  statutory-warning interstitial before any product is shown (design that gate too).
- Optional: a "shop by need" secondary rail (e.g. *Bath time, Nappy care, Massage*).
- Search entry point (persistent).

### A2. Category listing (within a brand)
- Category tiles with imagery + item counts.
- Breadcrumb (`Shop / Mateo / Bath & body`), sort + filter affordances.
- Empty/one-item states designed.

### A3. Product grid (within a category)
- Product card: image, name, short benefit line, price (₹, placeholder MRP),
  **star rating + review count**, quick-add to cart, wishlist heart.
- Eligible products show a subtle **"Earn ★ N Sitare"** micro-badge (see Part B).
  Formula products show **none**.
- Filter panel (age band, skin concern, price), sort (popularity, price, rating, new).
- Loading (skeleton), empty, and out-of-stock states.

### A4. Product detail page (the centerpiece)
- Gallery (multiple images, zoom), name, brand, price, variant selector, quantity.
- **Rating summary block**: big average (e.g. 4.6 ★), total count, and a
  **5→1 star distribution bar chart**.
- **Reviews list**: reviewer name/avatar + baby age context ("Mom of 8-month-old"),
  star rating, date, title, body, "verified purchase" badge, helpful (👍) count,
  optional review photos.
- **Write-a-review** entry (gated to verified buyers). Show the reward hook:
  *"Share an honest review — earn ★ Sitare for 4★ & 5★ reviews."* (Design the review
  composer: star picker, title, body, photo upload, honesty microcopy.)
- Ingredients / how-to-use / safety accordion. Trust signals (dermatologist-tested,
  IMS-compliant, etc. — real claims only).
- Sticky add-to-cart bar on mobile with price + "Earn ★ N".
- Cross-sell rail ("Complete the routine") — **excludes formula**.
- Formula PDP variant: same skeleton **minus** all reward/rating-promo affordances,
  **plus** the "Mother's milk is best" notice and factual, non-promotional copy.

### A5. Cart & checkout touchpoints (reward-aware)
- Cart shows: item list, eligible subtotal, **"Apply Sitare" toggle/slider** with the
  redeemable balance and the ₹ value, updated total. Formula lines clearly excluded
  from any discount with a calm one-liner.
- Post-purchase confirmation: **"You earned ★ N Sitare!"** celebratory moment
  (respectful, not slot-machine). Order tracking unchanged.

---

## PART B — "Mateo Sitare" rewards program

### B1. Naming & terminology (recommended, open to change)
- **Program name:** **Mateo Sitare** *(सितारे = "stars")* — bilingual, warm, on-brand
  with the app's existing star/journey motifs. Ties naturally to product **ratings**
  (also stars) without confusion because rating stars are gold ★ and Sitare are a
  distinct branded token.
- **Currency unit:** **Sitare** (a "Sitara" singular). UI shorthand: **★ 1,240**.
- **Verbs:** *earn Sitare*, *redeem Sitare*. Balance label: *"Your Sitare"*.
- **Alternate names** if the owner prefers (design one, note the swap is trivial):
  *Mateo Stars*, *Laddoos* (playful, a sweet = reward), *Mateo Moments*.
- Provide a small **logo/token mark** for the currency (a soft star coin), usable at
  badge, chip, and hero sizes, in light + dark.

### B2. Earning rules (design the UI for each; **all values below are placeholder/random — owner to finalize**)
| Action | Trigger | Placeholder reward | Notes / guardrails |
|---|---|---|---|
| Place an order | Order marked paid/delivered | **★ 5 per ₹100** spent (on **eligible** subtotal only) | **Formula excluded.** Reverse on refund. |
| Post a review | Review approved, **4★ or 5★** | **★ 50** per approved review | Verified buyers only; formula reviews **excluded**; anti-spam: one rewardable review per product. |
| Fill tracker details | Meaningful tracker/journey entry | **★ 5** per entry, **cap ★ 20/day** | Encourages engagement without farming; cap prevents spam entries. Health-data: never tie rewards to sensitive medical accuracy — reward the *act of logging*, not values. |
| Refer a friend | Referee signs up / first qualifying action | **★ 200** to referrer, **★ 100** welcome to referee | Reuse existing Refer & Earn plumbing; both-sided reward. |
| Book a consultation | Consultation booked & completed | **★ 100** per completed consult | Reverse if cancelled/no-show refunded. |
| Community participation | See B3 | **★ 10** per approved contribution, **cap ★ 30/day** | Anti-abuse gating required (see B3). |

Design an **earning states** set: pending → confirmed → reversed, and a "how to earn"
explainer screen (illustrated list of all the ways to earn).

### B3. Community points — proposed logic (needs owner sign-off)
Community is the highest abuse risk. Recommended model:
- Reward **quality contribution, not raw volume**: points on a post/answer **only
  after it passes moderation** (approved, not removed).
- **Daily/weekly caps** per user (e.g. max ★ from community per day) to kill farming.
- Optional bonus when a contribution crosses a **helpfulness threshold** (e.g. N
  helpful/likes from distinct users) — awarded once per item.
- **No points** for likes you *give*, only for genuine authored value you *receive*.
- Removed/flagged content **claws back** its points.
- Design: an unobtrusive "★ earned" toast on approval; a "community rewards rules"
  microcopy block. Keep it warm, not gamified-to-the-point-of-toxic.

### B4. Redemption
- Redeemable on **eligible products** and **consultations** only. Never formula.
- **Redemption model** (recommend to owner): points as a **partial-payment slider**
  (like Flipkart SuperCoins / Amazon Pay balance) with a **max-cap per order** and a
  fixed **★→₹ conversion**. **Placeholder values (random, owner to finalize):**
  - Conversion: **★ 10 = ₹1** (i.e. ★ 1 = ₹0.10)
  - Redemption cap: **up to 20% of the eligible subtotal per order**
  - Expiry: **Sitare expire 12 months after they're earned** (placeholder)
- Cart & consultation-booking both get an **"Apply Sitare"** control: shows balance,
  ₹ value, the capped applicable amount, and the new total.
- Clear states: insufficient balance, cap reached, nothing eligible in cart,
  formula-in-cart exclusion note.

### B5. Balance & history (the "wallet" — Flipkart/Amazon-like)
- **Balance surface** on the parent dashboard: a compact **Sitare chip/card** showing
  ★ balance, ₹ value, and a "→ how to earn / redeem" entry. Consider a small pill in
  the top nav so balance is always glanceable.
- **Dedicated Rewards page** (`/rewards` or within shop):
  - Hero: total balance, ₹ value, tier/progress (if tiers later), primary CTAs
    (Earn more · Redeem).
  - **Ledger / transaction history**: chronological list — earned (green +★) and
    redeemed (−★) with source label ("Order #1234", "Review: Baby lotion",
    "Referral: Priya", "Consultation"), date, running balance.
  - Filter (earned / redeemed / pending) and empty state.
  - **Expiry policy** display if points expire (design the "expiring soon" nudge —
    gentle, not pressuring).
  - "Ways to earn" explainer + "Where to redeem".
- Design **light + dark** and **EN + हिन्दी** for every reward surface (strings must
  be translation-ready; keep them short).

---

## PART C — Visual direction & deliverables

### C1. Visual language
- Parent-panel playful **purple** identity; warm neutrals; rounded, soft, friendly.
- Keep it **premium and calm** — this is a health app for anxious new parents.
  Rewards should feel *encouraging*, never manipulative or casino-like. No aggressive
  countdowns, no dark patterns, honest microcopy throughout.
- Respect existing hand-rolled Tailwind tokens; propose additions (a "Sitare gold/star"
  accent that is visually distinct from the purple UI and from gold rating-stars).
- Bilingual layouts must not break with longer Hindi strings.

### C2. Screens to deliver
**Shop flow:** Brands landing · Neucomed statutory interstitial · Category listing ·
Product grid (with filters) · **Product detail w/ reviews** · Write-a-review composer ·
Cart with "Apply Sitare" · Order confirmation (earn moment).

**Rewards:** Dashboard Sitare chip/card · Nav balance pill · Rewards/wallet page ·
Transaction ledger · "How to earn" explainer · "Apply Sitare" in cart & in
consultation booking · Earn toast/celebration states.

For each: **default, loading (skeleton), empty, and error** states where relevant,
plus **mobile-first** and desktop, **light + dark**.

### C3. Copy tone
- Warm, reassuring, honest. Dai Maa's grandmotherly warmth can flavor reward
  microcopy ("A little something for showing up for your little one 💜").
- Never imply rewards influence health advice or that spending more = better parenting.

---

## PART D — Open decisions for the owner (surface these, don't block on them)
1. Final program **name** (recommend *Mateo Sitare*).
2. **★→₹ conversion rate** and **per-order redemption cap %**.
3. **Earn amounts** per action (table B2 values are placeholders).
4. **Community points logic** sign-off (B3).
5. **Expiry policy** (do Sitare expire? how long?).
6. Whether to introduce **tiers** now or later (design should leave room, not require).

---

### Reminder to the designer
Everything reward-related must remain **formula-free** per the IMS Act (Part 0).
When in doubt, exclude formula from the reward surface and keep the exclusion quiet
and non-promotional.
