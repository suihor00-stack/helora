-- ===========================================================================
-- 加上「原價」欄位（做折扣用）
--
-- 怎麼跑：
--   Supabase -> SQL Editor -> New query -> 貼上整份 -> Run
-- 跑一次就好，重複跑也不會壞。
-- ===========================================================================

alter table public.products
  add column if not exists compare_at_cents int
  check (compare_at_cents is null or compare_at_cents >= 0);

comment on column public.products.compare_at_cents is
  '折扣前的原價（單位：分）。留空表示沒有在特價。網站上會顯示成劃掉的舊價。';
