-- ============================================================
-- HALFHATA — STAGE 2 SQL: orders sync
-- Paste ALL of this into Supabase → SQL Editor → Run.
-- Adds the orders table. Products/categories are untouched.
-- ============================================================

drop table if exists orders cascade;

create table orders (
  id            text primary key,            -- e.g. HALFMB3K2XQ7A
  created_at    timestamptz default now(),
  customer      jsonb not null,              -- name, phone, district, city, address, email
  items         jsonb not null,              -- [{id,name,price,qty,size,color,image}]
  subtotal      numeric not null,
  delivery      numeric not null,
  total         numeric not null,
  payment       jsonb not null,              -- method, paid, due, txnId, label...
  status        text default 'Pending',
  courier       jsonb,                       -- {service, trackingId}
  notifications jsonb default '[]',
  timeline      jsonb default '[]',
  user_email    text,
  phone         text
);

create index orders_email_idx  on orders(user_email);
create index orders_status_idx on orders(status);
create index orders_date_idx   on orders(created_at desc);

-- Stage 2 access: the site must insert (customers) and read/update (admin).
-- NOTE: this is open like the products table — Stage 3 locks it down with
-- real Supabase Auth. Do not skip Stage 3 once orders are flowing.
alter table orders disable row level security;
grant all on orders to anon, authenticated;
drop policy if exists "open orders" on orders;
create policy "open orders" on orders for all to anon, authenticated using (true) with check (true);
