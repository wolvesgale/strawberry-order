create table if not exists product_prices (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  unit_price integer not null check (unit_price > 0),
  tax_rate integer not null default 8 check (tax_rate >= 0 and tax_rate <= 100),
  effective_from date not null,
  created_at timestamptz not null default now()
);

create index if not exists product_prices_product_name_effective_from_idx
  on product_prices (product_name, effective_from desc);
