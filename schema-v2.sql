-- Execute once in the correct Supabase project's SQL Editor. Does not touch legacy tables.
begin;
create table public.atlas_admins(user_id uuid primary key references auth.users(id));
alter table public.atlas_admins enable row level security;
revoke all on public.atlas_admins from anon,authenticated;
grant select on public.atlas_admins to authenticated;
create policy admin_self on public.atlas_admins for select to authenticated using(user_id=(select auth.uid()));

create table public.atlas_profiles(
 user_id uuid primary key references auth.users(id),
 name text not null check(length(name) between 1 and 120),
 available_days integer[] not null default '{}' check(available_days <@ array[0,1,2,3,4,5,6]),
 is_admin boolean not null default false
);
-- This flag is only a display aid, never an authorization source. Admin grants remain SQL-only.
create schema atlas_private;
revoke all on schema atlas_private from public,anon,authenticated;
create function atlas_private.sync_admin_flag() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='DELETE' then update public.atlas_profiles set is_admin=false where user_id=old.user_id;return old;
 else update public.atlas_profiles set is_admin=true where user_id=new.user_id;return new;end if;
end $$;
revoke all on function atlas_private.sync_admin_flag() from public,anon,authenticated;
create trigger sync_admin_flag after insert or delete on public.atlas_admins for each row execute function atlas_private.sync_admin_flag();
alter table public.atlas_profiles enable row level security;
revoke all on public.atlas_profiles from anon,authenticated;
grant select,insert on public.atlas_profiles to authenticated;
grant update(name,available_days) on public.atlas_profiles to authenticated;
create policy profile_read on public.atlas_profiles for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.atlas_admins where user_id=(select auth.uid())));
create policy profile_insert on public.atlas_profiles for insert to authenticated with check(user_id=(select auth.uid()) and is_admin=false and not exists(select 1 from public.atlas_admins where user_id=(select auth.uid())));
create policy profile_update on public.atlas_profiles for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table public.atlas_plans(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.atlas_profiles(user_id),
 name text not null check(length(name) between 1 and 200),
 goal_km numeric check(goal_km between 0 and 1000),goal_minutes numeric check(goal_minutes between 0 and 100000),goal_date date,
 guide jsonb not null check(jsonb_typeof(guide)='array' and jsonb_array_length(guide)>0),
 created_at timestamptz not null default now(),unique(user_id,id)
);
create table public.atlas_sessions(
 user_id uuid not null,plan_id uuid not null,id text not null check(id ~ '^[A-Za-z0-9_-]{1,80}$'),
 date date not null,type text not null check(length(type)>0),km numeric check(km between 0 and 1000),minutes numeric check(minutes between 0 and 1440),
 intensity text not null default '',description text not null check(length(description)>0),gym text not null default '',notes text not null default '',
 primary key(user_id,plan_id,id),foreign key(user_id,plan_id) references public.atlas_plans(user_id,id)
);
create table public.atlas_activity_records(
 user_id uuid not null,plan_id uuid not null,session_id text not null,
 status text not null check(status in ('feito','adaptado','não feito')),
 km numeric check(km between 0 and 1000),minutes numeric check(minutes between 0 and 1440),
 effort integer check(effort between 0 and 10),pain integer check(pain between 0 and 10),
 recovery text not null default '',notes text not null default '' check(length(notes)<=3000),updated_at timestamptz not null default now(),
 primary key(user_id,plan_id,session_id),foreign key(user_id,plan_id,session_id) references public.atlas_sessions(user_id,plan_id,id)
);
alter table public.atlas_plans enable row level security;
alter table public.atlas_sessions enable row level security;
alter table public.atlas_activity_records enable row level security;
revoke all on public.atlas_plans,public.atlas_sessions,public.atlas_activity_records from anon,authenticated;
grant select,insert on public.atlas_plans,public.atlas_sessions to authenticated;
grant select,insert,update on public.atlas_activity_records to authenticated;
create policy plan_read on public.atlas_plans for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.atlas_admins where user_id=(select auth.uid())));
create policy plan_import on public.atlas_plans for insert to authenticated with check(exists(select 1 from public.atlas_admins where user_id=(select auth.uid())) and exists(select 1 from public.atlas_profiles where user_id=atlas_plans.user_id and not is_admin));
create policy session_read on public.atlas_sessions for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.atlas_admins where user_id=(select auth.uid())));
create policy session_import on public.atlas_sessions for insert to authenticated with check(exists(select 1 from public.atlas_admins where user_id=(select auth.uid())));
create policy activity_read on public.atlas_activity_records for select to authenticated using(user_id=(select auth.uid()) and not exists(select 1 from public.atlas_admins where user_id=(select auth.uid())));
create policy activity_insert on public.atlas_activity_records for insert to authenticated with check(user_id=(select auth.uid()) and not exists(select 1 from public.atlas_admins where user_id=(select auth.uid())));
create policy activity_update on public.atlas_activity_records for update to authenticated using(user_id=(select auth.uid()) and not exists(select 1 from public.atlas_admins where user_id=(select auth.uid()))) with check(user_id=(select auth.uid()) and not exists(select 1 from public.atlas_admins where user_id=(select auth.uid())));
create index atlas_sessions_plan on public.atlas_sessions(plan_id,date);

-- Invoker: RLS applies to every insert. A failing session rolls back the entire import.
create function public.atlas_import_plan(athlete uuid,document jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare plan uuid; s jsonb; g jsonb;
begin
 if not exists(select 1 from public.atlas_admins where user_id=(select auth.uid())) then raise exception 'Somente administradores podem importar';end if;
 if athlete is null or not exists(select 1 from public.atlas_profiles where user_id=athlete and not is_admin) then raise exception 'Selecione um atleta válido';end if;
 if jsonb_typeof(document->'sessions') is distinct from 'array' or jsonb_array_length(document->'sessions') not between 1 and 1000 then raise exception 'Sessões inválidas';end if;
 if jsonb_typeof(document->'guide') is distinct from 'array' or jsonb_array_length(document->'guide')<1 then raise exception 'Guia obrigatório';end if;
 for g in select * from jsonb_array_elements(document->'guide') loop
 if coalesce(g->>'tema','')='' or coalesce(g->>'orientacao','')='' then raise exception 'Guia incompleto';end if;end loop;
 insert into public.atlas_plans(user_id,name,goal_km,goal_minutes,goal_date,guide)
 values(athlete,document->>'name',(document->>'goal_km')::numeric,(document->>'goal_minutes')::numeric,(document->>'goal_date')::date,document->'guide') returning id into plan;
 for s in select * from jsonb_array_elements(document->'sessions') loop
 insert into public.atlas_sessions(user_id,plan_id,id,date,type,km,minutes,intensity,description,gym,notes)
 values(athlete,plan,s->>'id',(s->>'date')::date,s->>'type',(s->>'km')::numeric,(s->>'minutes')::numeric,coalesce(s->>'intensity',''),s->>'description',coalesce(s->>'gym',''),coalesce(s->>'notes',''));
 end loop;return plan;
end $$;
revoke all on function public.atlas_import_plan(uuid,jsonb) from public,anon;
grant execute on function public.atlas_import_plan(uuid,jsonb) to authenticated;
commit;
