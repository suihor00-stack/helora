/* ==========================================================================
   HELORA — small helpers used by every page
   ========================================================================== */

import { SITE } from './config.js';

/** Makes text safe to drop into HTML (stops a stray < from breaking the page). */
export function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** 12500 -> "RM 125.00" */
export function money(cents) {
  if (cents == null || Number.isNaN(cents)) return `${SITE.currency} —`;
  return `${SITE.currency} ${(cents / 100).toLocaleString(SITE.locale, {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  })}`;
}

/**
 * Price, with the old price struck through when the piece is on offer.
 * Anything that isn't a genuine reduction is ignored, so a stray value in
 * the admin can't render "RM 189 was RM 12".
 */
export function priceHTML(priceCents, compareAtCents) {
  const onOffer = compareAtCents != null && compareAtCents > priceCents;
  if (!onOffer) return money(priceCents);
  return `<span class="price-now">${money(priceCents)}</span>` +
         `<span class="price-was">${money(compareAtCents)}</span>`;
}

/**
 * An image frame. Shows the picture if there is one, otherwise the grey
 * caption box from the design ("Product on white · 268 × 268 px").
 */
export function frame(img, caption, opts = {}) {
  const { cls = '', style = '', hover = null, lazy = true } = opts;
  const loading = lazy ? ' loading="lazy" decoding="async"' : '';
  const inner = img
    ? `<img src="${esc(img.url || img)}" alt="${esc(img.alt || caption || '')}"${loading}>`
    : `<span class="cap">${esc(caption || '')}</span>`;
  const back = hover
    ? `<div class="sw-b"><img src="${esc(hover.url || hover)}" alt=""${loading}></div>`
    : '';
  return `<div class="ph ${hover ? 'sw' : ''} ${cls}"${style ? ` style="${style}"` : ''}>${inner}${back}</div>`;
}

/** Watches for elements scrolling into view and fades them up. */
export function reveals(root = document) {
  if (!('IntersectionObserver' in window)) {
    root.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
  root.querySelectorAll('[data-reveal]:not(.is-in)').forEach((el) => io.observe(el));
}

/** Wires up every element with a data-go="route" attribute. */
export function wireNav(root, go) {
  root.querySelectorAll('[data-go]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      go(el.dataset.go);
    });
  });
}

/** Accordion behaviour for FAQ-style lists. */
export function wireAccordion(root) {
  root.querySelectorAll('.acc-q').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.acc-item');
      const open = item.classList.contains('is-open');
      item.classList.toggle('is-open', !open);
      btn.setAttribute('aria-expanded', String(!open));
      const mark = btn.querySelector('.mark');
      if (mark) mark.textContent = open ? '＋' : '✕';
    });
  });
}

/** Turns "Rose Gold Band" into "rose-gold-band". */
export function slugify(s) {
  return String(s).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
