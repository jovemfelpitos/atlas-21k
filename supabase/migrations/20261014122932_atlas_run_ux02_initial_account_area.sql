-- Initial area is an onboarding preference, never an admin grant.
begin;
alter table public.atlas_profiles add column onboarding_completed boolean not null default false;
-- Existing accounts retain their chosen area and history.
update public.atlas_profiles set onboarding_completed=true;
revoke insert on public.atlas_profiles from authenticated;
grant insert(user_id,name,available_days,is_admin,preferred_area) on public.atlas_profiles to authenticated;

create function atlas_private.complete_onboarding(initial_area text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare completed boolean; chosen text;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta'; end if;
 if initial_area not in ('athlete','coach') or initial_area is null then raise exception 'Escolha atleta ou treinador'; end if;
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null
  and deleted_at is null and not coalesce(is_anonymous,false)) then raise exception 'Confirme seu e-mail antes de continuar'; end if;
 perform atlas_private.ensure_profile(auth.uid());
 select onboarding_completed into completed from public.atlas_profiles where user_id=auth.uid() for update;
 if not completed then
  chosen='athlete';
  if initial_area='coach' and not exists(select 1 from public.atlas_coaches where user_id=auth.uid() and not active) then
   perform atlas_private.enable_coach();chosen='coach';
  end if;
  update public.atlas_profiles set preferred_area=chosen,onboarding_completed=true where user_id=auth.uid();
 end if;
 return public.atlas_access_context();
end $$;
revoke all on function atlas_private.complete_onboarding(text) from public,anon;
grant execute on function atlas_private.complete_onboarding(text) to authenticated;
create function public.atlas_complete_onboarding(initial_area text default 'athlete') returns jsonb
language sql security invoker set search_path='' as $$
 select atlas_private.complete_onboarding(initial_area);
$$;
revoke all on function public.atlas_complete_onboarding(text) from public,anon;
grant execute on function public.atlas_complete_onboarding(text) to authenticated;
commit;
