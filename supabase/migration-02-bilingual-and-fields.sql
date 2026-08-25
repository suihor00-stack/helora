-- ===========================================================================
-- 商品雙語 + 自訂欄位
--
-- 怎麼跑：Supabase -> SQL Editor -> New query -> 貼上整份 -> Run
-- 跑一次就好，重複跑也不會壞。
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. 商品的中文名稱和描述
--    原本的 name / description 當作英文版（也是後備），另外加中文版。
-- ---------------------------------------------------------------------------

alter table public.products add column if not exists name_zh        text;
alter table public.products add column if not exists description_zh text;

-- ---------------------------------------------------------------------------
-- 2. 自訂欄位
--    欄位「有哪些」放在 product_fields，每件商品「填了什麼」放在 products.custom。
--    這樣你在後台改欄位，不用動到程式碼或資料表結構。
-- ---------------------------------------------------------------------------

alter table public.products
  add column if not exists custom jsonb not null default '{}'::jsonb;

create table if not exists public.product_fields (
  id           uuid primary key default gen_random_uuid(),
  key          text unique not null,            -- 存進 custom 的鍵，例如 material
  label_zh     text not null,                   -- 後台看到的中文名
  label_en     text not null default '',        -- 商品頁規格表顯示的英文名
  placeholder  text not null default '',        -- 輸入框裡的灰字範例
  sort_order   int  not null default 0,
  is_active    boolean not null default true,   -- 關掉就不再出現在表單
  show_on_page boolean not null default true,   -- 要不要顯示在商品頁的規格表
  created_at   timestamptz not null default now()
);

create index if not exists idx_product_fields_order
  on public.product_fields (is_active, sort_order);

alter table public.product_fields enable row level security;

-- 客人要看得到規格表，所以可以讀
drop policy if exists "public reads product fields" on public.product_fields;
create policy "public reads product fields" on public.product_fields
  for select using (is_active = true);

-- 只有管理員能改
drop policy if exists "admins manage product fields" on public.product_fields;
create policy "admins manage product fields" on public.product_fields
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. 把原本寫死的規格欄位搬進來，變成可以自己改的
-- ---------------------------------------------------------------------------

insert into public.product_fields (key, label_zh, label_en, placeholder, sort_order) values
  ('material',   '材質',           'Material',   '925 純銀',      1),
  ('finish',     '電鍍 / 表面處理', 'Finish',     '18K 金',        2),
  ('dimensions', '尺寸規格',        'Dimensions', '戒圈寬 2.4 mm', 3),
  ('weight',     '重量',           'Weight',     '2.1 克',        4),
  ('sku',        '貨號 SKU',       'SKU',        'HEL-R-001',     5)
on conflict (key) do nothing;

-- 已經填過的舊資料搬到 custom，不會不見
update public.products
   set custom = custom
     || case when coalesce(material,'')   <> '' then jsonb_build_object('material',   material)   else '{}'::jsonb end
     || case when coalesce(finish,'')     <> '' then jsonb_build_object('finish',     finish)     else '{}'::jsonb end
     || case when coalesce(dimensions,'') <> '' then jsonb_build_object('dimensions', dimensions) else '{}'::jsonb end
     || case when coalesce(weight,'')     <> '' then jsonb_build_object('weight',     weight)     else '{}'::jsonb end
     || case when coalesce(sku,'')        <> '' then jsonb_build_object('sku',        sku)        else '{}'::jsonb end
 where coalesce(material,'') <> '' or coalesce(finish,'') <> ''
    or coalesce(dimensions,'') <> '' or coalesce(weight,'') <> ''
    or coalesce(sku,'') <> '';

-- ---------------------------------------------------------------------------
-- 4. 戒指預設給標準戒圍，客人才有得選
-- ---------------------------------------------------------------------------

update public.products
   set options = '[{"label":"Size","values":["9","10","11","12","13","14","15","16"]}]'::jsonb
 where kind = 'ring'
   and (options is null or options = '[]'::jsonb);
