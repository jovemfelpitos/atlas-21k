import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';

test('private avatars and birth dates follow ownership, coach links, revocation and profile grants',async()=>{
 const db=new PGlite(),[A,B,C,O]=[1,2,3,4].map(i=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`);
 const photo=A+'/11111111-1111-4111-8111-111111111111.jpg',oldPhoto=A+'/22222222-2222-4222-8222-222222222222.jpg';
 const sql=async(query,args=[])=> (await db.query(query,args)).rows;
 const actor=async(id,role='authenticated')=>{await db.exec('reset role');await sql("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role);};
 const schema=async file=>db.exec(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false,deleted_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
   create schema storage;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner_id text,metadata jsonb);
   alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated;grant select,insert,update,delete on storage.objects to authenticated;grant select on storage.objects to anon;`);
  for(const file of ['schema-v2.sql','schema-v3.sql','schema-v4.sql','supabase/migrations/20261013205525_atlas_run_ux01_accounts_and_areas.sql','supabase/migrations/20261014122932_atlas_run_ux02_initial_account_area.sql','supabase/migrations/20261014175821_atlas_run_ux03_profile_and_private_avatars.sql'])await schema(file);
  for(const [i,id] of [A,B,C,O].entries())await sql("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)",[id,`person${i}@example.com`,JSON.stringify({full_name:'Pessoa '+i})]);
  await sql('insert into public.atlas_admins values($1)',[O]);await actor(O);await sql('insert into public.atlas_coaches(user_id) values($1)',[C]);await sql('insert into public.atlas_coach_athletes(coach_id,athlete_id) values($1,$2)',[C,A]);
  await actor(A);await sql("update public.atlas_profiles set birth_date='2000-02-29' where user_id=$1",[A]);await assert.rejects(()=>sql("update public.atlas_profiles set birth_date='2999-01-01' where user_id=$1",[A]),/check constraint/);await assert.rejects(()=>sql('update public.atlas_profiles set is_admin=true where user_id=$1',[A]),/permission denied/);
  await assert.rejects(()=>sql('update public.atlas_profiles set avatar_path=$1 where user_id=$2',[photo,A]),/Envie a foto/);
  await assert.rejects(()=>sql("insert into storage.objects(bucket_id,name,owner_id,metadata) values('atlas-avatars',$1,$2,'{\"mimetype\":\"image/jpeg\"}')",[B+'/11111111-1111-4111-8111-111111111111.jpg',A]),/row-level security/);
  for(const path of [photo,oldPhoto])await sql("insert into storage.objects(bucket_id,name,owner_id,metadata) values('atlas-avatars',$1,$2,'{\"mimetype\":\"image/jpeg\"}')",[path,A]);
  await sql('update public.atlas_profiles set avatar_path=$1 where user_id=$2',[photo,A]);assert.equal((await sql('select count(*)::int n from storage.objects'))[0].n,2);
  await actor(B);assert.equal((await sql('select count(*)::int n from storage.objects'))[0].n,0);assert.equal((await sql('select birth_date,avatar_path from public.atlas_profiles where user_id=$1',[A])).length,0);assert.equal((await sql('update public.atlas_profiles set birth_date=null where user_id=$1 returning user_id',[A])).length,0);
  await actor(null,'anon');assert.equal((await sql('select count(*)::int n from storage.objects'))[0].n,0);
  await actor(C);assert.equal((await sql('select name from storage.objects'))[0].name,photo);assert.equal((await sql('select count(*)::int n from storage.objects'))[0].n,1);assert.ok((await sql('select birth_date from public.atlas_profiles where user_id=$1',[A]))[0].birth_date);assert.equal((await sql('delete from storage.objects returning name')).length,0);
  await actor(O);assert.equal((await sql('select count(*)::int n from storage.objects'))[0].n,1);await sql('update public.atlas_coach_athletes set active=false where coach_id=$1',[C]);await actor(C);assert.equal((await sql('select count(*)::int n from storage.objects'))[0].n,0);assert.equal((await sql('select birth_date from public.atlas_profiles where user_id=$1',[A])).length,0);
  await actor(A);await sql('update public.atlas_profiles set avatar_path=null,birth_date=null where user_id=$1',[A]);assert.equal((await sql('select birth_date,avatar_path from public.atlas_profiles where user_id=$1',[A]))[0].avatar_path,null);assert.equal((await sql('update storage.objects set name=name returning name')).length,0);
  await db.exec('reset role');const bucket=(await sql('select public,file_size_limit,allowed_mime_types from storage.buckets'))[0];assert.equal(bucket.public,false);assert.equal(Number(bucket.file_size_limit),524288);assert.deepEqual(bucket.allowed_mime_types,['image/jpeg']);
 }finally{await db.close();}
});
