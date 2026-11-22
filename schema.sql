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

-- Rich catalog upgrade: metadata, product variants, images, and variant-level stock.
alter table public.products add column if not exists description text not null default '';
alter table public.products add column if not exists category text;
alter table public.products add column if not exists brand text;
alter table public.products add column if not exists barcode text;
alter table public.products add column if not exists reorder_level integer not null default 5;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_reorder_level_positive'
  ) then
    alter table public.products
      add constraint products_reorder_level_positive check (reorder_level > 0);
  end if;
end $$;

create unique index if not exists products_barcode_unique_idx
on public.products (barcode) where barcode is not null;

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  size text,
  color text,
  purchase_price numeric(12, 2) not null default 0 check (purchase_price >= 0),
  selling_price numeric(12, 2) not null default 0 check (selling_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_sku_not_blank check (length(btrim(sku)) > 0)
);

create unique index if not exists product_variants_one_default_idx
on public.product_variants (product_id) where is_default and is_active;
create index if not exists product_variants_product_id_idx
on public.product_variants (product_id);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null unique,
  public_url text not null,
  alt_text text,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create index if not exists product_images_product_id_idx
on public.product_images (product_id, sort_order);

insert into public.product_variants (
  product_id, sku, purchase_price, selling_price, stock, is_default
)
select p.id, p.sku || '-DEFAULT', p.purchase_price, p.selling_price, p.stock, true
from public.products p
where not exists (
  select 1 from public.product_variants pv where pv.product_id = p.id
)
on conflict (sku) do nothing;

alter table public.purchases add column if not exists variant_id uuid
references public.product_variants(id) on delete restrict;
alter table public.sales add column if not exists variant_id uuid
references public.product_variants(id) on delete restrict;
alter table public.transactions add column if not exists variant_id uuid
references public.product_variants(id) on delete set null;

create index if not exists purchases_variant_id_idx on public.purchases(variant_id);
create index if not exists sales_variant_id_idx on public.sales(variant_id);
create index if not exists transactions_variant_id_idx on public.transactions(variant_id);

drop trigger if exists product_variants_set_updated_at on public.product_variants;
create trigger product_variants_set_updated_at
before update on public.product_variants
for each row execute function public.set_updated_at();

create or replace function public.save_product_catalog(
  p_product_id uuid,
  p_sku text,
  p_name text,
  p_description text,
  p_category text,
  p_brand text,
  p_barcode text,
  p_reorder_level integer,
  p_variants jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_product_id uuid;
  v_variant jsonb;
  v_variant_id uuid;
  v_variant_count integer := 0;
begin
  if p_sku is null or length(btrim(p_sku)) = 0 then
    raise exception using errcode = '22023', message = 'Base SKU is required.';
  end if;
  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception using errcode = '22023', message = 'Product name is required.';
  end if;
  if p_reorder_level is null or p_reorder_level <= 0 then
    raise exception using errcode = '22023', message = 'Reorder level must be positive.';
  end if;
  if jsonb_array_length(coalesce(p_variants, '[]'::jsonb)) = 0 then
    raise exception using errcode = '22023', message = 'At least one product variant is required.';
  end if;

  if p_product_id is null then
    insert into public.products (
      sku, name, description, category, brand, barcode, reorder_level,
      purchase_price, selling_price, stock
    ) values (
      upper(btrim(p_sku)), btrim(p_name), coalesce(btrim(p_description), ''),
      nullif(btrim(p_category), ''), nullif(btrim(p_brand), ''),
      nullif(btrim(p_barcode), ''), p_reorder_level, 0, 0, 0
    ) returning id into v_product_id;
  else
    update public.products
    set sku = upper(btrim(p_sku)),
        name = btrim(p_name),
        description = coalesce(btrim(p_description), ''),
        category = nullif(btrim(p_category), ''),
        brand = nullif(btrim(p_brand), ''),
        barcode = nullif(btrim(p_barcode), ''),
        reorder_level = p_reorder_level
    where id = p_product_id
    returning id into v_product_id;

    if v_product_id is null then
      raise exception using errcode = 'P0002', message = 'The selected product does not exist.';
    end if;

    update public.product_variants
    set is_active = false
    where product_id = v_product_id;
  end if;

  for v_variant in select value from jsonb_array_elements(p_variants)
  loop
    v_variant_count := v_variant_count + 1;
    v_variant_id := nullif(v_variant->>'id', '')::uuid;

    if coalesce(length(btrim(v_variant->>'sku')), 0) = 0 then
      raise exception using errcode = '22023', message = 'Every variant requires a SKU.';
    end if;

    if v_variant_id is null then
      insert into public.product_variants (
        product_id, sku, size, color, purchase_price, selling_price,
        stock, is_default, is_active
      ) values (
        v_product_id,
        upper(btrim(v_variant->>'sku')),
        nullif(btrim(v_variant->>'size'), ''),
        nullif(btrim(v_variant->>'color'), ''),
        (v_variant->>'purchase_price')::numeric,
        (v_variant->>'selling_price')::numeric,
        (v_variant->>'stock')::integer,
        v_variant_count = 1,
        true
      );
    else
      update public.product_variants
      set sku = upper(btrim(v_variant->>'sku')),
          size = nullif(btrim(v_variant->>'size'), ''),
          color = nullif(btrim(v_variant->>'color'), ''),
          purchase_price = (v_variant->>'purchase_price')::numeric,
          selling_price = (v_variant->>'selling_price')::numeric,
          stock = (v_variant->>'stock')::integer,
          is_default = v_variant_count = 1,
          is_active = true
      where id = v_variant_id and product_id = v_product_id;

      if not found then
        raise exception using errcode = 'P0002', message = 'A product variant could not be found.';
      end if;
    end if;
  end loop;

  update public.products p
  set stock = coalesce((
        select sum(pv.stock)::integer from public.product_variants pv
        where pv.product_id = v_product_id and pv.is_active
      ), 0),
      purchase_price = coalesce((
        select pv.purchase_price from public.product_variants pv
        where pv.product_id = v_product_id and pv.is_active
        order by pv.is_default desc, pv.created_at limit 1
      ), 0),
      selling_price = coalesce((
        select pv.selling_price from public.product_variants pv
        where pv.product_id = v_product_id and pv.is_active
        order by pv.is_default desc, pv.created_at limit 1
      ), 0)
  where p.id = v_product_id;

  return v_product_id;
end;
$$;

create or replace function public.create_purchase_transaction_v2(
  p_supplier_name text,
  p_product_id uuid,
  p_variant_id uuid,
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
  v_variant public.product_variants%rowtype;
  v_purchase public.purchases%rowtype;
  v_variant_label text;
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

  select * into v_product from public.products where id = p_product_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'The selected product does not exist.';
  end if;

  select * into v_variant
  from public.product_variants
  where id = p_variant_id and product_id = p_product_id and is_active
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'The selected product variant does not exist.';
  end if;

  insert into public.purchases (
    supplier_name, product_id, variant_id, quantity, unit_purchase_price, purchased_at
  ) values (
    btrim(p_supplier_name), p_product_id, p_variant_id, p_quantity,
    p_unit_purchase_price, coalesce(p_purchased_at, now())
  ) returning * into v_purchase;

  update public.product_variants
  set stock = stock + p_quantity, purchase_price = p_unit_purchase_price
  where id = p_variant_id;

  update public.products p
  set stock = (select sum(pv.stock)::integer from public.product_variants pv where pv.product_id = p_product_id and pv.is_active),
      purchase_price = case when v_variant.is_default then p_unit_purchase_price else p.purchase_price end
  where p.id = p_product_id;

  v_variant_label := concat_ws(' / ', nullif(v_variant.color, ''), nullif(v_variant.size, ''));
  insert into public.transactions (
    type, reference_type, reference_id, product_id, variant_id, party_name,
    description, amount, occurred_at
  ) values (
    'EXPENSE', 'PURCHASE', v_purchase.id, p_product_id, p_variant_id, btrim(p_supplier_name),
    'Purchase of ' || p_quantity || ' × ' || v_product.name ||
      case when v_variant_label = '' then '' else ' (' || v_variant_label || ')' end,
    v_purchase.total_amount, v_purchase.purchased_at
  );

  return v_purchase;
end;
$$;

create or replace function public.create_sale_transaction_v2(
  p_customer_name text,
  p_product_id uuid,
  p_variant_id uuid,
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
  v_variant public.product_variants%rowtype;
  v_sale public.sales%rowtype;
  v_variant_label text;
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

  select * into v_product from public.products where id = p_product_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'The selected product does not exist.';
  end if;

  select * into v_variant
  from public.product_variants
  where id = p_variant_id and product_id = p_product_id and is_active
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'The selected product variant does not exist.';
  end if;
  if p_quantity > v_variant.stock then
    raise exception using errcode = 'P0001',
      message = format('Insufficient stock for %s. Available: %s, requested: %s.', v_variant.sku, v_variant.stock, p_quantity);
  end if;

  insert into public.sales (
    customer_name, product_id, variant_id, quantity, unit_selling_price, sold_at
  ) values (
    btrim(p_customer_name), p_product_id, p_variant_id, p_quantity,
    p_unit_selling_price, coalesce(p_sold_at, now())
  ) returning * into v_sale;

  update public.product_variants
  set stock = stock - p_quantity, selling_price = p_unit_selling_price
  where id = p_variant_id;

  update public.products p
  set stock = (select sum(pv.stock)::integer from public.product_variants pv where pv.product_id = p_product_id and pv.is_active),
      selling_price = case when v_variant.is_default then p_unit_selling_price else p.selling_price end
  where p.id = p_product_id;

  v_variant_label := concat_ws(' / ', nullif(v_variant.color, ''), nullif(v_variant.size, ''));
  insert into public.transactions (
    type, reference_type, reference_id, product_id, variant_id, party_name,
    description, amount, occurred_at
  ) values (
    'INCOME', 'SALE', v_sale.id, p_product_id, p_variant_id, btrim(p_customer_name),
    'Sale of ' || p_quantity || ' × ' || v_product.name ||
      case when v_variant_label = '' then '' else ' (' || v_variant_label || ')' end,
    v_sale.total_amount, v_sale.sold_at
  );

  return v_sale;
end;
$$;

-- Keep the original RPC signatures working by routing them to the default variant.
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
  v_variant_id uuid;
begin
  select id into v_variant_id from public.product_variants
  where product_id = p_product_id and is_active
  order by is_default desc, created_at limit 1;
  return public.create_purchase_transaction_v2(
    p_supplier_name, p_product_id, v_variant_id, p_quantity,
    p_unit_purchase_price, p_purchased_at
  );
end;
$$;

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
  v_variant_id uuid;
begin
  select id into v_variant_id from public.product_variants
  where product_id = p_product_id and is_active
  order by is_default desc, created_at limit 1;
  return public.create_sale_transaction_v2(
    p_customer_name, p_product_id, v_variant_id, p_quantity,
    p_unit_selling_price, p_sold_at
  );
end;
$$;

alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;

drop policy if exists "Demo users can view variants" on public.product_variants;
create policy "Demo users can view variants" on public.product_variants
for select to anon, authenticated using (true);
drop policy if exists "Demo users can add variants" on public.product_variants;
create policy "Demo users can add variants" on public.product_variants
for insert to anon, authenticated with check (true);
drop policy if exists "Demo users can edit variants" on public.product_variants;
create policy "Demo users can edit variants" on public.product_variants
for update to anon, authenticated using (true) with check (true);

drop policy if exists "Demo users can view product images" on public.product_images;
create policy "Demo users can view product images" on public.product_images
for select to anon, authenticated using (true);
drop policy if exists "Demo users can add product images" on public.product_images;
create policy "Demo users can add product images" on public.product_images
for insert to anon, authenticated with check (true);

grant select, insert, update on table public.product_variants to anon, authenticated;
grant select, insert on table public.product_images to anon, authenticated;
revoke execute on function public.save_product_catalog(uuid, text, text, text, text, text, text, integer, jsonb) from public;
revoke execute on function public.create_purchase_transaction_v2(text, uuid, uuid, integer, numeric, timestamptz) from public;
revoke execute on function public.create_sale_transaction_v2(text, uuid, uuid, integer, numeric, timestamptz) from public;
grant execute on function public.save_product_catalog(uuid, text, text, text, text, text, text, integer, jsonb) to anon, authenticated;
grant execute on function public.create_purchase_transaction_v2(text, uuid, uuid, integer, numeric, timestamptz) to anon, authenticated;
grant execute on function public.create_sale_transaction_v2(text, uuid, uuid, integer, numeric, timestamptz) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images', 'product-images', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public product images are viewable" on storage.objects;
create policy "Public product images are viewable" on storage.objects
for select to public using (bucket_id = 'product-images');
drop policy if exists "Demo users can upload product images" on storage.objects;
create policy "Demo users can upload product images" on storage.objects
for insert to anon, authenticated with check (bucket_id = 'product-images');
drop policy if exists "Demo users can update product images" on storage.objects;
create policy "Demo users can update product images" on storage.objects
for update to anon, authenticated
using (bucket_id = 'product-images') with check (bucket_id = 'product-images');
drop policy if exists "Demo users can delete product images" on storage.objects;
create policy "Demo users can delete product images" on storage.objects
for delete to anon, authenticated using (bucket_id = 'product-images');

comment on function public.save_product_catalog is
  'Atomically creates or updates a rich product catalog and its active variants.';
comment on function public.create_purchase_transaction_v2 is
  'Atomically records a variant purchase, increments locked variant stock, and creates an EXPENSE entry.';
comment on function public.create_sale_transaction_v2 is
  'Atomically validates and decrements locked variant stock, records a sale, and creates an INCOME entry.';
