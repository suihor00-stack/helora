/**
 * create-checkout — 把購物車變成一個 Stripe 付款頁
 *
 * 流程：
 *   1. 先用 place_order 在資料庫建一張訂單（價錢是資料庫自己算的，不信瀏覽器）
 *   2. 拿那張訂單的內容去跟 Stripe 開一個結帳頁
 *   3. 把付款頁網址回傳給瀏覽器，讓它跳過去
 *
 * 需要的環境變數（在 Supabase → Edge Functions → Secrets 設定）：
 *   STRIPE_SECRET_KEY   sk_live_... 或 sk_test_...
 *   SITE_URL            https://helora.suihor00.workers.dev
 *   CURRENCY            myr（可省略）
 * SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 由 Supabase 自動提供。
 */

const STRIPE_KEY   = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

/**
 * Stripe rejects a return address that isn't a full URL, and the error it
 * gives back ("Not a valid URL") doesn't say which one. So tidy up the usual
 * slips here — a missing scheme, a trailing slash, stray whitespace — and
 * check it parses before we ever call Stripe.
 */
function normaliseSiteUrl(raw: string): { url: string; error?: string } {
  let v = (raw ?? '').trim().replace(/\/+$/, '');
  if (!v) return { url: '', error: 'SITE_URL 沒有設定。' };
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  try {
    const parsed = new URL(v);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error('bad scheme');
    return { url: v };
  } catch {
    return { url: '', error: `SITE_URL 的值不是有效網址：「${raw}」` };
  }
}

const SITE = normaliseSiteUrl(Deno.env.get('SITE_URL') ?? '');
const SITE_URL = SITE.url;
const CURRENCY     = (Deno.env.get('CURRENCY') ?? 'myr').toLowerCase();
const SB_URL       = Deno.env.get('SUPABASE_URL') ?? '';
const SB_SERVICE   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const cors = {
  'Access-Control-Allow-Origin': SITE_URL || '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin'
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });

/** Stripe 的 API 吃 form 格式，巢狀資料要攤平成 a[b][c] 這種鍵名。 */
function flatten(obj: Record<string, unknown>, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item && typeof item === 'object') flatten(item as Record<string, unknown>, `${key}[${i}]`, out);
        else out.append(`${key}[${i}]`, String(item));
      });
    } else if (typeof v === 'object') {
      flatten(v as Record<string, unknown>, key, out);
    } else {
      out.append(key, String(v));
    }
  }
  return out;
}

async function sb(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SB_SERVICE,
      Authorization: `Bearer ${SB_SERVICE}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {})
    }
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(body?.message ?? `Supabase ${res.status}`);
  return body;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405);

  if (!STRIPE_KEY) return json({ error: '付款還沒設定好（少了 STRIPE_SECRET_KEY）。' }, 500);
  if (SITE.error)  return json({ error: `付款還沒設定好：${SITE.error}` }, 500);

  try {
    const { customer, items } = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return json({ error: '你的購物車是空的。' }, 400);
    }

    // 1. 先建訂單。價錢由資料庫依商品表重算，瀏覽器送什麼價錢都沒用。
    const order = await sb('rpc/place_order', {
      method: 'POST',
      body: JSON.stringify({
        p_customer: customer,
        p_items: items.map((i: { id: string; qty: number; option?: string }) => ({
          product_id: i.id, qty: i.qty, option: i.option ?? null
        })),
        p_payment_method: 'card'      // 實際用哪種由 Stripe 那頁決定，webhook 會回填
      })
    });

    const orderNo: string = order.order_no;
    const lines: Array<{ name: string; qty: number; unit_price_cents: number; option?: string }> =
      order.items ?? [];

    if (!lines.length) return json({ error: '訂單建立失敗，請再試一次。' }, 500);

    // 2. 開 Stripe 結帳頁。不指定付款方式，讓 Stripe 顯示你後台開啟的所有選項
    //    （卡片、FPX、GrabPay…），這樣不會因為某個方式沒開通就整個失敗。
    const params = flatten({
      mode: 'payment',
      client_reference_id: orderNo,
      customer_email: customer?.email ?? undefined,
      success_url: `${SITE_URL}/?order=${encodeURIComponent(orderNo)}&paid=1`,
      cancel_url:  `${SITE_URL}/?cancelled=1`,
      metadata: { order_no: orderNo },
      payment_intent_data: { metadata: { order_no: orderNo } },
      line_items: lines.map((l) => ({
        quantity: l.qty,
        price_data: {
          currency: CURRENCY,
          unit_amount: l.unit_price_cents,
          product_data: {
            name: l.option ? `${l.name} — ${l.option}` : l.name
          }
        }
      }))
    });

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });
    const session = await res.json();

    if (!res.ok) {
      console.error('stripe error', session);
      // 訂單已經建了但沒付成，標記起來以免被當成待出貨
      await sb(`orders?order_no=eq.${encodeURIComponent(orderNo)}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'cancelled' })
      }).catch(() => {});
      return json({ error: session?.error?.message ?? '無法建立付款頁面。' }, 502);
    }

    // 3. 記下 session id，webhook 回來時靠它對帳
    await sb(`orders?order_no=eq.${encodeURIComponent(orderNo)}`, {
      method: 'PATCH',
      body: JSON.stringify({ stripe_session_id: session.id })
    });

    return json({ url: session.url, order_no: orderNo, total_cents: order.total_cents });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message ?? '結帳時出了點問題。' }, 400);
  }
});
