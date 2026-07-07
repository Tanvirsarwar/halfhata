-- ============================================================================
-- HALFHATA · Stage 1 SQL  — products, categories & image uploads
-- Run this in Supabase → SQL Editor → New query → paste → Run.
-- It replaces the earlier products/categories tables with ones that match the
-- app exactly. Safe to run once.
-- ============================================================================

drop table if exists products  cascade;
drop table if exists categories cascade;

create table categories (
  name text primary key
);

create table products (
  id         text primary key,
  name       text not null,
  category   text,
  kind       text default 'tshirt',      -- 'tshirt' or 'jersey'
  price      numeric not null default 0,
  sizes      text[] default '{}',
  image      text,                        -- public URL from Storage
  badge      text,                        -- 'New' | 'Best Seller' | null
  active     boolean default true,
  created_at timestamptz default now()
);

-- Stage 1: open access (no login yet). Stage 2 locks writes to the admin.
alter table products   disable row level security;
alter table categories disable row level security;
grant all on products   to anon, authenticated;
grant all on categories to anon, authenticated;

-- Allow the site to upload + read product images in the public bucket
drop policy if exists "hh stage1 upload" on storage.objects;
drop policy if exists "hh stage1 read"   on storage.objects;
create policy "hh stage1 upload" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'product-images');
create policy "hh stage1 read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'product-images');
