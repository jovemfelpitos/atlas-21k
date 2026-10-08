import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {parsePlan} from '../importer.js';
test('PostgreSQL: RLS, account separation, session ownership and atomic imports',async()=>{
 const db=new PGlite();
 const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',ADMIN='00000000-0000-4000-8000-000000000003';
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
 await db.exec(readFileSync(new URL('../schema-v2.sql',import.meta.url),'utf8'));
 for(const id of [A,B,ADMIN])await db.query('insert into auth.users values ($1)',[id]);
 async function actor(id,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role);}
 for(const id of [A,B,ADMIN]){await actor(id);await db.query('insert into public.atlas_profiles(user_id,name) values ($1,$2)',[id,id===ADMIN?'Admin':'Atleta']);}
 await actor(A);assert.equal((await db.query('select * from public.atlas_profiles')).rows.length,1);
 await assert.rejects(db.query('insert into public.atlas_admins values ($1)',[A]),/permission denied/);
 await assert.rejects(db.query('update public.atlas_profiles set is_admin=true where user_id=$1',[A]),/permission denied/);
 await db.exec('reset role');await db.query('insert into public.atlas_admins values ($1)',[ADMIN]);
 await actor(ADMIN);assert.equal((await db.query('select * from public.atlas_profiles where is_admin')).rows.length,1);
 const doc=parsePlan(readFileSync(new URL('../modelo-plano.csv',import.meta.url),'utf8'));
 const importPlan=async(id,p=doc)=>(await db.query('select public.atlas_import_plan($1,$2::jsonb) as id',[id,JSON.stringify(p)])).rows[0].id;
 const planA=await importPlan(A),planB=await importPlan(B);
 await assert.rejects(importPlan(ADMIN),/atleta válido/);
 const before=(await db.query('select count(*)::int as n from public.atlas_plans')).rows[0].n;
 await assert.rejects(importPlan(A,{...doc,sessions:[doc.sessions[0],doc.sessions[0]]}),/duplicate key/);
 assert.equal((await db.query('select count(*)::int as n from public.atlas_plans')).rows[0].n,before);
 await actor(A);assert.deepEqual((await db.query('select id from public.atlas_plans')).rows.map(r=>r.id),[planA]);
 await assert.rejects(importPlan(A),/administradores/);
 await db.query("insert into public.atlas_activity_records(user_id,plan_id,session_id,status,km) values($1,$2,'sessao-001','feito',3),($1,$2,'sessao-002','adaptado',0)",[A,planA]);
 assert.equal((await db.query('select * from public.atlas_activity_records')).rows.length,2);
 await assert.rejects(db.query("insert into public.atlas_activity_records(user_id,plan_id,session_id,status) values($1,$2,'sessao-001','feito')",[B,planB]),/row-level security/);
 await assert.rejects(db.query("insert into public.atlas_activity_records(user_id,plan_id,session_id,status) values($1,$2,'inexistente','feito')",[A,planA]),/foreign key/);
 await assert.rejects(db.query('update public.atlas_activity_records set plan_id=$1 where session_id=$2',[planB,'sessao-001']),/foreign key/);
 await db.query("update public.atlas_activity_records set recovery='Normal' where session_id='sessao-001'");
 await actor(B);assert.equal((await db.query('select * from public.atlas_activity_records')).rows.length,0);
 assert.equal((await db.query("update public.atlas_activity_records set km=99 where user_id=$1 returning *",[A])).rows.length,0);
 await actor(ADMIN);assert.equal((await db.query('select * from public.atlas_activity_records')).rows.length,0);
 await assert.rejects(db.query("insert into public.atlas_activity_records(user_id,plan_id,session_id,status) values($1,$2,'sessao-001','feito')",[ADMIN,planA]),/row-level security/);
 await actor(null,'anon');await assert.rejects(db.query('select * from public.atlas_plans'),/permission denied/);
 await assert.rejects(importPlan(A),/permission denied/);
 }finally{await db.close();}
});
