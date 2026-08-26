-- ===========================================================================
-- 把分類對齊新網站（helora-store）
--
-- 新網站的程式只認三個分類：Necklaces、Earrings、Rings。
-- 這份把它們排到最前面並放上選單，其他分類保留但收起來 —— 資料不會消失，
-- 之後想用隨時可以在後台重新啟用。
--
-- 怎麼跑：Supabase -> SQL Editor -> New query -> 貼上整份 -> Run
-- 跑幾次都一樣，不會重複累加。
-- ===========================================================================

-- 1. 新增「項鍊」（原本只有戒指和耳環）
insert into public.collections (slug, title, title_zh, intro, sort_order, is_active, show_in_nav)
values (
  'necklaces', 'Necklaces', '項鍊',
  'Fine chains and pendants, made to layer or to wear on their own.',
  1, true, true
)
on conflict (slug) do update set
  title       = excluded.title,
  title_zh    = excluded.title_zh,
  intro       = excluded.intro,
  sort_order  = excluded.sort_order,
  is_active   = true,
  show_in_nav = true;

-- 2. 新網站用得到的三個 —— 排最前面、上選單
update public.collections set sort_order = 1, show_in_nav = true, is_active = true where slug = 'necklaces';
update public.collections set sort_order = 2, show_in_nav = true, is_active = true where slug = 'earrings';
update public.collections set sort_order = 3, show_in_nav = true, is_active = true where slug = 'rings';

-- 3. 首頁用的兩個特別分類（靠商品自己勾選，不是靠標籤）
update public.collections set sort_order = 4, show_in_nav = false where slug = 'newin';
update public.collections set sort_order = 5, show_in_nav = false where slug = 'picks';

-- 4. 其餘的收起來，排在後面。資料都在，之後想用就在後台按「啟用」。
update public.collections set sort_order = 20, show_in_nav = false where slug = 'moiss';
update public.collections set sort_order = 21, show_in_nav = false where slug = 'cz';
update public.collections set sort_order = 22, show_in_nav = false where slug = 'gold';
update public.collections set sort_order = 23, show_in_nav = false where slug = 'silver';
update public.collections set sort_order = 24, show_in_nav = false where slug = 'everyday';
update public.collections set sort_order = 25, show_in_nav = false where slug = 'minimal';
update public.collections set sort_order = 26, show_in_nav = false where slug = 'statement';
update public.collections set sort_order = 27, show_in_nav = false where slug = 'gifts';
update public.collections set sort_order = 28, show_in_nav = false where slug = 'edit';

-- 5. 把測試商品清掉
delete from public.products where slug = 'test-ring' or name = 'Test Ring';
