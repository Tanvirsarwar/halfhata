-- ============================================================================
-- HALFHATA — Supabase / PostgreSQL schema
-- Normalized tables, foreign keys, indexes, RLS, triggers, timeline.
-- Run in the Supabase SQL editor (order matters).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------- ENUMS ----------
create type order_status   as enum ('pending','confirmed','on_courier','delivered','cancelled','returned');
create type payment_method as enum ('cod','full');
create type payment_state  as enum ('cod_min','partial','full');
create type courier_service as enum ('steadfast','pathao','redx','sundarban','manual');

-- ---------- PROFILES (1:1 with auth.users) ----------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  district    text,
  city        text,
  address     text,
  is_admin    boolean default false,
  created_at  timestamptz default now()
);

-- ---------- CATEGORIES / PRODUCTS / IMAGES ----------
create table categories (
  id    uuid primary key default gen_random_uuid(),
  name  text not null,
  slug  text unique not null,
  sort  int default 0
);

create table products (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text unique not null,
  description  text,
  price        numeric(10,2) not null,
  compare_at   numeric(10,2),
  category_id  uuid references categories(id) on delete set null,
  sizes        text[] default array['S','M','L','XL'],
  colors       text[] default array['#141416'],
  stock        int default 0,
  is_new       boolean default false,
  is_best      boolean default false,
  is_active    boolean default true,
  created_at   timestamptz default now()
);
create index products_category_idx on products(category_id);
create index products_active_idx   on products(is_active);

create table product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid references products(id) on delete cascade,
  url         text not null,   -- Supabase Storage public URL
  alt         text,
  sort        int default 0
);

-- ---------- CART / WISHLIST ----------
create table cart_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete cascade,
  product_id  uuid references products(id) on delete cascade,
  size        text,
  color       text,
  qty         int default 1 check (qty > 0),
  created_at  timestamptz default now(),
  unique (user_id, product_id, size)
);

create table wishlist (
  user_id     uuid references profiles(id) on delete cascade,
  product_id  uuid references products(id) on delete cascade,
  created_at  timestamptz default now(),
  primary key (user_id, product_id)
);

-- ---------- COUPONS ----------
create table coupons (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,
  type         text check (type in ('flat','percent')) default 'flat',
  value        numeric(10,2) not null,
  min_amount   numeric(10,2) default 0,
  max_uses     int,
  used         int default 0,
  expires_at   timestamptz,
  is_active    boolean default true
);

-- ---------- ORDERS ----------
create sequence order_no_seq start 1287;

create table orders (
  id             uuid primary key default gen_random_uuid(),
  order_no       text unique not null default ('HALF' || nextval('order_no_seq')),
  user_id        uuid references profiles(id) on delete set null,
  -- shipping snapshot (denormalized on purpose)
  ship_name      text not null,
  ship_phone     text not null,
  ship_district  text not null,
  ship_city      text not null,
  ship_address   text not null,
  -- money
  subtotal       numeric(10,2) not null,
  delivery       numeric(10,2) not null default 80,
  discount       numeric(10,2) default 0,
  total          numeric(10,2) not null,
  coupon_id      uuid references coupons(id),
  status         order_status default 'pending',
  created_at     timestamptz default now()
);
create index orders_user_idx   on orders(user_id);
create index orders_status_idx on orders(status);
create index orders_date_idx   on orders(created_at desc);

create table order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid references orders(id) on delete cascade,
  product_id   uuid references products(id) on delete set null,
  name         text not null,     -- snapshot
  price        numeric(10,2) not null,
  size         text,
  color        text,
  qty          int not null
);
create index order_items_order_idx on order_items(order_id);

-- ---------- PAYMENTS (COD min ৳120 advance, partial, or full) ----------
create table payments (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid references orders(id) on delete cascade,
  method         payment_method not null,     -- cod | full
  state          payment_state  not null,     -- cod_min | partial | full
  channel        text,                         -- nagad | bkash | whatsapp
  amount_paid    numeric(10,2) not null,       -- must be >= 120 for COD
  amount_due     numeric(10,2) not null,
  txn_id         text,                          -- required for advance/full
  screenshot_url text,                          -- optional, Supabase Storage
  verified       boolean default false,
  created_at     timestamptz default now(),
  constraint cod_min_advance check (method = 'full' or amount_paid >= 120)
);
create index payments_order_idx on payments(order_id);

-- ---------- COURIER TRACKING ----------
create table courier_tracking (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid references orders(id) on delete cascade,
  service      courier_service not null,
  tracking_id  text not null,
  assigned_at  timestamptz default now()
);
create index courier_order_idx on courier_tracking(order_id);

-- ---------- ORDER TIMELINE ----------
create table order_timeline (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid references orders(id) on delete cascade,
  status      text not null,
  note        text,
  created_at  timestamptz default now()
);
create index timeline_order_idx on order_timeline(order_id);

-- ---------- NOTIFICATIONS ----------
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete cascade,
  order_id    uuid references orders(id) on delete cascade,
  title       text not null,
  body        text,
  is_read     boolean default false,
  created_at  timestamptz default now()
);
create index notif_user_idx on notifications(user_id, is_read);

-- ---------- REVIEWS ----------
create table reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid references products(id) on delete cascade,
  user_id     uuid references profiles(id) on delete cascade,
  rating      int check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz default now(),
  unique (product_id, user_id)
);

-- ---------- SETTINGS (single-row key/value store) ----------
create table settings (
  key    text primary key,
  value  jsonb not null
);
insert into settings(key,value) values
  ('contact', '{"whatsapp":"0199210064","nagad":"0199210064","bkash":"0199210064"}'),
  ('delivery', '{"charge":80,"free_over":1500,"cod_min_advance":120}');

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- auto-create profile on signup
create or replace function handle_new_user() returns trigger as $$
begin
  insert into profiles (id, full_name) values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end; $$ language plpgsql security definer;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- assigning a courier flips status -> on_courier, adds timeline + notification
create or replace function on_courier_assigned() returns trigger as $$
declare uid uuid;
begin
  update orders set status = 'on_courier' where id = new.order_id returning user_id into uid;
  insert into order_timeline(order_id,status,note)
    values (new.order_id, 'Handed to Courier', new.service || ' — ' || new.tracking_id);
  insert into notifications(user_id,order_id,title,body)
    values (uid, new.order_id, 'Your order is on the way 🚚',
            'Shipped via ' || new.service || '. Track ID: ' || new.tracking_id);
  return new;
end; $$ language plpgsql security definer;
create trigger trg_courier_assigned after insert on courier_tracking
  for each row execute function on_courier_assigned();

-- any status change writes a timeline row
create or replace function on_status_change() returns trigger as $$
begin
  if new.status is distinct from old.status then
    insert into order_timeline(order_id,status) values (new.id, new.status::text);
  end if;
  return new;
end; $$ language plpgsql;
create trigger trg_status_change after update of status on orders
  for each row execute function on_status_change();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table profiles         enable row level security;
alter table orders           enable row level security;
alter table order_items      enable row level security;
alter table payments         enable row level security;
alter table cart_items       enable row level security;
alter table wishlist         enable row level security;
alter table notifications    enable row level security;
alter table order_timeline   enable row level security;
alter table courier_tracking enable row level security;
alter table reviews          enable row level security;

create or replace function is_admin() returns boolean as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$ language sql stable security definer;

-- profiles: user sees/edits own, admin sees all
create policy p_profile_self on profiles for all
  using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());

-- cart / wishlist: owner only
create policy p_cart on cart_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy p_wish on wishlist   for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- orders + children: owner reads own, admin all; inserts by owner
create policy p_orders_r on orders for select using (user_id = auth.uid() or is_admin());
create policy p_orders_i on orders for insert with check (user_id = auth.uid());
create policy p_orders_u on orders for update using (is_admin());
create policy p_oi   on order_items      for select using (exists(select 1 from orders o where o.id=order_id and (o.user_id=auth.uid() or is_admin())));
create policy p_pay  on payments         for select using (exists(select 1 from orders o where o.id=order_id and (o.user_id=auth.uid() or is_admin())));
create policy p_tl   on order_timeline   for select using (exists(select 1 from orders o where o.id=order_id and (o.user_id=auth.uid() or is_admin())));
create policy p_ct   on courier_tracking for select using (exists(select 1 from orders o where o.id=order_id and (o.user_id=auth.uid() or is_admin())));
create policy p_ct_w on courier_tracking for insert with check (is_admin());

-- notifications: owner
create policy p_notif on notifications for all using (user_id = auth.uid() or is_admin());

-- reviews: read all, write own
create policy p_rev_r on reviews for select using (true);
create policy p_rev_w on reviews for insert with check (user_id = auth.uid());

-- products / categories / images / settings: public read (RLS left off; served publicly)
-- admin writes go through service-role key in server actions.
