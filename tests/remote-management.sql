-- Disposable fixtures; all users, roles, plans and records are rolled back.
begin;
create temporary table atlas_sprint_fixture(owner_id uuid,c1 uuid,c2 uuid,a uuid,b uuid,doc jsonb,draft jsonb,plan uuid,revised uuid) on commit drop;
grant select,update on atlas_sprint_fixture to authenticated;
insert into atlas_sprint_fixture(owner_id,c1,c2,a,b,doc) values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'{"name":"Fixture de validação","guide":[{"tema":"Teste","orientacao":"Conteúdo fictício de teste"}],"sessions":[{"id":"s1","date":"2026-10-12","type":"Teste","description":"Sessão fictícia"},{"id":"s2","date":"2026-10-12","type":"Teste","description":"Sessão fictícia"}]}'::jsonb);
insert into auth.users(id,instance_id,aud,role,email,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
select id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','atlas-sprint-'||id::text||'@example.invalid',now(),now(),now(),'{}'::jsonb,'{}'::jsonb
from atlas_sprint_fixture f cross join lateral unnest(array[f.owner_id,f.c1,f.c2,f.a,f.b]) as id;
insert into public.atlas_profiles(user_id,name)
select id,'Fixture de validação' from atlas_sprint_fixture f cross join lateral unnest(array[f.owner_id,f.c1,f.c2,f.a,f.b]) as id;
insert into public.atlas_admins select owner_id from atlas_sprint_fixture;
select set_config('request.jwt.claim.sub',(select owner_id::text from atlas_sprint_fixture),true);
set local role authenticated;
insert into public.atlas_coaches(user_id) select c1 from atlas_sprint_fixture union all select c2 from atlas_sprint_fixture;
insert into public.atlas_coach_athletes(coach_id,athlete_id) select c1,a from atlas_sprint_fixture union all select c2,b from atlas_sprint_fixture;
select set_config('request.jwt.claim.sub',(select c1::text from atlas_sprint_fixture),true);
do $$begin
 if (public.atlas_access_context()->>'role')<>'coach' then raise exception 'FAIL coach role'; end if;
 if exists(select 1 from public.atlas_profiles where user_id=(select b from atlas_sprint_fixture)) then raise exception 'FAIL unrelated profile visible'; end if;
 begin
  perform public.atlas_save_draft(null,(select b from atlas_sprint_fixture),(select doc from atlas_sprint_fixture),null,null);
  raise exception 'FAIL unrelated draft permitted';
 exception when others then if SQLERRM not like '%Atleta não autorizado%' then raise; end if;end;
 begin
  update public.atlas_plans set state='archived';raise exception 'FAIL direct snapshot write';
 exception when insufficient_privilege then null;end;
end$$;
update atlas_sprint_fixture set draft=public.atlas_save_draft(null,a,doc,null,null);
select set_config('request.jwt.claim.sub',(select a::text from atlas_sprint_fixture),true);
do $$begin
 if exists(select 1 from public.atlas_plan_drafts) then raise exception 'FAIL athlete sees draft'; end if;
 if exists(select 1 from public.atlas_plans where user_id=(select a from atlas_sprint_fixture)) then raise exception 'FAIL draft visible as plan'; end if;
 begin
  insert into public.atlas_coaches(user_id) select a from atlas_sprint_fixture;raise exception 'FAIL self promotion';
 exception when others then if SQLERRM not like '%Somente o dono%' then raise;end if;end;
end$$;
select set_config('request.jwt.claim.sub',(select c2::text from atlas_sprint_fixture),true);
do $$begin
 if exists(select 1 from public.atlas_plan_drafts) then raise exception 'FAIL other coach sees draft'; end if;
 begin
  perform public.atlas_publish_draft((select (draft->>'id')::uuid from atlas_sprint_fixture),1);raise exception 'FAIL other coach publishes';
 exception when others then if SQLERRM not like '%Rascunho não autorizado%' then raise;end if;end;
end$$;
select set_config('request.jwt.claim.sub',(select c1::text from atlas_sprint_fixture),true);
update atlas_sprint_fixture set draft=public.atlas_save_draft((draft->>'id')::uuid,a,jsonb_set(doc,'{name}','"Fixture editada"'::jsonb),1,null);
do $$begin
 begin
  perform public.atlas_publish_draft((select (draft->>'id')::uuid from atlas_sprint_fixture),1);raise exception 'FAIL stale revision';
 exception when others then if SQLERRM not like '%Conflito de edição%' then raise;end if;end;
 begin
  perform public.atlas_publish_draft((select (draft->>'id')::uuid from atlas_sprint_fixture),null);raise exception 'FAIL null revision';
 exception when others then if SQLERRM not like '%Conflito de edição%' then raise;end if;end;
end$$;
update atlas_sprint_fixture set plan=public.atlas_publish_draft((draft->>'id')::uuid,2);
select set_config('request.jwt.claim.sub',(select a::text from atlas_sprint_fixture),true);
insert into public.atlas_activity_records(user_id,plan_id,session_id,status) select a,plan,'s1','não feito' from atlas_sprint_fixture;
select set_config('request.jwt.claim.sub',(select c1::text from atlas_sprint_fixture),true);
do $$begin
 if exists(select 1 from public.atlas_activity_records) then raise exception 'FAIL coach reads athlete activity';end if;
end$$;
update atlas_sprint_fixture set draft=public.atlas_save_draft(null,a,doc,null,plan);
update atlas_sprint_fixture set revised=public.atlas_publish_draft((draft->>'id')::uuid,1);
do $$begin
 if not exists(select 1 from public.atlas_plans p,atlas_sprint_fixture f where p.id=f.plan and p.state='archived') then raise exception 'FAIL prior version not archived';end if;
 if not exists(select 1 from public.atlas_plans p,atlas_sprint_fixture f where p.id=f.revised and p.version=2 and p.previous_plan_id=f.plan) then raise exception 'FAIL revision lineage';end if;
end$$;
select set_config('request.jwt.claim.sub',(select a::text from atlas_sprint_fixture),true);
do $$begin
 if not exists(select 1 from public.atlas_activity_records r,atlas_sprint_fixture f where r.plan_id=f.plan and r.session_id='s1') then raise exception 'FAIL prior activity lost';end if;
 begin
  insert into public.atlas_activity_records(user_id,plan_id,session_id,status) select a,plan,'s2','não feito' from atlas_sprint_fixture;raise exception 'FAIL insert into archive';
 exception when insufficient_privilege then null;end;
end$$;
update public.atlas_activity_records set notes='Fixture corrigida' where plan_id=(select plan from atlas_sprint_fixture);
select set_config('request.jwt.claim.sub',(select owner_id::text from atlas_sprint_fixture),true);
update public.atlas_coach_athletes set active=false where coach_id=(select c1 from atlas_sprint_fixture);
select set_config('request.jwt.claim.sub',(select c1::text from atlas_sprint_fixture),true);
do $$begin
 if exists(select 1 from public.atlas_plans) then raise exception 'FAIL revoked link reads plans';end if;
 if exists(select 1 from public.atlas_plan_drafts) then raise exception 'FAIL revoked link reads drafts';end if;
 begin
  perform public.atlas_save_draft(null,(select a from atlas_sprint_fixture),(select doc from atlas_sprint_fixture),null,null);raise exception 'FAIL revoked link saves';
 exception when others then if SQLERRM not like '%Atleta não autorizado%' then raise;end if;end;
end$$;
reset role;
select 'passed' as management_database_suite,'owner / athlete / two coaches; scoped access, draft visibility, self-promotion, conflict, immutable snapshots, revisions, records and revoked link' as checks;
rollback;
