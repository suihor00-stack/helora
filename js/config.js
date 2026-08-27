/* ==========================================================================
   HELORA — settings
   This is the ONE file you edit to connect the site to your database.
   Everything else reads from here.
   ========================================================================== */

export const SUPABASE_URL      = 'https://ezhcfpuhxwncukzktaeh.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_Bfqp2LmEcHTq38MG-fCfBw_Wc76IiHw';

/* Where these come from: Supabase -> Project Settings -> API keys.
     SUPABASE_URL       the "Project URL" — it starts with https:// and ends
                        in .supabase.co. It is NOT a key.
     SUPABASE_ANON_KEY  the key labelled "publishable" (sb_publishable_...).

   These two are meant to be public — every Supabase website ships them in the
   browser. What actually protects your data is Row Level Security, which
   supabase/schema.sql switches on for you.

   NEVER paste the key labelled "secret" (sb_secret_... or service_role) into
   this file. That one bypasses every security rule and must stay off the
   internet. The check at the bottom of this file will stop the site loading
   if it ever ends up here. */

export const SITE = {
  name:     'HELORA',
  /* 客人看的店面。後台右上角的「看網站」會連到這裡。
     之後換成自己的域名（例如 https://heloraatelier.com）只要改這一行。 */
  shopUrl:  'https://heloraatelier.com',
  tagline:  'Hello, Aura.',
  blurb:    'Distinctive jewelry for everyday expression — made to feel like you.',
  currency: 'RM',              // shown next to every price
  locale:   'en-MY',
  ships:    'Malaysia & Singapore',
  year:     new Date().getFullYear(),
  madeIn:   'Made in Malaysia',
  email:    '',                // fill these in when you have them
  phone:    '',
  instagram:''
};

/* How checkout behaves.
     'stripe'      — the customer is sent to Stripe's secure payment page and
                     really pays. Needs the two Edge Functions deployed; see
                     CLAUDE.md → "Taking payments with Stripe".
     'record-only' — the order is saved but no money moves. Useful before the
                     Stripe side is set up, or if you take payment by hand. */
export const CHECKOUT_MODE = 'stripe';

/* Only used when CHECKOUT_MODE is 'record-only'. With Stripe, the customer
   picks how to pay on Stripe's own page, using whatever you switched on in
   your Stripe dashboard. */
export const PAY_METHODS = [
  { id: 'duitnow', name: 'DuitNow QR',            meta: 'Any bank app · instant' },
  { id: 'fpx',     name: 'Online banking (FPX)',  meta: 'Malaysian banks' },
  { id: 'card',    name: 'Credit or debit card',  meta: 'Visa · Mastercard · Amex' },
  { id: 'wallet',  name: 'E-wallet',              meta: 'Touch ’n Go · GrabPay' },
  { id: 'paynow',  name: 'PayNow',                meta: 'Singapore · S$' }
];

/* Collections = the shop menu. slug must match the "slug" column in the
   collections table. Editing this list changes the nav; editing the database
   changes what products appear inside each one. */
export const COLLECTIONS = [
  ['newin',     'New Arrivals',    'The latest to join HELORA—modern designs made for everyday wear, fresh off the bench.'],
  ['picks',     'HELORA Picks',    'A considered selection of HELORA pieces, chosen for their distinctive, easy-to-wear character.'],
  ['rings',     'Rings',           'From fine bands to sculptural shapes—rings made to stack, mix, and wear your way.'],
  ['earrings',  'Earrings',        'Studs, hoops, and drops—everyday earrings finished with quiet detail.'],
  ['moiss',     'Moissanite',      'Moissanite brings brilliance and colour to selected HELORA designs, adding sparkle that lasts.'],
  ['cz',        'Cubic Zirconia',  'A bright, versatile stone that brings a clean touch of sparkle to everyday pieces.'],
  ['gold',      'Gold Plated',     'Gold-plated finishes bring warmth and depth to selected designs.'],
  ['silver',    'Sterling Silver', 'Refined 925 sterling silver, finished with a clean, quiet character.'],
  ['everyday',  'Everyday',        'Easy, wear-anywhere pieces designed to become part of your daily rhythm.'],
  ['minimal',   'Minimalist',      'Clean lines and pared-back design, for those who love understated jewelry.'],
  ['statement', 'Statement',       'Bolder shapes and eye-catching silhouettes, for the days you want to be seen.'],
  ['gifts',     'Gifts',           'Pieces chosen with gifting in mind—personal, considered, and easy to make your own.'],
  ['edit',      'The Edit',        'A considered edit of distinctive pieces—modern, versatile, and made for everyday.']
];

export const COLS = Object.fromEntries(COLLECTIONS.map(([s, t, i]) => [s, [t, i]]));

/* Safety net: refuse to run with a secret key, rather than quietly shipping
   it to every visitor's browser. */
if (/^sb_secret_|service_role/.test(SUPABASE_ANON_KEY)) {
  throw new Error(
    'HELORA: that is the SECRET Supabase key. Use the "publishable" one ' +
    '(sb_publishable_...) in js/config.js, and rotate the secret key in ' +
    'Supabase -> Project Settings -> API keys.'
  );
}
if (SUPABASE_URL.startsWith('sb_')) {
  throw new Error(
    'HELORA: SUPABASE_URL should be the Project URL (https://....supabase.co), ' +
    'not a key. See js/config.js.'
  );
}

export const isConfigured = () =>
  SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 20;
