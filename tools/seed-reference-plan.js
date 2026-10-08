// Bootstrap only the confirmed owner's old reference plan. Never changes existing plans/records.
import {readFileSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
const athlete=process.argv[2];
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(athlete||''))throw Error('Provide the confirmed athlete UUID.');
const context={window:{}};
for(const file of ['legacy-plan.js','legacy-guide.js'])vm.runInNewContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
const guide=[{tema:'Referência histórica',orientacao:'Plano anterior, sem nova validação esportiva. Prova de 15/11/2026 não confirmada. Não inventa histórico ou resultado real da avaliação de 5 km.'},...context.window.ATLAS_LEGACY_GUIDE];
const sessions=context.window.ATLAS_PLAN.map((s,i)=>({id:'legacy-'+String(i).padStart(3,'0'),date:s.date,type:s.type,km:s.km,description:s.execution,gym:s.gym,notes:s.condition}));
const literal=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
const sql=`begin;
do $$begin if not exists(select 1 from auth.users where id='${athlete}' and email_confirmed_at is not null) then raise exception 'Confirmed athlete not found';end if;end $$;
insert into public.atlas_profiles(user_id,name) values('${athlete}','Luis Felipe') on conflict(user_id) do nothing;
with new_plan as (
 insert into public.atlas_plans(user_id,name,goal_km,goal_minutes,goal_date,guide)
 select '${athlete}','Plano anterior — referência; prova não confirmada',21.1,150,'2026-11-15',${literal(guide)}
 where not exists(select 1 from public.atlas_plans where user_id='${athlete}' and name='Plano anterior — referência; prova não confirmada') returning id
), chosen as (
 select id from new_plan union all select id from public.atlas_plans where user_id='${athlete}' and name='Plano anterior — referência; prova não confirmada' and not exists(select 1 from new_plan) limit 1
)
insert into public.atlas_sessions(user_id,plan_id,id,date,type,km,description,gym,notes)
select '${athlete}',chosen.id,s.id,s.date,s.type,s.km,s.description,s.gym,s.notes from chosen cross join jsonb_to_recordset(${literal(sessions)}) as s(id text,date date,type text,km numeric,description text,gym text,notes text)
on conflict(user_id,plan_id,id) do nothing;
commit;
select name,(select count(*) from public.atlas_sessions s where s.plan_id=p.id) as sessions from public.atlas_plans p where user_id='${athlete}' and name='Plano anterior — referência; prova não confirmada';
`;
writeFileSync(new URL('./.seed-reference-plan.sql',import.meta.url),sql);
console.log('Bootstrap SQL prepared. Only inserts a reference plan; existing records are preserved.');
