/**
 * stripe-webhook — Stripe 付款完成後會打這支，我們才把訂單標記成已付款
 *
 * ⚠️ 這支一定要在 Supabase 後台把「Verify JWT」關掉，
 *    因為 Stripe 不會帶我們的登入權杖。它靠簽章驗證身分（下面 verify()）。
 *
 * 需要的環境變數：
 *   STRIPE_WEBHOOK_SECRET   whsec_...（在 Stripe 建立 webhook 後會給）
 */

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const SB_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SB_SERVICE     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const enc = new TextEncoder();

/** 長度固定的比對，避免用比對速度反推簽章。 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * 驗證這個請求真的是 Stripe 送來的。
 * 標頭長這樣：stripe-signature: t=1699999999,v1=abc123...
 * 簽章內容是 "<t>.<原始 body>"，用 webhook secret 做 HMAC-SHA256。
 */
async function verify(rawBody: string, header: string | null): Promise<boolean> {
  if (!header || !WEBHOOK_SECRET) return false;

  let t = '';
  const sigs: string[] = [];
  for (const seg of header.split(',')) {
    const i = seg.indexOf('=');
    if (i < 0) continue;
    const k = seg.slice(0, i).trim();
    const v = seg.slice(i + 1).trim();
    if (k === 't') t = v;
    else if (k === 'v1') sigs.push(v);
  }
  if (!t || sigs.length === 0) return false;

  // 拒收超過 5 分鐘的請求，擋重放攻擊
  const ts = Number(t);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const key = await crypto.subtle.importKey(
    'raw', enc.encode(WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${rawBody}`));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0')).join('');

  return sigs.some((s) => safeEqual(s, expected));
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
  if (!res.ok) throw new Error(text || `Supabase ${res.status}`);
  return text ? JSON.parse(text) : null;
}

/** 只更新還沒付款的那些列，所以 Stripe 重送同一個事件也不會出錯。 */
const patchOrder = (sessionId: string, patch: Record<string, unknown>, onlyUnpaid = true) =>
  sb(`orders?stripe_session_id=eq.${encodeURIComponent(sessionId)}` +
     (onlyUnpaid ? '&status=eq.pending_payment' : ''), {
    method: 'PATCH', body: JSON.stringify(patch)
  });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const raw = await req.text();

  if (!(await verify(raw, req.headers.get('stripe-signature')))) {
    console.warn('簽章驗證失敗，忽略這個請求');
    return new Response('Invalid signature', { status: 400 });
  }

  let event: { type: string; data: { object: Record<string, any> } };
  try { event = JSON.parse(raw); }
  catch { return new Response('Bad payload', { status: 400 }); }

  const obj = event.data?.object ?? {};
  const sessionId: string = obj.id ?? '';

  try {
    switch (event.type) {
      // 卡片這類是當下就付掉；FPX 這種非同步的會先進來但 payment_status 還是 unpaid
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        if (obj.payment_status === 'paid') {
          await patchOrder(sessionId, {
            status: 'paid',
            paid_at: new Date().toISOString(),
            stripe_payment_intent: obj.payment_intent ?? null,
            payment_method: (obj.payment_method_types?.[0] ?? 'card'),
            payment_detail: obj.payment_method_types?.join(', ') ?? null
          });
          console.log('已標記付款完成', obj.metadata?.order_no ?? sessionId);
        }
        break;
      }

      case 'checkout.session.async_payment_failed': {
        await patchOrder(sessionId, { status: 'cancelled' });
        break;
      }

      case 'checkout.session.expired': {
        await patchOrder(sessionId, { status: 'expired' });
        break;
      }

      default:
        // 其他事件不處理，但還是回 200，Stripe 才不會一直重送
        break;
    }
  } catch (err) {
    console.error('處理事件時出錯', err);
    return new Response('Handler error', { status: 500 });   // 讓 Stripe 稍後重送
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
