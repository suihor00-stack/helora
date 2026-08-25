/* ==========================================================================
   HELORA — 分類 collections
   Which collections exist, what they're called, and which ones show in the
   Shop menu — all of it comes from the database so the shop owner can change
   it in 後台 -> 分類. config.js only supplies the starting set, used as a
   fallback if the database can't be reached.
   ========================================================================== */

import { COLLECTIONS as SEED } from './config.js';
import { listCollections } from './data.js';

const seeded = SEED.map(([slug, title, intro], i) => ({
  slug, title, title_zh: '', intro,
  sort_order: i + 1,
  is_active: true,
  show_in_nav: slug === 'rings' || slug === 'earrings'
}));

let rows = seeded;

/** Reads the collections once at start-up. Falls back to the seed list. */
export async function loadCollections() {
  try {
    const fromDb = await listCollections();
    const live = (fromDb || []).filter((r) => r.is_active !== false);
    if (live.length) rows = live;
  } catch {
    /* keep the seed list */
  }
  return rows;
}

export const allCollections = () => rows;

/** { slug: [title, intro] } — the shape the page templates expect. */
export const colMap = () =>
  Object.fromEntries(rows.map((r) => [r.slug, [r.title, r.intro || '']]));

/**
 * The ones the owner ticked to appear in the Shop menu. Before anyone has
 * ticked anything (or before migration-03 adds the column) fall back to rings
 * and earrings, so the menu is never empty.
 */
export const navCollections = () => {
  const picked = rows.filter((r) => r.show_in_nav);
  if (picked.length) return picked;
  const preferred = rows.filter((r) => r.slug === 'rings' || r.slug === 'earrings');
  return preferred.length ? preferred : rows.slice(0, 2);
};

export const isCollectionSlug = (s) => s === 'all' || rows.some((r) => r.slug === s);

export const collectionTitle = (slug) => {
  if (slug === 'all') return ['Shop All', 'Every HELORA piece, in one place.'];
  const hit = rows.find((r) => r.slug === slug);
  return hit ? [hit.title, hit.intro || ''] : ['Shop All', 'Every HELORA piece, in one place.'];
};
