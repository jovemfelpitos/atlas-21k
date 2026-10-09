-- Additive upgrade after schema-v3.sql: scoped read access and separate staff comments.
begin;
drop policy activity_read on public.atlas_activity_records;
create policy activity_read on public.atlas_activity_records for select to authenticated using(
 (user_id=(select auth.uid())
  and not exists(select 1 from public.atlas_admins where user_id=(select auth.uid()))
  and not exists(select 1 from public.atlas_coaches where user_id=(select auth.uid())))
 or atlas_private.can_manage(user_id)
);
-- Existing athlete-only INSERT/UPDATE policies remain unchanged.
create table public.atlas_session_comments (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null, plan_id uuid not null, session_id text not null,
 author_id uuid not null default auth.uid() references public.atlas_profiles(user_id),
 author_name text not null, author_role text not null check(author_role in ('admin','coach')),
 body text not null check(length(btrim(body)) between 1 and 3000),
 created_at timestamptz not null default now(),
 foreign key(user_id,plan_id,session_id) references public.atlas_sessions(user_id,plan_id,id)
);
create index atlas_comments_session on public.atlas_session_comments(user_id,plan_id,session_id,created_at,id);
create index atlas_comments_plan on public.atlas_session_comments(plan_id);
create index atlas_comments_author on public.atlas_session_comments(author_id);
alter table public.atlas_session_comments enable row level security;
revoke all on public.atlas_session_comments from public,anon,authenticated;
grant select on public.atlas_session_comments to authenticated;
grant insert(id,user_id,plan_id,session_id,body) on public.atlas_session_comments to authenticated;
create policy comment_read on public.atlas_session_comments for select to authenticated using(user_id=(select auth.uid()) or atlas_private.can_manage(user_id));
create policy comment_add on public.atlas_session_comments for insert to authenticated with check(author_id=(select auth.uid()) and atlas_private.can_manage(user_id));

-- Capture the authenticated author's identity; the client cannot supply or alter it.
create function atlas_private.check_session_comment() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not atlas_private.can_manage(new.user_id) then raise exception 'Atleta não autorizado'; end if;
 new.author_id=auth.uid();
 select name into new.author_name from public.atlas_profiles where user_id=auth.uid();
 new.author_role=case when exists(select 1 from public.atlas_admins where user_id=auth.uid()) then 'admin' else 'coach' end;
 new.body=btrim(new.body);new.created_at=now();
 return new;
end $$;
revoke all on function atlas_private.check_session_comment() from public,anon,authenticated;
create trigger check_session_comment before insert on public.atlas_session_comments for each row execute function atlas_private.check_session_comment();

-- A stable client-generated ID makes retries safe after an uncertain network response.
create function public.atlas_add_session_comment(comment_id uuid,athlete uuid,plan uuid,session text,comment_text text)
returns public.atlas_session_comments language plpgsql security invoker set search_path='' as $$
declare result public.atlas_session_comments;
begin
 if auth.uid() is null or not atlas_private.can_manage(athlete) then raise exception 'Atleta não autorizado'; end if;
 if comment_id is null or length(btrim(coalesce(comment_text,''))) not between 1 and 3000 then raise exception 'Escreva um comentário de até 3000 caracteres'; end if;
 insert into public.atlas_session_comments(id,user_id,plan_id,session_id,body)
 values(comment_id,athlete,plan,session,btrim(comment_text)) on conflict(id) do nothing returning * into result;
 if result.id is null then
  select * into result from public.atlas_session_comments where id=comment_id;
  if result.id is null or (result.author_id,result.user_id,result.plan_id,result.session_id,result.body)
    is distinct from (auth.uid(),athlete,plan,session,btrim(comment_text)) then
   raise exception 'Comentário já utilizado; sincronize antes de continuar';
  end if;
 end if;
 return result;
end $$;
revoke all on function public.atlas_add_session_comment(uuid,uuid,uuid,text,text) from public,anon;
grant execute on function public.atlas_add_session_comment(uuid,uuid,uuid,text,text) to authenticated;
commit;
