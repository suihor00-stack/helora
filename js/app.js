/* ==========================================================================
   HELORA — the app itself
   Draws the header and footer, decides which page to show based on the URL,
   and handles every click. Start reading at go() and render() near the bottom.
   ========================================================================== */

import { SITE, COLS, COLLECTIONS, isConfigured } from './config.js';
import { esc, money, frame, reveals, wireAccordion } from './ui.js';
import { getProduct, priceBag, placeOrder, trackOrder } from './data.js';
import * as shop from './views-shop.js';
import * as page from './views-content.js';
import {
  getBag, addToBag, removeFromBag, setQty, clearBag,
  bagCount, bagSubtotal, syncBagPrices, toggleWish, onChange
} from './store.js';

/* ---------- app state ------------------------------------------------------ */

const state = {
  route: 'home',
  param: '',
  bagOpen: false,
  searchOpen: false,
  query: '',
  toast: false,
  pay: 'duitnow',
  qty: 1,
  order: null
};

let toastTimer = null;

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const CONTENT_ROUTES = {
  story: page.story, craft: page.craft, size: page.size, faq: page.faq,
  shipping: page.shipping, care: page.care, returns: page.returns,
  contact: page.contact, legal: page.legal
};

const isCollection = (r) => r === 'all' || !!COLS[r];

/* ---------- header ---------------------------------------------------------- */

function header() {
  const n = bagCount();
  return `
  <div class="hd">
    <div class="hd-ticker">Complimentary Delivery · 30-Day Returns · Lifetime Craftsmanship Warranty</div>
    <div class="hd-bar">
      <button class="hd-burger" type="button" data-burger aria-label="Menu" aria-expanded="false">☰</button>
      <nav class="hd-left" id="hd-left">
        <div class="hd-shop" data-shop>
          <span class="ul hd-shop-t" role="button" tabindex="0" aria-expanded="false">Shop <span>▾</span></span>
          <div class="hd-menu" hidden>
            <div class="hd-menu-in">
              <span class="ul" data-go="rings">Rings</span>
              <span class="ul" data-go="earrings">Earrings</span>
              <span class="ul" data-go="all">Shop All</span>
            </div>
          </div>
        </div>
        <span class="ul" data-go="newin">New Arrivals</span>
        <span class="ul" data-go="story">About</span>
      </nav>
      <div class="hd-logo" data-go="home" role="button" tabindex="0">HELORA</div>
      <div class="hd-right">
        <span class="ul" data-search role="button" tabindex="0">Search</span>
        <span class="ul cur">${esc(SITE.currency)}</span>
        <span class="ul" data-bag role="button" tabindex="0">Bag (${n})</span>
      </div>
    </div>
  </div>`;
}

/* ---------- footer ---------------------------------------------------------- */

const FT_COLS = [
  ['Shop',  [['rings', 'Rings'], ['earrings', 'Earrings'], ['newin', 'New Arrivals'], ['all', 'Shop All']]],
  ['About', [['story', 'Our Story'], ['craft', 'Craftsmanship'], ['care', 'Jewelry Care']]],
  ['Help',  [['shipping', 'Shipping'], ['returns', 'Returns'], ['returns', 'Warranty'],
             ['size', 'Ring Size Guide'], ['faq', 'FAQ'], ['contact', 'Contact']]],
  ['Legal', [['legal', 'Privacy Policy'], ['legal', 'Terms & Conditions'],
             ['legal', 'Refund Policy'], ['legal', 'Accessibility']]]
];

const PROMISES = [
  ['Complimentary Delivery', `On all accepted orders, within ${SITE.ships}.`],
  ['30-Day Returns',         '30 days from the date you receive your order.'],
  ['Lifetime Warranty',      'Lifetime coverage for eligible craftsmanship defects.'],
  ['Thoughtful Presentation','Considered from the moment it arrives.']
];

const footer = () => `
  <div class="ft">
    <div class="ft-promises">
      ${PROMISES.map(([t, d]) => `<div><div class="t">${esc(t)}</div><div class="d">${esc(d)}</div></div>`).join('')}
    </div>
    <div class="ft-main">
      <div class="ft-brand">
        <div class="n">${esc(SITE.name)}</div>
        <div class="d">${esc(SITE.tagline)}<br>${esc(SITE.blurb)}</div>
      </div>
      ${FT_COLS.map(([h, links]) => `
        <div>
          <div class="fh">${esc(h)}</div>
          <div class="fc">
            ${links.map(([r, l]) => `<button class="fl" type="button" data-go="${r}">${esc(l)}</button>`).join('')}
          </div>
        </div>`).join('')}
    </div>
    <div class="ft-base"><span>© ${SITE.year} ${esc(SITE.name)}</span><span>${esc(SITE.madeIn)}</span></div>
  </div>`;

/* ---------- search ----------------------------------------------------------- */

const PAGE_INDEX = [
  ['Our Story',               'story',    'Page',       'about brand story helora aura'],
  ['Craftsmanship',           'craft',    'Page',       'craft made materials quality process'],
  ['Ring Size Guide',         'size',     'Guide',      'ring size guide measure fit chart mm'],
  ['FAQ',                     'faq',      'Help',       'faq questions help materials sizing delivery returns'],
  ['Shipping & Tracking',     'shipping', 'Help',       'shipping delivery track order courier postage'],
  ['Jewelry Care',            'care',     'Guide',      'care clean storage tarnish silver gold'],
  ['Returns & Warranty',      'returns',  'Help',       'returns refund exchange warranty repair'],
  ['Contact & Appointments',  'contact',  'Help',       'contact email whatsapp appointment'],
  ['Legal',                   'legal',    'Page',       'privacy terms refund cookie accessibility policy'],
  ['Checkout',                'checkout', 'Page',       'checkout pay payment duitnow fpx card wallet paynow']
];

const searchIndex = () => [
  ...COLLECTIONS.map(([slug, title, intro]) => ({ label: title, kind: 'Collection', route: slug, terms: `${title} ${intro}` })),
  ...PAGE_INDEX.map(([label, route, kind, terms]) => ({ label, kind, route, terms }))
];

function searchHits() {
  const q = state.query.trim().toLowerCase();
  const all = searchIndex();
  if (!q) return all.slice(0, 8);
  return all.filter((i) => `${i.label} ${i.terms}`.toLowerCase().includes(q)).slice(0, 10);
}

function searchOverlay() {
  if (!state.searchOpen) return '';
  const hits = searchHits();
  return `
  <div class="ov-scrim" data-close-search></div>
  <div class="search-panel" role="dialog" aria-label="Search">
    <div class="search-row">
      <input type="search" value="${esc(state.query)}" data-q autofocus
             placeholder="Search rings, earrings, guides…" aria-label="Search">
      <span class="ul" data-close-search role="button" tabindex="0"
            style="font:400 10.5px/1 Inter,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:var(--muted)">Close</span>
    </div>
    <div class="search-results">
      ${hits.map((h) => `
        <div class="search-hit" data-go="${h.route}">
          <span class="search-hit-l">${esc(h.label)}</span>
          <span class="search-hit-k">${esc(h.kind)}</span>
        </div>`).join('')}
      ${state.query.trim() && !hits.length
        ? `<div class="search-empty">Nothing matched — try “rings”, “size”, or “shipping”.</div>` : ''}
    </div>
  </div>`;
}

/* ---------- bag drawer -------------------------------------------------------- */

function bagDrawer() {
  if (!state.bagOpen) return '';
  const bag = getBag();
  return `
  <div class="ov-scrim" style="z-index:90" data-close-bag></div>
  <aside class="bag" role="dialog" aria-label="Your bag">
    <div class="bag-hd">
      <h2>Your Bag</h2>
      <button class="bag-close" type="button" data-close-bag aria-label="Close">×</button>
    </div>
    <div class="bag-body">
      ${bag.length ? bag.map((b) => `
        <div class="bag-item">
          ${frame(b.image, '', { style: 'width:62px;height:62px' })}
          <div class="bag-item-mid">
            <div class="bag-item-n">${esc(b.name)}</div>
            <div class="bag-item-m">${b.option ? esc(b.option) + ' · ' : ''}${money(b.priceCents)}</div>
            <div class="qty" style="margin-top:8px;transform:scale(.85);transform-origin:left">
              <button type="button" data-bagqty="-1" data-id="${esc(b.id)}" data-opt="${esc(b.option || '')}"
                      aria-label="Decrease">−</button>
              <span>${b.qty}</span>
              <button type="button" data-bagqty="1" data-id="${esc(b.id)}" data-opt="${esc(b.option || '')}"
                      aria-label="Increase">＋</button>
            </div>
          </div>
          <button class="bag-rm ul" type="button" data-remove="${esc(b.id)}" data-opt="${esc(b.option || '')}">Remove</button>
        </div>`).join('')
        : `<div class="bag-empty">Your bag is empty.</div>`}
    </div>
    <div class="bag-ft">
      <div class="bag-sub"><span>Subtotal</span><span>${money(bagSubtotal())}</span></div>
      <button class="btn" type="button" data-go="checkout"${bag.length ? '' : ' disabled'}>Checkout</button>
      <div class="bag-fine">Free delivery · 30-day returns</div>
    </div>
  </aside>`;
}

const toastEl = () => state.toast && !state.bagOpen
  ? `<div class="toast" data-bag role="status">
       <span>Added to bag</span><span class="ul">View bag</span>
     </div>`
  : '';

/* ---------- routing ------------------------------------------------------------ */

function parseHash() {
  const raw = (location.hash || '').replace(/^#/, '');
  const [route, param = ''] = raw.split('/');
  return { route: route || 'home', param: decodeURIComponent(param) };
}

export function go(route, param = '') {
  const target = param ? `${route}/${encodeURIComponent(param)}` : route;
  if (location.hash.replace(/^#/, '') === target) { render(); return; }
  location.hash = target;   // triggers hashchange -> render()
}

async function pageHTML() {
  const { route, param } = state;

  if (route === 'home')       return shop.home();
  if (isCollection(route))    return shop.collection(route);
  if (route === 'product')    return shop.product(param, 'ring');
  if (route === 'producte')   return shop.product(param, 'earrings');
  if (route === 'checkout')   return shop.checkout();
  if (route === 'confirmed')  return shop.confirmed(state.order);
  if (CONTENT_ROUTES[route])  return CONTENT_ROUTES[route]();

  return `
    <div class="pg-head center" style="padding:120px var(--pad)">
      <div class="eb">404</div>
      <h1 class="ti">Page not found</h1>
      <p class="p">That link doesn’t lead anywhere. <span class="ul" data-go="home">Back to the homepage</span>.</p>
    </div>`;
}

/* ---------- render -------------------------------------------------------------- */

let renderToken = 0;

async function render() {
  const token = ++renderToken;

  const parsed = parseHash();
  state.route = parsed.route;
  state.param = parsed.param;
  state.qty = 1;

  $('#hd').innerHTML = header();
  $('#ft').innerHTML = footer();

  const main = $('#main');
  main.setAttribute('aria-busy', 'true');

  const html = await pageHTML();
  if (token !== renderToken) return;          // a newer navigation won the race

  main.innerHTML = `<div class="page">${html}</div>`;
  main.removeAttribute('aria-busy');

  $('#overlays').innerHTML = searchOverlay() + bagDrawer() + toastEl();

  document.title = pageTitle();
  reveals(main);
  wireAccordion(main);

  const q = $('[data-q]');
  if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
}

function pageTitle() {
  const { route } = state;
  const name = route === 'home' ? SITE.tagline
    : isCollection(route) ? (route === 'all' ? 'Shop All' : COLS[route][0])
    : { product: 'Product', producte: 'Product', checkout: 'Checkout', confirmed: 'Order confirmed',
        story: 'Our Story', craft: 'Craftsmanship', size: 'Ring Size Guide', faq: 'FAQ',
        shipping: 'Shipping', care: 'Jewelry Care', returns: 'Returns & Exchanges',
        contact: 'Contact', legal: 'Legal' }[route] || 'Not found';
  return `${SITE.name} — ${name}`;
}

/** Redraws only the overlays + header count, without rebuilding the page. */
function paintChrome() {
  $('#hd').innerHTML = header();
  $('#overlays').innerHTML = searchOverlay() + bagDrawer() + toastEl();
  const q = $('[data-q]');
  if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
}

function showToast() {
  state.toast = true;
  paintChrome();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { state.toast = false; paintChrome(); }, 2600);
}

/* ---------- adding to the bag ---------------------------------------------------- */

async function addBySlug(slug, { qty = 1, option = '', then = null } = {}) {
  const p = await getProduct(slug);
  if (!p) return;

  // Quick Add can't guess a ring size, so send them to the product page to pick.
  if (!option && p.options.length) {
    go('product', p.slug);
    return;
  }

  addToBag({
    id: p.id, name: p.name, slug: p.slug,
    priceCents: p.priceCents,
    image: p.images[0] ? p.images[0].url : null,
    option
  }, qty);
  if (then) then(); else showToast();
}

/** Reads every option dropdown on a product page, e.g. "Size 12 · Silver". */
function chosenOption() {
  return $$('[data-option]').map((sel) => sel.value).filter(Boolean).join(' · ');
}

/**
 * A ring without a size isn't a real order line, so the bag stays shut until
 * every required dropdown has been answered.
 */
function optionsChosen() {
  const required = $$('[data-option][data-required]');
  const missing  = required.filter((sel) => !sel.value);
  const warn     = $('[data-option-warn]');
  if (warn) warn.hidden = missing.length === 0;
  if (missing.length) {
    missing[0].focus();
    return false;
  }
  return true;
}

/* ---------- events ---------------------------------------------------------------- */

function wireGlobalEvents() {
  // Keyboard: let Enter/Space activate the span-based buttons from the design.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.searchOpen || state.bagOpen) {
        state.searchOpen = false; state.bagOpen = false; paintChrome();
      }
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][tabindex="0"]')) {
      e.preventDefault();
      e.target.click();
    }
  });

  document.addEventListener('click', async (e) => {
    const hit = (sel) => e.target.closest(sel);

    /* navigation ------------------------------------------------------------- */
    const nav = hit('[data-go]');
    if (nav) {
      e.preventDefault();
      state.searchOpen = false;
      state.bagOpen = false;
      state.query = '';
      go(nav.dataset.go);
      return;
    }

    const wish = hit('[data-wish]');
    if (wish) {
      const on = toggleWish(wish.dataset.wish);
      wish.textContent = on ? '♥' : '♡';
      wish.setAttribute('aria-pressed', String(on));
      return;
    }

    const prod = hit('[data-product]');
    if (prod) { go('product', prod.dataset.product); return; }

    /* overlays --------------------------------------------------------------- */
    if (hit('[data-search]'))       { state.searchOpen = true; state.query = ''; paintChrome(); return; }
    if (hit('[data-close-search]')) { state.searchOpen = false; state.query = ''; paintChrome(); return; }
    if (hit('[data-bag]'))          { state.bagOpen = true; state.toast = false; await refreshBag(); return; }
    if (hit('[data-close-bag]'))    { state.bagOpen = false; paintChrome(); return; }
    if (hit('[data-admin]'))        { location.href = './admin.html'; return; }

    /* header menus ------------------------------------------------------------ */
    const burger = hit('[data-burger]');
    if (burger) {
      const nav2 = $('#hd-left');
      const open = nav2.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
      return;
    }
    const shopT = hit('.hd-shop-t');
    if (shopT) {
      const menu = $('.hd-menu');
      const open = menu.hasAttribute('hidden');
      menu.toggleAttribute('hidden', !open);
      shopT.setAttribute('aria-expanded', String(open));
      return;
    }

    /* bag ---------------------------------------------------------------------- */
    const rm = hit('[data-remove]');
    if (rm) { removeFromBag(rm.dataset.remove, rm.dataset.opt || ''); paintChrome(); return; }

    const bq = hit('[data-bagqty]');
    if (bq) {
      const bag = getBag();
      const item = bag.find((b) => b.id === bq.dataset.id && (b.option || '') === (bq.dataset.opt || ''));
      if (item) setQty(item.id, item.option || '', item.qty + Number(bq.dataset.bagqty));
      paintChrome();
      return;
    }

    /* product page ------------------------------------------------------------- */
    const qb = hit('[data-qty]');
    if (qb) {
      state.qty = Math.max(1, state.qty + Number(qb.dataset.qty));
      $('[data-qty-val]').textContent = state.qty;
      return;
    }

    const thumb = hit('[data-thumb]');
    if (thumb) {
      const main = $('[data-main]');
      main.innerHTML = `<img src="${esc(thumb.dataset.thumb)}" alt="">`;
      $$('.pd-thumbs .ph').forEach((t) => t.classList.remove('is-active'));
      thumb.classList.add('is-active');
      return;
    }

    const quick = hit('[data-add]');
    if (quick) { await addBySlug(quick.dataset.add); return; }

    const buy = hit('[data-buy]');
    if (buy && buy.dataset.buy) {
      if (!optionsChosen()) return;
      await addBySlug(buy.dataset.buy, { qty: state.qty, option: chosenOption() });
      return;
    }

    const buyNow = hit('[data-buy-now]');
    if (buyNow && buyNow.dataset.buyNow) {
      if (!optionsChosen()) return;
      await addBySlug(buyNow.dataset.buyNow, {
        qty: state.qty, option: chosenOption(), then: () => go('checkout')
      });
      return;
    }

    /* checkout ------------------------------------------------------------------ */
    const pay = hit('[data-pay]');
    if (pay) {
      state.pay = pay.dataset.pay;
      $$('.pay-opt').forEach((o) => {
        const on = o === pay;
        o.classList.toggle('is-on', on);
        o.setAttribute('aria-checked', String(on));
      });
      return;
    }

    if (hit('[data-promo]')) {
      const box = hit('[data-promo]').closest('.co-promo').querySelector('input');
      box.value = '';
      box.placeholder = 'No active codes right now';
      return;
    }

    /* in-page jumps (returns / legal side nav) ----------------------------------- */
    const jump = hit('[data-jump]');
    if (jump) {
      const target = document.getElementById(`r-${jump.dataset.jump}`);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      $$('.side-nav button').forEach((b) => b.classList.toggle('is-on', b === jump));
      return;
    }
  });

  // Choosing a size clears the warning straight away.
  document.addEventListener('change', (e) => {
    if (e.target.matches('[data-option][data-required]') && e.target.value) {
      const warn = $('[data-option-warn]');
      if (warn) warn.hidden = true;
    }
  });

  // Live search typing
  document.addEventListener('input', (e) => {
    if (e.target.matches('[data-q]')) {
      state.query = e.target.value;
      const box = $('.search-results');
      const hits = searchHits();
      box.innerHTML = hits.map((h) => `
        <div class="search-hit" data-go="${h.route}">
          <span class="search-hit-l">${esc(h.label)}</span>
          <span class="search-hit-k">${esc(h.kind)}</span>
        </div>`).join('')
        + (state.query.trim() && !hits.length
            ? `<div class="search-empty">Nothing matched — try “rings”, “size”, or “shipping”.</div>` : '');
    }
  });

  document.addEventListener('submit', onSubmit);
  addEventListener('hashchange', render);
  onChange(() => { const el = $('.hd-right [data-bag]'); if (el) el.textContent = `Bag (${bagCount()})`; });
}

/* ---------- forms ------------------------------------------------------------------- */

async function onSubmit(e) {
  /* Track your order (Shipping page) */
  if (e.target.matches('[data-track]')) {
    e.preventDefault();
    const wrap = e.target.parentElement;
    const out  = wrap.querySelector('.track-out');
    const no    = e.target.querySelector('[name=order_no]').value.trim();
    const email = wrap.querySelector('.track-email').value.trim();
    if (!no || !email) { out.textContent = 'Enter both your order number and the email you used.'; return; }
    out.textContent = 'Looking that up…';
    try {
      const r = await trackOrder(no, email);
      out.textContent = r && r.status
        ? `Order ${r.order_no} — ${r.status}. Placed ${new Date(r.created_at).toLocaleDateString(SITE.locale)}.`
        : 'We couldn’t find an order with those details.';
    } catch (err) {
      out.textContent = err.message;
    }
    return;
  }

  /* Checkout */
  if (e.target.matches('[data-checkout]')) {
    e.preventDefault();
    const form = e.target;
    const err  = form.querySelector('[data-form-error]');
    err.hidden = true;

    const data = Object.fromEntries(new FormData(form).entries());
    let bad = false;

    form.querySelectorAll('[data-field]').forEach((f) => {
      const input = f.querySelector('input, textarea');
      const msg   = f.querySelector('.err');
      let problem = '';
      if (input.required && !input.value.trim()) problem = 'This one’s needed.';
      else if (input.type === 'email' && input.value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.value))
        problem = 'That email doesn’t look right.';
      f.classList.toggle('is-bad', !!problem);
      msg.textContent = problem;
      msg.hidden = !problem;
      if (problem) bad = true;
    });
    if (bad) { form.querySelector('.is-bad input, .is-bad textarea')?.focus(); return; }

    const bag = getBag();
    if (!bag.length) { err.textContent = 'Your bag is empty.'; err.hidden = false; return; }

    const btn = form.querySelector('button[type=submit]');
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Placing your order…';

    try {
      const order = await placeOrder({ customer: data, items: bag, paymentMethod: state.pay });
      state.order = {
        ...order,
        payment_method: state.pay,
        items: order.items || bag.map((b) => ({
          name: b.name, option: b.option, qty: b.qty, unit_price_cents: b.priceCents, image: b.image
        }))
      };
      try { sessionStorage.setItem('helora.order', JSON.stringify(state.order)); } catch {}
      clearBag();
      go('confirmed');
    } catch (e2) {
      err.textContent = e2.message;
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = label;
    }
  }
}

/* ---------- bag price refresh ---------------------------------------------------------- */

async function refreshBag() {
  paintChrome();
  const ids = [...new Set(getBag().map((b) => b.id))];
  if (!ids.length) return;
  const prices = await priceBag(ids);
  syncBagPrices(prices);
  if (state.bagOpen) paintChrome();
}

/* ---------- start ------------------------------------------------------------------------ */

function setupNotice() {
  if (isConfigured()) return;
  $('#notice').innerHTML = `
    <div class="banner">
      This site isn’t connected to its database yet — products and checkout are switched off.
      Add your Supabase URL and key in <code>js/config.js</code>. See <code>CLAUDE.md</code> for the steps.
    </div>`;
}

async function boot() {
  setupNotice();
  try {
    const saved = sessionStorage.getItem('helora.order');
    if (saved) state.order = JSON.parse(saved);
  } catch {}

  wireGlobalEvents();
  await render();
  refreshBag();
}

boot();
