# halfhata — Security Report

Audit of the current build (static front end + `production/schema.sql`).
Split into **what I fixed** and **what remains** (needs the Supabase/server backend).

---

## Fresh-launch cleanup (done)
- **No assumed data anywhere.** Removed the 12 seeded demo orders, the hardcoded product catalogue, the default categories, and the mocked "Rakib Hasan" Google identity. The store now boots completely empty.
- **Example placeholders neutralised.** Checkout fields no longer suggest real-looking names/addresses (was "Rakib Hasan", "Dhanmondi", a full sample address) — now generic hints.
- **One-click reset.** Admin → **Settings → Danger zone → Reset all data** wipes products, categories, orders, customers and notifications so you can start clean at any time.

---

## What I FIXED

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | **Stored XSS** — a customer's name / address / phone / txn ID (and admin-typed courier + tracking) were rendered as raw HTML in the admin, tracking, account, success and cart screens. A crafted value could run code in *your* admin browser. | High | Added `esc()` and applied it to **every** user-controlled value at all HTML sinks (admin table + drawer + dashboard + products + customers, checkout summary, success, track, account, navbar notifications, signed-in name). |
| 2 | **Admin panel fully open** — anyone with the `/admin.html` URL could read all customer PII and change orders. | High | Added a login gate; the dashboard is hidden until authenticated. |
| 3 | **Admin password in plaintext** in the JS source (readable via View Source). | Medium | Password is now stored as a **SHA-256 hash**; the plaintext is not in the files. Login hashes the input and compares. |
| 4 | **Malicious image upload** (e.g. SVG with embedded script) when posting products. | Medium | Uploaded images are **re-encoded to JPEG via canvas**, which strips scripts/EXIF, and are size-capped. Only the safe re-encoded data URL is stored/displayed. |
| 5 | **App crash / DoS from a deleted product** still in someone's cart. | Low | `cartLines()` now skips missing products instead of throwing. |
| 6 | Oversized image uploads could blow the storage quota. | Low | Client-side compression (max ~700px, JPEG q0.72) before saving. |

---

## What REMAINS (needs the backend — cannot be truly fixed in a static demo)

These are **inherent to a client-only build**. They close when you wire up Supabase (schema + RLS are already written for it in `production/schema.sql`).

| # | Risk | Why it can't be fixed client-side | Production fix |
|---|------|-----------------------------------|----------------|
| A | **The admin gate is not real auth.** The hash is still shipped to the browser; a determined person could bypass the check in dev tools. | There is no server to verify against. | Replace with **Supabase Auth** + the `is_admin()` **RLS** already in `schema.sql`. Remove the client gate entirely. |
| B | **Prices & payment amounts are client-trusted.** `placeOrder` computes totals in the browser; a tampered request could set its own price or "paid" amount. | No server recomputes anything. | Do order creation in a **Supabase Edge Function / server action** (`SECURITY DEFINER`) that recomputes every price from the DB and ignores client amounts. |
| C | **Payment (txn ID) is unverified.** A typed Nagad/bKash txn ID is trusted as-is — the main COD-advance **fraud** vector. | No payment API is connected. | Verify against the **bKash/Nagad merchant API** (or manual admin "Verify payment" step) before shipping. Schema already has `payments.verified`. |
| D | **Customer PII sits in browser localStorage** in plaintext, shared on that device. | Client storage is the only store in the demo. | Move to Supabase Postgres with **RLS** (each customer sees only their own rows — policies already written). |
| E | **No rate-limiting / CSRF / bot protection** on the order or login actions. | Nothing server-side to enforce it. | **Cloudflare WAF + rate-limiting rules**, and Supabase RLS/policies. Add a `place_order` RPC so order+items+payment insert atomically (RLS currently blocks direct client inserts of items/payments by design). |
| F | **Admin password lives in the code / deployment PDF.** | It's a shared demo credential. | Once Supabase Auth is in, delete the hash from the code and rotate the password. Never commit real credentials. |

---

## Deployment security checklist (before going live)
- [ ] Switch admin + customer auth to **Supabase Auth**; delete the client gate and the password hash.
- [ ] Create orders/payments via a **server action/RPC** that recomputes prices server-side.
- [ ] Keep **RLS enabled** on all tables (it is, in `schema.sql`).
- [ ] Put the site behind **Cloudflare** with WAF + rate-limiting on `/checkout` and login.
- [ ] Store the **`service_role` key server-side only** — never in the front end.
- [ ] Serve over **HTTPS** only (Cloudflare gives this free); `crypto.subtle` also needs a secure context.
- [ ] Add a payment-verification step before an order can be shipped.
- [ ] Restrict `payment-screenshots` storage bucket to signed URLs (private).

**Bottom line:** every issue that *can* be fixed in a front-end-only app is fixed. The remaining items are architectural — they require the Supabase backend, which the included `schema.sql` (RLS, `is_admin()`, triggers) is already built for.
