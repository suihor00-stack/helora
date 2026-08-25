-- ===========================================================================
-- 接 Stripe 付款
--
-- 怎麼跑：Supabase -> SQL Editor -> New query -> 貼上整份 -> Run
-- 跑一次就好，重複跑也不會壞。
-- ===========================================================================

alter table public.orders add column if not exists stripe_session_id   text;
alter table public.orders add column if not exists stripe_payment_intent text;
alter table public.orders add column if not exists paid_at             timestamptz;
alter table public.orders add column if not exists payment_detail      text;

create unique index if not exists idx_orders_stripe_session
  on public.orders (stripe_session_id) where stripe_session_id is not null;

-- 訂單狀態一覽：
--   pending_payment  等付款（剛送出，還沒付）
--   paid             已付款
--   preparing / shipped / delivered   出貨流程
--   cancelled        取消
--   expired          結帳頁過期沒付

-- ---------------------------------------------------------------------------
-- 讓客人查訂單時也看得到付款狀態
-- ---------------------------------------------------------------------------

create or replace function public.track_order(p_order_no text, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  select jsonb_build_object(
           'order_no',    o.order_no,
           'status',      o.status,
           'created_at',  o.created_at,
           'paid_at',     o.paid_at,
           'total_cents', o.total_cents
         )
    into v
    from public.orders o
   where upper(o.order_no) = upper(trim(p_order_no))
     and lower(o.email)    = lower(trim(p_email));
  return v;
end;
$$;

grant execute on function public.track_order(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 給付款頁用：只回傳「這張單付了沒」，不會洩漏客人資料
-- ---------------------------------------------------------------------------

create or replace function public.order_status(p_order_no text)
returns text
language sql
security definer
set search_path = public
as $$
  select status from public.orders
   where upper(order_no) = upper(trim(p_order_no));
$$;

revoke all on function public.order_status(text) from public;
grant execute on function public.order_status(text) to anon, authenticated;
