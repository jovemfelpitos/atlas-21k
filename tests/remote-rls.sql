-- Disposable fixtures: all user/data writes are rolled back, including on a failed check.
begin;
create temporary table atlas_test_context(a uuid,b uuid,admin uuid,plan_a uuid,plan_b uuid);
insert into atlas_test_context(a,b,admin) values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid());
grant select,update on atlas_test_context to authenticated;
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data)
select a,'authenticated','authenticated','atlas-test-a@example.invalid','{}'::jsonb,'{}'::jsonb from atlas_test_context union all
select b,'authenticated','authenticated','atlas-test-b@example.invalid','{}'::jsonb,'{}'::jsonb from atlas_test_context union all
select admin,'authenticated','authenticated','atlas-test-admin@example.invalid','{}'::jsonb,'{}'::jsonb from atlas_test_context;
insert into public.atlas_profiles(user_id,name) select a,'Test A' from atlas_test_context union all select b,'Test B' from atlas_test_context union all select admin,'Test Admin' from atlas_test_context;
insert into public.atlas_admins select admin from atlas_test_context;
select set_config('request.jwt.claim.sub',(select admin::text from atlas_test_context),true);
set local role authenticated;
update atlas_test_context set plan_a=public.atlas_import_plan(a,'{"name":"RLS test A","guide":[{"tema":"Test","orientacao":"Disposable fixture"}],"sessions":[{"id":"s1","date":"2026-10-08","type":"Test","description":"Test"},{"id":"s2","date":"2026-10-08","type":"Test","description":"Test"}]}'::jsonb);
update atlas_test_context set plan_b=public.atlas_import_plan(b,'{"name":"RLS test B","guide":[{"tema":"Test","orientacao":"Disposable fixture"}],"sessions":[{"id":"s1","date":"2026-10-08","type":"Test","description":"Test"}]}'::jsonb);
select set_config('request.jwt.claim.sub',(select a::text from atlas_test_context),true);
do $$declare denied boolean=false;begin
 if (select count(*) from public.atlas_plans)<>1 then raise exception 'RLS: athlete saw foreign plans';end if;
 if (select count(*) from public.atlas_sessions)<>2 then raise exception 'RLS: sessions not isolated';end if;
 begin insert into public.atlas_admins select a from atlas_test_context;exception when insufficient_privilege then denied=true;end;
 if not denied then raise exception 'RLS: athlete self-promoted';end if;
 denied=false;
 begin perform public.atlas_import_plan((select a from atlas_test_context),'{}'::jsonb);exception when raise_exception then denied=true;end;
 if not denied then raise exception 'RLS: athlete imported a plan';end if;
end $$;
insert into public.atlas_activity_records(user_id,plan_id,session_id,status,km)
select a,plan_a,'s1','feito',3 from atlas_test_context union all select a,plan_a,'s2','adaptado',0 from atlas_test_context;
do $$declare denied boolean=false;begin
 begin insert into public.atlas_activity_records(user_id,plan_id,session_id,status) select b,plan_b,'s1','feito' from atlas_test_context;exception when insufficient_privilege then denied=true;end;
 if not denied then raise exception 'RLS: foreign record insert allowed';end if;
end $$;
select set_config('request.jwt.claim.sub',(select b::text from atlas_test_context),true);
do $$declare changed integer;begin
 if (select count(*) from public.atlas_activity_records)<>0 then raise exception 'RLS: B read A records';end if;
 update public.atlas_activity_records set km=99;get diagnostics changed=row_count;
 if changed<>0 then raise exception 'RLS: B changed A records';end if;
end $$;
select set_config('request.jwt.claim.sub',(select admin::text from atlas_test_context),true);
do $$begin
 if (select count(*) from public.atlas_activity_records)<>0 then raise exception 'RLS: admin read athlete records';end if;
end $$;
reset role;
rollback;
select 'PASS: live RLS, admin isolation, two sessions per day, no fixtures persisted' as validation;
