-- ===========================================================================
-- 把規格欄位對齊新網站（helora-store）
--
-- 新網站商品卡上那行小字（tone）是「材質 · 寶石」合併而成，例如：
--     14k recycled gold · freshwater pearl
-- 除此之外的規格（尺寸、重量、SKU）在新網站上不會出現，
-- 所以先停用 —— 資料留著，之後想用在後台按「啟用」就回來了。
--
-- 怎麼跑：Supabase -> SQL Editor -> New query -> 貼上整份 -> Run
-- ===========================================================================

-- 這兩欄會合併成商品卡上那行小字
update public.product_fields
   set label_zh = '材質', label_en = 'Material',
       placeholder = '14k recycled gold',
       sort_order = 1, is_active = true, show_on_page = true
 where key = 'material';

-- 原本叫「電鍍 / 表面處理」，但在新網站上它是那行小字的後半段，
-- 放的是寶石或材料細節，改個名字比較不會填錯。
update public.product_fields
   set label_zh = '寶石 / 細節', label_en = 'Stone or detail',
       placeholder = 'freshwater pearl',
       sort_order = 2, is_active = true, show_on_page = true
 where key = 'finish';

-- 新網站不顯示這些，先收起來
update public.product_fields set is_active = false, show_on_page = false
 where key in ('dimensions', 'weight', 'sku');
