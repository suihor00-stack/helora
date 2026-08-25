/* ==========================================================================
   HELORA — talking to Supabase
   Supabase's API is just HTTPS, so this file uses plain fetch(). No libraries,
   no CDN, nothing to install or build. If the keys in config.js aren't filled
   in yet, every function here quietly returns empty data so the site still
   loads and shows "No pieces here yet."
   ========================================================================== */

import { SUPABASE_URL, SUPABASE_ANON_KEY, isConfigured } from './config.js';

const api = (path) => `${SUPABASE_URL}/rest/v1/${path}`;

const headers = (extra = {}) => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  ...extra
});

async function req(url, options = {}) {
  const res = await fetch(url, { ...options, headers: headers(options.headers) });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const msg = (body && (body.message || body.error || body.hint)) || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body;
}

/* ---------- shaping ------------------------------------------------------- */

/* Turns a row from the database into the shape the page templates expect. */
function shape(row) {
  if (!row) return null;
  const images = (row.product_images || [])
    .slice()
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map((i) => ({ url: i.url, alt: i.alt || row.name }));

  return {
    id:          row.id,
    slug:        row.slug,
    name:        row.name,
    tag:         row.tag || '',
    description: row.description || '',
    priceCents:  row.price_cents ?? 0,
    compareAtCents: row.compare_at_cents ?? null,
    kind:        row.kind || 'ring',
    material:    row.material || '',
    finish:      row.finish || '',
    dimensions:  row.dimensions || '',
    weight:      row.weight || '',
    sku:         row.sku || '',
    options:     Array.isArray(row.options) ? row.options : [],
    inStock:     row.in_stock !== false,
    images,
    collections: (row.product_collections || []).map((c) => c.collection_slug)
  };
}

const SELECT =
  '*,product_images(url,alt,sort_order),product_collections(collection_slug)';

/* ---------- reads --------------------------------------------------------- */

/** Products, optionally filtered to one collection. */
export async function listProducts({ collection = null, limit = 24 } = {}) {
  if (!isConfigured()) return [];

  try {
    // "picks" and "newin" are flags on the product itself, not real collections.
    if (collection === 'picks' || collection === 'newin') {
      const flag = collection === 'picks' ? 'is_pick' : 'is_new';
      const rows = await req(api(
        `products?select=${SELECT}&is_active=eq.true&${flag}=eq.true` +
        `&order=sort_order.asc,created_at.desc&limit=${limit}`
      ));
      return rows.map(shape);
    }

    if (collection && collection !== 'all') {
      // Inner join: only products tagged with this collection.
      const rows = await req(api(
        `products?select=*,product_images(url,alt,sort_order),` +
        `product_collections!inner(collection_slug)` +
        `&product_collections.collection_slug=eq.${encodeURIComponent(collection)}` +
        `&is_active=eq.true&order=sort_order.asc,created_at.desc&limit=${limit}`
      ));
      return rows.map(shape);
    }

    const rows = await req(api(
      `products?select=${SELECT}&is_active=eq.true` +
      `&order=sort_order.asc,created_at.desc&limit=${limit}`
    ));
    return rows.map(shape);
  } catch (err) {
    console.warn('[helora] could not load products:', err.message);
    return [];
  }
}

/** One product by its slug (the bit in the URL). */
export async function getProduct(slug) {
  if (!isConfigured() || !slug) return null;
  try {
    const rows = await req(api(
      `products?select=${SELECT}&slug=eq.${encodeURIComponent(slug)}&limit=1`
    ));
    return rows.length ? shape(rows[0]) : null;
  } catch (err) {
    console.warn('[helora] could not load product:', err.message);
    return null;
  }
}

/** Collection titles/intros from the database, falling back to config.js. */
export async function listCollections() {
  if (!isConfigured()) return [];
  try {
    return await req(api('collections?select=*&order=sort_order.asc'));
  } catch {
    return [];
  }
}

/* ---------- writes -------------------------------------------------------- */

/**
 * Places an order.
 * Prices are recalculated inside the database from the products table, so a
 * tampered-with price in the browser can't produce a cheap order.
 * Returns { order_no, total_cents, ... }.
 */
export async function placeOrder({ customer, items, paymentMethod }) {
  if (!isConfigured()) throw new Error('The shop isn’t connected to its database yet.');
  return req(api('rpc/place_order'), {
    method: 'POST',
    body: JSON.stringify({
      p_customer: customer,
      p_items: items.map((i) => ({ product_id: i.id, qty: i.qty, option: i.option || null })),
      p_payment_method: paymentMethod
    })
  });
}

/** Looks up one order for the "Track your order" box. */
export async function trackOrder(orderNo, email) {
  if (!isConfigured()) throw new Error('The shop isn’t connected to its database yet.');
  return req(api('rpc/track_order'), {
    method: 'POST',
    body: JSON.stringify({ p_order_no: orderNo.trim(), p_email: email.trim().toLowerCase() })
  });
}

/** Live prices + names for the items in the bag, so the bag is never stale. */
export async function priceBag(ids) {
  if (!isConfigured() || !ids.length) return {};
  try {
    const list = ids.map((i) => `"${i}"`).join(',');
    const rows = await req(api(
      `products?select=id,name,slug,price_cents,product_images(url,sort_order)&id=in.(${list})`
    ));
    const out = {};
    for (const r of rows) {
      const img = (r.product_images || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))[0];
      out[r.id] = {
        name: r.name, slug: r.slug, priceCents: r.price_cents ?? 0, image: img ? img.url : null
      };
    }
    return out;
  } catch {
    return {};
  }
}
