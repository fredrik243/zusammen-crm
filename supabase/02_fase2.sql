-- =====================================================================
-- Zusammen CRM – database, fase 2 (pipeline)
-- Kør hele denne fil i Supabase: SQL Editor → New query → indsæt → Run.
-- Kør først 01_fase1.sql, hvis det ikke er gjort. Filen kan trygt køres igen.
-- =====================================================================

-- Flytter en deal til en ny fase og/eller position og logger flytningen
-- som en aktivitet med dato. Alt sker i én transaktion.
create or replace function public.move_deal(p_deal uuid, p_stage uuid, p_position double precision)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_old_stage uuid;
  v_company   uuid;
  v_kind      text;
  v_member    uuid;
begin
  select stage_id, company_id into v_old_stage, v_company from deals where id = p_deal;
  if not found then
    raise exception 'Deal findes ikke';
  end if;
  select kind into v_kind from stages where id = p_stage;
  if v_kind is null then
    raise exception 'Fase findes ikke';
  end if;

  update deals
     set stage_id  = p_stage,
         position  = p_position,
         closed_at = case when v_kind = 'open' then null
                          when v_old_stage is distinct from p_stage then current_date
                          else closed_at end
   where id = p_deal;

  if v_old_stage is distinct from p_stage then
    select id into v_member from team_members where user_id = auth.uid();
    insert into activities (type, occurred_at, company_id, deal_id, member_id, source,
                            from_stage_id, to_stage_id)
    values ('stage_changed', now(), v_company, p_deal, v_member, 'system',
            v_old_stage, p_stage);
  end if;
end $$;

grant execute on function public.move_deal(uuid, uuid, double precision) to authenticated;
