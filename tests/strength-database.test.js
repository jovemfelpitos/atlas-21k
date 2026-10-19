import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {parsePlan} from '../importer.js';

const migration='supabase/migrations/20261019135644_atlas_run_hybrid_strength.sql';
test('hybrid PostgreSQL upgrade preserves legacy rows, enforces exercise identity, RLS and immutable revisions',async()=>{
 const db=new PGlite(),[A,B,O,C]=[1,2,3,4].map(i=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`);
 const sql=async(q,args=[])=> (await db.query(q,args)).rows;
 const actor=async(id,role='authenticated')=>{await db.exec('reset role');await sql("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role);};
 const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const save=async(doc,base=null)=> (await sql('select public.atlas_save_draft(null,$1,$2::jsonb,null,$3) d',[A,JSON.stringify(doc),base]))[0].d;
 const publish=async d=>(await sql('select public.atlas_publish_draft($1,$2) id',[d.id,d.revision]))[0].id;
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false,deleted_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
  for(const file of ['schema-v2.sql','schema-v3.sql','schema-v4.sql','supabase/migrations/20261013205525_atlas_run_ux01_accounts_and_areas.sql'])await db.exec(read(file));
  for(const id of [A,B,O,C])await sql('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,id+'@example.invalid']);
  await sql('insert into public.atlas_admins values($1)',[O]);await actor(O);await sql('insert into public.atlas_coaches(user_id) values($1)',[C]);await sql('insert into public.atlas_coach_athletes(coach_id,athlete_id) values($1,$2)',[C,A]);
  const legacy=parsePlan(read('modelo-plano.csv')),old=await publish(await save(legacy));
  await actor(A);await sql("insert into public.atlas_activity_records(user_id,plan_id,session_id,status,km) values($1,$2,'sessao-001','feito',0)",[A,old]);
  const beforeSessions=await sql('select * from public.atlas_sessions order by id'),beforeRecords=await sql('select * from public.atlas_activity_records');
  await db.exec('reset role');await db.exec(read(migration));await actor(A);
  const afterSessions=await sql('select * from public.atlas_sessions order by id'),afterRecords=await sql('select * from public.atlas_activity_records');
  assert.deepEqual(afterSessions.map(({strength,...s})=>{assert.deepEqual(strength,[]);return s;}),beforeSessions);
  assert.deepEqual(afterRecords.map(({strength,...r})=>{assert.deepEqual(strength,[]);return r;}),beforeRecords);
  const hybrid=parsePlan(read('modelo-plano-hibrido.csv'));await actor(C);
  const d=await save(hybrid),plan=await publish(d);assert.equal((await sql('select strength from public.atlas_sessions where plan_id=$1 and id=$2',[plan,'forca-001']))[0].strength[0].name,hybrid.sessions[1].strength[0].name);
  await assert.rejects(sql("update public.atlas_sessions set strength='[]'"),/permission denied/);
  await actor(A);
  const actual=[{exercise_id:'ex-1',sets:[{reps:0,load_kg:0},{reps:8,load_kg:null},{reps:null,load_kg:12.5}]}];
  const insert=payload=>sql("insert into public.atlas_activity_records(user_id,plan_id,session_id,status,strength) values($1,$2,'forca-001','adaptado',$3::jsonb)",[A,plan,JSON.stringify(payload)]);
  await assert.rejects(insert([{exercise_id:'other',sets:[{reps:1,load_kg:1}]}]),/não pertence/);
  await assert.rejects(insert([{exercise_id:'ex-1',sets:[{reps:1.5,load_kg:1}]}]),/inválidos/);
  await assert.rejects(insert([{exercise_id:'ex-1',sets:[{reps:1,load_kg:-1}]}]),/inválidos/);
  await assert.rejects(insert([{exercise_id:'ex-1',sets:[{reps:1,load_kg:0.0001}]}]),/inválidos/);
  await insert(actual);const saved=(await sql('select * from public.atlas_activity_records where plan_id=$1',[plan]))[0];assert.deepEqual(saved.strength,actual);
  await assert.rejects(sql('update public.atlas_activity_records set km=5 where plan_id=$1',[plan]),/corrida/);
  await actor(B);assert.equal((await sql('select * from public.atlas_activity_records where plan_id=$1',[plan])).length,0);
  await assert.rejects(sql("insert into public.atlas_activity_records(user_id,plan_id,session_id,status) values($1,$2,'forca-001','feito')",[A,plan]),/row-level security|não disponível/);
  await actor(C);assert.deepEqual((await sql('select strength from public.atlas_activity_records where plan_id=$1',[plan]))[0].strength,actual);assert.equal((await sql("update public.atlas_activity_records set strength='[]' where plan_id=$1 returning *",[plan])).length,0);
  const omitted=structuredClone(hybrid);delete omitted.sessions[1].strength;await assert.rejects(save(omitted,plan),/não pode ser omitida/);const explicit=structuredClone(hybrid);explicit.sessions[1].strength=[];await save(explicit,plan);
  const revised=structuredClone(hybrid);revised.sessions[1].strength[0].name='Nome revisado';const newer=await publish(await save(revised,plan));
  await actor(A);assert.deepEqual((await sql('select strength from public.atlas_activity_records where plan_id=$1',[plan]))[0].strength,actual);assert.equal((await sql('select version from public.atlas_plans where id=$1',[newer]))[0].version,2);
  await assert.rejects(sql("insert into public.atlas_activity_records(user_id,plan_id,session_id,status,strength) values($1,$2,'sessao-002','feito',$3::jsonb)",[A,old,JSON.stringify(actual)]),/não pertence/);
  await actor(O);await sql('update public.atlas_coach_athletes set active=false where coach_id=$1',[C]);await actor(C);assert.equal((await sql('select * from public.atlas_activity_records where plan_id=$1',[plan])).length,0);await assert.rejects(save(hybrid),/não autorizado/);
  await actor(null,'anon');await assert.rejects(sql('select * from public.atlas_activity_records'),/permission denied/);await assert.rejects(sql("select atlas_private.valid_strength('[]'::jsonb,true)"),/permission denied/);
 }finally{await db.close();}
});
