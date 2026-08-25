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

## Taking payments with Stripe

Checkout sends the customer to Stripe's own payment page. Their card details
never touch this site, and the price is worked out in the database, so nothing
the browser sends can change what they're charged.

Set it up once, in this order.

### 1. Run the migration

Supabase → SQL Editor → paste `supabase/migration-04-stripe.sql` → Run.

### 2. Get your Stripe key

[dashboard.stripe.com](https://dashboard.stripe.com) → **Developers** →
**API keys** → copy the **Secret key**.

Start in **Test mode** (the toggle at the top right). Test keys begin
`sk_test_`, live ones `sk_live_`.

> Never put this key in `js/config.js` or anywhere in this folder. It only ever
> goes into Supabase's secrets, below.

### 3. Deploy the two functions

Supabase → **Edge Functions** → **Deploy a new function**, twice:

| Name | Paste from |
|---|---|
| `create-checkout` | `supabase/functions/create-checkout/index.ts` |
| `stripe-webhook` | `supabase/functions/stripe-webhook/index.ts` |

**On `stripe-webhook`, turn OFF "Verify JWT".** Stripe can't send a Supabase
token; the function checks Stripe's own signature instead. If this stays on,
every webhook is rejected and orders never get marked paid.

### 4. Add the secrets

Supabase → **Edge Functions** → **Secrets**:

| Name | Value |
|---|---|
| `STRIPE_SECRET_KEY` | your `sk_test_…` key |
| `SITE_URL` | `https://helora.suihor00.workers.dev` (no trailing slash) |
| `CURRENCY` | `myr` |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.

### 5. Tell Stripe where to send the webhook

Stripe → **Developers** → **Webhooks** → **Add endpoint**.

- URL: `https://ezhcfpuhxwncukzktaeh.supabase.co/functions/v1/stripe-webhook`
- Events: `checkout.session.completed`,
  `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`,
  `checkout.session.expired`

Copy the **Signing secret** (`whsec_…`) and add it to Supabase's secrets as
`STRIPE_WEBHOOK_SECRET`.

### 6. Switch on the payment methods you want

Stripe → **Settings** → **Payment methods**. In Malaysia you can enable cards,
**FPX** (online banking) and **GrabPay**. The checkout doesn't hard-code any of
them — whatever is on in Stripe is what the customer sees.

### 7. Test before going live

With test keys, pay using card `4242 4242 4242 4242`, any future expiry, any
CVC. Then check Supabase → **Table editor** → `orders`: the row should read
`paid`.

When it works, flip Stripe out of Test mode, swap `STRIPE_SECRET_KEY` for the
live key, and create a **new** webhook endpoint in live mode (the signing
secret is different).

### Turning it off again

`CHECKOUT_MODE` in `js/config.js`. Set it to `'record-only'` and checkout goes
back to saving the order without taking money.

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
  migration-03-*.sql    user-managed collections
  migration-04-*.sql    Stripe payment columns
  functions/            Edge Functions — paste these into Supabase's dashboard
    create-checkout/    turns the bag into a Stripe payment page
    stripe-webhook/     marks the order paid when Stripe says so
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
- Payment runs through Stripe Checkout — there is no Stripe.js on the page and
  no publishable key, just a redirect to the session URL. The secret key lives
  only in Supabase's Edge Function secrets; never read it from the browser.
- The webhook verifies Stripe's signature by hand in `stripe-webhook`. Don't
  loosen the timestamp tolerance or swap the constant-time compare.
- Collections come from the `collections` table via `js/collections.js`, loaded
  once in `boot()`. `COLLECTIONS` in `config.js` is only the seed list and the
  offline fallback — don't read it directly for anything the shop renders.
- The design source is the Claude Design project "UI mockups needed",
  file `HELORA Site.dc.html`. Match its look when adding anything.

---

## Not built yet

**Order emails.** Nothing is emailed yet, to you or the customer. Stripe sends
its own receipt, but a HELORA-branded confirmation would need a Supabase Edge
Function plus an email service (Resend is the usual choice).

**Other things worth doing later**

- Order emails to you and to the customer (Supabase Edge Function + Resend).
- Real search across products — right now search covers collections and pages,
  matching the original design.
- Stock counts, discount codes, and a proper orders screen in the admin.
- Search-engine visibility: pages use `#hash` addresses, which search engines
  handle poorly. Switching to real paths like `/rings` needs a `_redirects`
  file with `/* /index.html 200` and a change to the router.
