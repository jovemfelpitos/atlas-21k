-- Permission probe under existing account IDs, not a browser-login test.
-- All fixture plans, links, records, comments and drafts are rolled back.
begin;
create temporary table atlas_pilot_context(owner_id uuid,a uuid,b uuid,coach uuid,other_coach uuid,pa uuid,pb uuid,pc uuid);
create temporary table atlas_pilot_results(name text,result jsonb);
grant select,insert on atlas_pilot_results to authenticated;
do $setup$
declare o uuid;a uuid;b uuid;c uuid;d uuid;
begin
 select user_id into o from public.atlas_admins order by user_id limit 1;
 select user_id into a from public.atlas_plans where user_id<>o order by created_at,id limit 1;
 select user_id into c from public.atlas_coaches where active and user_id not in(o,a) order by user_id limit 1;
 select user_id into d from public.atlas_coaches where active and user_id<>c and user_id<>o order by user_id limit 1;
 select p.user_id into b from public.atlas_profiles p join auth.users u on u.id=p.user_id
 where p.user_id not in(o,a,c) and u.email_confirmed_at is not null
 order by (p.user_id=d) desc,p.user_id limit 1;
 if o is null or a is null or b is null or c is null or d is null then raise exception 'Pilot probe needs an owner, two athletes and two active coaches';end if;
 insert into atlas_pilot_context values(o,a,b,c,d,gen_random_uuid(),gen_random_uuid(),gen_random_uuid());
end $setup$;
do $probe$
declare t record;denied boolean;draft jsonb;published uuid;comment_id uuid=gen_random_uuid();changed integer;doc jsonb;
begin
 select * into t from atlas_pilot_context;
 perform set_config('request.jwt.claim.sub',t.owner_id::text,true);
 -- These link changes are visible only in this transaction and never committed.
 insert into public.atlas_coach_athletes(coach_id,athlete_id,active) values(t.coach,t.a,true),(t.coach,t.b,true)
 on conflict(coach_id,athlete_id) do update set active=true;
 update public.atlas_coach_athletes set active=false where coach_id=t.other_coach and athlete_id in(t.a,t.b);
 insert into public.atlas_plans(id,user_id,name,guide,published_by) values
 (t.pa,t.a,'UX06_TRANSIENT_A','[{"tema":"Piloto","orientacao":"Fixture revertida"}]',t.owner_id),
 (t.pb,t.b,'UX06_TRANSIENT_B','[{"tema":"Piloto","orientacao":"Fixture revertida"}]',t.owner_id),
 (t.pc,t.coach,'UX06_TRANSIENT_PERSONAL','[{"tema":"Piloto","orientacao":"Fixture revertida"}]',t.owner_id);
 insert into public.atlas_sessions(user_id,plan_id,id,date,type,description) values
 (t.a,t.pa,'pilot-run',current_date,'Piloto corrida','Fixture revertida'),(t.a,t.pa,'pilot-strength',current_date,'Piloto força','Fixture revertida'),
 (t.b,t.pb,'pilot-run',current_date,'Piloto corrida','Fixture revertida'),(t.coach,t.pc,'pilot-run',current_date,'Piloto pessoal','Fixture revertida');
 perform set_config('request.jwt.claim.sub',t.a::text,true);execute 'set local role authenticated';
 if(select count(*) from public.atlas_plans where id in(t.pa,t.pb,t.pc))<>1 then raise exception 'Athlete A saw a foreign fixture';end if;
 if(select count(*) from public.atlas_sessions where plan_id=t.pa)<>2 then raise exception 'Two sessions on one day were lost';end if;
 insert into public.atlas_activity_records(user_id,plan_id,session_id,status,minutes,pain) values(t.a,t.pa,'pilot-run','feito',0,0);
 if not exists(select 1 from public.atlas_activity_records where plan_id=t.pa and km is null and effort is null and pain=0 and minutes=0) then raise exception 'Blank/zero values changed';end if;
 denied=false;begin insert into public.atlas_admins values(t.a);exception when insufficient_privilege then denied=true;end;
 if not denied then raise exception 'Athlete self-promoted';end if;
 insert into atlas_pilot_results values('athlete_ownership_and_zero','true');
 perform set_config('request.jwt.claim.sub',t.b::text,true);
 if exists(select 1 from public.atlas_plans where id=t.pa) then raise exception 'Athlete B saw athlete A';end if;
 insert into public.atlas_activity_records(user_id,plan_id,session_id,status) values(t.b,t.pb,'pilot-run','não feito');
 update public.atlas_activity_records set notes='Forbidden' where plan_id=t.pa;get diagnostics changed=row_count;
 if changed<>0 then raise exception 'Athlete B changed athlete A';end if;
 insert into atlas_pilot_results values('independent_athlete','true');
 perform set_config('request.jwt.claim.sub',t.other_coach::text,true);
 if exists(select 1 from public.atlas_plans where id in(t.pa,t.pb,t.pc) and user_id<>t.other_coach) then raise exception 'Unlinked coach read a foreign fixture';end if;
 denied=false;begin perform public.atlas_add_session_comment(gen_random_uuid(),t.coach,t.pc,'pilot-run','Forbidden');exception when raise_exception then denied=true;end;
 if not denied then raise exception 'Unlinked coach commented';end if;
 insert into atlas_pilot_results values('unlinked_coach','true');
 perform set_config('request.jwt.claim.sub',t.coach::text,true);
 if(select count(*) from public.atlas_plans where id in(t.pa,t.pb,t.pc))<>3 then raise exception 'Linked/personal coach access missing';end if;
 insert into public.atlas_activity_records(user_id,plan_id,session_id,status) values(t.coach,t.pc,'pilot-run','adaptado');
 update public.atlas_activity_records set notes='Forbidden' where plan_id in(t.pa,t.pb);get diagnostics changed=row_count;
 if changed<>0 then raise exception 'Coach edited athlete reports';end if;
 perform public.atlas_add_session_comment(comment_id,t.a,t.pa,'pilot-run','UX06_TRANSIENT_COMMENT');
 if not exists(select 1 from public.atlas_session_comments where id=comment_id and author_id=t.coach and author_role='coach') then raise exception 'Comment authorship missing';end if;
 doc=jsonb_build_object('name','UX06_TRANSIENT_REVISION','guide',jsonb_build_array(jsonb_build_object('tema','Piloto','orientacao','Fixture revertida')),'sessions',jsonb_build_array(jsonb_build_object('id','pilot-run','date',current_date::text,'type','Piloto','description','Fixture revertida')));
 draft=public.atlas_save_draft(null,t.a,doc,null,t.pa);
 published=public.atlas_publish_draft((draft->>'id')::uuid,(draft->>'revision')::integer);
 if not exists(select 1 from public.atlas_plans where id=published and user_id=t.a and previous_plan_id=t.pa and version=2) then raise exception 'Wrong publication recipient or version';end if;
 if not exists(select 1 from public.atlas_plans where id=t.pa and state='archived') then raise exception 'Previous fixture version not archived';end if;
 if not exists(select 1 from public.atlas_activity_records where plan_id=t.pa and pain=0) or exists(select 1 from public.atlas_activity_records where plan_id=published) then raise exception 'Version records changed';end if;
 insert into atlas_pilot_results values('coach_personal_area_readonly_reports_comments_and_publication','true');
 execute 'reset role';perform set_config('request.jwt.claim.sub',t.owner_id::text,true);
 update public.atlas_coach_athletes set active=false where coach_id=t.coach and athlete_id=t.a;
 perform set_config('request.jwt.claim.sub',t.coach::text,true);execute 'set local role authenticated';
 if exists(select 1 from public.atlas_plans where id in(t.pa,published)) or exists(select 1 from public.atlas_session_comments where id=comment_id) then raise exception 'Revoked link retained foreign access';end if;
 if not exists(select 1 from public.atlas_plans where id=t.pc) then raise exception 'Revocation removed personal history';end if;
 denied=false;begin perform public.atlas_add_session_comment(gen_random_uuid(),t.a,t.pa,'pilot-run','Forbidden');exception when raise_exception then denied=true;end;
 if not denied then raise exception 'Revoked coach commented';end if;
 insert into atlas_pilot_results values('link_revocation_preserves_personal_history','true');
 execute 'reset role';perform set_config('request.jwt.claim.sub',t.owner_id::text,true);
 update public.atlas_coaches set active=false where user_id=t.coach;
 perform set_config('request.jwt.claim.sub',t.coach::text,true);execute 'set local role authenticated';
 if exists(select 1 from public.atlas_plans where id=t.pb) then raise exception 'Inactive coach retained linked access';end if;
 if not exists(select 1 from public.atlas_activity_records where plan_id=t.pc) then raise exception 'Deactivation removed personal activity';end if;
 insert into atlas_pilot_results values('coach_deactivation','true');
 perform set_config('request.jwt.claim.sub',t.owner_id::text,true);
 if(select count(*) from public.atlas_plans where id in(t.pa,t.pb,t.pc,published))<>4 then raise exception 'Owner overview incomplete';end if;
 update public.atlas_activity_records set notes='Forbidden' where plan_id in(t.pa,t.pb,t.pc);get diagnostics changed=row_count;
 if changed<>0 then raise exception 'Owner edited someone else activity';end if;
 insert into atlas_pilot_results values('owner_readonly_reports','true');
 execute 'reset role';
end $probe$;
select jsonb_build_object('checks',jsonb_object_agg(name,result),'test_type','Postgres role probe; browser login not tested','fixtures','transaction will roll back') as pilot_verification from atlas_pilot_results;
rollback;
