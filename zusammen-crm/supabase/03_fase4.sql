-- =====================================================================
-- Zusammen CRM – database, fase 4 (produkter og omsætning)
-- Kør hele denne fil i Supabase: SQL Editor → New query → indsæt → Run.
-- Vælg "Run and enable RLS", hvis Supabase spørger. Filen kan trygt køres igen.
-- =====================================================================

-- ---------- Produktkatalog ----------
create table if not exists public.products (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  description    text,
  default_price  numeric(12,2) not null default 0,
  unit           text not null default 'stk.',
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ---------- Produktlinjer på deals ----------
-- Et produkt kan ligge på samme deal flere gange med forskelligt antal, pris og rabat.
create table if not exists public.deal_products (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid not null references public.deals(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete restrict,
  quantity      numeric(12,2) not null default 1 check (quantity >= 0),
  unit_price    numeric(12,2) not null default 0,
  discount_pct  numeric(5,2) not null default 0 check (discount_pct between 0 and 100),
  created_at    timestamptz not null default now()
);
create index if not exists deal_products_deal_idx on public.deal_products(deal_id);

-- Når en deal har produktlinjer, er dealværdien summen af linjerne.
-- Fjernes den sidste linje, bliver værdien tom igen og kan skrives i hånden.
create or replace function public.sync_deal_value()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_deal uuid := coalesce(new.deal_id, old.deal_id);
begin
  update deals
     set value = (select round(sum(quantity * unit_price * (1 - discount_pct / 100)), 2)
                    from deal_products where deal_id = v_deal)
   where id = v_deal;
  if tg_op = 'UPDATE' and old.deal_id is distinct from new.deal_id then
    update deals
       set value = (select round(sum(quantity * unit_price * (1 - discount_pct / 100)), 2)
                      from deal_products where deal_id = old.deal_id)
     where id = old.deal_id;
  end if;
  return null;
end $$;

drop trigger if exists deal_products_sync on public.deal_products;
create trigger deal_products_sync
after insert or update or delete on public.deal_products
for each row execute function public.sync_deal_value();

-- ---------- Adgang ----------
do $$
declare t text;
begin
  foreach t in array array['products','deal_products']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Indloggede har fuld adgang" on public.%I', t);
    execute format('create policy "Indloggede har fuld adgang" on public.%I
                    for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

grant select, insert, update, delete on public.products, public.deal_products to authenticated;
