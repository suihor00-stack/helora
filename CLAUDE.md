# HELORA

**Live at <https://helora.suihor00.workers.dev>** — the admin is at `/admin`.

An online jewelry shop. Built from the HELORA design in Claude Design, running
as a plain website on Cloudflare, with Supabase holding the products and orders.

**No build step. No npm. No installing anything.** The files you see are the
files that go live. Edit one, push it, it's live in about a minute.

---

## Getting it live — three steps

Do these once, in order. About 20 minutes total.

### 1. Set up the database (Supabase)

1. Go to [supabase.com](https://supabase.com) and make a free account.
2. Create a new project. Pick a region near your customers — Singapore is the
   closest one to Malaysia. **Save the database password somewhere safe.**
3. Wait for it to finish setting up (a minute or two).
4. In the left menu click **SQL Editor** → **New query**.
5. Open `supabase/schema.sql` from this folder, copy everything, paste it in,
   press **Run**. This builds all the tables and the security rules.
6. In the left menu click **Project Settings** → **API keys**. Copy two things:
   - the **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - the **anon public** key (a long string)

### 2. Paste those two values in

Open `js/config.js` and replace the two placeholders at the top:

```js
export const SUPABASE_URL      = 'https://abcdefgh.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGci...';
```

That's the only file you need to touch. The yellow warning bar on the site
disappears once these are filled in.

> These two values are meant to be public — every Supabase site ships them in
> the browser. The security rules in `schema.sql` are what actually protect
> your data. **Never** put the `service_role` key in here; that one is a master
> key and belongs on a server only.

### 3. Put it on the internet (Cloudflare)

1. Push this folder to GitHub (see **Pushing to GitHub** below).
2. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages**
   → **Create** → **Pages** → **Connect to Git**.
3. Pick the `helora` repository.
4. Leave the build settings **empty**:
   - Framework preset: **None**
   - Build command: *(blank)*
   - Build output directory: `/`
5. Click **Save and Deploy**.

Done. Every time you push to GitHub from now on, Cloudflare rebuilds the site
automatically.

### 4. Make yourself the admin

1. Open `https://helora.suihor00.workers.dev/admin` (Cloudflare strips the
   `.html`, so `/admin.html` redirects there).
2. Enter your email and a password, click **First time? Create the account**.
3. Back in Supabase → **SQL Editor**, run this with your own email:

   ```sql
   insert into public.admins (user_id, email)
   select id, email from auth.users where email = 'you@example.com'
   on conflict (user_id) do nothing;
   ```

4. Now sign in on the admin page. You can add products.

---

## Everyday things

### Add a product

Open `/admin`, sign in, click **Add a piece**. Fill in the name and price,
save, then add photos. Tick **New Arrivals** or **HELORA Picks** to make it show
on the homepage, and tick the collections it belongs to.

Photos: the first one is the main image, the second one shows when someone
hovers over it. Square photos on a white background look best.

### Change wording on a page

All the written pages — Our Story, Craftsmanship, FAQ, Shipping, Care, Returns,
Contact, Legal — live in `js/views-content.js`. The text is right there in plain
sight. Change it, save, push.

### Change the shop name, currency or contact details

`js/config.js`, in the `SITE` block near the top.

### Change a colour or font size

`css/helora.css`, the `:root` block at the very top. Change it once, it changes
everywhere.

### Preview on your own machine

```bash
python3 serve.py
```

Then open http://localhost:8788. Ctrl+C to stop. (`serve.py` is only for
previewing — Cloudflare doesn't use it.)

---

## Pushing to GitHub

The repo is <https://github.com/suihor00-stack/helora>.

First time:

```bash
git remote add origin https://github.com/suihor00-stack/helora.git
git branch -M main
git push -u origin main
```

After that, every change:

```bash
git add -A && git commit -m "what you changed" && git push
```

GitHub will ask for a username and password. Use your GitHub username, and for
the password use a **personal access token**, not your real password — make one
at github.com → Settings → Developer settings → Personal access tokens → Tokens
(classic), tick `repo`.

---

## How the code is laid out

```
index.html              the shop — one page, everything loads into it
admin.html              where you add products
serve.py                local preview only
css/helora.css          every style. Colours and fonts are in :root at the top
js/
  config.js             ← your Supabase keys, shop name, collections
  data.js               reads and writes to Supabase
  store.js              the shopping bag (kept in the browser)
  ui.js                 small shared helpers
  views-shop.js         home, collection, product, checkout, confirmation
  views-content.js      the written pages (story, FAQ, shipping, legal…)
  app.js                header, footer, search, bag, and the router
  admin.js              the admin page
supabase/
  schema.sql            the database. Run once in Supabase's SQL Editor
  migration-01-*.sql    original price (compare_at_cents)
  migration-02-*.sql    bilingual products + user-managed spec fields
_headers                security settings Cloudflare applies
```

### How pages work

The address bar drives everything. `#rings` shows the Rings collection,
`#product/aura-fine-band` shows one piece, `#faq` shows the FAQ. `js/app.js`
reads the address, picks the matching function from `views-shop.js` or
`views-content.js`, and drops the result into the page.

To add a new page: write a function in `views-content.js` that returns HTML,
then add it to the `CONTENT_ROUTES` list in `js/app.js`.

### How the bag works

The bag lives in the browser (`localStorage`), so nobody needs an account to
shop. When someone checks out, the browser sends only *product ids and
quantities* to Supabase — never prices. The database looks the prices up itself
in the `place_order` function, so a customer editing prices in their browser
achieves nothing.

---

## Notes for Claude

- **No build tools.** Plain HTML, CSS and ES modules. Don't add npm, bundlers,
  frameworks or TypeScript — this machine has no Node installed and Cloudflare
  is configured with no build command.
- **No libraries.** Supabase is reached with plain `fetch` in `js/data.js`.
  Keep it that way; don't add the supabase-js CDN import back.
- **Styling goes in `css/helora.css`**, using the existing classes
  (`.p`, `.sec`, `.ti`, `.eb`, `.btn`, `.lnk`, `.ul`, `.ph`). Inline `style=`
  is fine for one-off layout, as the design itself does.
- **Escape anything from the database** with `esc()` from `js/ui.js` before
  putting it in HTML.
- **Prices are integers in cents** everywhere (`price_cents`). Only `money()`
  in `js/ui.js` formats them for display.
- **Never** put the `service_role` key anywhere in this folder.
- Changing `supabase/schema.sql` doesn't change the live database — the user has
  to paste it into Supabase's SQL Editor and run it. Say so when you change it.
- For an existing database, add a numbered file (`supabase/migration-NN-*.sql`)
  rather than editing `schema.sql` in place, and make it safe to run twice
  (`add column if not exists`, `on conflict do nothing`). Tell the user to run
  it, and make the code degrade gracefully until they do — see how
  `loadFields()` in `js/admin.js` falls back when the table isn't there yet.
- Spec rows on the product page come from the `product_fields` table, not from
  hard-coded columns. Don't reintroduce fixed spec fields; the shop owner
  manages them in 後台 → 欄位設定.
- The design source is the Claude Design project "UI mockups needed",
  file `HELORA Site.dc.html`. Match its look when adding anything.

---

## Not built yet

**Taking real money.** Checkout collects the order, saves it to the database
with the status `pending_payment`, and shows the confirmation page — but no
money moves. Choosing DuitNow or FPX right now just records which one the
customer picked.

To actually take payments you need a payment provider account
(Billplz, Stripe, iPay88 or similar) and a small server-side piece to talk to
them, because that step needs a secret key that can't live in the browser. A
Cloudflare Worker or Supabase Edge Function is the usual place for it. Ask
Claude to set it up once you've picked a provider.

**Other things worth doing later**

- Order emails to you and to the customer (Supabase Edge Function + Resend).
- Real search across products — right now search covers collections and pages,
  matching the original design.
- Stock counts, discount codes, and a proper orders screen in the admin.
- Search-engine visibility: pages use `#hash` addresses, which search engines
  handle poorly. Switching to real paths like `/rings` needs a `_redirects`
  file with `/* /index.html 200` and a change to the router.
