/* ==========================================================================
   HELORA — admin
   Sign in, then add and edit the pieces that show up on the site.
   Talks to Supabase over plain HTTPS, same as the shop.
   ========================================================================== */

import { SUPABASE_URL, SUPABASE_ANON_KEY, COLLECTIONS, SITE, isConfigured } from './config.js';
import { esc, slugify } from './ui.js';

const KEY = 'helora.admin.session';
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

let session = null;
let products = [];
let editing = null;

/* ---------- session -------------------------------------------------------- */

function loadSession() {
  try { session = JSON.parse(localStorage.getItem(KEY)); } catch { session = null; }
  if (session && session.expires_at && session.expires_at * 1000 < Date.now() + 30000) session = null;
  return session;
}
const saveSession = (s) => {
  session = s;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
};
const dropSession = () => {
  session = null;
  try { localStorage.removeItem(KEY); } catch {}
};

const authHeaders = () => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${session ? session.access_token : SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json'
});

async function call(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) }
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const msg = (body && (body.message || body.error_description || body.msg || body.error)) ||
                `Request failed (${res.status})`;
    if (res.status === 401) dropSession();
    throw new Error(msg);
  }
  return body;
}

const rest = (p, o) => call(`/rest/v1/${p}`, o);

/* ---------- sign in --------------------------------------------------------- */

async function signIn(email, password) {
  const r = await call('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  saveSession(r);
}

async function signUp(email, password) {
  await call('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email, password }) });
}

/* ---------- data ------------------------------------------------------------- */

const SELECT = '*,product_images(id,url,alt,sort_order),product_collections(collection_slug)';

async function loadProducts() {
  products = await rest(`products?select=${SELECT}&order=sort_order.asc,created_at.desc`);
}

async function saveProduct(form) {
  const body = {
    slug:        form.slug,
    name:        form.name,
    tag:         form.tag,
    description: form.description,
    price_cents: form.price_cents,
    kind:        form.kind,
    material:    form.material,
    finish:      form.finish,
    dimensions:  form.dimensions,
    weight:      form.weight,
    sku:         form.sku,
    options:     form.options,
    in_stock:    form.in_stock,
    is_active:   form.is_active,
    is_new:      form.is_new,
    is_pick:     form.is_pick,
    sort_order:  form.sort_order,
    updated_at:  new Date().toISOString()
  };

  let row;
  if (editing) {
    row = (await rest(`products?id=eq.${editing}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body)
    }))[0];
  } else {
    row = (await rest('products', {
      method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body)
    }))[0];
  }

  // Reset this product's collections, then add the ticked ones back.
  await rest(`product_collections?product_id=eq.${row.id}`, { method: 'DELETE' });
  if (form.collections.length) {
    await rest('product_collections', {
      method: 'POST',
      body: JSON.stringify(form.collections.map((c) => ({ product_id: row.id, collection_slug: c })))
    });
  }
  return row;
}

async function deleteProduct(id) {
  await rest(`products?id=eq.${id}`, { method: 'DELETE' });
}

async function uploadImage(productId, file, order) {
  const clean = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
  const path  = `${productId}/${Date.now()}-${clean}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/product-images/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true'
    },
    body: file
  });
  if (!res.ok) throw new Error(`Could not upload ${file.name}`);

  const url = `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`;
  await rest('product_images', {
    method: 'POST',
    body: JSON.stringify({ product_id: productId, url, alt: '', sort_order: order })
  });
  return url;
}

const deleteImage = (id) => rest(`product_images?id=eq.${id}`, { method: 'DELETE' });

/* ---------- screens ---------------------------------------------------------- */

function loginScreen(message = '') {
  $('#app').innerHTML = `
    <div class="a-center">
      <div class="a-card" style="max-width:400px">
        <div class="a-logo">HELORA</div>
        <h1 class="a-h1">Shop admin</h1>
        ${message ? `<div class="a-msg">${esc(message)}</div>` : ''}
        <form data-login>
          <label class="a-l" for="em">Email</label>
          <input class="a-i" id="em" name="email" type="email" required autocomplete="username">
          <label class="a-l" for="pw">Password</label>
          <input class="a-i" id="pw" name="password" type="password" required
                 autocomplete="current-password" minlength="6">
          <div class="a-err" hidden></div>
          <button class="btn" type="submit" style="width:100%;margin-top:18px">Sign in</button>
          <button class="a-link" type="button" data-signup>First time? Create the account</button>
        </form>
      </div>
    </div>`;
}

function listScreen() {
  $('#app').innerHTML = `
    <div class="a-bar">
      <span class="a-logo">HELORA</span>
      <span class="a-bar-r">
        <a class="a-link" href="./index.html" target="_blank" rel="noopener">View shop ↗</a>
        <button class="a-link" type="button" data-signout>Sign out</button>
      </span>
    </div>
    <div class="a-wrap">
      <div class="a-head">
        <h1 class="a-h1">Pieces <span class="a-count">${products.length}</span></h1>
        <button class="btn" type="button" data-new>Add a piece</button>
      </div>
      <div class="a-err" data-list-error hidden></div>
      ${products.length ? `
        <table class="a-table">
          <thead>
            <tr><th></th><th>Name</th><th>Price</th><th>Collections</th><th>Shows in</th><th></th></tr>
          </thead>
          <tbody>
            ${products.map((p) => {
              const img = (p.product_images || []).sort((a, b) => a.sort_order - b.sort_order)[0];
              const cols = (p.product_collections || []).map((c) => c.collection_slug);
              return `
              <tr>
                <td>${img ? `<img class="a-thumb" src="${esc(img.url)}" alt="">`
                          : `<div class="a-thumb a-thumb-empty"></div>`}</td>
                <td>
                  <div class="a-name">${esc(p.name)}</div>
                  <div class="a-sub">${esc(p.slug)}${p.is_active ? '' : ' · hidden'}</div>
                </td>
                <td>${SITE.currency} ${(p.price_cents / 100).toFixed(2)}</td>
                <td class="a-sub">${cols.length ? esc(cols.join(', ')) : '—'}</td>
                <td class="a-sub">${[p.is_new && 'New', p.is_pick && 'Picks'].filter(Boolean).join(', ') || '—'}</td>
                <td class="a-right">
                  <button class="a-link" type="button" data-edit="${esc(p.id)}">Edit</button>
                  <button class="a-link a-danger" type="button" data-del="${esc(p.id)}">Delete</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>`
        : `<div class="a-empty">
             No pieces yet. Add your first one and it appears on the shop straight away.
           </div>`}
    </div>`;
}

function editScreen(p) {
  editing = p ? p.id : null;
  const cols = p ? (p.product_collections || []).map((c) => c.collection_slug) : [];
  const sizes = p ? ((p.options || []).find((o) => /size/i.test(o.label))?.values || []).join(', ') : '';
  const imgs = p ? (p.product_images || []).slice().sort((a, b) => a.sort_order - b.sort_order) : [];

  $('#app').innerHTML = `
    <div class="a-bar">
      <span class="a-logo">HELORA</span>
      <span class="a-bar-r"><button class="a-link" type="button" data-back>← All pieces</button></span>
    </div>
    <div class="a-wrap">
      <h1 class="a-h1">${p ? 'Edit piece' : 'Add a piece'}</h1>
      <form data-product-form>
        <div class="a-grid">
          <div class="a-f a-full">
            <label class="a-l" for="name">Name</label>
            <input class="a-i" id="name" name="name" required value="${esc(p?.name || '')}">
          </div>
          <div class="a-f">
            <label class="a-l" for="slug">Web address (leave blank to fill in)</label>
            <input class="a-i" id="slug" name="slug" value="${esc(p?.slug || '')}" placeholder="rose-gold-band">
          </div>
          <div class="a-f">
            <label class="a-l" for="price">Price in ${esc(SITE.currency)}</label>
            <input class="a-i" id="price" name="price" type="number" step="0.01" min="0" required
                   value="${p ? (p.price_cents / 100).toFixed(2) : ''}">
          </div>
          <div class="a-f">
            <label class="a-l" for="kind">Type</label>
            <select class="a-i" id="kind" name="kind">
              ${['ring', 'earrings', 'other'].map((k) =>
                `<option value="${k}"${p?.kind === k ? ' selected' : ''}>${k}</option>`).join('')}
            </select>
          </div>
          <div class="a-f">
            <label class="a-l" for="tag">Small label above the name</label>
            <input class="a-i" id="tag" name="tag" value="${esc(p?.tag || '')}" placeholder="Rings">
          </div>
          <div class="a-f a-full">
            <label class="a-l" for="description">Description</label>
            <textarea class="a-i" id="description" name="description" rows="4">${esc(p?.description || '')}</textarea>
          </div>

          ${[['material', 'Material', '925 sterling silver'],
             ['finish', 'Finish', '18K gold vermeil'],
             ['dimensions', 'Dimensions', '2.4 mm band'],
             ['weight', 'Weight', '2.1 g'],
             ['sku', 'SKU', 'HEL-R-001']].map(([n, l, ph]) => `
            <div class="a-f">
              <label class="a-l" for="${n}">${l}</label>
              <input class="a-i" id="${n}" name="${n}" value="${esc(p?.[n] || '')}" placeholder="${ph}">
            </div>`).join('')}

          <div class="a-f">
            <label class="a-l" for="sizes">Sizes, separated by commas</label>
            <input class="a-i" id="sizes" name="sizes" value="${esc(sizes)}" placeholder="9, 10, 11, 12">
          </div>
          <div class="a-f">
            <label class="a-l" for="sort_order">Sort order (lower shows first)</label>
            <input class="a-i" id="sort_order" name="sort_order" type="number" value="${p?.sort_order ?? 0}">
          </div>

          <div class="a-f a-full">
            <div class="a-l">Collections</div>
            <div class="a-checks">
              ${COLLECTIONS.filter(([s]) => s !== 'newin' && s !== 'picks').map(([s, t]) => `
                <label class="a-check">
                  <input type="checkbox" name="col" value="${s}"${cols.includes(s) ? ' checked' : ''}>
                  <span>${esc(t)}</span>
                </label>`).join('')}
            </div>
          </div>

          <div class="a-f a-full">
            <div class="a-l">Where it shows</div>
            <div class="a-checks">
              <label class="a-check"><input type="checkbox" name="is_new"${p?.is_new ? ' checked' : ''}><span>New Arrivals</span></label>
              <label class="a-check"><input type="checkbox" name="is_pick"${p?.is_pick ? ' checked' : ''}><span>HELORA Picks</span></label>
              <label class="a-check"><input type="checkbox" name="in_stock"${p === null || p?.in_stock !== false ? ' checked' : ''}><span>In stock</span></label>
              <label class="a-check"><input type="checkbox" name="is_active"${p === null || p?.is_active !== false ? ' checked' : ''}><span>Visible on the shop</span></label>
            </div>
          </div>
        </div>

        <div class="a-photos">
          <div class="a-l">Photos</div>
          ${p ? `
            <div class="a-imgs">
              ${imgs.map((i) => `
                <div class="a-img">
                  <img src="${esc(i.url)}" alt="">
                  <button class="a-x" type="button" data-delimg="${esc(i.id)}" aria-label="Remove photo">×</button>
                </div>`).join('')}
              <label class="a-add">
                <input type="file" accept="image/*" multiple hidden data-upload>
                <span>+ Add photos</span>
              </label>
            </div>
            <p class="a-sub">The first photo is the main one. The second shows on hover.</p>`
          : `<p class="a-sub">Save the piece first, then you can add photos.</p>`}
        </div>

        <div class="a-err" hidden></div>
        <div class="a-actions">
          <button class="btn" type="submit">${p ? 'Save changes' : 'Create piece'}</button>
          <button class="a-link" type="button" data-back>Cancel</button>
        </div>
      </form>
    </div>`;
}

/* ---------- wiring ------------------------------------------------------------- */

function readForm(form) {
  const g = (n) => (form.querySelector(`[name=${n}]`)?.value || '').trim();
  const c = (n) => !!form.querySelector(`[name=${n}]`)?.checked;
  const sizes = g('sizes').split(',').map((s) => s.trim()).filter(Boolean);

  return {
    name:        g('name'),
    slug:        slugify(g('slug') || g('name')),
    tag:         g('tag'),
    description: g('description'),
    price_cents: Math.round(parseFloat(g('price') || '0') * 100),
    kind:        g('kind') || 'ring',
    material:    g('material'),
    finish:      g('finish'),
    dimensions:  g('dimensions'),
    weight:      g('weight'),
    sku:         g('sku'),
    options:     sizes.length ? [{ label: 'Size', values: sizes }] : [],
    sort_order:  parseInt(g('sort_order') || '0', 10) || 0,
    in_stock:    c('in_stock'),
    is_active:   c('is_active'),
    is_new:      c('is_new'),
    is_pick:     c('is_pick'),
    collections: $$('[name=col]:checked', form).map((i) => i.value)
  };
}

const showError = (el, msg) => { el.textContent = msg; el.hidden = false; };

async function refresh() {
  try {
    await loadProducts();
    listScreen();
  } catch (err) {
    if (!session) return loginScreen('Your session ended. Please sign in again.');
    listScreen();
    showError($('[data-list-error]'), err.message);
  }
}

document.addEventListener('submit', async (e) => {
  const form = e.target;

  if (form.matches('[data-login]')) {
    e.preventDefault();
    const err = form.querySelector('.a-err');
    err.hidden = true;
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      await signIn(form.email.value.trim(), form.password.value);
      await refresh();
    } catch (e2) {
      showError(err, e2.message);
      btn.disabled = false; btn.textContent = 'Sign in';
    }
    return;
  }

  if (form.matches('[data-product-form]')) {
    e.preventDefault();
    const err = form.querySelector('.a-err');
    err.hidden = true;
    const data = readForm(form);
    if (!data.name)  return showError(err, 'Give the piece a name.');
    if (!data.slug)  return showError(err, 'That name needs at least one letter or number.');
    if (Number.isNaN(data.price_cents)) return showError(err, 'Check the price.');

    const btn = form.querySelector('button[type=submit]');
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const row = await saveProduct(data);
      await loadProducts();
      if (!editing) {
        // Straight into edit mode so photos can be added right away.
        editScreen(products.find((p) => p.id === row.id));
      } else {
        listScreen();
      }
    } catch (e2) {
      showError(err, e2.message);
      btn.disabled = false; btn.textContent = label;
    }
  }
});

document.addEventListener('click', async (e) => {
  const hit = (s) => e.target.closest(s);

  if (hit('[data-signup]')) {
    const form = $('[data-login]');
    const err = form.querySelector('.a-err');
    err.hidden = true;
    const email = form.email.value.trim();
    const pw = form.password.value;
    if (!email || pw.length < 6) return showError(err, 'Enter an email and a password of at least 6 characters.');
    try {
      await signUp(email, pw);
      showError(err, 'Account created. Now add yourself to the admins table — the steps are at the bottom of supabase/schema.sql — then sign in.');
    } catch (e2) { showError(err, e2.message); }
    return;
  }

  if (hit('[data-signout]')) { dropSession(); loginScreen(); return; }
  if (hit('[data-new]'))     { editScreen(null); return; }
  if (hit('[data-back]'))    { editing = null; await refresh(); return; }

  const ed = hit('[data-edit]');
  if (ed) { editScreen(products.find((p) => p.id === ed.dataset.edit)); return; }

  const del = hit('[data-del]');
  if (del) {
    const p = products.find((x) => x.id === del.dataset.del);
    if (!confirm(`Delete "${p.name}"? This can't be undone.`)) return;
    try { await deleteProduct(p.id); await refresh(); }
    catch (err) { showError($('[data-list-error]'), err.message); }
    return;
  }

  const di = hit('[data-delimg]');
  if (di) {
    try {
      await deleteImage(di.dataset.delimg);
      await loadProducts();
      editScreen(products.find((p) => p.id === editing));
    } catch (err) { showError($('.a-err'), err.message); }
  }
});

document.addEventListener('change', async (e) => {
  if (!e.target.matches('[data-upload]')) return;
  const files = [...e.target.files];
  if (!files.length) return;
  const label = e.target.closest('.a-add');
  label.querySelector('span').textContent = 'Uploading…';
  try {
    // Keep the order the files were picked in, carrying on from any already there.
    let order = (products.find((p) => p.id === editing)?.product_images || []).length;
    for (const f of files) await uploadImage(editing, f, order++);
    await loadProducts();
    editScreen(products.find((p) => p.id === editing));
  } catch (err) {
    label.querySelector('span').textContent = '+ Add photos';
    showError($('.a-err'), err.message);
  }
});

/* ---------- start ---------------------------------------------------------------- */

(async function start() {
  if (!isConfigured()) {
    $('#app').innerHTML = `
      <div class="a-center">
        <div class="a-card">
          <div class="a-logo">HELORA</div>
          <h1 class="a-h1">Not connected yet</h1>
          <p class="a-sub">
            Open <code>js/config.js</code> and paste in your Supabase URL and anon key,
            then reload this page. The steps are in <code>CLAUDE.md</code>.
          </p>
        </div>
      </div>`;
    return;
  }
  if (loadSession()) await refresh();
  else loginScreen();
})();
