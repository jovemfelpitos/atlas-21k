import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {parsePlan} from '../importer.js';

test('Sprint 4 PostgreSQL: scoped read-only activities, immutable comments, retries, revocation and historical preservation',async()=>{
 const db=new PGlite(),ids=Array.from({length:5},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`),[A,B,OWNER,C,D]=ids;
 const doc=parsePlan(readFileSync(new URL('../modelo-plano.csv',import.meta.url),'utf8'));
 const actor=async(id,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role);};
 const add=(id,athlete,plan,text='Comentário da equipe',session='sessao-001')=>db.query('select to_jsonb(public.atlas_add_session_comment($1,$2,$3,$4,$5)) as c',[id,athlete,plan,session,text]);
 const count=async(table)=>(await db.query('select count(*)::int as n from public.'+table)).rows[0].n;
 const cid='00000000-0000-4000-9000-000000000001',cid2='00000000-0000-4000-9000-000000000002';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
  await db.exec(readFileSync(new URL('../schema-v2.sql',import.meta.url),'utf8'));
  for(const id of ids){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into public.atlas_profiles(user_id,name) values($1,$2)',[id,id===C?'Treinadora C':'Pessoa '+id.slice(-1)]);}
  await db.query('insert into public.atlas_admins values($1)',[OWNER]);await actor(OWNER);
  const planA=(await db.query('select public.atlas_import_plan($1,$2::jsonb) as id',[A,JSON.stringify(doc)])).rows[0].id;
  const planB=(await db.query('select public.atlas_import_plan($1,$2::jsonb) as id',[B,JSON.stringify(doc)])).rows[0].id;
  await actor(A);await db.query("insert into public.atlas_activity_records(user_id,plan_id,session_id,status,km,notes) values($1,$2,'sessao-001','feito',3,'Relato original')",[A,planA]);
  await actor(B);await db.query("insert into public.atlas_activity_records(user_id,plan_id,session_id,status,km) values($1,$2,'sessao-001','adaptado',2)",[B,planB]);
  await db.exec('reset role');await db.exec(readFileSync(new URL('../schema-v3.sql',import.meta.url),'utf8'));await actor(OWNER);
  await db.query('insert into public.atlas_coaches(user_id) values($1),($2)',[C,D]);await db.query('insert into public.atlas_coach_athletes(coach_id,athlete_id) values($1,$2),($3,$4)',[C,A,D,B]);
  await db.exec('reset role');await db.exec(readFileSync(new URL('../schema-v4.sql',import.meta.url),'utf8'));
  await actor(C);assert.equal(await count('atlas_activity_records'),1);assert.equal((await db.query('select notes from public.atlas_activity_records')).rows[0].notes,'Relato original');
  assert.equal((await db.query("update public.atlas_activity_records set notes='Alterado' returning *")).rows.length,0);
  await assert.rejects(db.query("insert into public.atlas_activity_records(user_id,plan_id,session_id,status) values($1,$2,'sessao-002','feito')",[A,planA]),/row-level security/);
  await assert.rejects(db.query("insert into public.atlas_activity_records(user_id,plan_id,session_id,status) values($1,$2,'sessao-001','feito') on conflict(user_id,plan_id,session_id) do update set status=excluded.status",[A,planA]),/row-level security/);
  const row=(await add(cid,A,planA,'  Comentário da equipe  ')).rows[0].c;assert.equal(row.author_id,C);assert.equal(row.author_name,'Treinadora C');assert.equal(row.author_role,'coach');assert.equal(row.body,'Comentário da equipe');
  assert.equal((await add(cid,A,planA)).rows[0].c.id,cid);assert.equal(await count('atlas_session_comments'),1);
  await assert.rejects(add(cid,A,planA,'Texto diferente'),/já utilizado/);
  await assert.rejects(add(cid2,B,planB),/não autorizado/);
  await assert.rejects(add(cid2,A,planB),/foreign key/);
  await assert.rejects(add(cid2,A,planA,'   '),/3000/);await assert.rejects(add(cid2,A,planA,'x'.repeat(3001)),/3000/);
  await assert.rejects(db.query("insert into public.atlas_session_comments(user_id,plan_id,session_id,body,author_id) values($1,$2,'sessao-001','Forjado',$3)",[A,planA,OWNER]),/permission denied/);
  await assert.rejects(db.query("update public.atlas_session_comments set body='Alterado'"),/permission denied/);await assert.rejects(db.query('delete from public.atlas_session_comments'),/permission denied/);
  await actor(D);assert.equal(await count('atlas_session_comments'),0);assert.equal(await count('atlas_activity_records'),1);await assert.rejects(add(cid2,A,planA),/não autorizado/);
  await actor(B);assert.equal(await count('atlas_session_comments'),0);assert.equal(await count('atlas_activity_records'),1);
  await actor(A);assert.equal(await count('atlas_session_comments'),1);await assert.rejects(add(cid2,A,planA),/não autorizado/);
  await assert.rejects(db.query("insert into public.atlas_session_comments(user_id,plan_id,session_id,body) values($1,$2,'sessao-001','Atleta')",[A,planA]),/não autorizado/);
  await db.query("update public.atlas_activity_records set notes='Correção do atleta' where plan_id=$1",[planA]);
  await actor(OWNER);assert.equal(await count('atlas_activity_records'),2);assert.equal((await db.query('update public.atlas_activity_records set km=99 returning *')).rows.length,0);
  await db.query('select public.atlas_archive_plan($1)',[planA]);assert.equal((await add(cid2,A,planA,'Comentário no histórico')).rows[0].c.author_role,'admin');
  await db.query('update public.atlas_coach_athletes set active=false where coach_id=$1',[C]);await actor(C);assert.equal(await count('atlas_activity_records'),0);assert.equal(await count('atlas_session_comments'),0);await assert.rejects(add(cid,A,planA),/não autorizado/);
  await actor(OWNER);await db.query('update public.atlas_coach_athletes set active=true where coach_id=$1',[C]);await db.query('update public.atlas_coaches set active=false where user_id=$1',[C]);await actor(C);assert.equal(await count('atlas_session_comments'),0);assert.equal(await count('atlas_activity_records'),0);
  await actor(A);assert.equal(await count('atlas_session_comments'),2);assert.equal((await db.query('select notes from public.atlas_activity_records')).rows[0].notes,'Correção do atleta');
  await db.query('update public.atlas_activity_records set km=3.5 where plan_id=$1',[planA]);assert.equal(await count('atlas_activity_records'),1);
  await actor(null);assert.equal(await count('atlas_session_comments'),0);assert.equal(await count('atlas_activity_records'),0);await assert.rejects(add(cid,A,planA),/não autorizado/);
  await actor(null,'anon');await assert.rejects(db.query('select * from public.atlas_session_comments'),/permission denied/);await assert.rejects(add(cid,A,planA),/permission denied/);
 }finally{await db.close();}
});
