import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';

test('pilot permission probe runs against current migrations and rolls back all fixture changes',async()=>{
 const db=new PGlite(),[A,B,C,D,O]=[1,2,3,4,5].map(i=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`);
 const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false,deleted_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
  for(const file of ['schema-v2.sql','schema-v3.sql','schema-v4.sql','supabase/migrations/20261013205525_atlas_run_ux01_accounts_and_areas.sql','supabase/migrations/20261014122932_atlas_run_ux02_initial_account_area.sql'])await db.exec(read(file));
  for(const [i,id] of [A,B,C,D,O].entries())await db.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)",[id,`pilot${i}@example.invalid`,JSON.stringify({full_name:'Piloto '+i})]);
  await db.query('insert into public.atlas_admins values($1)',[O]);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[O]);await db.query('insert into public.atlas_coaches(user_id) values($1),($2)',[C,D]);
  await db.query("insert into public.atlas_plans(user_id,name,guide) values($1,'Original','[{\"tema\":\"Original\",\"orientacao\":\"Preservar\"}]')",[A]);
  const before=(await db.query('select count(*)::int n from public.atlas_plans')).rows[0].n;
  const results=await db.exec(read('tests/pilot-remote.sql'));const report=results.find(result=>result.rows?.[0]?.pilot_verification)?.rows[0].pilot_verification;
  assert.equal(Object.keys(report.checks).length,7);assert.ok(Object.values(report.checks).every(value=>value===true));assert.equal((await db.query('select count(*)::int n from public.atlas_plans')).rows[0].n,before);
  assert.equal((await db.query('select count(*)::int n from public.atlas_coach_athletes')).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from public.atlas_activity_records')).rows[0].n,0);
 }finally{await db.close();}
});
