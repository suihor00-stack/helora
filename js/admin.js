/* ==========================================================================
   HELORA — 後台 admin
   登入後可以管理商品，以及決定商品要有哪些規格欄位。
   跟前台一樣，直接用 HTTPS 跟 Supabase 溝通，沒有任何套件。
   ========================================================================== */

import { SUPABASE_URL, SUPABASE_ANON_KEY, SITE, isConfigured } from './config.js';
import { esc, slugify } from './ui.js';

const KEY = 'helora.admin.session';
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* 分類的中文名字，只用在後台；前台維持 config.js 的英文。 */
const COL_NAME = {
  necklaces: '項鍊', rings: '戒指', earrings: '耳環', moiss: '莫桑石', cz: '鋯石',
  gold: '鍍金', silver: '925 純銀', everyday: '日常', minimal: '極簡',
  statement: '個性款', gifts: '送禮', edit: '編輯精選',
  newin: '新品上市', picks: 'HELORA 精選'
};

/** 雙語標籤：中文大、英文小。 */
const L = (zh, en) => `${esc(zh)} <span class="a-en">${esc(en)}</span>`;

let session  = null;
let products = [];
let fields   = [];      // 自訂規格欄位的定義
let fieldsReady = true; // migration-02 跑了沒
let cols     = [];      // 分類
let colsReady = true;   // migration-03 跑了沒
let editing  = null;    // 正在編輯的商品 id

/* ---------- 登入狀態 -------------------------------------------------------- */

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
    let msg = (body && (body.message || body.error_description || body.msg || body.error)) ||
              `連線失敗（${res.status}）`;
    if (/column .* does not exist|schema cache/i.test(String(msg))) {
      msg = '資料庫還沒更新 — 請先到 Supabase 的 SQL Editor 跑 supabase/ 資料夾裡的 migration 檔。';
    }
    if (res.status === 401) dropSession();
    throw new Error(msg);
  }
  return body;
}

const rest = (p, o) => call(`/rest/v1/${p}`, o);

/* ---------- 登入 / 註冊 ------------------------------------------------------ */

async function signIn(email, password) {
  saveSession(await call('/auth/v1/token?grant_type=password', {
    method: 'POST', body: JSON.stringify({ email, password })
  }));
}
const signUp = (email, password) =>
  call('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email, password }) });

/* ---------- 商品資料 --------------------------------------------------------- */

const SELECT = '*,product_images(id,url,alt,sort_order),product_collections(collection_slug)';

async function loadProducts() {
  products = await rest(`products?select=${SELECT}&order=sort_order.asc,created_at.desc`);
}

async function saveProduct(form) {
  const body = {
    slug: form.slug,
    name: form.name,
    tag: form.tag,
    description: form.description,
    price_cents: form.price_cents,
    compare_at_cents: form.compare_at_cents,
    kind: form.kind,
    options: form.options,
    in_stock: form.in_stock,
    is_active: form.is_active,
    is_new: form.is_new,
    is_pick: form.is_pick,
    sort_order: form.sort_order,
    updated_at: new Date().toISOString()
  };

  // 這幾個欄位是 migration-02 才有的，跑過才送，不然舊資料庫會擋下整筆。
  if (fieldsReady) {
    body.name_zh        = form.name_zh || null;
    body.description_zh = form.description_zh || null;
    body.custom         = form.custom;
  }

  const row = editing
    ? (await rest(`products?id=eq.${editing}`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body)
      }))[0]
    : (await rest('products', {
        method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body)
      }))[0];

  await rest(`product_collections?product_id=eq.${row.id}`, { method: 'DELETE' });
  if (form.collections.length) {
    await rest('product_collections', {
      method: 'POST',
      body: JSON.stringify(form.collections.map((c) => ({ product_id: row.id, collection_slug: c })))
    });
  }
  return row;
}

const deleteProduct = (id) => rest(`products?id=eq.${id}`, { method: 'DELETE' });

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

/* ---------- 自訂欄位 --------------------------------------------------------- */

async function loadFields() {
  // 資料表還沒建的時候不要讓整個後台掛掉，改成給提示就好。
  try {
    fields = await rest('product_fields?select=*&order=sort_order.asc');
    fieldsReady = true;
  } catch {
    fields = [];
    fieldsReady = false;
  }
}

const createField = (row) =>
  rest('product_fields', { method: 'POST', body: JSON.stringify(row) });

const updateField = (id, patch) =>
  rest(`product_fields?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(patch) });

const deleteField = (id) =>
  rest(`product_fields?id=eq.${id}`, { method: 'DELETE' });

/* ---------- 分類 ------------------------------------------------------------- */

const COL_FULL = 'slug,title,title_zh,intro,sort_order,is_active,show_in_nav';

async function loadCols() {
  // migration-03 之前沒有 title_zh 那幾欄，先試新的、失敗就退回舊的。
  try {
    cols = await rest(`collections?select=${COL_FULL}&order=sort_order.asc`);
    colsReady = true;
  } catch {
    cols = await rest('collections?select=slug,title,intro,sort_order&order=sort_order.asc');
    colsReady = false;
  }
}

const createCol = (row) =>
  rest('collections', { method: 'POST', body: JSON.stringify(row) });

const updateCol = (slug, patch) =>
  rest(`collections?slug=eq.${encodeURIComponent(slug)}`, { method: 'PATCH', body: JSON.stringify(patch) });

const deleteCol = (slug) =>
  rest(`collections?slug=eq.${encodeURIComponent(slug)}`, { method: 'DELETE' });

/* 後台顯示分類用的名字：有中文就用中文。 */
const colLabel = (c) => c.title_zh || COL_NAME[c.slug] || c.title || c.slug;

/* ---------- 共用外框 --------------------------------------------------------- */

const bar = (active) => `
  <div class="a-bar">
    <span class="a-logo">HELORA</span>
    <span class="a-nav">
      <button class="a-tab${active === 'products' ? ' is-on' : ''}" type="button" data-tab-products>
        商品 <span class="a-en">Products</span>
      </button>
      <button class="a-tab${active === 'cols' ? ' is-on' : ''}" type="button" data-tab-cols>
        分類 <span class="a-en">Collections</span>
      </button>
      <button class="a-tab${active === 'fields' ? ' is-on' : ''}" type="button" data-tab-fields>
        欄位設定 <span class="a-en">Fields</span>
      </button>
    </span>
    <span class="a-bar-r">
      <a class="a-link" href="${esc(SITE.shopUrl || './index.html')}"
         target="_blank" rel="noopener">看網站 ↗</a>
      <button class="a-link" type="button" data-signout>登出</button>
    </span>
  </div>`;

/* ---------- 畫面：登入 -------------------------------------------------------- */

function loginScreen(message = '') {
  $('#app').innerHTML = `
    <div class="a-center">
      <div class="a-card" style="max-width:400px">
        <div class="a-logo">HELORA</div>
        <h1 class="a-h1">後台管理 <span class="a-en">Admin</span></h1>
        ${message ? `<div class="a-msg">${esc(message)}</div>` : ''}
        <form data-login>
          <label class="a-l" for="em">${L('電子郵件', 'Email')}</label>
          <input class="a-i" id="em" name="email" type="email" required autocomplete="username">
          <label class="a-l" for="pw">${L('密碼', 'Password')}</label>
          <input class="a-i" id="pw" name="password" type="password" required
                 autocomplete="current-password" minlength="6">
          <div class="a-err" hidden></div>
          <button class="btn" type="submit" style="width:100%;margin-top:18px">登入 Sign in</button>
          <button class="a-link" type="button" data-signup>第一次使用？建立帳號</button>
        </form>
      </div>
    </div>`;
}

/* ---------- 畫面：商品列表 ----------------------------------------------------- */

function listScreen() {
  $('#app').innerHTML = `
    ${bar('products')}
    <div class="a-wrap">
      <div class="a-head">
        <h1 class="a-h1">商品 <span class="a-en">Products</span> <span class="a-count">${products.length}</span></h1>
        <button class="btn" type="button" data-new>新增商品</button>
      </div>
      <div class="a-err" data-list-error hidden></div>
      ${products.length ? `
        <table class="a-table">
          <thead>
            <tr>
              <th></th><th>${L('名稱', 'Name')}</th><th>${L('價錢', 'Price')}</th>
              <th>${L('分類', 'Collections')}</th><th>${L('顯示於', 'Shows in')}</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${products.map((p) => {
              const img  = (p.product_images || []).sort((a, b) => a.sort_order - b.sort_order)[0];
              // 先查資料庫裡的分類（含你自己新增的），查不到才退回寫死的對照表
              const tags = (p.product_collections || []).map((c) => {
                const hit = cols.find((x) => x.slug === c.collection_slug);
                return (hit && colLabel(hit)) || COL_NAME[c.collection_slug] || c.collection_slug;
              });
              const sale = p.compare_at_cents > p.price_cents;
              return `
              <tr>
                <td>${img ? `<img class="a-thumb" src="${esc(img.url)}" alt="">`
                          : `<div class="a-thumb a-thumb-empty"></div>`}</td>
                <td>
                  <div class="a-name">${esc(p.name)}</div>
                  ${p.name_zh ? `<div class="a-sub">${esc(p.name_zh)}</div>` : ''}
                  <div class="a-sub">${esc(p.slug)}${p.is_active ? '' : ' · 已隱藏'}${p.in_stock === false ? ' · 缺貨' : ''}</div>
                </td>
                <td>
                  ${SITE.currency} ${(p.price_cents / 100).toFixed(2)}
                  ${sale ? `<div class="a-sub" style="text-decoration:line-through">${SITE.currency} ${(p.compare_at_cents / 100).toFixed(2)}</div>` : ''}
                </td>
                <td class="a-sub">${tags.length ? esc(tags.join('、')) : '—'}</td>
                <td class="a-sub">${[p.is_new && '新品', p.is_pick && '精選'].filter(Boolean).join('、') || '—'}</td>
                <td class="a-right">
                  <button class="a-link" type="button" data-edit="${esc(p.id)}">編輯</button>
                  <button class="a-link a-danger" type="button" data-del="${esc(p.id)}">刪除</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>`
        : `<div class="a-empty">還沒有商品。新增第一件，網站上馬上就會出現。</div>`}
    </div>`;
}

/* ---------- 畫面：新增 / 編輯商品 ------------------------------------------------ */

function editScreen(p) {
  editing = p ? p.id : null;
  const picked = p ? (p.product_collections || []).map((c) => c.collection_slug) : [];
  const sizes  = p ? ((p.options || []).find((o) => /size/i.test(o.label))?.values || []).join('、') : '';
  const imgs   = p ? (p.product_images || []).slice().sort((a, b) => a.sort_order - b.sort_order) : [];
  const custom = p ? (p.custom || {}) : {};
  const on     = (v) => (p === null || v !== false) ? ' checked' : '';
  const isRing = p ? p.kind === 'ring' : true;
  const live   = fields.filter((f) => f.is_active);

  $('#app').innerHTML = `
    ${bar('products')}
    <div class="a-wrap">
      <h1 class="a-h1">${p ? '編輯商品' : '新增商品'}
        <span class="a-en">${p ? 'Edit product' : 'New product'}</span></h1>
      <form data-product-form>

        <div class="a-sec">基本資料 <span class="a-en">Basics</span></div>
        <div class="a-grid">
          <div class="a-f a-full">
            <label class="a-l" for="name">${L('英文名稱', 'Name (EN)')} <span class="a-req">必填</span></label>
            <input class="a-i" id="name" name="name" required value="${esc(p?.name || '')}"
                   placeholder="The Solace Pendant">
            <p class="a-note">商品卡和彈窗上顯示的名字</p>
          </div>
          <div class="a-f a-full">
            <label class="a-l" for="name_zh">${L('中文名稱', 'Name (中文)')}</label>
            <input class="a-i" id="name_zh" name="name_zh" value="${esc(p?.name_zh || '')}"
                   placeholder="Solace 墜飾">
          </div>
          <div class="a-f">
            <label class="a-l" for="price">${L(`價錢（${SITE.currency}）`, 'Price')} <span class="a-req">必填</span></label>
            <input class="a-i" id="price" name="price" type="number" step="0.01" min="0" required
                   value="${p ? (p.price_cents / 100).toFixed(2) : ''}" placeholder="189.00">
          </div>
          <div class="a-f">
            <label class="a-l" for="compare_at">${L('原價（留空＝沒特價）', 'Was')}</label>
            <input class="a-i" id="compare_at" name="compare_at" type="number" step="0.01" min="0"
                   value="${p?.compare_at_cents != null ? (p.compare_at_cents / 100).toFixed(2) : ''}"
                   placeholder="289.00">
          </div>
          <div class="a-f">
            <label class="a-l" for="kind">${L('類型', 'Type')}</label>
            <select class="a-i" id="kind" name="kind">
              <option value="ring"${isRing ? ' selected' : ''}>戒指 Ring</option>
              <option value="earrings"${p?.kind === 'earrings' ? ' selected' : ''}>耳環 Earrings</option>
              <option value="other"${p?.kind === 'other' ? ' selected' : ''}>其他 Other</option>
            </select>
          </div>
          <div class="a-f">
            <label class="a-l" for="sizes">${L('尺寸選項', 'Sizes')}</label>
            <input class="a-i" id="sizes" name="sizes" value="${esc(sizes)}" placeholder="9、10、11、12">
            <p class="a-note">用逗號或頓號分開。填了之後，客人一定要選尺寸才能加入購物車。
              <button class="a-mini" type="button" data-fill-sizes>帶入標準戒圍 9–16</button>
            </p>
          </div>
          <div class="a-f a-full">
            <label class="a-l" for="description">${L('英文描述', 'Description (EN)')}</label>
            <textarea class="a-i" id="description" name="description" rows="4"
                      placeholder="Hand-finished in our London studio…">${esc(p?.description || '')}</textarea>
            <p class="a-note">客人點開商品時看到的介紹</p>
          </div>
          <div class="a-f a-full">
            <label class="a-l" for="description_zh">${L('中文描述', 'Description (中文)')}</label>
            <textarea class="a-i" id="description_zh" name="description_zh" rows="4"
                      placeholder="這件商品的故事、特色、適合什麼場合…">${esc(p?.description_zh || '')}</textarea>
          </div>
        </div>

        <div class="a-sec">商品照片 <span class="a-en">Photos</span></div>
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

        <div class="a-sec">要放在哪些分類 <span class="a-en">Collections</span></div>
        <div class="a-checks">
          ${cols.filter((c) => c.slug !== 'newin' && c.slug !== 'picks')
                // 停用的分類不能再選，但這件商品已經歸在裡面的話還是要看得到
                .filter((c) => c.is_active !== false || picked.includes(c.slug))
                .map((c) => `
            <label class="a-check">
              <input type="checkbox" name="col" value="${esc(c.slug)}"${picked.includes(c.slug) ? ' checked' : ''}>
              <span>${esc(colLabel(c))}</span>
            </label>`).join('')}
        </div>
        <p class="a-note">分類清單可以自己增減 —
          <button class="a-mini" type="button" data-tab-cols>去分類設定</button>
        </p>

        <div class="a-sec">顯示設定 <span class="a-en">Visibility</span></div>
        <p class="a-note" style="margin-top:-6px">
          「在網站上公開」和「有庫存」會生效；前兩個是舊版首頁用的，新網站目前還沒有那兩個區塊。
        </p>
        <div class="a-checks">
          <label class="a-check"><input type="checkbox" name="is_new"${p?.is_new ? ' checked' : ''}><span>放上首頁「新品上市」</span></label>
          <label class="a-check"><input type="checkbox" name="is_pick"${p?.is_pick ? ' checked' : ''}><span>放上首頁「HELORA 精選」</span></label>
          <label class="a-check"><input type="checkbox" name="in_stock"${on(p?.in_stock)}><span>有庫存（沒勾就顯示「已售完」）</span></label>
          <label class="a-check"><input type="checkbox" name="is_active"${on(p?.is_active)}><span>在網站上公開</span></label>
        </div>

        <div class="a-sec">規格 <span class="a-en">Specifications</span></div>
        <p class="a-note" style="margin-top:-6px">
          「材質」和「寶石 / 細節」會合併成商品卡上那行小字，中間自動加上「·」。
          例如填 <code>14k recycled gold</code> 和 <code>freshwater pearl</code>，
          網站上會顯示 <code>14k recycled gold · freshwater pearl</code>。
        </p>
        ${fieldsReady ? '' : `<div class="a-msg a-warn">
        資料庫還沒更新。請先到 Supabase → SQL Editor，
        跑一次 <code>supabase/migration-02-bilingual-and-fields.sql</code>，
        然後重新整理這頁。
      </div>`}
        ${live.length ? `
          <div class="a-grid">
            ${live.map((f) => `
              <div class="a-f">
                <label class="a-l" for="cf-${esc(f.key)}">${L(f.label_zh, f.label_en)}</label>
                <input class="a-i" id="cf-${esc(f.key)}" data-custom="${esc(f.key)}"
                       value="${esc(custom[f.key] || '')}" placeholder="${esc(f.placeholder)}">
              </div>`).join('')}
          </div>
          <p class="a-note">這些欄位可以自己增減和改名 —
            <button class="a-mini" type="button" data-tab-fields>去欄位設定</button>
          </p>`
        : `<p class="a-sub a-hint">還沒有規格欄位。
             <button class="a-mini" type="button" data-tab-fields>去欄位設定新增</button></p>`}

        <details class="a-adv">
          <summary>進階設定（排序、網址代號 — 新網站上不會顯示，平常不用管）</summary>
          <div class="a-grid" style="margin-top:18px">
            <div class="a-f">
              <label class="a-l" for="tag">${L('名字上方的小標', 'Tag')}</label>
              <input class="a-i" id="tag" name="tag" value="${esc(p?.tag || '')}" placeholder="Rings">
            </div>
            <div class="a-f">
              <label class="a-l" for="sort_order">${L('排序（數字越小越前面）', 'Sort order')}</label>
              <input class="a-i" id="sort_order" name="sort_order" type="number" value="${p?.sort_order ?? 0}">
            </div>
            <div class="a-f a-full">
              <label class="a-l" for="slug">${L('網址代號（留空會自動產生）', 'URL slug')}</label>
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

/* ---------- 畫面：欄位設定 ------------------------------------------------------ */

function fieldsScreen() {
  $('#app').innerHTML = `
    ${bar('fields')}
    <div class="a-wrap">
      <h1 class="a-h1">欄位設定 <span class="a-en">Product fields</span></h1>
      <p class="a-sub" style="max-width:60ch;margin-bottom:24px">
        這裡決定「新增商品」那頁的<strong>規格</strong>區有哪些欄位，
        以及商品頁的規格表要顯示什麼。改完按儲存，網站馬上跟著變。
      </p>

      <div class="a-err" data-fields-error hidden></div>
      ${fieldsReady ? '' : `<div class="a-msg a-warn">
        資料庫還沒更新。請先到 Supabase → SQL Editor，
        跑一次 <code>supabase/migration-02-bilingual-and-fields.sql</code>，
        然後重新整理這頁。
      </div>`}

      ${fields.length ? `
        <form data-fields-form>
          <table class="a-table">
            <thead>
              <tr>
                <th>${L('中文名稱', 'Chinese')}</th>
                <th>${L('英文名稱', 'English')}</th>
                <th>${L('範例文字', 'Placeholder')}</th>
                <th class="a-center-c">${L('顯示在商品頁', 'On page')}</th>
                <th class="a-center-c">${L('排序', 'Order')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${fields.map((f) => `
                <tr data-field-row="${esc(f.id)}"${f.is_active ? '' : ' class="a-off"'}>
                  <td><input class="a-i a-i-sm" data-f="label_zh" value="${esc(f.label_zh)}"></td>
                  <td><input class="a-i a-i-sm" data-f="label_en" value="${esc(f.label_en)}"></td>
                  <td><input class="a-i a-i-sm" data-f="placeholder" value="${esc(f.placeholder)}"></td>
                  <td class="a-center-c">
                    <input type="checkbox" data-f="show_on_page"${f.show_on_page ? ' checked' : ''}>
                  </td>
                  <td class="a-center-c">
                    <input class="a-i a-i-sm a-i-num" data-f="sort_order" type="number" value="${f.sort_order}">
                  </td>
                  <td class="a-right">
                    <button class="a-link" type="button" data-toggle-field="${esc(f.id)}">
                      ${f.is_active ? '停用' : '啟用'}
                    </button>
                    <button class="a-link a-danger" type="button" data-del-field="${esc(f.id)}">刪除</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
          <div class="a-actions">
            <button class="btn" type="submit">儲存變更</button>
          </div>
        </form>`
        : `<div class="a-empty">還沒有任何規格欄位。用下面的表單加第一個。</div>`}

      <div class="a-sec" style="margin-top:40px">新增欄位 <span class="a-en">Add a field</span></div>
      <form data-new-field>
        <div class="a-grid">
          <div class="a-f">
            <label class="a-l" for="nf_zh">${L('中文名稱', 'Chinese')} <span class="a-req">必填</span></label>
            <input class="a-i" id="nf_zh" name="label_zh" required placeholder="鍍金厚度">
          </div>
          <div class="a-f">
            <label class="a-l" for="nf_en">${L('英文名稱', 'English')}</label>
            <input class="a-i" id="nf_en" name="label_en" placeholder="Plating thickness">
            <p class="a-note">商品頁的規格表用這個；留空就用中文</p>
          </div>
          <div class="a-f a-full">
            <label class="a-l" for="nf_ph">${L('範例文字（灰字提示）', 'Placeholder')}</label>
            <input class="a-i" id="nf_ph" name="placeholder" placeholder="3 微米">
          </div>
        </div>
        <div class="a-err" hidden></div>
        <div class="a-actions"><button class="btn" type="submit">新增欄位</button></div>
      </form>

      <p class="a-note" style="margin-top:30px">
        小提醒：<strong>刪除</strong>欄位會連同所有商品裡填過的內容一起不見。
        只是暫時不想用的話，按<strong>停用</strong>就好 — 資料會留著，隨時可以再啟用。
      </p>
    </div>`;
}


/* ---------- 畫面：分類設定 ------------------------------------------------------ */

function colsScreen() {
  $('#app').innerHTML = `
    ${bar('cols')}
    <div class="a-wrap">
      <h1 class="a-h1">分類 <span class="a-en">Collections</span></h1>
      <p class="a-sub" style="max-width:62ch;margin-bottom:24px">
        分類就是網站上的商品分頁（戒指、耳環、送禮…）。這裡改的東西，
        商品表單的勾選清單、網站上方的 Shop 選單、頁尾連結和分類頁標題都會跟著變。
      </p>

      <div class="a-err" data-cols-error hidden></div>
      ${colsReady ? '' : `<div class="a-msg a-warn">
        資料庫還沒更新。請先到 Supabase → SQL Editor 跑一次
        <code>supabase/migration-03-collections.sql</code>，然後重新整理這頁。
      </div>`}

      ${cols.length ? `
        <form data-cols-form>
          <table class="a-table">
            <thead>
              <tr>
                <th>${L('中文名稱', 'Chinese')}</th>
                <th>${L('英文名稱', 'English')}</th>
                <th>${L('說明（網站上顯示）', 'Intro')}</th>
                <th class="a-center-c">${L('放上選單', 'In menu')}</th>
                <th class="a-center-c">${L('排序', 'Order')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${cols.map((c) => `
                <tr data-col-row="${esc(c.slug)}"${c.is_active === false ? ' class="a-off"' : ''}>
                  <td><input class="a-i a-i-sm" data-c="title_zh" value="${esc(c.title_zh || '')}"
                             ${colsReady ? '' : 'disabled'}></td>
                  <td><input class="a-i a-i-sm" data-c="title" value="${esc(c.title || '')}"></td>
                  <td><input class="a-i a-i-sm a-i-wide" data-c="intro" value="${esc(c.intro || '')}"></td>
                  <td class="a-center-c">
                    <input type="checkbox" data-c="show_in_nav"${c.show_in_nav ? ' checked' : ''}
                           ${colsReady ? '' : 'disabled'}>
                  </td>
                  <td class="a-center-c">
                    <input class="a-i a-i-sm a-i-num" data-c="sort_order" type="number" value="${c.sort_order ?? 0}">
                  </td>
                  <td class="a-right">
                    <span class="a-sub" style="margin-right:10px">${esc(c.slug)}</span>
                    ${colsReady ? `<button class="a-link" type="button" data-toggle-col="${esc(c.slug)}">
                      ${c.is_active === false ? '啟用' : '停用'}
                    </button>` : ''}
                    <button class="a-link a-danger" type="button" data-del-col="${esc(c.slug)}">刪除</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
          <div class="a-actions"><button class="btn" type="submit">儲存變更</button></div>
        </form>`
        : `<div class="a-empty">還沒有任何分類。</div>`}

      <div class="a-sec" style="margin-top:40px">新增分類 <span class="a-en">Add a collection</span></div>
      <form data-new-col>
        <div class="a-grid">
          <div class="a-f">
            <label class="a-l" for="nc_zh">${L('中文名稱', 'Chinese')} <span class="a-req">必填</span></label>
            <input class="a-i" id="nc_zh" name="title_zh" required placeholder="項鍊">
          </div>
          <div class="a-f">
            <label class="a-l" for="nc_en">${L('英文名稱', 'English')} <span class="a-req">必填</span></label>
            <input class="a-i" id="nc_en" name="title" required placeholder="Necklaces">
            <p class="a-note">網站上顯示的是這個</p>
          </div>
          <div class="a-f a-full">
            <label class="a-l" for="nc_intro">${L('說明', 'Intro')}</label>
            <input class="a-i" id="nc_intro" name="intro" placeholder="Fine chains and pendants for every day.">
          </div>
        </div>
        <div class="a-err" hidden></div>
        <div class="a-actions"><button class="btn" type="submit">新增分類</button></div>
      </form>

      <p class="a-note" style="margin-top:30px">
        小提醒：<strong>刪除</strong>分類會讓所有商品失去這個標籤（商品本身還在）。
        只是暫時不想顯示的話，按<strong>停用</strong>比較安全。
        <br>「新品上市」和「HELORA 精選」是靠商品自己的勾選決定的，不用在這裡管。
      </p>
    </div>`;
}

/* ---------- 讀表單 ------------------------------------------------------------ */

function readForm(form) {
  const g = (n) => (form.querySelector(`[name="${n}"]`)?.value || '').trim();
  const c = (n) => !!form.querySelector(`[name="${n}"]`)?.checked;
  const sizes = g('sizes').split(/[,、，]/).map((s) => s.trim()).filter(Boolean);

  const custom = {};
  $$('[data-custom]', form).forEach((el) => {
    const v = el.value.trim();
    if (v) custom[el.dataset.custom] = v;
  });

  return {
    name:           g('name'),
    name_zh:        g('name_zh'),
    slug:           slugify(g('slug') || g('name')),
    tag:            g('tag'),
    description:    g('description'),
    description_zh: g('description_zh'),
    price_cents:      Math.round(parseFloat(g('price') || '0') * 100),
    compare_at_cents: g('compare_at') ? Math.round(parseFloat(g('compare_at')) * 100) : null,
    kind:       g('kind') || 'ring',
    options:    sizes.length ? [{ label: 'Size', values: sizes }] : [],
    custom,
    sort_order: parseInt(g('sort_order') || '0', 10) || 0,
    in_stock:   c('in_stock'),
    is_active:  c('is_active'),
    is_new:     c('is_new'),
    is_pick:    c('is_pick'),
    collections: $$('[name="col"]:checked', form).map((i) => i.value)
  };
}

const showError = (el, msg) => { if (el) { el.textContent = msg; el.hidden = false; } };

/* ---------- 換頁 -------------------------------------------------------------- */

async function refresh() {
  try {
    await Promise.all([loadProducts(), loadFields(), loadCols()]);
    listScreen();
  } catch (err) {
    if (!session) return loginScreen('登入時效過了，請重新登入。');
    listScreen();
    showError($('[data-list-error]'), err.message);
  }
}

async function showCols() {
  try {
    await loadCols();
    colsScreen();
  } catch (err) {
    if (!session) return loginScreen('登入時效過了，請重新登入。');
    colsScreen();
    showError($('[data-cols-error]'), err.message);
  }
}

async function showFields() {
  try {
    await loadFields();
    fieldsScreen();
  } catch (err) {
    if (!session) return loginScreen('登入時效過了，請重新登入。');
    fieldsScreen();
    showError($('[data-fields-error]'), err.message);
  }
}

/* ---------- 事件 -------------------------------------------------------------- */

document.addEventListener('submit', async (e) => {
  const form = e.target;

  /* 登入 */
  if (form.matches('[data-login]')) {
    e.preventDefault();
    const err = form.querySelector('.a-err'); err.hidden = true;
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = '登入中…';
    try {
      await signIn(form.email.value.trim(), form.password.value);
      await refresh();
    } catch (e2) {
      showError(err, e2.message);
      btn.disabled = false; btn.textContent = '登入 Sign in';
    }
    return;
  }

  /* 儲存商品 */
  if (form.matches('[data-product-form]')) {
    e.preventDefault();
    const err = form.querySelector('.a-err'); err.hidden = true;
    const data = readForm(form);

    if (!data.name) return showError(err, '請填英文名稱。');
    if (!data.slug) return showError(err, '英文名稱要有至少一個字母或數字，好產生網址代號。');
    if (Number.isNaN(data.price_cents)) return showError(err, '價錢好像怪怪的，再確認一下。');
    if (data.compare_at_cents != null &&
        (Number.isNaN(data.compare_at_cents) || data.compare_at_cents <= data.price_cents)) {
      return showError(err, '原價要比現在的售價高才算折扣，不然就留空。');
    }

    const btn = form.querySelector('button[type=submit]');
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = '儲存中…';
    try {
      const row = await saveProduct(data);
      await loadProducts();
      if (!editing) editScreen(products.find((p) => p.id === row.id));  // 接著就能傳照片
      else listScreen();
    } catch (e2) {
      showError(err, e2.message);
      btn.disabled = false; btn.textContent = label;
    }
    return;
  }

  /* 儲存分類（整批） */
  if (form.matches('[data-cols-form]')) {
    e.preventDefault();
    const err = $('[data-cols-error]'); err.hidden = true;
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = '儲存中…';
    try {
      for (const row of $$('[data-col-row]', form)) {
        const get = (k) => row.querySelector(`[data-c="${k}"]`);
        const patch = {
          title:      get('title').value.trim(),
          intro:      get('intro').value.trim(),
          sort_order: parseInt(get('sort_order').value || '0', 10) || 0
        };
        // 這兩欄是 migration-03 才有的
        if (colsReady) {
          patch.title_zh    = get('title_zh').value.trim() || null;
          patch.show_in_nav = get('show_in_nav').checked;
        }
        await updateCol(row.dataset.colRow, patch);
      }
      await showCols();
    } catch (e2) {
      showError($('[data-cols-error]'), e2.message);
      btn.disabled = false; btn.textContent = '儲存變更';
    }
    return;
  }

  /* 新增分類 */
  if (form.matches('[data-new-col]')) {
    e.preventDefault();
    const err = form.querySelector('.a-err'); err.hidden = true;
    const zh = form.title_zh.value.trim();
    const en = form.title.value.trim();
    if (!zh || !en) return showError(err, '中文和英文名稱都要填。');

    // slug 是網址代號，建立後就固定，改名字不會影響已經歸類好的商品。
    let slug = slugify(en);
    if (!slug) slug = `c${Date.now().toString(36)}`;
    if (cols.some((c) => c.slug === slug)) return showError(err, `網址代號「${slug}」已經有人用了，換一個英文名稱。`);

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = '新增中…';
    try {
      const row = { slug, title: en, intro: form.intro.value.trim(),
                    sort_order: (cols.at(-1)?.sort_order ?? 0) + 1 };
      if (colsReady) { row.title_zh = zh; row.show_in_nav = false; }
      await createCol(row);
      await showCols();
    } catch (e2) {
      showError(err, e2.message);
      btn.disabled = false; btn.textContent = '新增分類';
    }
    return;
  }

  /* 儲存欄位設定（整批） */
  if (form.matches('[data-fields-form]')) {
    e.preventDefault();
    const err = $('[data-fields-error]'); err.hidden = true;
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = '儲存中…';
    try {
      for (const row of $$('[data-field-row]', form)) {
        const get = (k) => row.querySelector(`[data-f="${k}"]`);
        await updateField(row.dataset.fieldRow, {
          label_zh:     get('label_zh').value.trim(),
          label_en:     get('label_en').value.trim(),
          placeholder:  get('placeholder').value.trim(),
          show_on_page: get('show_on_page').checked,
          sort_order:   parseInt(get('sort_order').value || '0', 10) || 0
        });
      }
      await showFields();
    } catch (e2) {
      showError($('[data-fields-error]'), e2.message);
      btn.disabled = false; btn.textContent = '儲存變更';
    }
    return;
  }

  /* 新增欄位 */
  if (form.matches('[data-new-field]')) {
    e.preventDefault();
    const err = form.querySelector('.a-err'); err.hidden = true;
    const zh = form.label_zh.value.trim();
    const en = form.label_en.value.trim();
    if (!zh) return showError(err, '請填中文名稱。');

    // key 是資料實際存放的位置，建立後就不再更動，改名字不會弄丟資料。
    let key = slugify(en || zh);
    if (!key || fields.some((f) => f.key === key)) key = `field_${Date.now().toString(36)}`;

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = '新增中…';
    try {
      await createField({
        key, label_zh: zh, label_en: en,
        placeholder: form.placeholder.value.trim(),
        sort_order: (fields.at(-1)?.sort_order ?? 0) + 1
      });
      await showFields();
    } catch (e2) {
      showError(err, e2.message);
      btn.disabled = false; btn.textContent = '新增欄位';
    }
  }
});

document.addEventListener('click', async (e) => {
  const hit = (s) => e.target.closest(s);

  if (hit('[data-signup]')) {
    const form = $('[data-login]');
    const err  = form.querySelector('.a-err'); err.hidden = true;
    const email = form.email.value.trim();
    const pw    = form.password.value;
    if (!email || pw.length < 6) return showError(err, '請輸入電子郵件，密碼至少 6 個字。');
    try {
      await signUp(email, pw);
      showError(err, '帳號建好了。接下來要去 Supabase 的 SQL Editor 把自己加進管理員名單（指令在 supabase/schema.sql 最下面），然後再回來登入。');
    } catch (e2) { showError(err, e2.message); }
    return;
  }

  if (hit('[data-signout]'))     { dropSession(); loginScreen(); return; }
  if (hit('[data-tab-fields]'))  { await showFields(); return; }
  if (hit('[data-tab-cols]'))    { await showCols(); return; }
  if (hit('[data-tab-products]')){ editing = null; await refresh(); return; }
  if (hit('[data-new]'))         { editScreen(null); return; }
  if (hit('[data-back]'))        { editing = null; await refresh(); return; }

  /* 帶入標準戒圍 */
  const fill = hit('[data-fill-sizes]');
  if (fill) {
    const box = $('[name="sizes"]');
    box.value = '9、10、11、12、13、14、15、16';
    box.focus();
    return;
  }

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
    return;
  }

  /* 分類：停用 / 啟用 */
  const tc = hit('[data-toggle-col]');
  if (tc) {
    const c = cols.find((x) => x.slug === tc.dataset.toggleCol);
    try { await updateCol(c.slug, { is_active: c.is_active === false }); await showCols(); }
    catch (err) { showError($('[data-cols-error]'), err.message); }
    return;
  }

  /* 分類：刪除 */
  const dc = hit('[data-del-col]');
  if (dc) {
    const c = cols.find((x) => x.slug === dc.dataset.delCol);
    if (!confirm(`刪除分類「${colLabel(c)}」？\n\n所有商品都會失去這個分類標籤（商品本身不會被刪）。\n只是暫時不想顯示的話，選「停用」比較安全。`)) return;
    try { await deleteCol(c.slug); await showCols(); }
    catch (err) { showError($('[data-cols-error]'), err.message); }
    return;
  }

  /* 欄位：停用 / 啟用 */
  const tf = hit('[data-toggle-field]');
  if (tf) {
    const f = fields.find((x) => x.id === tf.dataset.toggleField);
    try { await updateField(f.id, { is_active: !f.is_active }); await showFields(); }
    catch (err) { showError($('[data-fields-error]'), err.message); }
    return;
  }

  /* 欄位：刪除 */
  const df = hit('[data-del-field]');
  if (df) {
    const f = fields.find((x) => x.id === df.dataset.delField);
    if (!confirm(`刪除欄位「${f.label_zh}」？\n\n所有商品裡填在這個欄位的內容都會一起不見。\n只是暫時不用的話，選「停用」比較安全。`)) return;
    try { await deleteField(f.id); await showFields(); }
    catch (err) { showError($('[data-fields-error]'), err.message); }
  }
});

document.addEventListener('change', async (e) => {
  if (!e.target.matches('[data-upload]')) return;
  const files = [...e.target.files];
  if (!files.length) return;
  const label = e.target.closest('.a-add');
  label.querySelector('span').textContent = '上傳中…';
  try {
    let order = (products.find((p) => p.id === editing)?.product_images || []).length;
    for (const f of files) await uploadImage(editing, f, order++);
    await loadProducts();
    editScreen(products.find((p) => p.id === editing));
  } catch (err) {
    label.querySelector('span').textContent = '＋ 加照片';
    showError($('.a-err'), err.message);
  }
});

/* ---------- 開始 -------------------------------------------------------------- */

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
