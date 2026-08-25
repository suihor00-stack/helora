/* ==========================================================================
   HELORA — the shopping bag and wishlist
   Both live in the browser's own storage, so there's no login to shop.
   ========================================================================== */

const BAG_KEY  = 'helora.bag.v1';
const WISH_KEY = 'helora.wish.v1';

const listeners = new Set();

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
  listeners.forEach((fn) => fn());
}

/** Called whenever the bag or wishlist changes, so the header count updates. */
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/* ---------- bag ----------------------------------------------------------- */

/** [{ id, name, slug, priceCents, image, option, qty }] */
export const getBag = () => read(BAG_KEY, []);

export function addToBag(item, qty = 1) {
  const bag = getBag();
  const key = (b) => `${b.id}::${b.option || ''}`;
  const hit = bag.find((b) => key(b) === key(item));
  if (hit) hit.qty += qty;
  else bag.push({ ...item, qty });
  write(BAG_KEY, bag);
}

export function removeFromBag(id, option = '') {
  write(BAG_KEY, getBag().filter((b) => !(b.id === id && (b.option || '') === option)));
}

export function setQty(id, option, qty) {
  const bag = getBag();
  const hit = bag.find((b) => b.id === id && (b.option || '') === option);
  if (!hit) return;
  if (qty <= 0) return removeFromBag(id, option);
  hit.qty = qty;
  write(BAG_KEY, bag);
}

export const clearBag = () => write(BAG_KEY, []);

export const bagCount    = () => getBag().reduce((n, b) => n + b.qty, 0);
export const bagSubtotal = () => getBag().reduce((n, b) => n + (b.priceCents || 0) * b.qty, 0);

/** Refreshes names, prices and photos from the database. */
export function syncBagPrices(priceMap) {
  const bag = getBag();
  let touched = false;
  for (const b of bag) {
    const fresh = priceMap[b.id];
    if (!fresh) continue;
    if (b.priceCents !== fresh.priceCents || b.name !== fresh.name || b.image !== fresh.image) {
      b.priceCents = fresh.priceCents;
      b.name = fresh.name;
      b.slug = fresh.slug;
      b.image = fresh.image;
      touched = true;
    }
  }
  if (touched) write(BAG_KEY, bag);
}

/* ---------- wishlist ------------------------------------------------------ */

export const getWishes = () => read(WISH_KEY, {});
export const isWished  = (id) => !!getWishes()[id];

export function toggleWish(id) {
  const w = getWishes();
  if (w[id]) delete w[id]; else w[id] = true;
  write(WISH_KEY, w);
  return !!w[id];
}
