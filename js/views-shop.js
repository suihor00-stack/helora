/* ==========================================================================
   HELORA — the shopping pages
   Home · Collection · Product · Checkout · Confirmation.
   These read real products out of Supabase. Before you've added any, they
   fall back to the empty state from the design.
   ========================================================================== */

import { frame, esc, money } from './ui.js';
import { SITE, COLS, PAY_METHODS } from './config.js';
import { listProducts, getProduct } from './data.js';
import { getBag, bagSubtotal, isWished } from './store.js';

/* ---------- reusable product card ------------------------------------------ */

/** One product tile. `shape` is '4/5' on home, '1' on collection pages. */
export function productCard(p, { shape = '4/5', showAdd = true, showWish = true } = {}) {
  if (!p) {
    return `
      <div class="prod-card">
        ${frame(null, `Product on white · ${shape === '1' ? '268 × 268' : '266 × 332'} px`,
                { style: `aspect-ratio:${shape}` })}
        <div>
          <div class="prod-name is-empty">Product name</div>
          <div class="prod-price is-empty">${SITE.currency} —</div>
        </div>
      </div>`;
  }

  const [main, alt] = p.images;
  const heart = isWished(p.id) ? '♥' : '♡';

  return `
    <div class="prod-card">
      <div class="ph ${alt ? 'sw' : ''}" style="aspect-ratio:${shape};cursor:pointer" data-product="${esc(p.slug)}">
        ${main
          ? `<img src="${esc(main.url)}" alt="${esc(main.alt)}" loading="lazy" decoding="async">`
          : `<span class="cap">Product on white</span>`}
        ${alt ? `<div class="sw-b"><img src="${esc(alt.url)}" alt="" loading="lazy" decoding="async"></div>` : ''}
        ${showWish ? `<button class="wish" type="button" data-wish="${esc(p.id)}"
                        aria-label="Save ${esc(p.name)}" aria-pressed="${isWished(p.id)}">${heart}</button>` : ''}
      </div>
      <div>
        <div class="prod-name" data-product="${esc(p.slug)}" style="cursor:pointer">${esc(p.name)}</div>
        <div class="prod-price">${money(p.priceCents)}</div>
        ${!p.inStock
          ? `<div class="prod-add" style="cursor:default">Sold out</div>`
          : showAdd
            ? `<div class="prod-add ul" data-add="${esc(p.slug)}" role="button" tabindex="0">Quick Add</div>`
            : ''}
      </div>
    </div>`;
}

/** Fills a row to `n` tiles, using empty placeholders when there aren't enough. */
const row = (items, n, opts) =>
  Array.from({ length: Math.max(n, items.length) }, (_, i) => productCard(items[i] || null, opts)).join('');

/* ---------- Home ----------------------------------------------------------- */

export async function home() {
  const [fresh, picks] = await Promise.all([
    listProducts({ collection: 'newin', limit: 4 }),
    listProducts({ collection: 'picks', limit: 4 })
  ]);

  return `
  <section class="hero">
    <div class="hero-copy">
      <div class="eb" data-reveal style="margin-bottom:20px">Everyday, Made Distinctive</div>
      <h1 class="hero-h"><span>Hello,</span><span>Aura.</span></h1>
      <p class="p" data-reveal style="max-width:32ch;margin-top:22px;font-size:17px;transition-delay:.16s">
        Distinctive jewelry for everyday expression.
      </p>
      <div class="btn" data-reveal data-go="newin" role="button" tabindex="0"
           style="margin-top:38px;align-self:flex-start;transition-delay:.24s">Shop New Arrivals</div>
    </div>
    ${frame(null, 'Model wearing the hero piece — plain white studio background · 650 × 700 px',
            { cls: 'hero-img' })}
  </section>

  <div class="section-head">
    <div class="eb" data-reveal style="margin-bottom:18px">Shop by Category</div>
    <h2 class="sec" data-reveal style="transition-delay:.08s">Find Your Everyday Piece</h2>
  </div>
  <div class="cat-grid">
    ${[['rings', 'Rings'], ['earrings', 'Earrings']].map(([slug, label], i) => `
      <div class="cat-card" data-reveal${i ? ' style="transition-delay:.1s"' : ''}>
        <div data-go="${slug}">
          ${frame(null, `${label} on white background · 556 × 740 px`, { style: 'aspect-ratio:4/5' })}
        </div>
        <div class="center">
          <div class="cat-name">${label}</div>
          <p class="p" style="font-size:13px;margin:6px 0 0">${esc(COLS[slug][1])}</p>
          <div class="lnk" data-go="${slug}" role="button" tabindex="0" style="margin-top:14px">Shop ${label}</div>
        </div>
      </div>`).join('')}
  </div>

  <div class="section-head rule-t">
    <div class="eb" data-reveal style="margin-bottom:18px">Just In</div>
    <h2 class="sec" data-reveal style="transition-delay:.08s">New Arrivals</h2>
  </div>
  <div class="prod-grid">${row(fresh, 4)}</div>
  <div class="center" style="padding:0 48px 104px">
    <span class="lnk" data-go="newin" role="button" tabindex="0">View All</span>
  </div>

  <div class="section-head rule-t" style="padding-bottom:40px">
    <div class="eb" data-reveal style="margin-bottom:18px">HELORA Picks</div>
    <h2 class="sec" data-reveal style="transition-delay:.08s">HELORA Picks</h2>
    <p class="p" data-reveal style="font-size:15px;max-width:52ch;margin:14px auto 0;transition-delay:.16s">
      ${esc(COLS.picks[1])}
    </p>
  </div>
  <div class="prod-grid" style="padding-top:40px;padding-bottom:48px">
    ${row(picks, 4, { showAdd: false, showWish: false })}
  </div>
  <div class="center" style="padding:0 48px 104px">
    <span class="lnk" data-go="picks" role="button" tabindex="0">Explore HELORA Picks →</span>
  </div>

  <section class="gift">
    <div class="gift-copy">
      <div class="eb" data-reveal style="margin-bottom:18px">Made for Gifting</div>
      <h2 data-reveal style="font:500 38px/1.16 var(--serif);color:var(--ink);margin:0;transition-delay:.08s">Gifts</h2>
      <p class="p" data-reveal style="max-width:34ch;margin-top:20px;transition-delay:.16s">${esc(COLS.gifts[1])}</p>
      <div class="lnk" data-reveal data-go="gifts" role="button" tabindex="0"
           style="margin-top:28px;align-self:flex-start;transition-delay:.24s">Explore Gifts →</div>
    </div>
    ${frame(null, 'Ring and earrings in an open gift box, white background · 744 × 440 px', { cls: 'gift-img' })}
  </section>

  <div class="section-head" style="padding-bottom:48px">
    <div class="eb" data-reveal style="margin-bottom:18px">Craftsmanship</div>
    <h2 class="sec" data-reveal data-go="craft" style="transition-delay:.08s;cursor:pointer">Made with Intention</h2>
  </div>
  <div class="craft-grid">
    ${[
      ['01', 'Thoughtfully Made',   'Thoughtfully made, with care taken in the details you notice up close.'],
      ['02', 'Considered Materials','Carefully selected materials, chosen to feel good every day.'],
      ['03', 'Designed to Last',    'Clean, versatile shapes with a distinctive point of view.'],
      ['04', 'Easy to Live In',     'Designed to feel effortless from morning to night.']
    ].map(([n, t, b], i) => `
      <div class="craft-item" data-reveal${i ? ` style="transition-delay:.${i * 8}s"` : ''}>
        <div class="craft-num">${n}</div>
        <div class="craft-h">${esc(t)}</div>
        <p class="p" style="font-size:13.5px;margin-top:8px">${esc(b)}</p>
      </div>`).join('')}
  </div>`;
}

/* ---------- Collection ------------------------------------------------------ */

export async function collection(slug) {
  const isAll = slug === 'all';
  const [title, intro] = isAll
    ? ['Shop All', 'Every HELORA piece, in one place.']
    : (COLS[slug] || ['Shop All', 'Every HELORA piece, in one place.']);

  const items = await listProducts({ collection: isAll ? null : slug, limit: 48 });

  return `
  <div class="col-head">
    <div class="kicker">Shop</div>
    <h1>${esc(title)}</h1>
    <p class="intro">${esc(intro)}</p>
  </div>
  <div class="col-tools">
    <span class="ul" data-search role="button" tabindex="0">Search</span>
    <span class="ul" data-search role="button" tabindex="0">Sort</span>
  </div>
  <div class="col-grid">
    ${items.length
      ? items.map((p) => productCard(p, { shape: '1' })).join('')
      : `<div class="empty-note">No pieces here yet.</div>`}
  </div>
  ${items.length ? '' : `
    <p class="col-note">
      Products added in the admin fill these slots.
      <span class="ul" data-admin role="button" tabindex="0">Open the admin</span> to add your first piece.
    </p>`}`;
}

/* ---------- Product --------------------------------------------------------- */

export async function product(slug, kindHint = 'ring') {
  const p = slug ? await getProduct(slug) : null;
  // With no product loaded we still honour #producte so the empty page keeps
  // the earrings layout from the design.
  const earrings = p ? p.kind === 'earrings' : kindHint === 'earrings';
  const backTo   = earrings ? 'earrings' : 'rings';
  const [main, ...rest] = p ? p.images : [];

  const specs = earrings
    ? [['Material', p?.material], ['Finish', p?.finish], ['Drop / diameter', p?.dimensions],
       ['Fitting', 'Post / hoop / clip'], ['Weight per earring', p?.weight], ['SKU', p?.sku],
       ['Warranty', 'Limited Lifetime Craftsmanship Warranty']]
    : [['Material', p?.material], ['Finish', p?.finish], ['Dimensions', p?.dimensions],
       ['Weight', p?.weight], ['SKU', p?.sku],
       ['Warranty', 'Limited Lifetime Craftsmanship Warranty']];

  const soldOut = !!p && !p.inStock;
  const buyable = !!p && !soldOut;

  const related = await listProducts({ collection: earrings ? 'earrings' : null, limit: 4 });

  return `
  <div class="pd">
    <div class="pd-media">
      <div class="pd-back" data-go="${backTo}" role="button" tabindex="0">
        ← Back${p ? ` to ${earrings ? 'Earrings' : 'Rings'}` : ''}
      </div>
      <div class="ph pd-main" data-main>
        ${main
          ? `<img src="${esc(main.url)}" alt="${esc(main.alt)}" decoding="async">`
          : `<span class="cap">${earrings ? 'Earrings worn, ear crop' : 'Main product'} on white · 532 × 532 px</span>`}
      </div>
      <div class="pd-thumbs">
        ${(p && p.images.length ? p.images : [null, null, null, null]).slice(0, 4).map((img, i) => `
          <div class="ph${i === 0 ? ' is-active' : ''}" ${img ? `data-thumb="${esc(img.url)}"` : ''}>
            ${img ? `<img src="${esc(img.url)}" alt="" loading="lazy">` : ''}
          </div>`).join('')}
      </div>
    </div>

    <div class="pd-info">
      <div class="pd-tag">${esc(p?.tag || (earrings ? 'Earrings' : 'Tag'))}</div>
      <h1 class="pd-name${p ? '' : ' is-empty'}">${esc(p?.name || 'Product name')}</h1>
      <div class="pd-price${p ? '' : ' is-empty'}">${p ? money(p.priceCents) : `${SITE.currency} —`}</div>
      <p class="pd-desc${p ? '' : ' is-empty'}">
        ${esc(p?.description || 'Product description — written per piece in the admin.')}
      </p>

      ${earrings ? `<div class="pd-pair">Sold as a pair · no sizing needed</div>` : ''}

      ${(p?.options || []).map((opt) => `
        <div class="pd-field">
          <div class="pd-label">${esc(opt.label)}</div>
          <select class="pd-select" data-option="${esc(opt.label)}">
            ${(opt.values || []).map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}
          </select>
          ${/size/i.test(opt.label)
            ? `<div class="pd-sizelink" data-go="size" role="button" tabindex="0">Ring Size Guide</div>`
            : ''}
        </div>`).join('')}

      ${!p ? `
        <div class="pd-field">
          <div class="pd-label">${earrings ? 'Finish (optional)' : 'Option (e.g. size)'}</div>
          <div class="pd-select" style="color:var(--ghost)">${earrings ? 'Silver / Vermeil' : 'Select'} ▾</div>
          ${earrings ? '' : `<div class="pd-sizelink" data-go="size" role="button" tabindex="0">Ring Size Guide</div>`}
        </div>` : ''}

      ${soldOut ? `<div class="pd-hygiene" style="margin:0 0 22px">
        This piece is sold out. <span class="ul" data-go="${earrings ? 'earrings' : 'rings'}">See what else is available</span>.
      </div>` : ''}

      <div class="pd-field">
        <div class="pd-label">Quantity</div>
        <div class="qty">
          <button type="button" data-qty="-1" aria-label="Decrease quantity">−</button>
          <span data-qty-val>1</span>
          <button type="button" data-qty="1" aria-label="Increase quantity">＋</button>
        </div>
      </div>

      <div class="pd-actions">
        <button class="btn" type="button" data-buy="${esc(p?.slug || '')}" ${buyable ? '' : 'disabled'}>
          ${soldOut ? 'Sold out' : 'Add to Bag'}
        </button>
        <button class="btn-ghost" type="button" data-buy-now="${esc(p?.slug || '')}" ${buyable ? '' : 'disabled'}>Buy Now</button>
      </div>

      ${earrings ? `
        <div class="pd-hygiene">
          For hygiene reasons, earrings can only be returned or exchanged if unopened and
          unworn. Faulty or misdescribed earrings remain covered by applicable consumer rights.
        </div>` : ''}

      <div class="pd-spec">
        <h3>Specifications</h3>
        ${specs.map(([k, v]) => `
          <div class="pd-spec-row"><span>${esc(k)}</span><span>${esc(v || '—')}</span></div>`).join('')}
      </div>

      <p class="pd-note">
        Complimentary delivery${earrings ? '' : ' · 30-day returns'} · lifetime craftsmanship warranty
      </p>
    </div>
  </div>

  <div class="section-head rule-t" style="padding:76px var(--pad) 30px">
    <div class="eb" style="margin-bottom:16px">${earrings ? 'Pairs Well With' : 'For You'}</div>
    <h2 class="sec" style="font-size:30px">${earrings ? 'More earrings' : 'You may also like'}</h2>
  </div>
  <div class="prod-grid" style="padding-bottom:90px">
    ${row(related.filter((r) => !p || r.id !== p.id).slice(0, 4), 4, { shape: '1', showWish: false })}
  </div>`;
}

/* ---------- Checkout --------------------------------------------------------- */

const FIELDS = [
  ['email',        'Email',                  'email',  true,  true ],
  ['full_name',    'Full name',              'text',   true,  true ],
  ['phone',        'Phone',                  'tel',    true,  false],
  ['postcode',     'Postcode',               'text',   true,  false],
  ['address',      'Address',                'text',   true,  true ],
  ['city_state',   'City / State',           'text',   true,  true ],
  ['gift_message', 'Gift message (optional)','area',   false, true ]
];

export function checkout() {
  const bag = getBag();
  const sub = bagSubtotal();

  return `
  <div class="co-bar">
    <span class="logo" data-go="home" style="cursor:pointer">HELORA</span>
    <span class="sec-note">Secure Checkout · Encrypted</span>
  </div>
  <form class="co" data-checkout novalidate>
    <div class="co-form">
      <h2>Shipping &amp; contact details</h2>
      <p class="co-lead">
        We deliver within ${esc(SITE.ships)}. Every order includes tracking, usually sent by email.
      </p>

      <div class="f-grid">
        ${FIELDS.map(([name, label, type, required, full]) => `
          <div class="f${full ? ' full' : ''}" data-field="${name}">
            <label for="f-${name}">${esc(label)}</label>
            ${type === 'area'
              ? `<textarea id="f-${name}" name="${name}" rows="3"></textarea>`
              : `<input id="f-${name}" name="${name}" type="${type}"${required ? ' required' : ''}
                        autocomplete="${name === 'email' ? 'email' : name === 'full_name' ? 'name'
                          : name === 'phone' ? 'tel' : name === 'postcode' ? 'postal-code'
                          : name === 'address' ? 'street-address' : 'address-level2'}">`}
            <div class="err" hidden></div>
          </div>`).join('')}
      </div>

      <div class="pay-head">Payment</div>
      <div role="radiogroup" aria-label="Payment method">
        ${PAY_METHODS.map((m, i) => `
          <button class="pay-opt${i === 0 ? ' is-on' : ''}" type="button" role="radio"
                  aria-checked="${i === 0}" data-pay="${m.id}">
            <span class="pay-dot"></span>
            <span class="pay-n">${esc(m.name)}</span>
            <span class="pay-m">${esc(m.meta)}</span>
          </button>`).join('')}
      </div>

      <button class="btn" type="submit" style="width:100%;margin-top:26px"${bag.length ? '' : ' disabled'}>
        ${bag.length ? 'Place Order' : 'Your bag is empty'}
      </button>
      <div class="err" data-form-error hidden style="margin-top:12px;color:#a4443a;font:400 13px/1.6 Inter,sans-serif"></div>
      <p class="co-fine">
        Payments are handled by our payment providers, and we do not store your full card details.
      </p>
    </div>

    <aside class="co-sum">
      <h3>Order Summary</h3>
      ${bag.length ? bag.map((b) => `
        <div class="co-line">
          ${frame(b.image, '', { style: 'width:58px;height:58px' })}
          <div class="co-line-mid">
            <div class="co-line-n">${esc(b.name)}</div>
            <div class="co-line-m">${b.option ? esc(b.option) + ' · ' : ''}×${b.qty}</div>
          </div>
          <div class="co-line-p">${money((b.priceCents || 0) * b.qty)}</div>
        </div>`).join('')
        : `<p class="p" style="font-size:14px">Your bag is empty. <span class="ul" data-go="all">Browse the collection</span>.</p>`}

      <div class="co-promo">
        <input placeholder="Discount code" aria-label="Discount code">
        <button type="button" data-promo>Apply</button>
      </div>

      <div class="co-sub">
        <div class="co-sub-row"><span>Subtotal</span><span>${money(sub)}</span></div>
        <div class="co-sub-row"><span>Delivery</span><span>Complimentary</span></div>
        <div class="co-sub-row"><span>Presentation</span><span>Included</span></div>
      </div>
      <div class="co-total"><span>Total</span><span>${money(sub)}</span></div>
      <p class="co-badges">
        Complimentary delivery on all accepted orders · 30-day returns ·
        Limited Lifetime Craftsmanship Warranty
      </p>
    </aside>
  </form>`;
}

/* ---------- Confirmation ------------------------------------------------------ */

export function confirmed(order) {
  const method = PAY_METHODS.find((m) => m.id === order?.payment_method);
  const items  = order?.items || [];
  const steps  = ['Paid', 'Preparing', 'Shipped', 'Delivered'];
  const at     = Math.max(0, steps.findIndex((s) => s.toLowerCase() === (order?.status || 'paid')));

  return `
  <div class="cf-head">
    <div class="tag">${order ? 'Payment Received' : 'Order'}</div>
    <h1>Thank you.</h1>
    <p class="p" style="max-width:48ch;margin:0 auto">
      Your order is confirmed. Once your order ships, we’ll send tracking details by email.
    </p>
  </div>

  <div class="cf-meta">
    <div><div class="k">Order</div><div class="v">${esc(order?.order_no || '—')}</div></div>
    <div><div class="k">Paid with</div><div class="v">${esc(method?.name || '—')}</div></div>
    <div><div class="k">Reference</div><div class="v">${esc(order?.reference || order?.order_no || '—')}</div></div>
    <div><div class="k">Total</div><div class="v">${order ? money(order.total_cents) : `${SITE.currency} —`}</div></div>
  </div>

  <div class="steps">
    ${steps.map((s, i) => `
      ${i ? '<span class="step-bar"></span>' : ''}
      <span class="step${i <= at ? ' is-on' : ''}"><span class="dot"></span>${s}</span>`).join('')}
  </div>

  ${items.length ? `
    <div class="wrap" style="max-width:640px;margin:0 auto;padding-bottom:20px">
      ${items.map((i) => `
        <div class="co-line">
          ${frame(i.image, '', { style: 'width:58px;height:58px' })}
          <div class="co-line-mid">
            <div class="co-line-n">${esc(i.name)}</div>
            <div class="co-line-m">${i.option ? esc(i.option) + ' · ' : ''}×${i.qty}</div>
          </div>
          <div class="co-line-p">${money((i.unit_price_cents || 0) * i.qty)}</div>
        </div>`).join('')}
    </div>` : ''}

  <div class="center" style="padding:36px var(--pad) 90px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
    <button class="btn-ghost" type="button" data-go="shipping">Track Your Order</button>
    <button class="btn" type="button" data-go="all">Continue Shopping</button>
  </div>`;
}
