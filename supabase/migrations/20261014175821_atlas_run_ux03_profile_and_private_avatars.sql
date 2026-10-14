-- Additive profile fields. Existing ownership, roles and workout IDs are unchanged.
alter table public.atlas_profiles
 add column birth_date date,
 add column avatar_path text,
 add constraint atlas_profile_birth_date_check check(birth_date is null or
  birth_date between date '0001-01-01' and (current_timestamp at time zone 'America/Sao_Paulo')::date),
 add constraint atlas_profile_avatar_path_check check(avatar_path is null or
  avatar_path ~ ('^' || user_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'));
grant update(birth_date,avatar_path) on public.atlas_profiles to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('atlas-avatars','atlas-avatars',false,524288,array['image/jpeg']);

-- Each upload gets a new path. No UPDATE/upsert policy is granted.
create policy atlas_avatar_insert on storage.objects for insert to authenticated
 with check(bucket_id='atlas-avatars' and owner_id=(select auth.uid())::text and
  name ~ ('^' || (select auth.uid())::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'));
create policy atlas_avatar_select on storage.objects for select to authenticated
 using(bucket_id='atlas-avatars' and (
  (owner_id=(select auth.uid())::text and split_part(name,'/',1)=(select auth.uid())::text)
  or exists(select 1 from public.atlas_profiles p where p.user_id::text=split_part(storage.objects.name,'/',1) and p.avatar_path=storage.objects.name)
 ));
create policy atlas_avatar_delete on storage.objects for delete to authenticated
 using(bucket_id='atlas-avatars' and owner_id=(select auth.uid())::text and split_part(name,'/',1)=(select auth.uid())::text);

create function atlas_private.check_profile_avatar() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 if new.avatar_path is not null and new.avatar_path is distinct from old.avatar_path and not exists(
  select 1 from storage.objects o where o.bucket_id='atlas-avatars' and o.name=new.avatar_path
   and o.owner_id=new.user_id::text and o.metadata->>'mimetype'='image/jpeg'
 ) then raise exception 'Envie a foto antes de vinculá-la ao perfil.' using errcode='22023'; end if;
 return new;
end $$;
revoke all on function atlas_private.check_profile_avatar() from public,anon,authenticated;
create trigger atlas_profile_avatar_check before update of avatar_path on public.atlas_profiles
 for each row execute function atlas_private.check_profile_avatar();
