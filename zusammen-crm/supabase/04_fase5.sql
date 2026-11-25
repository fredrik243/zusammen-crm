-- =====================================================================
-- Zusammen CRM – database, fase 5 (budget)
-- Kør hele denne fil i Supabase: SQL Editor → New query → indsæt → Run.
-- Vælg "Run and enable RLS", hvis Supabase spørger. Filen kan trygt køres igen.
-- =====================================================================

-- Omsætningsmål pr. måned (month er altid den 1. i måneden)
create table if not exists public.revenue_targets (
  month   date primary key check (extract(day from month) = 1),
  amount  numeric(12,2) not null default 0
);

-- Omkostningsposter, fx Løn, Husleje, Software
create table if not exists public.cost_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- Budgetteret beløb pr. post pr. måned
create table if not exists public.cost_budgets (
  cost_item_id  uuid not null references public.cost_items(id) on delete cascade,
  month         date not null check (extract(day from month) = 1),
  amount        numeric(12,2) not null default 0,
  primary key (cost_item_id, month)
);

do $$
declare t text;
begin
  foreach t in array array['revenue_targets','cost_items','cost_budgets']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Indloggede har fuld adgang" on public.%I', t);
    execute format('create policy "Indloggede har fuld adgang" on public.%I
                    for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

grant select, insert, update, delete on public.revenue_targets, public.cost_items, public.cost_budgets to authenticated;

-- Gemmer et helt års budget i én transaktion.
-- payload: {"year": 2026, "targets": [12 beløb], "items": [{"id": uuid|null, "name": "...", "amounts": [12 beløb]}]}
-- Poster, der ikke er med i payload, slettes ikke (de slettes enkeltvis i appen).
create or replace function public.save_budget(payload jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_year  int := (payload->>'year')::int;
  v_item  jsonb;
  v_id    uuid;
  v_order int := 0;
  m       int;
begin
  if v_year is null or v_year < 2000 or v_year > 2100 then
    raise exception 'Ugyldigt år';
  end if;

  for m in 1..12 loop
    insert into revenue_targets (month, amount)
    values (make_date(v_year, m, 1), coalesce((payload->'targets'->>(m-1))::numeric, 0))
    on conflict (month) do update set amount = excluded.amount;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(payload->'items', '[]'::jsonb))
  loop
    v_order := v_order + 1;
    if coalesce(trim(v_item->>'name'), '') = '' then
      continue;
    end if;
    if nullif(v_item->>'id', '') is null then
      insert into cost_items (name, sort_order) values (trim(v_item->>'name'), v_order)
      on conflict (name) do update set sort_order = excluded.sort_order
      returning id into v_id;
    else
      v_id := (v_item->>'id')::uuid;
      update cost_items set name = trim(v_item->>'name'), sort_order = v_order where id = v_id;
    end if;

    for m in 1..12 loop
      insert into cost_budgets (cost_item_id, month, amount)
      values (v_id, make_date(v_year, m, 1), coalesce((v_item->'amounts'->>(m-1))::numeric, 0))
      on conflict (cost_item_id, month) do update set amount = excluded.amount;
    end loop;
  end loop;
end $$;

grant execute on function public.save_budget(jsonb) to authenticated;
