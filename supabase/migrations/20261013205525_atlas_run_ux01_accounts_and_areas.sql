-- UX-01: cumulative account areas. Upgrade after schema-v4.sql, preserving all IDs.
begin;
alter table public.atlas_profiles add column preferred_area text not null default 'athlete'
 check(preferred_area in ('athlete','coach','admin'));
grant update(preferred_area) on public.atlas_profiles to authenticated;
update public.atlas_profiles p set preferred_area=case
 when exists(select 1 from public.atlas_admins a where a.user_id=p.user_id) then 'admin'
 when exists(select 1 from public.atlas_coaches c where c.user_id=p.user_id and c.active) then 'coach'
 else 'athlete' end;

-- Auth creates only a personal profile; user-editable metadata never grants roles.
create function atlas_private.on_account_created() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if coalesce(new.is_anonymous,false) or new.deleted_at is not null then return new; end if;
 insert into public.atlas_profiles(user_id,name)
 values(new.id,case when jsonb_typeof(new.raw_user_meta_data->'full_name')='string'
  and length(btrim(new.raw_user_meta_data->>'full_name'))>0
  then left(btrim(new.raw_user_meta_data->>'full_name'),120) else 'Novo usuário' end)
 on conflict(user_id) do nothing;
 return new;
end $$;
revoke all on function atlas_private.on_account_created() from public,anon,authenticated;
create trigger atlas_account_created after insert on auth.users
 for each row execute function atlas_private.on_account_created();
insert into public.atlas_profiles(user_id,name,is_admin,preferred_area)
 select u.id,case when jsonb_typeof(u.raw_user_meta_data->'full_name')='string'
  and length(btrim(u.raw_user_meta_data->>'full_name'))>0
  then left(btrim(u.raw_user_meta_data->>'full_name'),120) else 'Novo usuário' end,
 exists(select 1 from public.atlas_admins a where a.user_id=u.id),
 case when exists(select 1 from public.atlas_admins a where a.user_id=u.id) then 'admin' else 'athlete' end
 from auth.users u where u.deleted_at is null and not coalesce(u.is_anonymous,false)
 on conflict(user_id) do nothing;

create function atlas_private.ensure_profile(account uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare source auth.users; result jsonb;
begin
 if auth.uid() is null or account is null or (account<>auth.uid()
  and not exists(select 1 from public.atlas_admins where user_id=auth.uid())) then
  raise exception 'Conta não autorizada';
 end if;
 select * into source from auth.users where id=account and deleted_at is null and not coalesce(is_anonymous,false);
 if source.id is null then raise exception 'Conta indisponível'; end if;
 insert into public.atlas_profiles(user_id,name,is_admin,preferred_area)
 values(account,case when jsonb_typeof(source.raw_user_meta_data->'full_name')='string'
  and length(btrim(source.raw_user_meta_data->>'full_name'))>0
  then left(btrim(source.raw_user_meta_data->>'full_name'),120) else 'Novo usuário' end,
  exists(select 1 from public.atlas_admins where user_id=account),
  case when exists(select 1 from public.atlas_admins where user_id=account) then 'admin' else 'athlete' end)
 on conflict(user_id) do nothing;
 select to_jsonb(p) into result from public.atlas_profiles p where p.user_id=account;
 return result;
end $$;
revoke all on function atlas_private.ensure_profile(uuid) from public,anon;
grant execute on function atlas_private.ensure_profile(uuid) to authenticated;
create function public.atlas_ensure_profile(account uuid default null) returns jsonb
language sql security invoker set search_path='' as $$
 select atlas_private.ensure_profile(coalesce(account,auth.uid()));
$$;
revoke all on function public.atlas_ensure_profile(uuid) from public,anon;
grant execute on function public.atlas_ensure_profile(uuid) to authenticated;

create or replace function atlas_private.can_manage(athlete uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null
 and exists(select 1 from public.atlas_profiles p where p.user_id=athlete)
 and (exists(select 1 from public.atlas_admins a where a.user_id=auth.uid())
 or exists(select 1 from public.atlas_coaches c join public.atlas_coach_athletes l on l.coach_id=c.user_id
  where c.user_id=auth.uid() and c.active and l.active and l.athlete_id=athlete));
$$;
create or replace function atlas_private.check_team_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare owner boolean;
begin
 owner=auth.uid() is not null and exists(select 1 from public.atlas_admins where user_id=auth.uid());
 if TG_TABLE_NAME='atlas_coaches' then
  if not owner and not (auth.uid() is not null and TG_OP='INSERT' and new.user_id=auth.uid() and new.active) then
   raise exception 'Somente o dono pode gerenciar a equipe';
  end if;
  if new.active and not exists(select 1 from auth.users where id=new.user_id and email_confirmed_at is not null
   and deleted_at is null and not coalesce(is_anonymous,false)) then raise exception 'Confirme o e-mail antes de ativar treinador'; end if;
 else
  if not owner then raise exception 'Somente o dono pode gerenciar os vínculos'; end if;
  if new.active and not exists(select 1 from public.atlas_coaches where user_id=new.coach_id and active) then raise exception 'Treinador inativo'; end if;
 end if;
 return new;
end $$;

-- Direct role writes remain owner-only. This command can only activate the caller,
-- never reactivate an owner-disabled coach, assign athletes, or grant admin.
create function atlas_private.enable_coach() returns jsonb
language plpgsql security definer set search_path='' as $$
declare enabled boolean;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta'; end if;
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null
  and deleted_at is null and not coalesce(is_anonymous,false)) then raise exception 'Confirme seu e-mail antes de ativar treinador'; end if;
 perform atlas_private.ensure_profile(auth.uid());
 insert into public.atlas_coaches(user_id) values(auth.uid()) on conflict(user_id) do nothing;
 select active into enabled from public.atlas_coaches where user_id=auth.uid() for update;
 if not enabled then raise exception 'Acesso de treinador desativado pelo dono. Solicite a reativação ao dono'; end if;
 return jsonb_build_object('active',true);
end $$;
revoke all on function atlas_private.enable_coach() from public,anon;
grant execute on function atlas_private.enable_coach() to authenticated;
create function public.atlas_enable_coach() returns jsonb language sql security invoker set search_path='' as $$
 select atlas_private.enable_coach();
$$;
revoke all on function public.atlas_enable_coach() from public,anon;
grant execute on function public.atlas_enable_coach() to authenticated;

drop policy activity_read on public.atlas_activity_records;
drop policy activity_insert on public.atlas_activity_records;
drop policy activity_update on public.atlas_activity_records;
create policy activity_read on public.atlas_activity_records for select to authenticated
 using(user_id=(select auth.uid()) or atlas_private.can_manage(user_id));
create policy activity_insert on public.atlas_activity_records for insert to authenticated
 with check(user_id=(select auth.uid()) and exists(select 1 from public.atlas_plans where id=plan_id
  and user_id=(select auth.uid()) and state='published'));
create policy activity_update on public.atlas_activity_records for update to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

-- Keep role/active for older clients while exposing all server-authorized areas.
create or replace function public.atlas_access_context() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'role',case when exists(select 1 from public.atlas_admins where user_id=auth.uid()) then 'admin'
   when exists(select 1 from public.atlas_coaches where user_id=auth.uid()) then 'coach' else 'athlete' end,
  'active',case when exists(select 1 from public.atlas_admins where user_id=auth.uid()) then true
   else coalesce((select active from public.atlas_coaches where user_id=auth.uid()),true) end,
  'areas',to_jsonb(array['athlete']::text[]
   || case when exists(select 1 from public.atlas_coaches where user_id=auth.uid() and active) then array['coach'] else array[]::text[] end
   || case when exists(select 1 from public.atlas_admins where user_id=auth.uid()) then array['admin'] else array[]::text[] end),
  'coach_status',coalesce((select case when active then 'active' else 'inactive' end from public.atlas_coaches where user_id=auth.uid()),'none'),
  'preferred_area',coalesce((select preferred_area from public.atlas_profiles where user_id=auth.uid()),'athlete'))
 where auth.uid() is not null;
$$;

-- Only the owner can inspect this small projection of Auth accounts. No credentials
-- or editable metadata are returned. Paging is explicit and capped at 100 rows.
create function atlas_private.list_users(search_text text,user_filter text,page_offset integer,page_size integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.atlas_admins where user_id=auth.uid()) then
  raise exception 'Somente o dono pode consultar usuários';
 end if;
 if user_filter not in ('all','athletes','coaches','pending') or user_filter is null
  or page_offset is null or page_offset<0 or page_size is null or page_size not between 1 and 100
  or length(coalesce(search_text,''))>120 then raise exception 'Filtro ou paginação inválidos'; end if;
 with accounts as (
  select u.id user_id,coalesce(p.name,'Perfil pendente') name,u.email,
   u.email_confirmed_at is not null email_confirmed,p.user_id is not null profile_ready,
   exists(select 1 from public.atlas_admins a where a.user_id=u.id) is_admin,
   case when c.user_id is null then 'none' when c.active then 'active' else 'inactive' end coach_status
  from auth.users u left join public.atlas_profiles p on p.user_id=u.id
  left join public.atlas_coaches c on c.user_id=u.id
  where u.deleted_at is null and not coalesce(u.is_anonymous,false)
 ), filtered as (
  select * from accounts where (coalesce(search_text,'')='' or name ilike '%'||search_text||'%' or email ilike '%'||search_text||'%')
   and (user_filter in ('all','athletes') or (user_filter='coaches' and coach_status<>'none')
    or (user_filter='pending' and (not profile_ready or not email_confirmed)))
 ), paged as (select * from filtered order by lower(name),user_id offset page_offset limit page_size)
 select jsonb_build_object('total',(select count(*) from filtered),'users',coalesce((select jsonb_agg(to_jsonb(paged) order by lower(name),user_id) from paged),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function atlas_private.list_users(text,text,integer,integer) from public,anon;
grant execute on function atlas_private.list_users(text,text,integer,integer) to authenticated;
create function public.atlas_list_users(search_text text default '',user_filter text default 'all',page_offset integer default 0,page_size integer default 25) returns jsonb
language sql stable security invoker set search_path='' as $$
 select atlas_private.list_users(search_text,user_filter,page_offset,page_size);
$$;
revoke all on function public.atlas_list_users(text,text,integer,integer) from public,anon;
grant execute on function public.atlas_list_users(text,text,integer,integer) to authenticated;
commit;
