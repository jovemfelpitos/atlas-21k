-- UX-11: additive strength prescriptions/results. Existing snapshots are untouched.
create function atlas_private.valid_strength(value jsonb, actual boolean default false) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare e jsonb; s jsonb; key text; n numeric; ids text[]='{}';
begin
 if jsonb_typeof(value) is distinct from 'array' then return false; end if;
 if jsonb_array_length(value)>30 then return false; end if;
 for e in select * from jsonb_array_elements(value) loop
  if jsonb_typeof(e) is distinct from 'object' then return false; end if;
  key=case when actual then 'exercise_id' else 'id' end;
  if jsonb_typeof(e->key) is distinct from 'string' or coalesce(e->>key,'') !~ '^[A-Za-z0-9_-]{1,80}$' or (e->>key)=any(ids) then return false; end if;
  ids=array_append(ids,e->>key);
  if actual then
   if (e-array['exercise_id','sets'])<>'{}'::jsonb or jsonb_typeof(e->'sets') is distinct from 'array' then return false; end if;
   if jsonb_array_length(e->'sets') not between 1 and 20 then return false; end if;
   for s in select * from jsonb_array_elements(e->'sets') loop
    if jsonb_typeof(s) is distinct from 'object' or (s-array['reps','load_kg'])<>'{}'::jsonb then return false; end if;
    foreach key in array array['reps','load_kg'] loop
     if s->key is not null and s->key<>'null'::jsonb then
      if jsonb_typeof(s->key)<>'number' then return false; end if;
      n=(s->>key)::numeric;
      if n not between 0 and 1000 or (key='reps' and trunc(n)<>n) or (key='load_kg' and trunc(n,3)<>n) then return false; end if;
     end if;
    end loop;
   end loop;
  else
   if (e-array['id','name','sets','reps','load_kg','notes'])<>'{}'::jsonb or jsonb_typeof(e->'name') is distinct from 'string' or length(btrim(e->>'name')) not between 1 and 200 or jsonb_typeof(e->'sets') is distinct from 'number' then return false; end if;
   n=(e->>'sets')::numeric;if n not between 1 and 20 or trunc(n)<>n then return false; end if;
   if e->'notes' is not null and (jsonb_typeof(e->'notes') is distinct from 'string' or length(e->>'notes')>1000) then return false; end if;
   foreach key in array array['reps','load_kg'] loop
    if e->key is not null and e->key<>'null'::jsonb then
     if jsonb_typeof(e->key)<>'number' then return false; end if;
     n=(e->>key)::numeric;
     if n not between 0 and 1000 or (key='reps' and (n<1 or trunc(n)<>n)) or (key='load_kg' and trunc(n,3)<>n) then return false; end if;
    end if;
   end loop;
  end if;
 end loop;
 return true;
exception when others then return false;
end $$;
revoke all on function atlas_private.valid_strength(jsonb,boolean) from public,anon;
grant execute on function atlas_private.valid_strength(jsonb,boolean) to authenticated;
alter table public.atlas_sessions add column strength jsonb not null default '[]'::jsonb;
alter table public.atlas_sessions add constraint atlas_strength_prescription_valid check(atlas_private.valid_strength(strength,false));
alter table public.atlas_sessions add constraint atlas_strength_separate_from_run check(jsonb_array_length(strength)=0 or km is null or km=0);
alter table public.atlas_activity_records add column strength jsonb not null default '[]'::jsonb;
alter table public.atlas_activity_records add constraint atlas_strength_results_valid check(atlas_private.valid_strength(strength,true));

create or replace function atlas_private.validate_document(document jsonb) returns void
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
  if not atlas_private.valid_strength(coalesce(s->'strength','[]'::jsonb),false) then raise exception 'Musculação: exercícios, séries, repetições ou cargas inválidos'; end if;
  if jsonb_array_length(coalesce(s->'strength','[]'::jsonb))>0 and (s->>'km')::numeric>0 then raise exception 'Separe corrida e musculação em duas sessões'; end if;
  if length(coalesce(s->>'intensity',''))>500 or length(coalesce(s->>'gym',''))>3000 or length(coalesce(s->>'notes',''))>3000 then raise exception 'Orientação de sessão muito longa'; end if;
 end loop;
end $$;

create or replace function atlas_private.publish_draft(draft_id uuid,expected_revision integer) returns uuid
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
  insert into public.atlas_sessions(user_id,plan_id,id,date,type,km,minutes,intensity,description,gym,notes,strength)
  values(d.athlete_id,result,s->>'id',(s->>'date')::date,s->>'type',(s->>'km')::numeric,(s->>'minutes')::numeric,coalesce(s->>'intensity',''),s->>'description',coalesce(s->>'gym',''),coalesce(s->>'notes',''),coalesce(s->'strength','[]'::jsonb));
 end loop;
 if base.id is not null then
  update public.atlas_plans set state='archived' where id=base.id;
  insert into public.atlas_plan_events(plan_id,actor_id,event) values(base.id,auth.uid(),'replaced');
 end if;
 update public.atlas_plan_drafts set state='published',published_plan_id=result where id=d.id;
 insert into public.atlas_plan_events(plan_id,actor_id,event) values(result,auth.uid(),'published');
 return result;
end $$;

create function atlas_private.check_strength_record() returns trigger language plpgsql security invoker set search_path='' as $$
declare prescribed jsonb; e jsonb;
begin
 if not atlas_private.valid_strength(new.strength,true) then raise exception 'Resultados de musculação inválidos'; end if;
 select s.strength into prescribed from public.atlas_sessions s where s.user_id=new.user_id and s.plan_id=new.plan_id and s.id=new.session_id;
 if prescribed is null then raise exception 'Sessão não disponível'; end if;
 if jsonb_array_length(prescribed)>0 and new.km>0 then raise exception 'Registre a corrida em sua sessão separada da musculação'; end if;
 for e in select * from jsonb_array_elements(new.strength) loop
  if not exists(select 1 from jsonb_array_elements(prescribed) p where p->>'id'=e->>'exercise_id') then raise exception 'Exercício não pertence a esta sessão e versão'; end if;
 end loop;
 return new;
end $$;
revoke all on function atlas_private.check_strength_record() from public,anon;
create trigger check_strength_record before insert or update on public.atlas_activity_records for each row execute function atlas_private.check_strength_record();

-- An older client must not silently drop an existing structured block.
-- Explicit [] from a current editor is an intentional removal in a new revision.
create function atlas_private.check_strength_draft() returns trigger language plpgsql security invoker set search_path='' as $$
declare previous jsonb='{}'; e jsonb;
begin
 if tg_op='UPDATE' then
  if new.document is not distinct from old.document then return new; end if;
  previous=old.document;
 end if;
 for e in
  select value from jsonb_array_elements(coalesce(previous->'sessions','[]'::jsonb))
  union all
  select jsonb_build_object('id',s.id,'strength',s.strength) from public.atlas_sessions s where s.plan_id=new.base_plan_id and s.user_id=new.athlete_id
 loop
  if jsonb_array_length(coalesce(e->'strength','[]'::jsonb))>0 and exists(select 1 from jsonb_array_elements(new.document->'sessions') n where n->>'id'=e->>'id' and not n?'strength') then
   raise exception 'Atualize o aplicativo: a musculação estruturada não pode ser omitida ao editar esta sessão';
  end if;
 end loop;
 return new;
end $$;
revoke all on function atlas_private.check_strength_draft() from public,anon;
create trigger check_strength_draft before insert or update on public.atlas_plan_drafts for each row execute function atlas_private.check_strength_draft();

notify pgrst, 'reload schema';
