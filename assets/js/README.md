# halfhata — Web App

A complete, working clothing-brand storefront + checkout + admin, built to the HALFHATA master prompt.
Premium **black / white / cream** aesthetic, Cash-on-Delivery flow with ৳120 advance, courier tracking, and a full admin dashboard.

> **Latest updates:** the store now starts **empty with no fake data** — you add your own t-shirts. The admin **Products** manager lets you post products with **multiple designs (each with its own image + price)**, pick or create a **category**, set sizes and a badge; they appear on the home page instantly and customers can filter by category. Also added: admin dashboard (KPIs + charts, top products, activity), Customers data view, a customer **Account** page, an **admin login gate**, per-item **cart removal**, and **XSS hardening**. Admin password: **`halfhata#26#`**. Full launch steps are in **HALFHATA-Deployment-Guide.pdf**; the security audit is in **SECURITY.md**. Wipe everything anytime via admin **Settings → Reset all data**.
>
> **First run:** open `admin.html`, log in (`halfhata#26#`), go to **Products → Add Product**, publish a few designs — then open `index.html` to see them live.


---

## 1. What's in the box (runs right now, no build)

```
halfhata/
├── index.html          ← Landing: hero, features, New Arrivals, Best Sellers, Collections,
│                          add-to-cart, floating Order Bar, floating WhatsApp
├── checkout.html       ← 4-step checkout: login → shipping → payment → place order
├── success.html        ← Order confirmation + Order ID
├── track.html          ← Customer order tracking (status, courier tracking ID, notifications)
├── admin.html          ← Admin Orders: stat cards, search, filters, sort, pagination,
│                          CSV export, order drawer, assign courier + notify customer
├── assets/
│   ├── css/styles.css   ← Full design system
│   ├── js/data.js       ← Brand config + product catalogue + SVG garments
│   ├── js/store.js      ← Mock backend (cart/orders/notifications) over localStorage
│   ├── js/landing.js · checkout.js · success (inline) · track.js · admin.js
│   └── img/logo.jpeg    ← Your logo (used in navbar, footer, admin, favicon)
├── production/
│   └── schema.sql       ← Production Supabase/PostgreSQL schema (RLS, triggers, timeline)
└── README.md
```

### Run it
Because the pages share a cart/order store, **serve it** (localStorage on `file://` is blocked in some browsers):

```bash
cd halfhata
python3 -m http.server 5173
# open http://localhost:5173
```

### Try the full loop
1. Open **`admin.html`** → log in with **`halfhata#26#`** → **Products → Add Product** → upload a design photo, set name/price/category/sizes → **Publish**. Add a few.
2. Open the landing page → your products show under New Arrivals / Best Sellers / Collections (filterable by category) → **Add to Cart** → the Order Bar slides up → **Order Now**.
3. Checkout: **Continue with Google** (mocked), fill shipping, keep **COD** → pay the **৳120** advance, enter any **Transaction ID**, **Place Order**. (You can remove items or change quantity right in the summary.)
4. Back in **admin.html** → the order is at the top → open it (eye icon) → assign a courier + tracking ID → **Ship & Notify Customer**.
5. The navbar **🔔 bell** and **`track.html`** now show the customer's tracking notification.

---

## 2. Business rules already implemented

- **COD minimum ৳120 advance** (validated), or **Pay Full** — rest shown as "Due on delivery".
- **Transaction ID required** for any advance/full payment; optional screenshot upload (≤5MB).
- Required shipping fields: **Full Name, Phone, District, City, Address** (with inline validation).
- Delivery charge **৳80**; totals recomputed live.
- Payment channels **WhatsApp / Nagad / bKash — 0199210064** shown at checkout, footer, admin.
- Admin: filter by status / payment / courier, free-text search, **click-to-sort every column**, pagination, **CSV export**, courier assignment (**Steadfast, Pathao, RedX, Sundarban, Manual**).
- **In-account notification center**: the storefront navbar **bell** shows the logged-in customer's notifications (order received, shipped + tracking ID, delivered, cancelled) with an unread badge and "mark all read" — aggregated across all their orders. Assigning a courier / changing status pushes here in real time.

---

## 3. Moving to the production stack (Next.js 15 + Supabase)

The prototype is a faithful, clickable spec. `store.js` is deliberately a **thin mock of the real API** — every method maps 1:1 to a Supabase call, so porting is mechanical.

Target structure:

```
app/
├── (shop)/page.tsx                 landing  (Server Component + product fetch)
├── (shop)/product/[slug]/page.tsx
├── (shop)/checkout/page.tsx        + actions.ts (server action: placeOrder)
├── (shop)/order/[no]/page.tsx      success + track
├── admin/orders/page.tsx           table (RSC) + client filters
├── admin/orders/[id]/page.tsx      drawer / detail + assignCourier action
├── admin/(products|customers|coupons|reports)/…
└── api/webhooks/payment/route.ts   (optional bKash/Nagad callback)
components/  (shadcn/ui)   lib/supabase/{client,server}.ts   store → replaced by server actions
```

Mapping cheat-sheet:

| Prototype (`store.js`)     | Production (Supabase)                                             |
|----------------------------|------------------------------------------------------------------|
| `addToCart / getCart`      | `cart_items` table (RLS: owner)                                  |
| `placeOrder`               | server action → insert `orders`, `order_items`, `payments`      |
| `assignCourier`            | insert `courier_tracking` → **trigger** sets status + notifies  |
| `setStatus`                | `update orders.status` → **trigger** writes timeline            |
| notifications              | `notifications` table + **Supabase Realtime** subscription       |

### Supabase setup
1. Create project → SQL editor → run `production/schema.sql`.
2. **Auth** → enable Email/Password + Google provider (add OAuth client ID/secret).
3. **Storage** → buckets: `product-images` (public), `payment-screenshots` (private, signed URLs).
4. Copy keys into `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...   # server-only, admin writes
   ```
5. Seed products (or an admin CRUD screen). The trigger `handle_new_user()` auto-creates the profile.

### Deploy
- Push to **GitHub** → import to **Vercel** → add the env vars → deploy.
- Add Supabase project URL to Google OAuth "Authorized redirect URIs".
- Point your domain, set `logo.jpeg` as favicon + OpenGraph image.

---

## 4. What I'd add before launch (features you didn't list but will want)

**Payments & orders**
- **Real payment verification.** A submitted txn ID is trust-based. Add a `verified` flag (already in schema) + an admin "Verify payment" action; ideally integrate **bKash/Nagad merchant API** callbacks so txn IDs auto-verify. This is your #1 fraud gap for COD advance.
- **Stock/inventory** decrement on order + "out of stock" states (schema has `stock`).
- **Order cancellation / refund** flow for the advance amount.
- **Delivery-charge logic** by district (Dhaka vs outside) + the "free over ৳1,500" rule (in settings).
- **Fraud check** against courier fraud APIs (Steadfast/Pathao expose customer success-rate lookups by phone) before shipping COD.

**Customer experience**
- Product detail page with size/color selection, image gallery, related products.
- **Real cart drawer** + quantity editing on the storefront (prototype adds from cards; the schema/store support qty).
- Wishlist persistence, product **search** + category filtering, reviews UI (tables exist).
- The in-account notification center is built. In production, back it with the `notifications` table + **Supabase Realtime** so the bell updates live without refresh. SMS/email on status change is an *optional* extra channel, not the primary one.
- Abandoned-cart WhatsApp nudge.

**Admin**
- The other nav sections (Products CRUD, Customers, Coupons, Reports charts, Settings, Notifications inbox) — routes are stubbed in the sidebar.
- **Courier API integration** to auto-create the consignment and pull live tracking status, instead of pasting a tracking ID.
- Bulk actions (bulk ship, bulk export), date-range filter, revenue dashboard.
- Role-based admin (schema has `is_admin`; extend to roles for staff vs super-admin).

**Platform / launch**
- SEO: metadata per page, `sitemap.xml`, `robots.txt`, JSON-LD Product schema, OpenGraph.
- `next/image` optimization + lazy loading, Lighthouse pass (target 95+).
- Analytics (GA4 / Meta Pixel — Pixel matters for BD ad retargeting).
- Legal pages: Return/Refund, Privacy, Terms, Delivery policy (needed for FB/Meta commerce).
- Rate-limit the order endpoint; validate everything server-side (never trust the client amount).
- Backups + a staging environment before pointing the domain.

---

**Suggested build order:** Supabase schema → Auth + profile → product catalogue & storefront → cart → checkout + server action → order success/track → admin orders + courier → payments verification → SMS/notifications → SEO/perf → deploy.

Want me to generate the actual Next.js files next? I'd do it screen-by-screen (landing → checkout action → admin) so each piece is real, typed, and testable rather than one large untested drop.
