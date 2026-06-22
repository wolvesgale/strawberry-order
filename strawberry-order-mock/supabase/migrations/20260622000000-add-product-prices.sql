create table if not exists product_prices (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  pieces_per_sheet integer,
  unit_price integer not null check (unit_price > 0),
  tax_rate integer not null default 8 check (tax_rate >= 0 and tax_rate <= 100),
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now()
);

create index if not exists product_prices_lookup_idx
  on product_prices (product_name, pieces_per_sheet, effective_from desc);
