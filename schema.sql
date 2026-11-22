-- Ledgerly ERP: Supabase/PostgreSQL schema
-- This file is intentionally rerunnable for a fresh demo project.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  purchase_price numeric(12, 2) not null default 0 check (purchase_price >= 0),
  selling_price numeric(12, 2) not null default 0 check (selling_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_sku_not_blank check (length(btrim(sku)) > 0),
  constraint products_name_not_blank check (length(btrim(name)) > 0)
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_purchase_price numeric(12, 2) not null check (unit_purchase_price >= 0),
  total_amount numeric(14, 2) generated always as (quantity * unit_purchase_price) stored,
  purchased_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint purchases_supplier_not_blank check (length(btrim(supplier_name)) > 0)
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_selling_price numeric(12, 2) not null check (unit_selling_price >= 0),
  total_amount numeric(14, 2) generated always as (quantity * unit_selling_price) stored,
  sold_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint sales_customer_not_blank check (length(btrim(customer_name)) > 0)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('INCOME', 'EXPENSE')),
  reference_type text not null check (reference_type in ('SALE', 'PURCHASE')),
  reference_id uuid not null,
  product_id uuid references public.products(id) on delete set null,
  party_name text not null,
  description text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint transactions_reference_unique unique (reference_type, reference_id)
);

create index if not exists purchases_product_id_idx on public.purchases(product_id);
create index if not exists purchases_purchased_at_idx on public.purchases(purchased_at desc);
create index if not exists sales_product_id_idx on public.sales(product_id);
create index if not exists sales_sold_at_idx on public.sales(sold_at desc);
create index if not exists transactions_type_idx on public.transactions(type);
create index if not exists transactions_occurred_at_idx on public.transactions(occurred_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

-- The row lock serializes concurrent stock changes for the same product. If any
-- statement fails, PostgreSQL rolls back the purchase, stock, and ledger writes.
create or replace function public.create_purchase_transaction(
  p_supplier_name text,
  p_product_id uuid,
  p_quantity integer,
  p_unit_purchase_price numeric,
  p_purchased_at timestamptz
)
returns public.purchases
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_purchase public.purchases%rowtype;
begin
  if p_supplier_name is null or length(btrim(p_supplier_name)) = 0 then
    raise exception using errcode = '22023', message = 'Supplier name is required.';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception using errcode = '22023', message = 'Quantity must be greater than zero.';
  end if;
  if p_unit_purchase_price is null or p_unit_purchase_price < 0 then
    raise exception using errcode = '22023', message = 'Unit purchase price cannot be negative.';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'The selected product does not exist.';
  end if;

  insert into public.purchases (
    supplier_name, product_id, quantity, unit_purchase_price, purchased_at
  ) values (
    btrim(p_supplier_name), p_product_id, p_quantity,
    p_unit_purchase_price, coalesce(p_purchased_at, now())
  ) returning * into v_purchase;

  update public.products
  set stock = stock + p_quantity,
      purchase_price = p_unit_purchase_price
  where id = p_product_id;

  insert into public.transactions (
    type, reference_type, reference_id, product_id, party_name,
    description, amount, occurred_at
  ) values (
    'EXPENSE', 'PURCHASE', v_purchase.id, p_product_id, btrim(p_supplier_name),
    'Purchase of ' || p_quantity || ' × ' || v_product.name,
    v_purchase.total_amount, v_purchase.purchased_at
  );

  return v_purchase;
end;
$$;

-- Stock is checked only after acquiring the product row lock, preventing two
-- simultaneous sales from both consuming the same available units.
create or replace function public.create_sale_transaction(
  p_customer_name text,
  p_product_id uuid,
  p_quantity integer,
  p_unit_selling_price numeric,
  p_sold_at timestamptz
)
returns public.sales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_sale public.sales%rowtype;
begin
  if p_customer_name is null or length(btrim(p_customer_name)) = 0 then
    raise exception using errcode = '22023', message = 'Customer name is required.';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception using errcode = '22023', message = 'Quantity must be greater than zero.';
  end if;
  if p_unit_selling_price is null or p_unit_selling_price < 0 then
    raise exception using errcode = '22023', message = 'Unit selling price cannot be negative.';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'The selected product does not exist.';
  end if;

  if p_quantity > v_product.stock then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Insufficient stock for %s. Available: %s, requested: %s.',
        v_product.name, v_product.stock, p_quantity
      );
  end if;

  insert into public.sales (
    customer_name, product_id, quantity, unit_selling_price, sold_at
  ) values (
    btrim(p_customer_name), p_product_id, p_quantity,
    p_unit_selling_price, coalesce(p_sold_at, now())
  ) returning * into v_sale;

  update public.products
  set stock = stock - p_quantity,
      selling_price = p_unit_selling_price
  where id = p_product_id;

  insert into public.transactions (
    type, reference_type, reference_id, product_id, party_name,
    description, amount, occurred_at
  ) values (
    'INCOME', 'SALE', v_sale.id, p_product_id, btrim(p_customer_name),
    'Sale of ' || p_quantity || ' × ' || v_product.name,
    v_sale.total_amount, v_sale.sold_at
  );

  return v_sale;
end;
$$;

-- Public-demo access model. For a private production tenant, replace these
-- policies with organization/user ownership predicates and require Auth.
alter table public.products enable row level security;
alter table public.purchases enable row level security;
alter table public.sales enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "Demo users can view products" on public.products;
create policy "Demo users can view products"
on public.products for select to anon, authenticated using (true);

drop policy if exists "Demo users can add products" on public.products;
create policy "Demo users can add products"
on public.products for insert to anon, authenticated with check (true);

drop policy if exists "Demo users can edit products" on public.products;
create policy "Demo users can edit products"
on public.products for update to anon, authenticated
using (true) with check (true);

drop policy if exists "Demo users can view purchases" on public.purchases;
create policy "Demo users can view purchases"
on public.purchases for select to anon, authenticated using (true);

drop policy if exists "Demo users can view sales" on public.sales;
create policy "Demo users can view sales"
on public.sales for select to anon, authenticated using (true);

drop policy if exists "Demo users can view transactions" on public.transactions;
create policy "Demo users can view transactions"
on public.transactions for select to anon, authenticated using (true);

revoke all on table public.products from anon, authenticated;
revoke all on table public.purchases from anon, authenticated;
revoke all on table public.sales from anon, authenticated;
revoke all on table public.transactions from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select, insert, update on table public.products to anon, authenticated;
grant select on table public.purchases to anon, authenticated;
grant select on table public.sales to anon, authenticated;
grant select on table public.transactions to anon, authenticated;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.create_purchase_transaction(text, uuid, integer, numeric, timestamptz) from public;
revoke execute on function public.create_sale_transaction(text, uuid, integer, numeric, timestamptz) from public;
grant execute on function public.create_purchase_transaction(text, uuid, integer, numeric, timestamptz) to anon, authenticated;
grant execute on function public.create_sale_transaction(text, uuid, integer, numeric, timestamptz) to anon, authenticated;

insert into public.products (sku, name, purchase_price, selling_price, stock)
values
  ('LPT-001', 'Ultrabook Pro 14', 78000.00, 89900.00, 12),
  ('MON-024', '24-inch IPS Monitor', 14200.00, 16900.00, 4),
  ('KBD-010', 'Mechanical Keyboard', 5200.00, 6900.00, 18),
  ('MSE-205', 'Wireless Mouse', 1450.00, 1990.00, 0),
  ('HDS-032', 'USB-C Headset', 3100.00, 4200.00, 7)
on conflict (sku) do nothing;

comment on function public.create_purchase_transaction is
  'Atomically records a purchase, increments locked product stock, and creates an EXPENSE ledger entry.';
comment on function public.create_sale_transaction is
  'Atomically validates/decrements locked product stock, records a sale, and creates an INCOME ledger entry.';
