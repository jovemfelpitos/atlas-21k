-- Run against the existing operation. Every draft, plan, event and record rolls back.
begin;
do $$
declare owner_id uuid; athlete_id uuid; d jsonb; p uuid; revised uuid; affected integer;
 document jsonb='{"name":"VALIDAÇÃO TRANSIENTE UX-11","guide":[{"tema":"Teste","orientacao":"Dados fictícios; transação revertida."}],"sessions":[{"id":"run","date":"2026-10-19","type":"Corrida fictícia","description":"Teste","km":5,"minutes":30},{"id":"force","date":"2026-10-19","type":"Musculação fictícia","description":"Teste","minutes":40,"strength":[{"id":"ex-1","name":"Exercício fictício","sets":2,"reps":null,"load_kg":null,"notes":""}]}]}'::jsonb;
 actual jsonb='[{"exercise_id":"ex-1","sets":[{"reps":0,"load_kg":0},{"reps":8,"load_kg":12.125},{"reps":null,"load_kg":null}]}]'::jsonb;
begin
 select user_id into owner_id from public.atlas_admins limit 1;
 select user_id into athlete_id from public.atlas_plans where user_id<>owner_id limit 1;
 if owner_id is null or athlete_id is null then raise exception 'Existing owner/athlete required'; end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 execute 'set local role authenticated';
 d=public.atlas_save_draft(null,athlete_id,document,null,null);
 p=public.atlas_publish_draft((d->>'id')::uuid,(d->>'revision')::integer);
 if not exists(select 1 from public.atlas_sessions s where s.plan_id=p and s.id='force' and s.strength=document->'sessions'->1->'strength') then raise exception 'FAIL publication';end if;
 perform set_config('request.jwt.claim.sub',athlete_id::text,true);
 begin
  insert into public.atlas_activity_records(user_id,plan_id,session_id,status,strength) values(athlete_id,p,'force','adaptado','[{"exercise_id":"wrong","sets":[{"reps":1}]}]');
  raise exception 'FAIL wrong exercise accepted';
 exception when others then if SQLERRM not like '%não pertence%' then raise;end if;end;
 begin
  insert into public.atlas_activity_records(user_id,plan_id,session_id,status,strength) values(athlete_id,p,'force','feito','[{"exercise_id":"ex-1","sets":[{"load_kg":0.0001}]}]');
  raise exception 'FAIL excessive precision accepted';
 exception when others then if SQLERRM not like '%inválidos%' then raise;end if;end;
 insert into public.atlas_activity_records(user_id,plan_id,session_id,status,strength) values(athlete_id,p,'force','adaptado',actual);
 if not exists(select 1 from public.atlas_activity_records r where r.plan_id=p and r.strength=actual) then raise exception 'FAIL actual values';end if;
 begin
  update public.atlas_activity_records set km=1 where plan_id=p;
  raise exception 'FAIL force distance accepted';
 exception when others then if SQLERRM not like '%corrida%' then raise;end if;end;
 begin
  insert into public.atlas_activity_records(user_id,plan_id,session_id,status,strength) values(athlete_id,p,'run','feito',actual);
  raise exception 'FAIL cross-session exercise accepted';
 exception when others then if SQLERRM not like '%não pertence%' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 update public.atlas_activity_records set strength='[]' where plan_id=p;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'FAIL owner edited actual';end if;
 begin
  perform public.atlas_save_draft(null,athlete_id,jsonb_set(document,'{sessions,1}',(document->'sessions'->1)-'strength'),null,p);
  raise exception 'FAIL old client dropped prescription';
 exception when others then if SQLERRM not like '%não pode ser omitida%' then raise;end if;end;
 d=public.atlas_save_draft(null,athlete_id,document,null,p);
 revised=public.atlas_publish_draft((d->>'id')::uuid,(d->>'revision')::integer);
 if not exists(select 1 from public.atlas_plans where id=revised and version=2 and previous_plan_id=p) then raise exception 'FAIL lineage';end if;
 if not exists(select 1 from public.atlas_plans where id=p and state='archived') then raise exception 'FAIL prior snapshot';end if;
 if not exists(select 1 from public.atlas_activity_records r where r.plan_id=p and r.strength=actual) then raise exception 'FAIL history';end if;
 execute 'reset role';
end $$;
rollback;
select 'UX-11 remote assertions passed; all writes rolled back' as verification;
