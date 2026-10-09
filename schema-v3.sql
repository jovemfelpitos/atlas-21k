-- Additive upgrade after schema-v2.sql. Published prescriptions stay immutable.
begin;
create table public.atlas_coaches (
 user_id uuid primary key references public.atlas_profiles(user_id),
 active boolean not null default true, created_at timestamptz not null default now()
);
create table public.atlas_coach_athletes (
 coach_id uuid not null references public.atlas_coaches(user_id),
 athlete_id uuid not null references public.atlas_profiles(user_id),
 active boolean not null default true, primary key(coach_id,athlete_id), check(coach_id<>athlete_id)
);
create index atlas_coach_athletes_athlete on public.atlas_coach_athletes(athlete_id);
alter table public.atlas_coaches enable row level security;
alter table public.atlas_coach_athletes enable row level security;
revoke all on public.atlas_coaches,public.atlas_coach_athletes from public,anon,authenticated;
grant select on public.atlas_coaches,public.atlas_coach_athletes to authenticated;
grant insert(user_id),update(active) on public.atlas_coaches to authenticated;
grant insert(coach_id,athlete_id),update(active) on public.atlas_coach_athletes to authenticated;
create policy coach_read on public.atlas_coaches for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.atlas_admins where user_id=(select auth.uid())));
create policy coach_add on public.atlas_coaches for insert to authenticated with check(exists(select 1 from public.atlas_admins where user_id=(select auth.uid())));
create policy coach_update on public.atlas_coaches for update to authenticated using(exists(select 1 from public.atlas_admins where user_id=(select auth.uid()))) with check(exists(select 1 from public.atlas_admins where user_id=(select auth.uid())));
create policy link_read on public.atlas_coach_athletes for select to authenticated using(coach_id=(select auth.uid()) or athlete_id=(select auth.uid()) or exists(select 1 from public.atlas_admins where user_id=(select auth.uid())));
create policy link_add on public.atlas_coach_athletes for insert to authenticated with check(exists(select 1 from public.atlas_admins where user_id=(select auth.uid())));
create policy link_update on public.atlas_coach_athletes for update to authenticated using(exists(select 1 from public.atlas_admins where user_id=(select auth.uid()))) with check(exists(select 1 from public.atlas_admins where user_id=(select auth.uid())));

-- Private, narrowly scoped lookup avoids recursive RLS across profiles/links/roles.
-- No private schema is exposed through PostgREST. Every privileged routine checks auth.uid().
grant usage on schema atlas_private to authenticated;
create function atlas_private.can_manage(athlete uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null
 and exists(select 1 from public.atlas_profiles p where p.user_id=athlete)
 and not exists(select 1 from public.atlas_admins a where a.user_id=athlete)
 and not exists(select 1 from public.atlas_coaches c where c.user_id=athlete)
 and (exists(select 1 from public.atlas_admins a where a.user_id=auth.uid())
 or exists(select 1 from public.atlas_coaches c join public.atlas_coach_athletes l on l.coach_id=c.user_id where c.user_id=auth.uid() and c.active and l.active and l.athlete_id=athlete));
$$;
revoke all on function atlas_private.can_manage(uuid) from public,anon;
grant execute on function atlas_private.can_manage(uuid) to authenticated;

create function atlas_private.check_team_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.atlas_admins where user_id=auth.uid()) then raise exception 'Somente o dono pode gerenciar a equipe'; end if;
 if TG_TABLE_NAME='atlas_coaches' then
  if exists(select 1 from public.atlas_admins where user_id=new.user_id) or exists(select 1 from public.atlas_plans where user_id=new.user_id) or exists(select 1 from public.atlas_plan_drafts where athlete_id=new.user_id) then raise exception 'Use uma conta separada, sem planos de atleta, para treinador'; end if;
 else
  if not exists(select 1 from public.atlas_coaches where user_id=new.coach_id and active) and new.active then raise exception 'Treinador inativo'; end if;
  if exists(select 1 from public.atlas_coaches where user_id=new.athlete_id) or exists(select 1 from public.atlas_admins where user_id=new.athlete_id) then raise exception 'Selecione uma conta de atleta'; end if;
 end if;
 return new;
end $$;
revoke all on function atlas_private.check_team_change() from public,anon,authenticated;
create trigger check_coach before insert or update on public.atlas_coaches for each row execute function atlas_private.check_team_change();
create trigger check_link before insert or update on public.atlas_coach_athletes for each row execute function atlas_private.check_team_change();

drop policy profile_read on public.atlas_profiles;
create policy profile_read on public.atlas_profiles for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.atlas_admins where user_id=(select auth.uid())) or atlas_private.can_manage(user_id));
drop policy profile_insert on public.atlas_profiles;
create policy profile_insert on public.atlas_profiles for insert to authenticated with check(user_id=(select auth.uid()) and is_admin=false);

alter table public.atlas_plans add column state text not null default 'published' check(state in ('published','archived'));
alter table public.atlas_plans add column version integer not null default 1 check(version>0);
alter table public.atlas_plans add column previous_plan_id uuid references public.atlas_plans(id);
alter table public.atlas_plans add column published_by uuid references public.atlas_profiles(user_id);
create index atlas_plans_previous on public.atlas_plans(previous_plan_id);
create index atlas_plans_publisher on public.atlas_plans(published_by);
create table public.atlas_plan_drafts (
 id uuid primary key default gen_random_uuid(), athlete_id uuid not null references public.atlas_profiles(user_id),
 author_id uuid not null references public.atlas_profiles(user_id), base_plan_id uuid references public.atlas_plans(id),
 document jsonb not null, revision integer not null default 1, state text not null default 'draft' check(state in ('draft','published')),
 published_plan_id uuid references public.atlas_plans(id), updated_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create index atlas_drafts_athlete on public.atlas_plan_drafts(athlete_id,updated_at desc);
create index atlas_drafts_author on public.atlas_plan_drafts(author_id);
create index atlas_drafts_base on public.atlas_plan_drafts(base_plan_id);
create index atlas_drafts_published on public.atlas_plan_drafts(published_plan_id);
alter table public.atlas_plans add column source_draft_id uuid unique references public.atlas_plan_drafts(id);
create table public.atlas_plan_events (
 id bigint generated always as identity primary key, plan_id uuid not null references public.atlas_plans(id),
 actor_id uuid not null references public.atlas_profiles(user_id), event text not null check(event in ('published','archived','replaced')),
 created_at timestamptz not null default now()
);
create index atlas_events_plan on public.atlas_plan_events(plan_id,created_at);
create index atlas_events_actor on public.atlas_plan_events(actor_id);
alter table public.atlas_plan_drafts enable row level security;
alter table public.atlas_plan_events enable row level security;
revoke all on public.atlas_plan_drafts,public.atlas_plan_events from public,anon,authenticated;
grant select on public.atlas_plan_drafts,public.atlas_plan_events to authenticated;
grant insert(athlete_id,author_id,base_plan_id,document),update(document) on public.atlas_plan_drafts to authenticated;
create policy draft_read on public.atlas_plan_drafts for select to authenticated using(atlas_private.can_manage(athlete_id));
create policy draft_insert on public.atlas_plan_drafts for insert to authenticated with check(author_id=(select auth.uid()) and atlas_private.can_manage(athlete_id));
create policy draft_update on public.atlas_plan_drafts for update to authenticated using(state='draft' and atlas_private.can_manage(athlete_id)) with check(state='draft' and atlas_private.can_manage(athlete_id));
create policy event_read on public.atlas_plan_events for select to authenticated using(exists(select 1 from public.atlas_plans p where p.id=plan_id and (p.user_id=(select auth.uid()) or atlas_private.can_manage(p.user_id))));

create function atlas_private.validate_document(document jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare s jsonb; g jsonb; ids text[]='{}';
begin
 if jsonb_typeof(document) is distinct from 'object' or jsonb_typeof(document->'name') is distinct from 'string' or length(coalesce(document->>'name','')) not between 1 and 200 then raise exception 'Nome do plano obrigatório (até 200 caracteres)'; end if;
 if (document->>'goal_km')::numeric not between 0 and 1000 or (document->>'goal_minutes')::numeric not between 0 and 100000 then raise exception 'Meta inválida'; end if;
 if document->>'goal_date' is not null and coalesce(document->>'goal_date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Data da meta inválida'; end if;
 perform (document->>'goal_date')::date;
 if jsonb_typeof(document->'sessions') is distinct from 'array' or jsonb_array_length(document->'sessions') not between 1 and 1000 then raise exception 'Inclua de 1 a 1000 sessões'; end if;
 if jsonb_typeof(document->'guide') is distinct from 'array' or jsonb_array_length(document->'guide') not between 1 and 100 then raise exception 'Inclua de 1 a 100 orientações'; end if;
 for g in select * from jsonb_array_elements(document->'guide') loop
  if jsonb_typeof(g) is distinct from 'object' or jsonb_typeof(g->'tema') is distinct from 'string' or jsonb_typeof(g->'orientacao') is distinct from 'string' or length(coalesce(g->>'tema','')) not between 1 and 200 or length(coalesce(g->>'orientacao','')) not between 1 and 10000 then raise exception 'Guia incompleto ou muito longo'; end if;
 end loop;
 for s in select * from jsonb_array_elements(document->'sessions') loop
  if jsonb_typeof(s) is distinct from 'object' or jsonb_typeof(s->'id') is distinct from 'string' or jsonb_typeof(s->'date') is distinct from 'string' or jsonb_typeof(s->'type') is distinct from 'string' or jsonb_typeof(s->'description') is distinct from 'string' or coalesce(s->>'id','') !~ '^[A-Za-z0-9_-]{1,80}$' or (s->>'id')=any(ids) then raise exception 'ID de sessão inválido ou repetido'; end if;
  ids=array_append(ids,s->>'id');
  if coalesce(s->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Data obrigatória no formato AAAA-MM-DD'; end if;
  perform (s->>'date')::date;
  if length(coalesce(s->>'type','')) not between 1 and 120 or length(coalesce(s->>'description','')) not between 1 and 10000 then raise exception 'Modalidade e descrição obrigatórias'; end if;
  if (s->>'km')::numeric not between 0 and 1000 or (s->>'minutes')::numeric not between 0 and 1440 then raise exception 'Distância ou duração inválida'; end if;
  if length(coalesce(s->>'intensity',''))>500 or length(coalesce(s->>'gym',''))>3000 or length(coalesce(s->>'notes',''))>3000 then raise exception 'Orientação de sessão muito longa'; end if;
 end loop;
end $$;
revoke all on function atlas_private.validate_document(jsonb) from public,anon;
grant execute on function atlas_private.validate_document(jsonb) to authenticated;
create function atlas_private.check_draft() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform atlas_private.validate_document(new.document);
 if TG_OP='UPDATE' then
  if old.state<>'draft' then raise exception 'Rascunho já publicado'; end if;
  if (new.id,new.athlete_id,new.author_id,new.base_plan_id) is distinct from (old.id,old.athlete_id,old.author_id,old.base_plan_id) then raise exception 'Identidade do rascunho imutável'; end if;
  new.revision=old.revision+1;
 end if;
 if new.base_plan_id is not null and not exists(select 1 from public.atlas_plans where id=new.base_plan_id and user_id=new.athlete_id) then raise exception 'Plano base de outro atleta'; end if;
 new.updated_at=now();return new;
end $$;
revoke all on function atlas_private.check_draft() from public,anon,authenticated;
create trigger check_draft before insert or update on public.atlas_plan_drafts for each row execute function atlas_private.check_draft();

revoke all on public.atlas_plans,public.atlas_sessions from public,anon;
revoke insert,update,delete on public.atlas_plans,public.atlas_sessions from authenticated;
drop policy plan_import on public.atlas_plans;
drop policy session_import on public.atlas_sessions;
drop policy plan_read on public.atlas_plans;
drop policy session_read on public.atlas_sessions;
create policy plan_read on public.atlas_plans for select to authenticated using(user_id=(select auth.uid()) or atlas_private.can_manage(user_id));
create policy session_read on public.atlas_sessions for select to authenticated using(user_id=(select auth.uid()) or atlas_private.can_manage(user_id));
drop policy activity_read on public.atlas_activity_records;
drop policy activity_insert on public.atlas_activity_records;
drop policy activity_update on public.atlas_activity_records;
create policy activity_read on public.atlas_activity_records for select to authenticated using(user_id=(select auth.uid()) and not exists(select 1 from public.atlas_admins where user_id=(select auth.uid())) and not exists(select 1 from public.atlas_coaches where user_id=(select auth.uid())));
create policy activity_insert on public.atlas_activity_records for insert to authenticated with check(user_id=(select auth.uid()) and not exists(select 1 from public.atlas_admins where user_id=(select auth.uid())) and not exists(select 1 from public.atlas_coaches where user_id=(select auth.uid())) and exists(select 1 from public.atlas_plans where id=plan_id and user_id=(select auth.uid()) and state='published'));
create policy activity_update on public.atlas_activity_records for update to authenticated using(user_id=(select auth.uid()) and not exists(select 1 from public.atlas_admins where user_id=(select auth.uid())) and not exists(select 1 from public.atlas_coaches where user_id=(select auth.uid()))) with check(user_id=(select auth.uid()) and not exists(select 1 from public.atlas_admins where user_id=(select auth.uid())) and not exists(select 1 from public.atlas_coaches where user_id=(select auth.uid())));
create function atlas_private.check_record_identity() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if (new.user_id,new.plan_id,new.session_id) is distinct from (old.user_id,old.plan_id,old.session_id) then raise exception 'Vínculo da atividade imutável'; end if;return new;
end $$;
revoke all on function atlas_private.check_record_identity() from public,anon,authenticated;
create trigger check_record_identity before update on public.atlas_activity_records for each row execute function atlas_private.check_record_identity();

create function public.atlas_access_context() returns jsonb language sql stable security invoker set search_path='' as $$
 select case when exists(select 1 from public.atlas_admins where user_id=auth.uid()) then jsonb_build_object('role','admin','active',true)
 when exists(select 1 from public.atlas_coaches where user_id=auth.uid()) then (select jsonb_build_object('role','coach','active',active) from public.atlas_coaches where user_id=auth.uid())
 else jsonb_build_object('role','athlete','active',true) end;
$$;
revoke all on function public.atlas_access_context() from public,anon;
grant execute on function public.atlas_access_context() to authenticated;

create function public.atlas_save_draft(draft_id uuid,athlete uuid,document jsonb,expected_revision integer,base_plan uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result public.atlas_plan_drafts;
begin
 if not atlas_private.can_manage(athlete) then raise exception 'Atleta não autorizado'; end if;
 if draft_id is null then
  insert into public.atlas_plan_drafts(athlete_id,author_id,base_plan_id,document) values(athlete,auth.uid(),base_plan,document) returning * into result;
 else
  update public.atlas_plan_drafts set document=atlas_save_draft.document where id=draft_id and athlete_id=athlete and revision=expected_revision and state='draft' returning * into result;
  if result.id is null then raise exception 'Conflito de edição: atualize o rascunho antes de salvar'; end if;
 end if;return to_jsonb(result);
end $$;
revoke all on function public.atlas_save_draft(uuid,uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.atlas_save_draft(uuid,uuid,jsonb,integer,uuid) to authenticated;

-- Command-only writes protect immutable snapshots. These private definer commands deliberately
-- own publication/archive; API roles have no direct INSERT/UPDATE/DELETE grant on snapshots.
create function atlas_private.publish_draft(draft_id uuid,expected_revision integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare d public.atlas_plan_drafts; base public.atlas_plans; result uuid; s jsonb; next_version integer=1;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta'; end if;
 select * into d from public.atlas_plan_drafts where id=draft_id for update;
 if d.id is null or not atlas_private.can_manage(d.athlete_id) then raise exception 'Rascunho não autorizado'; end if;
 if expected_revision is null or d.state<>'draft' or d.revision<>expected_revision then raise exception 'Conflito de edição: atualize e revise antes de publicar'; end if;
 perform atlas_private.validate_document(d.document);
 if d.base_plan_id is not null then
  select * into base from public.atlas_plans where id=d.base_plan_id and user_id=d.athlete_id for update;
  if base.id is null or base.state<>'published' then raise exception 'Esta versão já foi arquivada ou substituída'; end if;
  next_version=base.version+1;
 end if;
 insert into public.atlas_plans(user_id,name,goal_km,goal_minutes,goal_date,guide,version,previous_plan_id,published_by,source_draft_id)
 values(d.athlete_id,d.document->>'name',(d.document->>'goal_km')::numeric,(d.document->>'goal_minutes')::numeric,(d.document->>'goal_date')::date,d.document->'guide',next_version,d.base_plan_id,auth.uid(),d.id) returning id into result;
 for s in select * from jsonb_array_elements(d.document->'sessions') loop
  insert into public.atlas_sessions(user_id,plan_id,id,date,type,km,minutes,intensity,description,gym,notes)
  values(d.athlete_id,result,s->>'id',(s->>'date')::date,s->>'type',(s->>'km')::numeric,(s->>'minutes')::numeric,coalesce(s->>'intensity',''),s->>'description',coalesce(s->>'gym',''),coalesce(s->>'notes',''));
 end loop;
 if base.id is not null then
  update public.atlas_plans set state='archived' where id=base.id;
  insert into public.atlas_plan_events(plan_id,actor_id,event) values(base.id,auth.uid(),'replaced');
 end if;
 update public.atlas_plan_drafts set state='published',published_plan_id=result where id=d.id;
 insert into public.atlas_plan_events(plan_id,actor_id,event) values(result,auth.uid(),'published');
 return result;
end $$;
revoke all on function atlas_private.publish_draft(uuid,integer) from public,anon;
grant execute on function atlas_private.publish_draft(uuid,integer) to authenticated;
create function public.atlas_publish_draft(draft_id uuid,expected_revision integer) returns uuid language sql security invoker set search_path='' as $$select atlas_private.publish_draft(draft_id,expected_revision);$$;
revoke all on function public.atlas_publish_draft(uuid,integer) from public,anon;
grant execute on function public.atlas_publish_draft(uuid,integer) to authenticated;

create function atlas_private.archive_plan(plan uuid) returns void language plpgsql security definer set search_path='' as $$
declare p public.atlas_plans;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta'; end if;
 select * into p from public.atlas_plans where id=plan for update;
 if p.id is null or not atlas_private.can_manage(p.user_id) then raise exception 'Plano não autorizado'; end if;
 if p.state<>'published' then raise exception 'Plano já arquivado'; end if;
 update public.atlas_plans set state='archived' where id=p.id;
 insert into public.atlas_plan_events(plan_id,actor_id,event) values(p.id,auth.uid(),'archived');
end $$;
revoke all on function atlas_private.archive_plan(uuid) from public,anon;
grant execute on function atlas_private.archive_plan(uuid) to authenticated;
create function public.atlas_archive_plan(plan uuid) returns void language sql security invoker set search_path='' as $$select atlas_private.archive_plan(plan);$$;
revoke all on function public.atlas_archive_plan(uuid) from public,anon;
grant execute on function public.atlas_archive_plan(uuid) to authenticated;

-- Existing import API now creates a draft, never silently publishes.
create or replace function public.atlas_import_plan(athlete uuid,document jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare d jsonb;
begin
 d=public.atlas_save_draft(null,athlete,document,null,null);return (d->>'id')::uuid;
end $$;
commit;
