/* ==========================================================================
   HELORA — the written pages
   Story · Craftsmanship · Ring Size · FAQ · Shipping · Care · Returns ·
   Contact · Legal.  All the wording comes straight from the design file.
   Edit the text right here — it isn't in the database.
   ========================================================================== */

import { frame, esc } from './ui.js';
import { SITE } from './config.js';

const head = (eyebrow, title, lead = '', center = false) => `
  <div class="pg-head${center ? ' center' : ''}" data-reveal>
    <div class="eb">${esc(eyebrow)}</div>
    <h1 class="ti">${esc(title)}</h1>
    ${lead ? `<p class="p">${lead}</p>` : ''}
  </div>`;

/* ---------- Our Story ------------------------------------------------------ */

export const story = () => `
  ${head('About', 'Our Story')}
  <div class="wrap" data-reveal>
    ${frame(null, 'Brand image, wide crop, white background · 1240 × 380 px', { style: 'aspect-ratio:1240/380' })}
  </div>
  <div class="story-cols">
    <p class="p" data-reveal>
      HELORA begins with a simple thought: say hello to what is already yours.<br><br>
      Your aura is your presence, your instinct and your individuality — the way you
      make something your own. HELORA creates jewelry to accompany that expression,
      not define it.
    </p>
    <p class="p" data-reveal style="transition-delay:.1s">
      We design modern, distinctive pieces for everyday wear — refined enough to live
      in, individual enough to feel your own. Wear them to work, to dinner, and on the
      days that are simply yours.
    </p>
  </div>
  <div class="story-quote" data-reveal><div class="q">Hello, Aura.</div></div>
  <div class="story-more">
    <div data-reveal>${frame(null, 'Detail shot on white background')}</div>
    <div data-reveal style="transition-delay:.1s">
      <div class="sh">Continue reading</div>
      <div class="story-links">
        <span class="lnk" data-go="craft">Craftsmanship <span>→</span></span>
        <span class="lnk" data-go="craft">Materials <span>→</span></span>
        <span class="lnk" data-go="moiss">Aura Stone <span>→</span></span>
      </div>
    </div>
  </div>`;

/* ---------- Craftsmanship -------------------------------------------------- */

const CRAFT = [
  ['01', 'Design',       'We refine each piece down to the lines and proportions that feel right — distinctive, considered, and easy to wear every day.'],
  ['02', 'Details',      'Every element is considered for how it looks, feels and works as part of the design, creating pieces that feel refined without being overdone.'],
  ['03', 'Finishing',    'Each piece is carefully finished and checked before it leaves us, with attention to comfort, balance and the details that shape the final feel.'],
  ['04', 'Presentation', 'Every order is thoughtfully presented, whether it is being given or kept.']
];

export const craft = () => `
  ${head('About', 'Craftsmanship',
    'HELORA jewelry is thoughtfully made and carefully finished, with attention to the details you notice up close.')}
  ${CRAFT.map(([n, title, body], i) => {
    const copy = `
      <div data-reveal>
        <div class="n">${n}</div>
        <h3>${esc(title)}</h3>
        <p class="p">${esc(body)}</p>
      </div>`;
    const pic = `<div data-reveal style="transition-delay:.1s">${frame(null, 'Detail shot on white background')}</div>`;
    return `<div class="craft-row">${i % 2 === 0 ? copy + pic : pic + copy}</div>`;
  }).join('')}
  <div class="story-quote" data-reveal>
    <div class="q">Made with intention. Designed to be lived in.</div>
  </div>`;

/* ---------- Ring Size Guide ------------------------------------------------ */

const SIZES = [
  ['9', '49.0 mm', '15.6 mm'], ['10', '50.0 mm', '15.9 mm'],
  ['11', '51.2 mm', '16.3 mm'], ['12', '52.5 mm', '16.7 mm'],
  ['13', '53.8 mm', '17.1 mm'], ['14', '55.1 mm', '17.5 mm'],
  ['15', '56.3 mm', '17.9 mm'], ['16', '57.6 mm', '18.3 mm']
];

export const size = () => `
  ${head('Guides', 'Ring Size Guide', 'The right fit makes all the difference.', true)}
  <div class="two-col">
    <div data-reveal>
      <div class="sh">Measure at home</div>
      <div class="steps-list">
        <div><span class="n">01</span><span class="p">Wrap a thin strip of paper or string around your finger</span></div>
        <div><span class="n">02</span><span class="p">Mark where it overlaps and measure the length in millimetres</span></div>
        <div><span class="n">03</span><span class="p">Match that circumference to a standard ring size chart</span></div>
      </div>
      <div class="callout">
        Measure at the end of the day, when fingers are at their largest.
        If you’re between sizes, go up.
      </div>
    </div>
    <div data-reveal style="transition-delay:.1s">
      <div class="sh">Size chart</div>
      <table class="tbl">
        <thead><tr><th>Size</th><th>Circumference</th><th>Diameter</th></tr></thead>
        <tbody>
          ${SIZES.map(([s, c, d]) => `<tr><td>${s}</td><td>${c}</td><td>${d}</td></tr>`).join('')}
        </tbody>
      </table>
      <p class="fine">Confirm these figures against your own supplier’s chart before publishing.</p>
    </div>
  </div>`;

/* ---------- FAQ ------------------------------------------------------------ */

const FAQ = [
  ['What materials do you use?',
   '925 sterling silver and 18K gold vermeil, with stones such as moissanite or cubic zirconia in selected pieces. The exact materials are listed on each product page.'],
  ['How do I find my ring size?',
   'Wrap a thin strip of paper around your finger, mark where it overlaps, and measure that length in millimetres — then match it to our chart. Measure at the end of the day, and size up if you’re in between. Our Ring Size Guide walks through it step by step.'],
  ['Where do you deliver?',
   `We deliver across ${SITE.ships}, with tracking included on every order. Delivery is complimentary on all accepted orders. We aren’t shipping further afield just yet.`],
  ['What is the return window?',
   'You may return or exchange an item within 30 days of the date you receive it, as long as it’s unworn and in its original condition and packaging. For hygiene reasons, earrings can only be returned if unopened and unworn.'],
  ['What does the warranty cover?',
   'Our Limited Lifetime Craftsmanship Warranty covers eligible manufacturing and craftsmanship defects for the original purchaser with proof of purchase. It does not cover normal wear, scratches, tarnish, plating wear, accidental damage or third-party repairs.'],
  ['Can I add a gift message?',
   'Yes — there’s a gift message field at checkout, and every order arrives thoughtfully presented in a HELORA gift box with a polishing cloth.']
];

const FAQ_NAV = ['Products', 'Sizing', 'Delivery', 'Returns & warranty', 'Gifting'];

export const faq = () => `
  ${head('Help', 'FAQ')}
  <div class="two-col">
    <div data-reveal>
      <div class="sh">Browse by topic</div>
      <div class="side-nav">
        ${FAQ_NAV.map((n, i) => `<button type="button" data-faq="${i}">${esc(n)}</button>`).join('')}
      </div>
    </div>
    <div class="acc" data-reveal style="transition-delay:.1s">
      ${FAQ.map(([q, a], i) => `
        <div class="acc-item${i === 0 ? ' is-open' : ''}">
          <button class="acc-q" type="button" aria-expanded="${i === 0}">
            <span>${esc(q)}</span><span class="mark">${i === 0 ? '✕' : '＋'}</span>
          </button>
          <div class="acc-a"><p class="p">${esc(a)}</p></div>
        </div>`).join('')}
    </div>
  </div>`;

/* ---------- Shipping ------------------------------------------------------- */

export const shipping = () => `
  ${head('Help', 'Shipping', 'Every HELORA piece is carefully packaged to arrive safely.', true)}
  <div class="two-col">
    <div data-reveal>
      <div class="sh">Where we deliver</div>
      <table class="tbl">
        <thead><tr><th>Destination</th><th>Delivery</th></tr></thead>
        <tbody>
          <tr><td>Malaysia</td><td>Complimentary · tracked</td></tr>
          <tr><td>Singapore</td><td>Complimentary · tracked</td></tr>
          <tr><td>Elsewhere</td><td>Not available yet</td></tr>
        </tbody>
      </table>
      <p class="fine">Dispatch timing will be confirmed closer to launch.</p>
    </div>
    <div data-reveal style="transition-delay:.1s">
      <div class="sh">After you order</div>
      <div class="steps-list">
        <div><span class="n">01</span><span class="p">Order confirmed — receipt sent by email</span></div>
        <div><span class="n">02</span><span class="p">Packed in a HELORA gift box with polishing cloth</span></div>
        <div><span class="n">03</span><span class="p">Shipped — tracking details sent by email</span></div>
        <div><span class="n">04</span><span class="p">Delivered</span></div>
      </div>
      <div style="margin-top:34px">
        <div class="sh">Track your order</div>
        <form class="track-form" data-track>
          <input name="order_no" placeholder="Order number" aria-label="Order number" required>
          <button class="btn-ghost" type="submit" style="padding:13px 22px">Track</button>
        </form>
        <input class="track-email" name="email" type="email" placeholder="Email used on the order"
               aria-label="Email used on the order"
               style="margin-top:10px;max-width:420px;width:100%;border:1px solid var(--field);padding:13px 14px;font:400 13.5px/1.2 Inter,sans-serif;outline:none">
        <div class="track-out" role="status"></div>
      </div>
    </div>
  </div>`;

/* ---------- Jewelry Care --------------------------------------------------- */

const CARE = [
  ['Cleaning',      'Wipe each piece gently with a soft, lint-free cloth after wearing. For a deeper clean, use lukewarm water with a small amount of mild soap and a soft brush, then dry completely before storing. Avoid harsh chemicals and ultrasonic cleaners.'],
  ['Storage',       'Store each piece separately in a dry, protected place, away from direct sunlight and humidity. Keeping pieces apart helps reduce scratches and tangled chains.'],
  ['Travel',        'When you travel, keep your jewelry in a soft pouch or a dedicated case so pieces do not rub together. Fasten clasps and arrange chains to help prevent tangling.'],
  ['Daily wear',    'Jewelry is best put on last and taken off first. Apply perfume, lotion and hair products before wearing your pieces, and remove jewelry before showering, swimming or sleeping.'],
  ['Long-term care','Gentle, regular care helps keep your jewelry looking its best over time. Store pieces carefully, clean them softly, and follow the material-specific guidance provided for each design.']
];

export const care = () => `
  ${head('Help', 'Jewelry Care',
    'A few simple habits can help keep your HELORA pieces looking their best through everyday wear.', true)}
  <div class="care-grid">
    ${CARE.map(([t, b], i) => `
      <div data-reveal${i ? ` style="transition-delay:.0${i * 6}s"` : ''}>
        <div class="sh">${esc(t)}</div>
        <p class="p">${esc(b)}</p>
      </div>`).join('')}
    <div data-reveal>${frame(null, 'Detail shot on white background')}</div>
  </div>`;

/* ---------- Returns & Exchanges -------------------------------------------- */

const RETURNS = [
  ['Return Window', ['You may return or exchange an item within 30 days of the date you receive it.']],
  ['Condition', [
    'Returned items must be unworn, unused, undamaged and in their original condition, with original packaging, tags, any certificates, and any included items. Proof of purchase — your order number or a valid receipt — is required. All returns are subject to inspection and approval.',
    'Returns may be refused if an item shows signs of wear, scratches, stains, deformation, missing parts, alterations, repairs, or materially incomplete packaging or accessories. These conditions do not affect your statutory rights for faulty, misdescribed or otherwise legally protected goods.'
  ]],
  ['Earrings', ['For hygiene reasons, earrings can only be returned or exchanged if unopened and unworn. Faulty or misdescribed earrings remain covered by applicable consumer rights.']],
  ['Sale Items', ['For now, sale and final-sale items may be returned or exchanged under the same conditions above.']],
  ['Return Shipping', ['For a change of mind, return shipping is paid by you. If an item is faulty or incorrect, HELORA covers reasonable return shipping.']],
  ['Refunds', ['Approved returns are refunded in full to your original payment method. We initiate refunds within 5–7 business days of approving your return.']],
  ['Exchanges', ['Exchanges can be arranged within the same 30-day window.']]
];

export const returns = () => `
  ${head('Help', 'Returns & Exchanges')}
  <div class="two-col">
    <div data-reveal>
      <div class="sh">On this page</div>
      <div class="side-nav">
        ${RETURNS.map(([t]) => `<button type="button" data-jump="${esc(t)}">${esc(t)}</button>`).join('')}
      </div>
      <p class="fine">See also: Warranty · <span class="ul" data-go="legal">Refund Policy</span></p>
    </div>
    <div class="blocks" data-reveal style="transition-delay:.1s">
      <p class="p">We want you to be happy with your HELORA piece. If something isn’t right, here’s how returns and exchanges work.</p>
      ${RETURNS.map(([t, ps]) => `
        <div id="r-${esc(t)}">
          <h3>${esc(t)}</h3>
          ${ps.map((p) => `<p class="p">${esc(p)}</p>`).join('')}
        </div>`).join('')}
      <div class="callout">
        <div class="sh" style="margin-bottom:10px">Limited Lifetime Craftsmanship Warranty</div>
        <p class="p" style="margin:0;font-size:13.5px">
          We stand behind how our pieces are made. Coverage is limited to eligible
          manufacturing and craftsmanship defects, applies to the original purchaser with
          proof of purchase, and may be resolved by repair, replacement or an equivalent
          solution. It does not cover normal wear, scratches, tarnish, plating wear or
          fading, accidental damage, misuse, improper care, loss, or third-party repair
          or alteration.
        </p>
      </div>
    </div>
  </div>`;

/* ---------- Contact -------------------------------------------------------- */

export const contact = () => `
  <div class="two-col" style="padding-top:76px">
    <div data-reveal>
      <div class="eb">Help</div>
      <h1 class="ti" style="margin-top:14px">Contact</h1>
      <p class="p" style="margin-top:16px">We’d love to hear from you.</p>
      <p class="p">Full contact details will be available soon. In the meantime, you’re welcome to explore the collection.</p>
      <div class="kv">
        <div><span class="k">Email</span><span class="v">${SITE.email ? esc(SITE.email) : 'to be added'}</span></div>
        <div><span class="k">Phone</span><span class="v">${SITE.phone ? esc(SITE.phone) : 'to be added'}</span></div>
        <div><span class="k">Instagram</span><span class="v">${SITE.instagram ? esc(SITE.instagram) : 'to be added'}</span></div>
      </div>
    </div>
    <div data-reveal style="transition-delay:.1s">
      <div class="eb">Services</div>
      <h2 class="ti" style="margin-top:14px">Book an Appointment</h2>
      <p class="p" style="margin-top:16px">Appointments aren’t available just yet.</p>
      <p class="p">We may introduce one-to-one appointments in the future, alongside services such as custom pieces and consultations. We’ll share more here when they’re ready.</p>
      <div class="callout">Notify me when appointments open — add an email field here once the service is confirmed.</div>
    </div>
  </div>`;

/* ---------- Legal ---------------------------------------------------------- */

const LEGAL = [
  ['Privacy Policy', [
    'Your privacy matters to us.',
    'When you shop with HELORA or get in touch, we collect the information needed to fulfil your order and support you—your name, contact details, shipping address, and order history. We use it only to process orders, provide customer service, and, if you’ve opted in, send you updates. We never sell your personal data.',
    'We keep your information only as long as needed for these purposes or as required by law, and protect it with appropriate security measures. Payments are handled by our payment providers, and we do not store your full card details.',
    'You can ask to access, correct or delete your information at any time.'
  ]],
  ['Terms & Conditions', [
    'Welcome to HELORA. By using this website, you agree to use it lawfully and not to misuse its content. All text, images, and designs on this site belong to HELORA and may not be reproduced without our permission.',
    'We take care to describe our pieces and prices accurately, though colours may vary slightly between screens, and prices and availability may change without notice. Orders are confirmed once payment is received, and we may decline or cancel an order where necessary.'
  ]],
  ['Refund Policy', [
    'If your return is approved, you’ll receive a full refund to your original payment method. We initiate approved refunds within 5–7 business days. The time it takes to appear on your statement can vary by bank or provider. Returns must meet the conditions on our Returns page.'
  ]],
  ['Cookie Policy', [
    'This website uses cookies to work properly and to improve your experience. We use essential cookies that keep the site running—remembering your bag and preferences—and analytics cookies that help us understand how the site is used so we can make it better. We don’t use cookies to sell your data.',
    'You can manage or disable cookies at any time in your browser settings, though some features may not work as smoothly without them.'
  ]],
  ['Accessibility', [
    'We want everyone to feel at home browsing HELORA. We continue to improve the readability, contrast and keyboard navigation of our site so the experience can feel as clear and comfortable as possible. This is ongoing work.',
    'If you encounter a barrier while using the site, or have a suggestion, we’d like to hear about it. Your feedback helps us keep improving.'
  ]]
];

export const legal = () => `
  <div class="two-col" style="padding-top:76px">
    <div data-reveal>
      <div class="eb">Legal</div>
      <div class="side-nav" style="margin-top:22px">
        ${LEGAL.map(([t], i) => `<button type="button" data-jump="${esc(t)}"${i === 0 ? ' class="is-on"' : ''}>${esc(t)}</button>`).join('')}
      </div>
      <p class="fine">Last updated — add a date once the wording is final with your payment provider.</p>
    </div>
    <div class="blocks" data-reveal style="transition-delay:.1s">
      ${LEGAL.map(([t, ps], i) => `
        <div id="r-${esc(t)}">
          ${i === 0 ? `<h2 class="ti" style="font-size:34px;margin:0 0 14px">${esc(t)}</h2>`
                    : `<h3>${esc(t)}</h3>`}
          ${ps.map((p) => `<p class="p">${esc(p)}</p>`).join('')}
        </div>`).join('')}
    </div>
  </div>`;
