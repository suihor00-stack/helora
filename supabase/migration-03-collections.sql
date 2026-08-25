-- ===========================================================================
-- 讓分類（Collections）變成你自己可以管的
--
-- 怎麼跑：Supabase -> SQL Editor -> New query -> 貼上整份 -> Run
-- 跑一次就好，重複跑也不會壞。不會刪任何東西。
-- ===========================================================================

-- 中文名稱（後台顯示用）、要不要啟用、要不要出現在網站上方選單
alter table public.collections add column if not exists title_zh    text;
alter table public.collections add column if not exists is_active   boolean not null default true;
alter table public.collections add column if not exists show_in_nav boolean not null default false;

-- 客人只看得到啟用中的分類
drop policy if exists "public reads collections" on public.collections;
create policy "public reads collections" on public.collections
  for select using (is_active = true);

-- 幫現有的 13 個分類補上中文名字
update public.collections set title_zh = v.zh
  from (values
    ('newin','新品上市'), ('picks','HELORA 精選'), ('rings','戒指'),
    ('earrings','耳環'),  ('moiss','莫桑石'),      ('cz','鋯石'),
    ('gold','鍍金'),      ('silver','925 純銀'),   ('everyday','日常'),
    ('minimal','極簡'),   ('statement','個性款'),  ('gifts','送禮'),
    ('edit','編輯精選')
  ) as v(slug, zh)
 where public.collections.slug = v.slug
   and coalesce(public.collections.title_zh, '') = '';

-- 預設讓「戒指」和「耳環」出現在網站上方的 Shop 選單
update public.collections set show_in_nav = true
 where slug in ('rings','earrings') ;
