-- ===========================================================================
-- HELORA — database setup
--
-- HOW TO RUN THIS
--   1. Go to supabase.com -> your project -> SQL Editor -> New query
--   2. Paste this whole file in
--   3. Press Run
-- It's safe to run more than once.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Who's allowed to manage the shop
-- ---------------------------------------------------------------------------

create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

-- Answers "is the person making this request a shop admin?"
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------

create table if not exists public.collections (
  slug       text primary key,
  title      text not null,
  intro      text not null default '',
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  tag         text not null default '',      -- small label above the name
  description text not null default '',
  price_cents int  not null default 0 check (price_cents >= 0),
  kind        text not null default 'ring'   -- 'ring' or 'earrings'
              check (kind in ('ring','earrings','other')),
  material    text not null default '',
  finish      text not null default '',
  dimensions  text not null default '',
  weight      text not null default '',
  sku         text not null default '',
  options     jsonb not null default '[]'::jsonb,  -- [{"label":"Size","values":["9","10"]}]
  in_stock    boolean not null default true,
  is_active   boolean not null default true,
  is_new      boolean not null default false,      -- shows under "New Arrivals"
  is_pick     boolean not null default false,      -- shows under "HELORA Picks"
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url        text not null,
  alt        text not null default '',
  sort_order int  not null default 0
);

create table if not exists public.product_collections (
  product_id      uuid not null references public.products(id) on delete cascade,
  collection_slug text not null references public.collections(slug) on delete cascade,
  primary key (product_id, collection_slug)
);

create index if not exists idx_products_active  on public.products (is_active, sort_order);
create index if not exists idx_images_product   on public.product_images (product_id, sort_order);
create index if not exists idx_pc_collection    on public.product_collections (collection_slug);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

create sequence if not exists public.order_no_seq start 1001;

create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  order_no       text unique not null,
  email          text not null,
  full_name      text not null,
  phone          text,
  address        text,
  postcode       text,
  city_state     text,
  gift_message   text,
  payment_method text not null,
  subtotal_cents int not null default 0,
  total_cents    int not null default 0,
  currency       text not null default 'MYR',
  status         text not null default 'pending_payment',
  created_at     timestamptz not null default now()
);

create table if not exists public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  product_id       uuid references public.products(id) on delete set null,
  name             text not null,
  option           text,
  qty              int  not null check (qty > 0),
  unit_price_cents int  not null check (unit_price_cents >= 0)
);

create index if not exists idx_order_items on public.order_items (order_id);
create index if not exists idx_orders_email on public.orders (lower(email));

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Nothing is readable or writable until a policy below says so.
-- ---------------------------------------------------------------------------

alter table public.collections         enable row level security;
alter table public.products            enable row level security;
alter table public.product_images      enable row level security;
alter table public.product_collections enable row level security;
alter table public.orders              enable row level security;
alter table public.order_items         enable row level security;
alter table public.admins              enable row level security;

-- Shoppers can read the catalogue (only pieces marked active).
drop policy if exists "public reads collections" on public.collections;
create policy "public reads collections" on public.collections
  for select using (true);

drop policy if exists "public reads active products" on public.products;
create policy "public reads active products" on public.products
  for select using (is_active = true);

drop policy if exists "public reads images" on public.product_images;
create policy "public reads images" on public.product_images
  for select using (
    exists (select 1 from public.products p where p.id = product_id and p.is_active)
  );

drop policy if exists "public reads product collections" on public.product_collections;
create policy "public reads product collections" on public.product_collections
  for select using (
    exists (select 1 from public.products p where p.id = product_id and p.is_active)
  );

-- Admins can do everything to the catalogue.
drop policy if exists "admins manage collections" on public.collections;
create policy "admins manage collections" on public.collections
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage products" on public.products;
create policy "admins manage products" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage images" on public.product_images;
create policy "admins manage images" on public.product_images
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage product collections" on public.product_collections;
create policy "admins manage product collections" on public.product_collections
  for all using (public.is_admin()) with check (public.is_admin());

-- Orders: shoppers get NO direct access at all. Orders are created and read
-- only through the two functions below, which control exactly what happens.
drop policy if exists "admins read orders" on public.orders;
create policy "admins read orders" on public.orders
  for select using (public.is_admin());

drop policy if exists "admins update orders" on public.orders;
create policy "admins update orders" on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins read order items" on public.order_items;
create policy "admins read order items" on public.order_items
  for select using (public.is_admin());

drop policy if exists "admins read admins" on public.admins;
create policy "admins read admins" on public.admins
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- place_order — the only way an order gets created
--
-- The browser sends product ids and quantities, never prices. This function
-- looks each price up itself, so editing the price in the browser does nothing.
-- ---------------------------------------------------------------------------

create or replace function public.place_order(
  p_customer       jsonb,
  p_items          jsonb,
  p_payment_method text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_no text;
  v_subtotal int := 0;
  v_item     jsonb;
  v_product  public.products%rowtype;
  v_qty      int;
  v_pid      uuid;
  v_email    text;
  v_name     text;
begin
  v_email := lower(trim(coalesce(p_customer->>'email', '')));
  v_name  := trim(coalesce(p_customer->>'full_name', ''));

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'A valid email address is required.';
  end if;
  if v_name = '' then
    raise exception 'A name is required.';
  end if;
  if p_payment_method is null
     or p_payment_method not in ('duitnow','fpx','card','wallet','paynow') then
    raise exception 'Please choose a payment method.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Your bag is empty.';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'That is too many items for one order.';
  end if;

  v_order_no := 'HEL-' || to_char(now(), 'YYMM') || '-' ||
                lpad(nextval('public.order_no_seq')::text, 4, '0');

  insert into public.orders (
    order_no, email, full_name, phone, address, postcode, city_state,
    gift_message, payment_method, status
  ) values (
    v_order_no, v_email, left(v_name, 120),
    left(nullif(trim(coalesce(p_customer->>'phone','')), ''), 40),
    left(nullif(trim(coalesce(p_customer->>'address','')), ''), 400),
    left(nullif(trim(coalesce(p_customer->>'postcode','')), ''), 20),
    left(nullif(trim(coalesce(p_customer->>'city_state','')), ''), 120),
    left(nullif(trim(coalesce(p_customer->>'gift_message','')), ''), 600),
    p_payment_method, 'pending_payment'
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    begin
      v_pid := (v_item->>'product_id')::uuid;
    exception when others then
      raise exception 'One of the pieces in your bag is no longer available.';
    end;

    v_qty := greatest(1, least(20, coalesce((v_item->>'qty')::int, 1)));

    select * into v_product
      from public.products
     where id = v_pid and is_active = true and in_stock = true;

    if not found then
      raise exception 'One of the pieces in your bag is no longer available.';
    end if;

    insert into public.order_items (order_id, product_id, name, option, qty, unit_price_cents)
    values (v_order_id, v_product.id, v_product.name,
            left(nullif(trim(coalesce(v_item->>'option','')), ''), 120),
            v_qty, v_product.price_cents);

    v_subtotal := v_subtotal + (v_product.price_cents * v_qty);
  end loop;

  update public.orders
     set subtotal_cents = v_subtotal, total_cents = v_subtotal
   where id = v_order_id;

  return jsonb_build_object(
    'order_no',       v_order_no,
    'subtotal_cents', v_subtotal,
    'total_cents',    v_subtotal,
    'status',         'pending_payment',
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name',  oi.name,
        'option', oi.option,
        'qty',   oi.qty,
        'unit_price_cents', oi.unit_price_cents,
        'image', (select pi.url from public.product_images pi
                   where pi.product_id = oi.product_id
                   order by pi.sort_order limit 1)
      )), '[]'::jsonb)
      from public.order_items oi where oi.order_id = v_order_id
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- track_order — lets a shopper check one order with its number + their email
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
           'total_cents', o.total_cents
         )
    into v
    from public.orders o
   where upper(o.order_no) = upper(trim(p_order_no))
     and lower(o.email)    = lower(trim(p_email));
  return v;   -- null when nothing matches
end;
$$;

revoke all on function public.place_order(jsonb, jsonb, text) from public;
revoke all on function public.track_order(text, text)         from public;
grant execute on function public.place_order(jsonb, jsonb, text) to anon, authenticated;
grant execute on function public.track_order(text, text)         to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Somewhere to keep product photos
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "public views product images" on storage.objects;
create policy "public views product images" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "admins upload product images" on storage.objects;
create policy "admins upload product images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "admins change product images" on storage.objects;
create policy "admins change product images" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "admins delete product images" on storage.objects;
create policy "admins delete product images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- ---------------------------------------------------------------------------
-- The collections, matching js/config.js
-- ---------------------------------------------------------------------------

insert into public.collections (slug, title, intro, sort_order) values
  ('newin',     'New Arrivals',    'The latest to join HELORA—modern designs made for everyday wear, fresh off the bench.', 1),
  ('picks',     'HELORA Picks',    'A considered selection of HELORA pieces, chosen for their distinctive, easy-to-wear character.', 2),
  ('rings',     'Rings',           'From fine bands to sculptural shapes—rings made to stack, mix, and wear your way.', 3),
  ('earrings',  'Earrings',        'Studs, hoops, and drops—everyday earrings finished with quiet detail.', 4),
  ('moiss',     'Moissanite',      'Moissanite brings brilliance and colour to selected HELORA designs, adding sparkle that lasts.', 5),
  ('cz',        'Cubic Zirconia',  'A bright, versatile stone that brings a clean touch of sparkle to everyday pieces.', 6),
  ('gold',      'Gold Plated',     'Gold-plated finishes bring warmth and depth to selected designs.', 7),
  ('silver',    'Sterling Silver', 'Refined 925 sterling silver, finished with a clean, quiet character.', 8),
  ('everyday',  'Everyday',        'Easy, wear-anywhere pieces designed to become part of your daily rhythm.', 9),
  ('minimal',   'Minimalist',      'Clean lines and pared-back design, for those who love understated jewelry.', 10),
  ('statement', 'Statement',       'Bolder shapes and eye-catching silhouettes, for the days you want to be seen.', 11),
  ('gifts',     'Gifts',           'Pieces chosen with gifting in mind—personal, considered, and easy to make your own.', 12),
  ('edit',      'The Edit',        'A considered edit of distinctive pieces—modern, versatile, and made for everyday.', 13)
on conflict (slug) do update
  set title = excluded.title, intro = excluded.intro, sort_order = excluded.sort_order;

-- ===========================================================================
-- LAST STEP — make yourself an admin
--
--   1. Open admin.html on your site and sign up with your email + a password
--      (or Authentication -> Users -> Add user in the Supabase dashboard)
--   2. Come back here and run:
--
--        insert into public.admins (user_id, email)
--        select id, email from auth.users where email = 'you@example.com'
--        on conflict (user_id) do nothing;
--
-- Until you do that, nobody can add products.
-- ===========================================================================
