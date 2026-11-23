-- =====================================================================
-- Zusammen CRM – database, fase 1
-- Kør hele denne fil én gang i Supabase: SQL Editor → New query → indsæt → Run.
-- Filen kan trygt køres igen: den opretter kun det, der mangler.
-- =====================================================================

-- ---------- Team (de to brugere) ----------
create table if not exists public.team_members (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  initials    text not null,
  email       text unique,
  user_id     uuid unique references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

insert into public.team_members (name, initials)
select v.name, v.initials
from (values ('Fredrik Hillerbrand', 'FH'), ('Thomas Kahr', 'TK')) as v(name, initials)
where not exists (select 1 from public.team_members);

-- ---------- Kategorier ----------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  sort_order  int  not null default 0
);

insert into public.categories (name, sort_order)
values ('Kultur',1),('Fashion',2),('Livsstil',3),('Oplevelser',4),('Mad',5),
       ('NGO''er',6),('Organisationer',7),('Medier',8),('Samarbejder',9),
       ('Rejser',10),('Hobby',11)
on conflict (name) do nothing;

-- ---------- Pipeline-faser ----------
create table if not exists public.stages (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null unique,
  sort_order           int  not null,
  default_probability  int  not null default 0 check (default_probability between 0 and 100),
  kind                 text not null default 'open' check (kind in ('open','won','lost'))
);

insert into public.stages (name, sort_order, default_probability, kind)
values ('Ikke kontaktet',1,5,'open'),('Kontaktet',2,10,'open'),('Dialog',3,25,'open'),
       ('Møde holdt',4,40,'open'),('Tilbud sendt',5,60,'open'),
       ('Vundet',6,100,'won'),('Tabt',7,0,'lost')
on conflict (name) do nothing;

-- ---------- Virksomheder ----------
create table if not exists public.companies (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  category_id             uuid references public.categories(id) on delete set null,
  website                 text,
  general_email           text,
  notes                   text,
  owner_id                uuid references public.team_members(id) on delete set null,
  do_not_contact          boolean not null default false,
  do_not_contact_reason   text,
  import_source           jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create unique index if not exists companies_name_unique on public.companies (lower(name));

-- ---------- Personer ----------
create table if not exists public.contacts (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  name          text not null,
  title         text,
  email         text,
  phone         text,
  linkedin_url  text,
  created_at    timestamptz not null default now()
);
create index if not exists contacts_company_idx on public.contacts(company_id);

-- ---------- Deals ----------
create table if not exists public.deals (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies(id) on delete cascade,
  title                 text not null,
  stage_id              uuid not null references public.stages(id),
  owner_id              uuid references public.team_members(id) on delete set null,
  contact_id            uuid references public.contacts(id) on delete set null,
  value                 numeric(12,2),
  probability           int check (probability between 0 and 100),
  expected_close_date   date,
  position              double precision not null default 0,
  closed_at             date,
  lost_reason           text,
  created_at            timestamptz not null default now()
);
create index if not exists deals_company_idx on public.deals(company_id);
create index if not exists deals_stage_idx on public.deals(stage_id);

-- ---------- Aktiviteter ----------
-- occurred_at er tom, når datoen er ukendt (fx importerede hændelser uden dato).
create table if not exists public.activities (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in (
                  'mail_sent','reminder_sent','linkedin_message','reply_received',
                  'meeting_booked','meeting_held','rejection','stage_changed','note')),
  occurred_at   timestamptz,
  company_id    uuid references public.companies(id) on delete cascade,
  deal_id       uuid references public.deals(id) on delete cascade,
  contact_id    uuid references public.contacts(id) on delete set null,
  member_id     uuid references public.team_members(id) on delete set null,
  note          text,
  source        text not null default 'manual' check (source in ('manual','import','import_status','system')),
  from_stage_id uuid references public.stages(id) on delete set null,
  to_stage_id   uuid references public.stages(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists activities_company_idx on public.activities(company_id);
create index if not exists activities_occurred_idx on public.activities(occurred_at);

-- ---------- Opgaver ----------
create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  due_date      date,
  assignee_id   uuid references public.team_members(id) on delete set null,
  company_id    uuid references public.companies(id) on delete cascade,
  deal_id       uuid references public.deals(id) on delete cascade,
  status        text not null default 'open' check (status in ('open','done')),
  completed_at  timestamptz,
  source        text not null default 'manual' check (source in ('manual','import')),
  created_at    timestamptz not null default now()
);
create index if not exists tasks_company_idx on public.tasks(company_id);
create index if not exists tasks_open_idx on public.tasks(status, due_date);

-- ---------- Indstillinger ----------
create table if not exists public.app_settings (
  id                    int primary key default 1 check (id = 1),
  weekly_meeting_goal   int not null default 2
);
insert into public.app_settings (id) values (1) on conflict do nothing;

-- ---------- Adgang (Row Level Security) ----------
-- Kun brugere, der er logget ind, kan læse og skrive. Begge brugere ser alt.
do $$
declare t text;
begin
  foreach t in array array['team_members','categories','stages','companies','contacts',
                           'deals','activities','tasks','app_settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Indloggede har fuld adgang" on public.%I', t);
    execute format('create policy "Indloggede har fuld adgang" on public.%I
                    for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Nyere Supabase-projekter giver ikke automatisk adgang til tabeller oprettet med SQL.
-- Indloggede brugere får derfor adgang eksplicit her (RLS ovenfor gælder stadig).
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- ---------- Import ----------
-- Modtager den fortolkede bruttoliste fra importsiden og gemmer alt i én
-- transaktion: enten lykkes hele importen, eller intet gemmes.
-- Virksomheder, der allerede findes (samme navn), springes over.
create or replace function public.import_companies(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  c          jsonb;
  p          jsonb;
  t          jsonb;
  a          jsonb;
  v_company  uuid;
  v_deal     uuid;
  v_contact  uuid;
  v_first    uuid;
  v_cat      uuid;
  v_stage    uuid;
  v_created  int := 0;
  v_skipped  text[] := '{}';
begin
  for c in select * from jsonb_array_elements(payload -> 'companies')
  loop
    if exists (select 1 from companies where lower(name) = lower(c->>'name')) then
      v_skipped := v_skipped || (c->>'name');
      continue;
    end if;

    v_cat := null;
    if coalesce(c->>'category','') <> '' then
      insert into categories (name, sort_order)
      values (c->>'category', (select coalesce(max(sort_order),0)+1 from categories))
      on conflict (name) do nothing;
      select id into v_cat from categories where name = c->>'category';
    end if;

    select id into v_stage from stages where name = c->>'stage';
    if v_stage is null then
      raise exception 'Ukendt fase: %', c->>'stage';
    end if;

    insert into companies (name, category_id, general_email, notes, owner_id,
                           do_not_contact, do_not_contact_reason, import_source)
    values (c->>'name', v_cat, nullif(c->>'general_email',''), nullif(c->>'notes',''),
            nullif(c->>'owner_id','')::uuid,
            coalesce((c->>'do_not_contact')::boolean, false),
            nullif(c->>'do_not_contact_reason',''), c->'source')
    returning id into v_company;

    v_first := null;
    for p in select * from jsonb_array_elements(coalesce(c->'contacts','[]'::jsonb))
    loop
      insert into contacts (company_id, name, title, email, linkedin_url)
      values (v_company, p->>'name', nullif(p->>'title',''), nullif(p->>'email',''),
              nullif(p->>'linkedin_url',''))
      returning id into v_contact;
      if v_first is null then v_first := v_contact; end if;
    end loop;

    insert into deals (company_id, title, stage_id, owner_id, contact_id, position,
                       closed_at)
    values (v_company, c->>'name', v_stage, nullif(c->>'owner_id','')::uuid, v_first,
            (select coalesce(max(position),0)+1 from deals where stage_id = v_stage),
            case when (select kind from stages where id = v_stage) <> 'open'
                 then current_date end)
    returning id into v_deal;

    for t in select * from jsonb_array_elements(coalesce(c->'tasks','[]'::jsonb))
    loop
      insert into tasks (title, due_date, assignee_id, company_id, deal_id, source)
      values (t->>'title', nullif(t->>'due_date','')::date,
              nullif(t->>'assignee_id','')::uuid, v_company, v_deal, 'import');
    end loop;

    for a in select * from jsonb_array_elements(coalesce(c->'activities','[]'::jsonb))
    loop
      insert into activities (type, occurred_at, company_id, deal_id, contact_id,
                              member_id, note, source)
      values (a->>'type',
              case when coalesce(a->>'date','') = '' then null
                   else ((a->>'date') || ' 12:00 Europe/Copenhagen')::timestamptz end,
              v_company, v_deal, v_first, nullif(a->>'member_id','')::uuid,
              nullif(a->>'note',''), coalesce(a->>'source','import'));
    end loop;

    v_created := v_created + 1;
  end loop;

  return jsonb_build_object('created', v_created, 'skipped', to_jsonb(v_skipped));
end $$;

grant execute on function public.import_companies(jsonb) to authenticated;
