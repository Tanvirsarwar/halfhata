# halfhata — Fresh Deployment Guide (Shopora-basis redesign)

## What this is
Your complete redesigned site. Same working Supabase backend (nothing to change
in the database), new Shopora-inspired design: artisan cream & brass palette,
Plus Jakarta Sans, hero slider, editorial sections, trust strip, mega footer.

## ✅ What you do NOT need to do
- NO new SQL. Your Supabase tables (products, categories, orders) stay as they are.
- NO Supabase key changes — they are already inside assets/js/supabase.js.
- NO Google changes — same halfhata.pages.dev origin, login keeps working.
- Your existing products & orders remain — the design changed, not the data.

## Deploy (replace everything in your GitHub repo)
1. Unzip halfhata.zip on your computer. Open the halfhata folder.
2. GitHub → your halfhata repo → Add file → Upload files.
3. Select EVERYTHING inside the folder (Ctrl+A) and drag it in.
   (Drag the contents, not the outer folder.)
4. Commit changes → Cloudflare rebuilds in ~1 minute.
5. Hard refresh: Ctrl+Shift+R (phone: open in an incognito tab once).

## OR: brand-new Cloudflare Pages project (optional)
1. Cloudflare → Workers & Pages → Create application → Pages → Upload assets.
2. Name: halfhata-v2 → drag the files INSIDE the folder → Deploy.
3. You get halfhata-v2.pages.dev. If you use this NEW address:
   Google Cloud → Credentials → your OAuth client →
   Authorized JavaScript origins → add https://halfhata-v2.pages.dev

## After deploy — 5-minute test
1. Home: slider auto-rotates (01/03 counter, arrows work).
2. Click a product → modal (photos, description, mandatory size, chart) → Add.
3. Checkout → sign in → COD with txn → order → success page.
4. Admin (/admin.html, pw halfhata#26#): order appears (≤15s), assign courier.
5. Phone (incognito): products show, ☰ menu works, notification arrives.
6. Custom Design page: upload → sizes → order → check admin drawer + download.

## Files in this build
index.html · jersey.html · custom.html · checkout.html · success.html ·
track.html · account.html · admin.html · assets/css/styles.css ·
assets/js/{data,store,supabase,auth,landing,jersey,custom,checkout,account,track,admin}.js
· assets/img/{logo.jpeg,favicon.png,hero.png,jersey-hero.png} · production/*.sql
