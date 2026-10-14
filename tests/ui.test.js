import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parsePlan} from '../importer.js';
import {createManagement} from '../management.js';
import {createCalendarState,calendarHTML,handleCalendarAction} from '../calendar.js';
import {createActivityEditor,persistActivity} from '../activity.js';
import {safeNext} from '../auth-client.js';
import {createAvatarStore,createProfileEditor,initials} from '../profile.js';
import {accountAreas,areaLabels} from '../account-areas.js';
import {readRows, monitoringRows, summaryHTML, commentsHTML} from '../monitoring.js';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'');
const html=readFileSync(new URL('../app.html',import.meta.url),'utf8').replace(/<script[\s\S]*?<\/script>/g,'');
const tick=()=>new Promise(r=>setTimeout(r,20));
async function harness({admin=false,coach=false,linked=false,loggedIn=true,withComments=false,expired=false,calendarSessions=null,history=false,interceptRequest=null}={}){
 const w=new Window({url:'http://localhost/app'});w.document.write(html);w.ATLAS_CONFIG={supabaseUrl:'https://example.supabase.co',supabaseKey:'sb_publishable_test'};
 const id=admin?'admin':'athlete',profile={user_id:id,name:admin?'Admin':'Atleta',available_days:[2,4],is_admin:admin};
 const doc=parsePlan(readFileSync(new URL('../modelo-plano.csv',import.meta.url),'utf8'));
 if(calendarSessions)doc.sessions=structuredClone(calendarSessions);
 const plan={...doc,state:'published',version:1,id:'plan-1',published_by:'coach-private-id',source_draft_id:'draft-private-id',user_id:id,atlas_sessions:doc.sessions};let rows=[],fail=false,imported=0;
 if(loggedIn)w.localStorage.setItem('atlas-session',JSON.stringify({access_token:'test',expires_at:Date.now()/1000+3600,user:{id}}));
 const blobs=[];w.URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:http://localhost/test';};w.URL.revokeObjectURL=()=>{};
 const calls=[];let intercept=interceptRequest;
 let coachStatus=coach?'active':'none';
 w.fetch=async(url,options)=>{calls.push({url,options});if(intercept){const response=await intercept(url,options);if(response)return response;}let data=[];
 if(url.includes('/auth/v1/signup'))data={user:{id}};
 else if(url.includes('/auth/v1/user')){if(expired)return new Response(JSON.stringify({error_code:'bad_jwt',message:'JWT expired'}),{status:401});data={id,user_metadata:{account_type:coach?'coach':'athlete'}};}
 else if(url.includes('/auth/v1/token'))data={access_token:'test',expires_in:3600,user:{id}};
 else if(url.includes('atlas_enable_coach')){coachStatus='active';data={active:true};}
 else if(url.includes('atlas_access_context'))data={role:admin?'admin':coachStatus!=='none'?'coach':'athlete',active:coachStatus!=='inactive',coach_status:coachStatus,areas:['athlete',...(coachStatus==='active'?['coach']:[]),...(admin?['admin']:[])],preferred_area:profile.preferred_area||(admin?'admin':coach?'coach':'athlete')};
 else if(url.includes('atlas_list_users'))data={users:[],total:0};
 else if(url.includes('atlas_admins'))data=admin?[{user_id:id}]:[];
 else if(url.includes('atlas_profiles')){if(options.method==='PATCH')Object.assign(profile,JSON.parse(options.body));data=admin?[profile,{user_id:'athlete',name:'Atleta',is_admin:false}]:linked?[profile,{user_id:'linked',name:'Atleta vinculado'}]:[profile];}
 else if(url.includes('atlas_coach_athletes'))data=linked?[{coach_id:id,athlete_id:'linked',active:true}]:[];
 else if(url.includes('atlas_plans'))data=[plan,...(history?[{...plan,id:'old',state:'archived',version:0}]:[])];
 else if(url.includes('atlas_session_comments'))data=withComments?[{id:'comment',user_id:id,plan_id:'plan-1',session_id:'sessao-001',author_id:'private-author-id',author_name:'Luana',author_role:'coach',body:'<script>Comentário para o atleta</script>',created_at:'2026-10-09T12:00:00Z'}]:[];
 else if(url.includes('atlas_activity_records')){if(options.method==='POST'||options.method==='PATCH'){if(fail)return new Response(JSON.stringify({message:'Falha de rede simulada'}),{status:503});rows=[{...rows[0],...JSON.parse(options.body)}];}data=rows;}
 else if(url.includes('atlas_import_plan')){imported++;data='plan-2';}
 return new Response(JSON.stringify(data));};
 const context=vm.createContext({window:w,document:w.document,localStorage:w.localStorage,fetch:w.fetch,FormData:w.FormData,Blob:w.Blob,URL:w.URL,URLSearchParams,AbortController,navigator:w.navigator,parsePlan,createManagement,createCalendarState,calendarHTML,handleCalendarAction,createActivityEditor,persistActivity,safeNext,createAvatarStore,createProfileEditor,initials,accountAreas,areaLabels,readRows,monitoringRows,summaryHTML,commentsHTML,console,setTimeout,clearTimeout});
 vm.runInContext(source,context);await tick();
 return {w,calls,blobs,set intercept(value){intercept=value;},get rows(){return rows;},get imported(){return imported;},set fail(v){fail=v;},set coachStatus(value){coachStatus=value;},async click(sel){w.document.querySelector(sel).click();await tick();},async submit(sel){w.document.querySelector(sel).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();},async area(value){const s=w.document.querySelector('#areaSelect');s.value=value;s.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();}};
}
test('athlete form keeps failed fields, saves and edits exact session, exports no auth data',async()=>{
 const h=await harness(),d=h.w.document;await h.click('[data-view=calendar]');await h.click('[data-cal-mode=agenda]');assert.equal(d.querySelectorAll('[data-record]').length,2);
 await h.click('[data-record="sessao-001"]');const f=d.querySelector('#recordForm');f.elements.session_id.value='sessao-002';f.elements.status.value='feito';f.elements.km.value='3.25';f.elements.minutes.value='25';f.elements.notes.value='Teste';h.fail=true;await h.submit('#recordForm');assert.match(d.querySelector('#saveError').textContent,/campos foram mantidos/);assert.equal(f.elements.notes.value,'Teste');assert.equal(h.rows.length,0);
 h.fail=false;await h.submit('#recordForm');assert.equal(h.rows[0].session_id,'sessao-001');assert.equal(h.rows[0].plan_id,'plan-1');assert.equal(h.rows[0].user_id,'athlete');
 await h.click('[data-record="sessao-001"]');assert.equal(f.elements.km.value,'3.25');f.elements.recovery.value='Normal';await h.submit('#recordForm');assert.equal(h.rows[0].recovery,'Normal');
 await h.click('[data-view=progress]');assert.match(d.querySelector('#content').textContent,/3,25/);assert.equal(d.querySelectorAll('[data-record]').length,1);
 await h.click('#export');const exported=JSON.parse(await h.blobs[0].text());assert.equal(exported.plans.length,1);assert.equal(exported.records.length,1);assert.equal(exported.plans[0].guide.length,1);assert.ok(!JSON.stringify(exported).includes('user_id'));assert.ok(!JSON.stringify(exported).includes('access_token'));assert.ok(!JSON.stringify(exported).includes('coach-private-id'));assert.ok(!JSON.stringify(exported).includes('draft-private-id'));
 await h.click('[data-view=profile]');await h.submit('#profileForm');assert.match(d.querySelector('#profileStatus').textContent,/salvo/);
 assert.ok(h.calls.some(c=>c.options.method==='PATCH'));await h.w.happyDOM.close();
});

test('the common profile preserves unsaved fields and saved identity across athlete and coach areas',async()=>{
 const h=await harness({coach:true}),d=h.w.document;
 try{
  await h.click('[data-page=staffProfile]');let form=d.querySelector('#profileForm');assert.ok(form.elements.birth_date);assert.ok(d.querySelector('#profilePasswordForm'));form.elements.name.value='Nome compartilhado';
  await h.click('[data-page=overview]');assert.equal(d.querySelector('#profileForm'),form);assert.match(d.querySelector('#managementError').textContent,/Salve ou descarte/);
  await h.submit('#profileForm');assert.equal(d.querySelector('#accountName').textContent,'Nome compartilhado');await h.area('athlete');await h.click('[data-view=profile]');form=d.querySelector('#profileForm');assert.equal(form.elements.name.value,'Nome compartilhado');
  form.elements.birth_date.value='2000-03-04';await h.area('coach');assert.equal(d.querySelector('#areaSelect').value,'athlete');assert.equal(form.elements.birth_date.value,'2000-03-04');
  await h.click('#discardProfile');await h.area('coach');await h.click('[data-page=staffProfile]');assert.equal(d.querySelector('#profileForm').elements.name.value,'Nome compartilhado');
 }finally{await h.w.happyDOM.close();}
});
test('private app without a session redirects to the separate login; logout clears private state',async()=>{
 const h=await harness({loggedIn:false});assert.match(h.w.location.href,/\/entrar\?next=%2Fapp/);assert.equal(h.w.document.querySelector('#appMain').hidden,true);assert.equal(h.w.document.querySelector('#authForm'),null);await h.w.happyDOM.close();
 const logged=await harness();await logged.click('#account');assert.equal(logged.w.localStorage.getItem('atlas-session'),null);assert.equal(logged.w.document.querySelector('#appMain').hidden,true);assert.match(logged.w.location.href,/\/entrar$/);await logged.w.happyDOM.close();
});
test('owner boot enters management with team controls and no record actions',async()=>{
 const h=await harness({admin:true}),d=h.w.document;assert.equal(d.querySelector('nav').hidden,true);assert.match(d.querySelector('#content').textContent,/Admin dono/);assert.ok(d.querySelector('[data-page=team]'));assert.equal(d.querySelectorAll('[data-record]').length,0);await h.w.happyDOM.close();
});
test('expired app access clears the old session and returns to login without showing private data',async()=>{
 const h=await harness({expired:true});try{assert.equal(h.w.localStorage.getItem('atlas-session'),null);assert.match(h.w.location.href,/reason=expired/);assert.equal(h.w.document.querySelector('#appMain').hidden,true);assert.equal(h.w.document.querySelectorAll('[data-record]').length,0);}finally{await h.w.happyDOM.close();}
});

test('coach switches to personal athlete records without another login; revoked area falls back safely',async()=>{
 const h=await harness({coach:true}),d=h.w.document;
 try{
  assert.equal(d.querySelector('#areaSelect').value,'coach');assert.ok(d.querySelector('.management'));const initial=h.w.localStorage.getItem('atlas-session');
  await h.area('athlete');assert.equal(d.querySelector('#areaSelect').value,'athlete');assert.equal(d.querySelector('.management'),null);assert.equal(h.w.localStorage.getItem('atlas-session'),initial);
  assert.ok(h.calls.some(c=>c.url.includes('atlas_plans')&&c.url.includes('user_id=eq.athlete')));
  await h.click('[data-view=calendar]');await h.click('[data-cal-mode=agenda]');await h.click('[data-record="sessao-001"]');d.querySelector('#recordForm').elements.status.value='feito';d.querySelector('#recordForm').elements.km.value='4';await h.submit('#recordForm');assert.equal(h.rows[0].user_id,'athlete');
  await h.area('coach');assert.equal(d.querySelectorAll('[data-record]').length,0);h.coachStatus='inactive';await h.click('#sync');assert.equal(d.querySelector('#areaSelect').value,'athlete');assert.equal(d.querySelector('#areaSelect option[value=coach]'),null);
  await h.click('[data-view=profile]');assert.match(d.querySelector('.account-areas').textContent,/desativado pelo dono/);assert.equal(d.querySelector('[data-enable-coach]'),null);
 }finally{await h.w.happyDOM.close();}
});

test('athlete enables an empty coach area without receiving arbitrary athletes',async()=>{
 const h=await harness(),d=h.w.document;
 try{
  await h.click('[data-view=profile]');await h.click('[data-enable-coach]');assert.equal(d.querySelector('#areaSelect').value,'coach');assert.ok(h.calls.some(c=>c.url.includes('atlas_enable_coach')));
  await h.click('[data-page=plans]');assert.equal(d.querySelectorAll('[data-plan]').length,0);await h.click('#newPlan');const destination=d.querySelector('#destination');assert.equal(destination.options.length,1);await h.click('[data-dismiss]');
  // Creating a draft through a linked athlete is covered in the management suite.
  // Here a newly activated coach has no assigned athletes, even with their own plan.
  assert.equal(d.querySelector('[data-page=team]'),null);
  await h.area('athlete');assert.equal(d.querySelector('#areaSelect').value,'athlete');
 }finally{await h.w.happyDOM.close();}
});

test('switching areas cannot discard an unsaved coach draft',async()=>{
 const h=await harness({coach:true,linked:true}),d=h.w.document;
 try{
  await h.click('[data-page=plans]');await h.click('#newPlan');d.querySelector('#destination').value='linked';await h.click('#confirmAction');d.querySelector('[data-field=name]').value='Rascunho em andamento';
  await h.area('athlete');assert.equal(d.querySelector('#areaSelect').value,'coach');assert.match(d.querySelector('#notice').textContent,/Salve ou descarte/);assert.equal(d.querySelector('[data-field=name]').value,'Rascunho em andamento');
 }finally{await h.w.happyDOM.close();}
});

test('athlete sees separate staff comments before a record and exports no staff identifiers',async()=>{
 const h=await harness({withComments:true}),d=h.w.document;
 try{
  await h.click('[data-view=calendar]');await h.click('[data-cal-mode=agenda]');assert.match(d.querySelector('.staff-comments').textContent,/Comentário para o atleta/);assert.ok(!d.querySelector('.staff-comments script'));assert.equal(d.querySelector('#commentForm'),null);
  await h.click('[data-view=progress]');assert.match(d.querySelector('.staff-comments').textContent,/Luana/);await h.click('#export');const data=JSON.parse(await h.blobs[0].text());assert.equal(data.comments.length,1);assert.equal(data.comments[0].body,'<script>Comentário para o atleta</script>');assert.ok(!JSON.stringify(data).includes('private-author-id'));assert.ok(!JSON.stringify(data).includes('user_id'));
 }finally{await h.w.happyDOM.close();}
});

test('monthly calendar saves one of two sessions, keeps location and separates historical versions',async()=>{
 const calendarSessions=[{id:'sessao-001',date:'2024-02-29',type:'Corrida',km:3},{id:'sessao-002',date:'2024-02-29',type:'Força',minutes:30}];
 const h=await harness({calendarSessions,history:true}),d=h.w.document;
 try{
  await h.click('[data-view=calendar]');assert.equal(d.querySelectorAll('[data-record]').length,2);assert.match(d.querySelector('.calendar-toolbar').textContent,/fevereiro de 2024/);
  await h.click('[data-record=sessao-001]');d.querySelector('#recordForm').elements.status.value='adaptado';await h.submit('#recordForm');
  assert.equal(d.querySelector('.calendar-grid [aria-pressed=true]').dataset.calDay,'2024-02-29');assert.equal(d.querySelectorAll('.calendar-status.done').length,1);assert.equal(d.querySelectorAll('.calendar-status.pending').length,1);assert.equal(d.querySelector('#areaSelect').disabled,false);
  await h.click('[data-cal-filter=done]');assert.equal(d.querySelectorAll('[data-record]').length,1);assert.equal(h.rows[0].plan_id,'plan-1');
  const select=d.querySelector('#planSelect');select.value='old';select.dispatchEvent(new h.w.Event('change',{bubbles:true}));await tick();
  assert.equal(d.querySelectorAll('.calendar-status.done').length,0);assert.equal(d.querySelectorAll('.calendar-status.pending').length,2);assert.equal(d.querySelectorAll('[data-record]').length,0);assert.match(d.querySelector('.calendar-day-detail').textContent,/Plano arquivado/);
  select.value='plan-1';select.dispatchEvent(new h.w.Event('change',{bubbles:true}));await tick();assert.equal(d.querySelector('[data-cal-filter=done]').getAttribute('aria-pressed'),'true');assert.equal(d.querySelectorAll('[data-record]').length,1);
 }finally{await h.w.happyDOM.close();}
});

test('unsaved activity fields block navigation, area changes, sync and unload until explicitly discarded',async()=>{
 const h=await harness({coach:true}),d=h.w.document;
 try{
  await h.area('athlete');await h.click('[data-view=calendar]');await h.click('[data-cal-mode=agenda]');await h.click('[data-record=sessao-001]');const form=d.querySelector('#recordForm');form.elements.notes.value='Texto em andamento';
  await h.area('coach');assert.equal(d.querySelector('#areaSelect').value,'athlete');assert.equal(d.querySelector('#activityDiscard').hidden,false);assert.equal(form.elements.notes.value,'Texto em andamento');
  const before=h.calls.length;await h.click('#sync');assert.equal(h.calls.length,before);await h.click('[data-view=progress]');assert.ok(d.querySelector('.training-calendar'));
  const event=new h.w.Event('beforeunload',{cancelable:true});h.w.dispatchEvent(event);assert.equal(event.defaultPrevented,true);
  await h.click('#keepActivity');assert.equal(d.querySelector('#recordDialog').open,true);await h.click('[data-close=recordDialog]');await h.click('#discardActivity');assert.equal(d.querySelector('#recordDialog').open,false);
  await h.area('coach');assert.equal(d.querySelector('#areaSelect').value,'coach');assert.equal(h.rows.length,0);
 }finally{await h.w.happyDOM.close();}
});

const storageChange=async(h,value)=>{const oldValue=h.w.localStorage.getItem('atlas-session'),newValue=value?JSON.stringify(value):null;if(newValue)h.w.localStorage.setItem('atlas-session',newValue);else h.w.localStorage.removeItem('atlas-session');h.w.dispatchEvent(new h.w.StorageEvent('storage',{key:'atlas-session',oldValue,newValue,storageArea:h.w.localStorage}));await tick();};
test('logout in another tab clears private data and unsaved activity fields immediately',async()=>{
 const h=await harness(),d=h.w.document;try{
  await h.click('[data-view=calendar]');await h.click('[data-cal-mode=agenda]');await h.click('[data-record=sessao-001]');d.querySelector('#recordForm').elements.notes.value='Relato privado não salvo';
  await storageChange(h,null);assert.equal(d.querySelector('#appMain').hidden,true);assert.equal(d.querySelector('#recordDialog').open,false);assert.equal(d.querySelector('#recordForm').elements.notes.value,'');assert.equal(d.querySelector('#recordForm').elements.session_id.value,'');assert.equal(d.querySelector('#recordContext').textContent,'');assert.equal(d.querySelector('#accountName').textContent,'');assert.equal(d.querySelector('#content').textContent,'');assert.match(h.w.location.href,/reason=expired/);
 }finally{await h.w.happyDOM.close();}
});
test('a late activity response after an account switch cannot restore the previous user or remove the new session',async()=>{
 const h=await harness(),d=h.w.document;let respond;try{
  await h.click('[data-view=calendar]');await h.click('[data-cal-mode=agenda]');await h.click('[data-record=sessao-001]');const form=d.querySelector('#recordForm');form.elements.status.value='feito';form.elements.notes.value='Relato da conta anterior';
  h.intercept=(url,options)=>url.includes('atlas_activity_records')&&options.method==='POST'?new Promise(resolve=>respond=()=>resolve(new Response(JSON.stringify([JSON.parse(options.body)])))):null;
  await h.submit('#recordForm');assert.ok(respond);assert.equal(d.querySelector('#recordForm [type=submit]').disabled,true);
  const other={access_token:'other-access',refresh_token:'other-refresh',expires_at:Date.now()/1000+3600,user:{id:'other'}};await storageChange(h,other);respond();await tick();
  assert.equal(h.w.localStorage.getItem('atlas-session'),JSON.stringify(other));assert.equal(d.querySelector('#appMain').hidden,true);assert.equal(d.querySelector('#content').textContent,'');assert.equal(d.querySelector('#recordContext').textContent,'');assert.equal(d.querySelector('#recordForm').elements.notes.value,'');assert.match(h.w.location.href,/reason=changed/);assert.equal(h.rows.length,0);
 }finally{respond?.();await h.w.happyDOM.close();}
});
test('refreshing the same account in another tab keeps a dirty form and uses its renewed access token',async()=>{
 const h=await harness(),d=h.w.document;try{
  await h.click('[data-view=calendar]');await h.click('[data-cal-mode=agenda]');await h.click('[data-record=sessao-001]');const form=d.querySelector('#recordForm');form.elements.status.value='adaptado';form.elements.notes.value='Continuar preenchendo';
  const renewed={access_token:'renewed-access',refresh_token:'renewed-refresh',expires_at:Date.now()/1000+3600,user:{id:'athlete'}};await storageChange(h,renewed);assert.equal(d.querySelector('#recordDialog').open,true);assert.equal(form.elements.notes.value,'Continuar preenchendo');
  await h.submit('#recordForm');assert.equal(h.rows[0].notes,'Continuar preenchendo');const write=h.calls.findLast(c=>c.url.includes('atlas_activity_records')&&c.options.method==='POST');assert.equal(write.options.headers.Authorization,'Bearer renewed-access');
 }finally{await h.w.happyDOM.close();}
});
test('a refresh response arriving after cross-tab logout never resurrects the old session',async()=>{
 const h=await harness(),d=h.w.document;let respond;try{
  const expiring={access_token:'expiring',refresh_token:'refresh',expires_at:Date.now()/1000-1,user:{id:'athlete'}};await storageChange(h,expiring);
  h.intercept=url=>url.includes('grant_type=refresh_token')?new Promise(resolve=>respond=()=>resolve(new Response(JSON.stringify({access_token:'late-access',refresh_token:'late-refresh',expires_in:3600,user:{id:'athlete'}})))):null;
  d.querySelector('#sync').click();await tick();assert.ok(respond);await storageChange(h,null);respond();await tick();
  assert.equal(h.w.localStorage.getItem('atlas-session'),null);assert.equal(d.querySelector('#appMain').hidden,true);assert.equal(d.querySelector('#content').textContent,'');assert.match(h.w.location.href,/reason=expired/);
 }finally{respond?.();await h.w.happyDOM.close();}
});

test('an initial account response and a pending logout cannot clear a newer login from another tab',async()=>{
 let releaseInitial;
 const initial=await harness({interceptRequest:url=>url.endsWith('/auth/v1/user')?new Promise(resolve=>releaseInitial=()=>resolve(new Response(JSON.stringify({id:'athlete',user_metadata:{}})))):null});
 const other={access_token:'other-access',refresh_token:'other-refresh',expires_at:Date.now()/1000+3600,user:{id:'other'}};
 try{assert.ok(releaseInitial);await storageChange(initial,other);releaseInitial();await tick();assert.equal(initial.w.localStorage.getItem('atlas-session'),JSON.stringify(other));assert.equal(initial.w.document.querySelector('#appMain').hidden,true);}finally{releaseInitial?.();await initial.w.happyDOM.close();}
 const h=await harness();let releaseLogout;
 try{h.intercept=url=>url.includes('/auth/v1/logout')?new Promise(resolve=>releaseLogout=()=>resolve(new Response('null'))):null;h.w.document.querySelector('#account').click();await tick();assert.ok(releaseLogout);await storageChange(h,other);releaseLogout();await tick();assert.equal(h.w.localStorage.getItem('atlas-session'),JSON.stringify(other));assert.equal(h.w.document.querySelector('#appMain').hidden,true);}finally{releaseLogout?.();await h.w.happyDOM.close();}
});
