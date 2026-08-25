/* ==========================================================================
   HELORA — admin
   Sign in, then add and edit the pieces that show up on the site.
   Talks to Supabase over plain HTTPS, same as the shop.
   ========================================================================== */

import { SUPABASE_URL, SUPABASE_ANON_KEY, COLLECTIONS, SITE, isConfigured } from './config.js';
import { esc, slugify } from './ui.js';

const KEY = 'helora.admin.session';

/* 分類的中文名字，只用在後台；前台網站仍照 config.js 的英文顯示。 */
const COL_NAME = {
  rings: '戒指', earrings: '耳環', moiss: '莫桑石', cz: '鋯石',
  gold: '鍍金', silver: '925 純銀', everyday: '日常', minimal: '極簡',
  statement: '個性款', gifts: '送禮', edit: '編輯精選',
  newin: '新品上市', picks: 'HELORA 精選'
};
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
                `連線失敗（${res.status}）`;
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
  if (!res.ok) throw new Error(`${file.name} 上傳失敗`);

  const url = `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`;
  await rest('product_images', {
    method: 'POST',
    body: JSON.stringify({ product_id: productId, url, alt: '', sort_order: order })
  });
  return url;
}

const deleteImage = (id) => rest(`product_images?id=eq.${id}`, { method: 'DELETE' });

/* ---------- 畫面 ----------------------------------------------------------- */

function loginScreen(message = '') {
  $('#app').innerHTML = `
    <div class="a-center">
      <div class="a-card" style="max-width:400px">
        <div class="a-logo">HELORA</div>
        <h1 class="a-h1">後台管理</h1>
        ${message ? `<div class="a-msg">${esc(message)}</div>` : ''}
        <form data-login>
          <label class="a-l" for="em">電子郵件</label>
          <input class="a-i" id="em" name="email" type="email" required autocomplete="username">
          <label class="a-l" for="pw">密碼</label>
          <input class="a-i" id="pw" name="password" type="password" required
                 autocomplete="current-password" minlength="6">
          <div class="a-err" hidden></div>
          <button class="btn" type="submit" style="width:100%;margin-top:18px">登入</button>
          <button class="a-link" type="button" data-signup>第一次使用？建立帳號</button>
        </form>
      </div>
    </div>`;
}

function listScreen() {
  $('#app').innerHTML = `
    <div class="a-bar">
      <span class="a-logo">HELORA</span>
      <span class="a-bar-r">
        <a class="a-link" href="./index.html" target="_blank" rel="noopener">看網站 ↗</a>
        <button class="a-link" type="button" data-signout>登出</button>
      </span>
    </div>
    <div class="a-wrap">
      <div class="a-head">
        <h1 class="a-h1">商品 <span class="a-count">${products.length}</span></h1>
        <button class="btn" type="button" data-new>新增商品</button>
      </div>
      <div class="a-err" data-list-error hidden></div>
      ${products.length ? `
        <table class="a-table">
          <thead>
            <tr><th></th><th>名稱</th><th>價錢</th><th>分類</th><th>顯示於</th><th></th></tr>
          </thead>
          <tbody>
            ${products.map((p) => {
              const img = (p.product_images || []).sort((a, b) => a.sort_order - b.sort_order)[0];
              const cols = (p.product_collections || []).map((c) => COL_NAME[c.collection_slug] || c.collection_slug);
              return `
              <tr>
                <td>${img ? `<img class="a-thumb" src="${esc(img.url)}" alt="">`
                          : `<div class="a-thumb a-thumb-empty"></div>`}</td>
                <td>
                  <div class="a-name">${esc(p.name)}</div>
                  <div class="a-sub">${esc(p.slug)}${p.is_active ? '' : ' · 已隱藏'}${p.in_stock === false ? ' · 缺貨' : ''}</div>
                </td>
                <td>${SITE.currency} ${(p.price_cents / 100).toFixed(2)}</td>
                <td class="a-sub">${cols.length ? esc(cols.join('、')) : '—'}</td>
                <td class="a-sub">${[p.is_new && '新品', p.is_pick && '精選'].filter(Boolean).join('、') || '—'}</td>
                <td class="a-right">
                  <button class="a-link" type="button" data-edit="${esc(p.id)}">編輯</button>
                  <button class="a-link a-danger" type="button" data-del="${esc(p.id)}">刪除</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>`
        : `<div class="a-empty">
             還沒有商品。新增第一件，網站上馬上就會出現。
           </div>`}
    </div>`;
}

/* 進階欄位：平常用不到，收在「進階設定」裡，需要時才展開。 */
const ADVANCED = [
  ['tag',        '名字上方的小標',   '例如：戒指'],
  ['material',   '材質',            '925 純銀'],
  ['finish',     '電鍍 / 表面處理',  '18K 金'],
  ['dimensions', '尺寸規格',         '戒圈寬 2.4 mm'],
  ['weight',     '重量',            '2.1 克'],
  ['sku',        '貨號 SKU',        'HEL-R-001']
];

function editScreen(p) {
  editing = p ? p.id : null;
  const cols  = p ? (p.product_collections || []).map((c) => c.collection_slug) : [];
  const sizes = p ? ((p.options || []).find((o) => /size/i.test(o.label))?.values || []).join('、') : '';
  const imgs  = p ? (p.product_images || []).slice().sort((a, b) => a.sort_order - b.sort_order) : [];
  const on    = (v) => (p === null || v !== false) ? ' checked' : '';

  $('#app').innerHTML = `
    <div class="a-bar">
      <span class="a-logo">HELORA</span>
      <span class="a-bar-r"><button class="a-link" type="button" data-back>← 回商品列表</button></span>
    </div>
    <div class="a-wrap">
      <h1 class="a-h1">${p ? '編輯商品' : '新增商品'}</h1>
      <form data-product-form>

        <div class="a-sec">基本資料</div>
        <div class="a-grid">
          <div class="a-f a-full">
            <label class="a-l" for="name">商品名稱 <span class="a-req">必填</span></label>
            <input class="a-i" id="name" name="name" required value="${esc(p?.name || '')}"
                   placeholder="例如：Aura 細戒">
          </div>
          <div class="a-f">
            <label class="a-l" for="price">價錢（${esc(SITE.currency)}）<span class="a-req">必填</span></label>
            <input class="a-i" id="price" name="price" type="number" step="0.01" min="0" required
                   value="${p ? (p.price_cents / 100).toFixed(2) : ''}" placeholder="189.00">
          </div>
          <div class="a-f">
            <label class="a-l" for="kind">類型</label>
            <select class="a-i" id="kind" name="kind">
              <option value="ring"${p?.kind === 'ring' || !p ? ' selected' : ''}>戒指</option>
              <option value="earrings"${p?.kind === 'earrings' ? ' selected' : ''}>耳環</option>
              <option value="other"${p?.kind === 'other' ? ' selected' : ''}>其他</option>
            </select>
          </div>
          <div class="a-f a-full">
            <label class="a-l" for="description">商品描述</label>
            <textarea class="a-i" id="description" name="description" rows="4"
                      placeholder="這件商品的故事、特色、適合什麼場合…">${esc(p?.description || '')}</textarea>
          </div>
          <div class="a-f a-full">
            <label class="a-l" for="sizes">尺寸選項（用逗號分開，沒有就留空）</label>
            <input class="a-i" id="sizes" name="sizes" value="${esc(sizes)}" placeholder="9, 10, 11, 12">
          </div>
        </div>

        <div class="a-sec">商品照片</div>
        ${p ? `
          <div class="a-imgs">
            ${imgs.map((i) => `
              <div class="a-img">
                <img src="${esc(i.url)}" alt="">
                <button class="a-x" type="button" data-delimg="${esc(i.id)}" aria-label="移除照片">×</button>
              </div>`).join('')}
            <label class="a-add">
              <input type="file" accept="image/*" multiple hidden data-upload>
              <span>＋ 加照片</span>
            </label>
          </div>
          <p class="a-sub">第一張是主圖，第二張是滑鼠移過去會換的那張。白底方形的最好看。</p>`
        : `<p class="a-sub a-hint">先按下面的「建立商品」存檔，存好之後就能上傳照片了。</p>`}

        <div class="a-sec">要放在哪些分類</div>
        <div class="a-checks">
          ${COLLECTIONS.filter(([s]) => s !== 'newin' && s !== 'picks').map(([s, t]) => `
            <label class="a-check">
              <input type="checkbox" name="col" value="${s}"${cols.includes(s) ? ' checked' : ''}>
              <span>${esc(COL_NAME[s] || t)}</span>
            </label>`).join('')}
        </div>

        <div class="a-sec">顯示設定</div>
        <div class="a-checks">
          <label class="a-check"><input type="checkbox" name="is_new"${p?.is_new ? ' checked' : ''}><span>放上首頁「新品上市」</span></label>
          <label class="a-check"><input type="checkbox" name="is_pick"${p?.is_pick ? ' checked' : ''}><span>放上首頁「HELORA 精選」</span></label>
          <label class="a-check"><input type="checkbox" name="in_stock"${on(p?.in_stock)}><span>有庫存（沒勾就顯示「已售完」）</span></label>
          <label class="a-check"><input type="checkbox" name="is_active"${on(p?.is_active)}><span>在網站上公開</span></label>
        </div>

        <details class="a-adv">
          <summary>進階設定（規格、貨號、排序 — 平常可以不用管）</summary>
          <div class="a-grid" style="margin-top:18px">
            ${ADVANCED.map(([n, l, ph]) => `
              <div class="a-f">
                <label class="a-l" for="${n}">${l}</label>
                <input class="a-i" id="${n}" name="${n}" value="${esc(p?.[n] || '')}" placeholder="${esc(ph)}">
              </div>`).join('')}
            <div class="a-f">
              <label class="a-l" for="sort_order">排序（數字越小越前面）</label>
              <input class="a-i" id="sort_order" name="sort_order" type="number" value="${p?.sort_order ?? 0}">
            </div>
            <div class="a-f">
              <label class="a-l" for="slug">網址代號（留空會自動產生）</label>
              <input class="a-i" id="slug" name="slug" value="${esc(p?.slug || '')}" placeholder="aura-fine-band">
            </div>
          </div>
        </details>

        <div class="a-err" hidden></div>
        <div class="a-actions">
          <button class="btn" type="submit">${p ? '儲存變更' : '建立商品'}</button>
          <button class="a-link" type="button" data-back>取消</button>
        </div>
      </form>
    </div>`;
}

/* ---------- wiring ------------------------------------------------------------- */

function readForm(form) {
  const g = (n) => (form.querySelector(`[name=${n}]`)?.value || '').trim();
  const c = (n) => !!form.querySelector(`[name=${n}]`)?.checked;
  const sizes = g('sizes').split(/[,、]/).map((s) => s.trim()).filter(Boolean);

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
    if (!session) return loginScreen('登入時效過了，請重新登入。');
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
    btn.disabled = true; btn.textContent = '登入中…';
    try {
      await signIn(form.email.value.trim(), form.password.value);
      await refresh();
    } catch (e2) {
      showError(err, e2.message);
      btn.disabled = false; btn.textContent = '登入';
    }
    return;
  }

  if (form.matches('[data-product-form]')) {
    e.preventDefault();
    const err = form.querySelector('.a-err');
    err.hidden = true;
    const data = readForm(form);
    if (!data.name)  return showError(err, '請填商品名稱。');
    if (!data.slug)  return showError(err, '商品名稱要有至少一個英文字母或數字，好產生網址代號。');
    if (Number.isNaN(data.price_cents)) return showError(err, '價錢好像怪怪的，再確認一下。');

    const btn = form.querySelector('button[type=submit]');
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = '儲存中…';
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
    if (!email || pw.length < 6) return showError(err, '請輸入電子郵件，密碼至少 6 個字。');
    try {
      await signUp(email, pw);
      showError(err, '帳號建好了。接下來要去 Supabase 的 SQL Editor 把自己加進管理員名單（指令在 supabase/schema.sql 最下面），然後再回來登入。');
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
    if (!confirm(`確定要刪除「${p.name}」嗎？刪掉就救不回來了。`)) return;
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
  label.querySelector('span').textContent = '上傳中…';
  try {
    // Keep the order the files were picked in, carrying on from any already there.
    let order = (products.find((p) => p.id === editing)?.product_images || []).length;
    for (const f of files) await uploadImage(editing, f, order++);
    await loadProducts();
    editScreen(products.find((p) => p.id === editing));
  } catch (err) {
    label.querySelector('span').textContent = '＋ 加照片';
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
          <h1 class="a-h1">還沒接上資料庫</h1>
          <p class="a-sub">
            打開 <code>js/config.js</code>，填入 Supabase 的網址和 publishable key，
            然後重新整理這頁。步驟寫在 <code>CLAUDE.md</code> 裡。
          </p>
        </div>
      </div>`;
    return;
  }
  if (loadSession()) await refresh();
  else loginScreen();
})();
