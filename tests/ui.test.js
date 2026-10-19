import {strengthPrescriptionHTML,strengthResultsHTML} from '../strength.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parsePlan} from '../importer.js';
import {createManagement} from '../management.js';
import {createCalendarState,calendarHTML,handleCalendarAction} from '../calendar.js';
import {createActivityEditor,persistActivity} from '../activity.js';
import {createNotificationSettings,notificationTarget} from '../notifications.js';
import {safeNext} from '../auth-client.js';
import {createAvatarStore,createProfileEditor,initials} from '../profile.js';
import {accountAreas,areaLabels} from '../account-areas.js';
import {readRows, monitoringRows, summaryHTML, commentsHTML} from '../monitoring.js';
import {createProgressState,progressHTML,selectProgressWeek} from '../progress.js';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'');
const html=readFileSync(new URL('../app.html',import.meta.url),'utf8').replace(/<script[\s\S]*?<\/script>/g,'');
const tick=()=>new Promise(r=>setTimeout(r,20));
async function harness({admin=false,coach=false,linked=false,loggedIn=true,withComments=false,expired=false,calendarSessions=null,activityRecords=[],history=false,interceptRequest=null,now=null,serviceWorker=false,url='http://localhost/app',preferredArea=null,profileValues={},accountId=null,notificationFactory=createNotificationSettings}={}){
 const w=new Window({url});w.document.write(html);w.ATLAS_CONFIG={supabaseUrl:'https://example.supabase.co',supabaseKey:'sb_publishable_test'};
 if(serviceWorker)Object.defineProperty(w.navigator,'serviceWorker',{value:new w.EventTarget(),configurable:true});
 const id=accountId||(admin?'admin':'athlete'),profile={user_id:id,name:admin?'Admin':'Atleta',available_days:[2,4],is_admin:admin,preferred_area:preferredArea,...profileValues};
 const doc=parsePlan(readFileSync(new URL('../modelo-plano.csv',import.meta.url),'utf8'));
 if(calendarSessions)doc.sessions=structuredClone(calendarSessions);
 const plan={...doc,state:'published',version:1,id:'plan-1',published_by:'coach-private-id',source_draft_id:'draft-private-id',user_id:id,atlas_sessions:doc.sessions};let rows=structuredClone(activityRecords),fail=false,imported=0;
 if(loggedIn)w.localStorage.setItem('atlas-session',JSON.stringify({access_token:'test',expires_at:Date.now()/1000+3600,user:{id}}));
 const blobs=[],revokedURLs=[];w.URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:http://localhost/test-'+blobs.length;};w.URL.revokeObjectURL=url=>revokedURLs.push(url);
 const calls=[];let intercept=interceptRequest;
 let coachStatus=coach?'active':'none';
 w.fetch=async(url,options)=>{calls.push({url,options});if(intercept){const response=await intercept(url,options);if(response)return response;}let data=[];
 if(url.includes('/auth/v1/signup'))data={user:{id}};
 else if(url.includes('/auth/v1/user')){if(expired)return new Response(JSON.stringify({error_code:'bad_jwt',message:'JWT expired'}),{status:401});data={id,user_metadata:{account_type:coach?'coach':'athlete'}};}
 else if(url.includes('/auth/v1/token'))data={access_token:'test',expires_in:3600,user:{id}};
 else if(url.includes('atlas_enable_coach')){coachStatus='active';data={active:true};}
 else if(url.includes('atlas_ensure_profile'))data={...profile};
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
 const HarnessDate=now?class extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return new Date(now).getTime();}}:Date;
 const context=vm.createContext({window:w,document:w.document,localStorage:w.localStorage,fetch:w.fetch,FormData:w.FormData,Blob:w.Blob,URL:w.URL,URLSearchParams,AbortController,Date:HarnessDate,navigator:w.navigator,parsePlan,createManagement,createCalendarState,calendarHTML,handleCalendarAction,createActivityEditor,persistActivity,createNotificationSettings:notificationFactory,notificationTarget,safeNext,createAvatarStore,createProfileEditor,initials,accountAreas,areaLabels,readRows,monitoringRows,summaryHTML,commentsHTML,createProgressState,progressHTML,selectProgressWeek,strengthPrescriptionHTML,strengthResultsHTML,console,setTimeout,clearTimeout});
 vm.runInContext(source,context);await tick();
 return {w,calls,blobs,revokedURLs,set intercept(value){intercept=value;},get rows(){return rows;},get imported(){return imported;},set fail(v){fail=v;},set coachStatus(value){coachStatus=value;},async click(sel){w.document.querySelector(sel).click();await tick();},async submit(sel){w.document.querySelector(sel).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();},async area(value){const s=w.document.querySelector('#areaSelect');s.value=value;s.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();}};
}
test('workout prescriptions and records omit absent metrics while preserving explicit zero values',async()=>{
 const calendarSessions=[
  {id:'duration',date:'2030-01-15',type:'Força',km:null,minutes:30},
  {id:'zero',date:'2030-01-15',type:'Corrida',km:0,minutes:0},
  {id:'absent',date:'2030-01-15',type:'Mobilidade',km:null}
 ];
 const activityRecords=[
  {session_id:'duration',km:null,minutes:15},
  {session_id:'zero',km:0,minutes:0},
  {session_id:'absent',km:null,minutes:null}
 ].map(row=>({...row,user_id:'athlete',plan_id:'plan-1',status:'feito'}));
 const h=await harness({calendarSessions,activityRecords,now:'2030-01-15T12:00:00'}),d=h.w.document;
 try{
  const card=id=>d.querySelector(`[data-record="${id}"]`).closest('article');
  const duration=card('duration'),zero=card('zero'),absent=card('absent');
  assert.deepEqual([...duration.querySelectorAll('dt')].map(el=>el.textContent),['Duração prevista']);
  assert.equal(duration.querySelector('dd').textContent.trim(),'30 min');
  assert.equal(duration.querySelector('[aria-label="Seu registro"] .muted').textContent,'15 min');
  assert.deepEqual([...zero.querySelectorAll('dd')].map(el=>el.textContent.trim()),['0 km','0 min']);
  assert.equal(zero.querySelector('[aria-label="Seu registro"] .muted').textContent,'0 km · 0 min');
  assert.equal(absent.querySelector('[aria-label="Prescrição"]'),null);
  assert.equal(absent.querySelector('[aria-label="Seu registro"] .muted'),null);
  assert.equal(absent.querySelector('[aria-label="Seu registro"] .status').textContent,'feito');
  assert.ok(!absent.textContent.includes('— km'));
 }finally{await h.w.happyDOM.close();}
});

test('workout instructions keep line breaks and render user-authored markup as text',async()=>{
 const description='Aquecer por 5 minutos.\n<script>não executar()</script>',gym='Agachar com controle.\n<img src=x onerror="não executar()">',notes='Descansar entre séries.\n<b>Sem pressa.</b>';
 const h=await harness({calendarSessions:[{id:'instructions',date:'2030-01-15',type:'Força',description,gym,notes}],now:'2030-01-15T12:00:00'}),d=h.w.document;
 try{
  const card=d.querySelector('[data-record=instructions]').closest('article');
  assert.equal(card.querySelector('.workout-description').textContent,description);
  assert.deepEqual([...card.querySelectorAll('.workout-instructions p')].map(el=>el.textContent),[gym,notes]);
  assert.equal(card.querySelector('script, img, b'),null);
 }finally{await h.w.happyDOM.close();}
});

test('athlete navigation identifies only the active section and hides plan context on profile and staff areas',async()=>{
 const h=await harness({coach:true}),d=h.w.document;
 try{
  assert.equal(d.querySelector('#planContext').hidden,true);
  assert.equal(d.querySelector('#athleteHeading').hidden,true);
  await h.area('athlete');
  for(const control of d.querySelectorAll('nav[aria-label="Seções"] button, #account, #planSelect, #sync'))assert.equal(control.disabled,false,`${control.id||control.dataset.view} must be usable after switching areas`);
  for(const view of ['today','calendar','progress','guide','profile','today']){
   await h.click(`[data-view=${view}]`);
   const current=d.querySelectorAll('nav[aria-label="Seções"] [aria-current]');
   assert.equal(current.length,1);
   assert.equal(current[0].dataset.view,view);
   assert.equal(current[0].getAttribute('aria-current'),'page');
   assert.equal(d.querySelector('#planContext').hidden,view==='profile');
   assert.equal(d.querySelector('#athleteHeading').hidden,false);
  }
  await h.area('coach');
  assert.equal(d.querySelector('nav[aria-label="Seções"]').hidden,true);
  assert.equal(d.querySelector('#planContext').hidden,true);
  assert.equal(d.querySelector('#athleteHeading').hidden,true);
 }finally{await h.w.happyDOM.close();}
 const owner=await harness({admin:true});
 try{assert.equal(owner.w.document.querySelector('#planContext').hidden,true);assert.equal(owner.w.document.querySelector('#athleteHeading').hidden,true);}finally{await owner.w.happyDOM.close();}
});

test('workout selection keeps all sessions today, otherwise the next or last session, and handles an empty plan',async()=>{
 const session=(id,date)=>({id,date,type:id});
 const cases=[
  {sessions:[session('past','2030-01-14'),session('today-run','2030-01-15'),session('today-strength','2030-01-15'),session('future','2030-01-16')],ids:['today-run','today-strength'],context:'Hoje · 2 sessões'},
  {sessions:[session('past','2030-01-14'),session('next','2030-01-16'),session('future','2030-01-17')],ids:['next'],context:'Próxima sessão do plano'},
  {sessions:[session('older','2030-01-13'),session('last','2030-01-14')],ids:['last'],context:'Última sessão do plano'},
  {sessions:[],ids:[],context:'Ainda não há sessões neste plano'}
 ];
 for(const {sessions,ids,context} of cases){
  const h=await harness({calendarSessions:sessions,now:'2030-01-15T12:00:00'}),d=h.w.document;
  try{
   assert.deepEqual([...d.querySelectorAll('#content [data-record]')].map(el=>el.dataset.record),ids);
   assert.equal(d.querySelector('#workoutContext').textContent,context);
  }finally{await h.w.happyDOM.close();}
 }
});

test('athlete form keeps failed fields, saves and edits exact session, exports no auth data',async()=>{
 const h=await harness(),d=h.w.document;await h.click('[data-view=calendar]');await h.click('[data-cal-mode=agenda]');assert.equal(d.querySelectorAll('[data-record]').length,2);
 await h.click('[data-record="sessao-001"]');const f=d.querySelector('#recordForm');f.elements.session_id.value='sessao-002';f.elements.status.value='feito';f.elements.km.value='3.25';f.elements.minutes.value='25';f.elements.notes.value='Teste';h.fail=true;await h.submit('#recordForm');assert.match(d.querySelector('#saveError').textContent,/campos foram mantidos/);assert.equal(f.elements.notes.value,'Teste');assert.equal(h.rows.length,0);
 h.fail=false;await h.submit('#recordForm');assert.equal(h.rows[0].session_id,'sessao-001');assert.equal(h.rows[0].plan_id,'plan-1');assert.equal(h.rows[0].user_id,'athlete');
 await h.click('[data-record="sessao-001"]');assert.equal(f.elements.km.value,'3.25');f.elements.recovery.value='Normal';await h.submit('#recordForm');assert.equal(h.rows[0].recovery,'Normal');
 await h.click('[data-view=progress]');assert.match(d.querySelector('#content').textContent,/3,25/);assert.equal(d.querySelectorAll('[data-record]').length,1);
 await h.click('#export');const exported=JSON.parse(await h.blobs[0].text());assert.equal(exported.plans.length,1);assert.equal(exported.records.length,1);assert.equal(exported.plans[0].guide.length,1);assert.ok(!JSON.stringify(exported).includes('user_id'));assert.ok(!JSON.stringify(exported).includes('access_token'));assert.ok(!JSON.stringify(exported).includes('coach-private-id'));assert.ok(!JSON.stringify(exported).includes('draft-private-id'));
 await h.click('[data-view=profile]');await h.click('#editProfile');await h.submit('#profileForm');assert.match(d.querySelector('#profileStatus').textContent,/salvo/);
 assert.ok(h.calls.some(c=>c.options.method==='PATCH'));await h.w.happyDOM.close();
});

test('notification messages and explicit opening preserve unsaved activity and profile forms',async()=>{
 for(const mode of ['activity','profile']){
  const h=await harness({serviceWorker:true}),d=h.w.document;
  try{
   if(mode==='activity'){await h.click('[data-view=calendar]');await h.click('[data-cal-mode=agenda]');await h.click('[data-record="sessao-001"]');d.querySelector('#recordForm').elements.notes.value='Relato ainda em edição';}
   else{await h.click('[data-view=profile]');await h.click('#editProfile');d.querySelector('#profileForm').elements.name.value='Nome em edição';}
   const form=d.querySelector(mode==='activity'?'#recordForm':'#profileForm'),before=h.calls.length;
   h.w.navigator.serviceWorker.dispatchEvent(new h.w.MessageEvent('message',{data:{type:'atlas-notification-open',user_id:'athlete',url:'/app?view=progress'}}));
   assert.equal(d.querySelector(mode==='activity'?'#recordForm':'#profileForm'),form);
   assert.ok(d.querySelector('[data-notification-view=progress]'));
   await h.click('[data-notification-view=progress]');
   assert.equal(h.calls.length,before);assert.equal(d.querySelector(mode==='activity'?'#recordForm':'#profileForm'),form);
   if(mode==='activity'){assert.equal(form.elements.notes.value,'Relato ainda em edição');assert.equal(d.querySelector('#recordDialog').open,true);assert.equal(d.querySelector('#activityDiscard').hidden,false);}
   else{assert.equal(form.elements.name.value,'Nome em edição');assert.match(d.querySelector('#notice').textContent,/Salve ou cancele/);}
  }finally{await h.w.happyDOM.close();}
 }
});

test('a coach summary opens team monitoring through the current access checks instead of personal progress',async()=>{
 const h=await harness({coach:true,linked:true,serviceWorker:true}),d=h.w.document;
 try{
  await h.area('athlete');
  h.w.navigator.serviceWorker.dispatchEvent(new h.w.MessageEvent('message',{data:{type:'atlas-notification-open',user_id:'athlete',url:'/app?view=progress&area=coach'}}));
  await h.click('[data-notification-view=progress]');assert.equal(d.querySelector('#areaSelect').value,'coach');assert.ok(d.querySelector('[data-page=monitoring].active'));assert.equal(d.querySelectorAll('[data-record]').length,0);
  await h.area('athlete');h.coachStatus='inactive';await h.click('#sync');
  h.w.navigator.serviceWorker.dispatchEvent(new h.w.MessageEvent('message',{data:{type:'atlas-notification-open',user_id:'athlete',url:'/app?view=progress&area=coach'}}));
  await h.click('[data-notification-view=progress]');assert.equal(d.querySelector('#areaSelect').value,'athlete');assert.equal(d.querySelector('.management'),null);assert.match(d.querySelector('#notice').textContent,/não está disponível/);
 }finally{await h.w.happyDOM.close();}
});

test('notification cold starts choose the authorized area instead of the saved area',async()=>{
 for(const item of [
  {url:'http://localhost/app?view=progress&area=coach',preferredArea:'athlete',expected:'coach'},
  {url:'http://localhost/app?view=calendar&area=athlete',preferredArea:'coach',expected:'athlete'}
 ]){
  const h=await harness({coach:true,linked:true,...item}),d=h.w.document;
  try{assert.equal(d.querySelector('#areaSelect').value,item.expected);if(item.expected==='coach')assert.ok(d.querySelector('[data-page=monitoring].active'));else assert.ok(d.querySelector('.training-calendar'));assert.ok(h.calls.some(call=>call.url.includes('atlas_access_context')));assert.equal(h.calls.some(call=>call.options.method==='PATCH'),false,'opening an alert does not rewrite the account preference');}finally{await h.w.happyDOM.close();}
 }
 const revoked=await harness({url:'http://localhost/app?view=progress&area=coach'});
 try{assert.equal(revoked.w.document.querySelector('#areaSelect').value,'athlete');assert.equal(revoked.w.document.querySelector('.management'),null);assert.match(revoked.w.document.querySelector('#notice').textContent,/não está disponível/);}finally{await revoked.w.happyDOM.close();}
});

test('athlete notifications respect a coach draft before switching to the personal calendar',async()=>{
 const h=await harness({coach:true,linked:true,serviceWorker:true}),d=h.w.document;
 try{
  await h.click('[data-page=plans]');await h.click('#newPlan');d.querySelector('#destination').value='linked';await h.click('#confirmAction');d.querySelector('[data-field=name]').value='Plano ainda não salvo';
  const before=h.calls.length;
  h.w.navigator.serviceWorker.dispatchEvent(new h.w.MessageEvent('message',{data:{type:'atlas-notification-open',user_id:'athlete',url:'/app?view=calendar&area=athlete'}}));
  await h.click('[data-notification-view=calendar]');assert.equal(h.calls.length,before);assert.equal(d.querySelector('[data-field=name]').value,'Plano ainda não salvo');assert.equal(d.querySelector('#areaSelect').value,'coach');
 }finally{await h.w.happyDOM.close();}
 const ready=await harness({coach:true,linked:true,serviceWorker:true});
 try{ready.w.navigator.serviceWorker.dispatchEvent(new ready.w.MessageEvent('message',{data:{type:'atlas-notification-open',user_id:'athlete',url:'/app?view=calendar&area=athlete'}}));await ready.click('[data-notification-view=calendar]');assert.equal(ready.w.document.querySelector('#areaSelect').value,'athlete');assert.ok(ready.w.document.querySelector('.training-calendar'));}finally{await ready.w.happyDOM.close();}
});

test('the common profile preserves unsaved fields and saved identity across athlete and coach areas',async()=>{
 const h=await harness({coach:true}),d=h.w.document;
 try{
  await h.click('[data-page=staffProfile]');assert.equal(!!d.querySelector('#profilePasswordForm'),false);await h.click('#editProfile');let form=d.querySelector('#profileForm');assert.ok(form.elements.birth_date);form.elements.name.value='Nome compartilhado';
  await h.click('[data-page=overview]');assert.equal(d.querySelector('#profileForm'),form);assert.match(d.querySelector('#managementError').textContent,/Salve ou cancele/);
  await h.submit('#profileForm');assert.equal(d.querySelector('#accountName').textContent,'Nome compartilhado');await h.area('athlete');await h.click('[data-view=profile]');await h.click('#editProfile');form=d.querySelector('#profileForm');assert.equal(form.elements.name.value,'Nome compartilhado');
  form.elements.birth_date.value='2000-03-04';await h.area('coach');assert.equal(d.querySelector('#areaSelect').value,'athlete');assert.equal(form.elements.birth_date.value,'2000-03-04');
  await h.click('#discardProfile');await h.area('coach');await h.click('[data-page=staffProfile]');await h.click('#editProfile');assert.equal(d.querySelector('#profileForm').elements.name.value,'Nome compartilhado');
 }finally{await h.w.happyDOM.close();}
});
test('unchanged profile and autofilled current password allow area switching, sync and logout in every area',async()=>{
 for(const area of ['athlete','coach','admin']){
  const h=await harness({coach:true,admin:area==='admin'}),d=h.w.document;
  try{
   if(area==='athlete')await h.area('athlete');
   await h.click(area==='athlete'?'[data-view=profile]':'[data-page=staffProfile]');assert.equal(!!d.querySelector('#profileForm'),false);await h.click('#editPassword');d.querySelector('#currentPassword').value='autofilled-current';
   const next=area==='athlete'?'coach':'athlete';await h.area(next);assert.equal(d.querySelector('#areaSelect').value,next);assert.equal(!!d.querySelector('#profilePasswordForm'),false);
   await h.click('#sync');assert.ok(!d.querySelector('#notice').textContent.includes('Salve ou'));await h.click(next==='coach'?'[data-page=staffProfile]':'[data-view=profile]');await h.click('#editPassword');d.querySelector('#currentPassword').value='autofilled-current';await h.click('#account');assert.equal(d.querySelector('#appMain').hidden,true);assert.equal(h.w.localStorage.getItem('atlas-session'),null);
  }finally{await h.w.happyDOM.close();}
 }
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

test('logout and both expiration paths hide data immediately and await bounded device cleanup',async()=>{
 for(const mode of ['logout','initial-expiration','load-expiration']){
  let release;const cleaned=[];
  const cleanup=new Promise(resolve=>{release=resolve;});
  const h=await harness({expired:mode==='initial-expiration',notificationFactory:()=>({busy:false,detach(){},mount(){},checkDeviceIdentity(){},resetDevice(user){cleaned.push(user);return cleanup;}})}),d=h.w.document;
  try{
   if(mode==='logout')await h.click('#account');
   if(mode==='load-expiration'){h.intercept=url=>url.includes('atlas_access_context')?new Response(JSON.stringify({error_code:'bad_jwt'}),{status:401}):null;await h.click('#sync');}
   assert.deepEqual(cleaned,['athlete']);assert.equal(d.querySelector('#appMain').hidden,true);assert.equal(d.querySelector('#content').textContent,'');assert.equal(d.querySelector('#accountName').textContent,'');assert.equal(h.w.localStorage.getItem('atlas-session'),null);assert.equal(h.w.location.pathname,'/app','navigation waits for the worker acknowledgement');
   release();await tick();assert.equal(h.w.location.pathname,'/entrar');
  }finally{release();await h.w.happyDOM.close();}
 }
 const stuck=await harness({notificationFactory:()=>({busy:false,detach(){},mount(){},checkDeviceIdentity(){},resetDevice(){return new Promise(()=>{});}})});
 try{await stuck.click('#account');assert.equal(stuck.w.document.querySelector('#appMain').hidden,true);await new Promise(resolve=>setTimeout(resolve,2100));assert.equal(stuck.w.location.pathname,'/entrar','a missing worker acknowledgement cannot trap logout');}finally{await stuck.w.happyDOM.close();}
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
  for(const control of d.querySelectorAll('#areaSelect, #sync, #account, #planSelect, nav button'))assert.equal(control.disabled,false,'account controls must be usable after enabling the coach area');
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

const responseGate=()=>{let release;const response=new Promise(resolve=>{release=resolve;});return {response,release};};
test('area bootstrap repairs the profile and checks capabilities concurrently before fetching private data',async()=>{
 const repair=responseGate(),access=responseGate();
 const h=await harness({interceptRequest:url=>url.includes('atlas_ensure_profile')?repair.response:url.includes('atlas_access_context')?access.response:null}),d=h.w.document;
 try{
  assert.equal(h.calls.filter(c=>c.url.includes('atlas_ensure_profile')).length,1);
  assert.equal(h.calls.filter(c=>c.url.includes('atlas_access_context')).length,1,'capabilities start while profile repair is still pending');
  assert.equal(h.calls.some(c=>c.url.includes('/rest/v1/atlas_plans?')),false);
  assert.equal(d.querySelector('#content').getAttribute('aria-busy'),'true');
  for(const control of d.querySelectorAll('#areaSelect, #sync, #account, #planSelect, nav button'))assert.equal(control.disabled,true);
  repair.release();await tick();
  assert.equal(h.calls.some(c=>c.url.includes('/rest/v1/atlas_plans?')),false,'neither bootstrap response can open the area on its own');
  assert.equal(d.querySelectorAll('[data-record]').length,0);
  access.release();await tick();
  assert.ok(d.querySelector('[data-record]'));assert.equal(d.querySelector('#content').hasAttribute('aria-busy'),false);
  assert.equal(h.calls.some(c=>c.url.includes('/rest/v1/atlas_profiles?')),false,'the repaired profile avoids a redundant profile read');
  assert.equal(h.w.localStorage.length,1);assert.equal(h.w.localStorage.key(0),'atlas-session');
 }finally{repair.release();access.release();await h.w.happyDOM.close();}
});

test('area switching fetches data and saves the preference concurrently but waits for both before showing success',async()=>{
 for(const first of ['preference','data']){
  const h=await harness({coach:true}),d=h.w.document,preference=responseGate(),data=responseGate(),start=h.calls.length;
  try{
   h.intercept=(url,options)=>url.includes('/rest/v1/atlas_profiles?')&&options.method==='PATCH'?preference.response:url.includes('/rest/v1/atlas_plans?')?data.response:null;
   await h.area('athlete');
   const calls=h.calls.slice(start),patch=calls.find(c=>c.options.method==='PATCH');
   assert.ok(patch);assert.equal(patch.options.headers.Prefer,'return=representation');
   assert.ok(calls.some(c=>c.url.includes('/rest/v1/atlas_plans?')),'data starts before preference confirmation');
   assert.equal(d.querySelector('#content').getAttribute('aria-busy'),'true');assert.equal(d.querySelectorAll('[data-record]').length,0);
   assert.match(d.querySelector('#notice').textContent,/Atualizando/);
   (first==='preference'?preference:data).release();await tick();
   assert.equal(d.querySelector('#content').getAttribute('aria-busy'),'true',`${first} alone cannot complete the switch`);
   assert.equal(d.querySelectorAll('[data-record]').length,0);assert.doesNotMatch(d.querySelector('#notice').textContent,/Dados sincronizados/);
   (first==='preference'?data:preference).release();await tick();
   assert.equal(d.querySelector('#areaSelect').value,'athlete');assert.ok(d.querySelector('[data-record]'));
   assert.match(d.querySelector('#notice').textContent,/Dados sincronizados/);assert.equal(d.querySelector('#content').hasAttribute('aria-busy'),false);
   for(const control of d.querySelectorAll('#areaSelect, #sync, #account, #planSelect, nav button'))assert.equal(control.disabled,false);
   assert.equal(d.activeElement.id,'viewHeading');
   await h.area('coach');assert.equal(d.activeElement.dataset.page,'overview');assert.equal(d.activeElement.disabled,false);
  }finally{preference.release();data.release();await h.w.happyDOM.close();}
 }
});

test('a failed or unconfirmed area preference never reports success and can be recovered by synchronizing',async()=>{
 for(const failure of ['network','no rows','offline','timeout']){
  const h=await harness({coach:true}),d=h.w.document;
  try{
   h.intercept=(url,options)=>{if(!url.includes('/rest/v1/atlas_profiles?')||options.method!=='PATCH')return null;if(failure==='offline')throw TypeError('Failed to fetch');if(failure==='timeout')throw Object.assign(Error('Aborted'),{name:'AbortError'});return new Response(JSON.stringify(failure==='network'?{message:'Falha ao salvar preferência'}:[]),{status:failure==='network'?503:200});};
   await h.area('athlete');
   assert.match(d.querySelector('#notice').textContent,/Não foi possível/);assert.doesNotMatch(d.querySelector('#notice').textContent,/Dados sincronizados/);
   if(failure==='offline')assert.match(d.querySelector('#notice').textContent,/Verifique sua conexão/);
   if(failure==='timeout')assert.match(d.querySelector('#notice').textContent,/demorou mais/);
   assert.equal(d.querySelectorAll('[data-record]').length,0);assert.equal(d.querySelector('.management'),null);
   assert.ok(d.querySelector('#reload'));assert.equal(d.querySelector('#areaSelect').disabled,false);assert.equal(d.querySelector('#sync').disabled,false);
   h.intercept=null;await h.click('#sync');
   assert.ok(d.querySelector('.management'));assert.equal(d.querySelector('#areaSelect').value,'coach');assert.match(d.querySelector('#notice').textContent,/Área do treinador/);
  }finally{await h.w.happyDOM.close();}
 }
});

test('a failed coach activation preference restores usable controls and allows a fresh retry',async()=>{
 const h=await harness(),d=h.w.document;
 try{
  await h.click('[data-view=profile]');
  h.intercept=(url,options)=>url.includes('/rest/v1/atlas_profiles?')&&options.method==='PATCH'?new Response(JSON.stringify({message:'Falha ao salvar preferência'}),{status:503}):null;
  await h.click('[data-enable-coach]');
  assert.match(d.querySelector('#notice').textContent,/Não foi possível/);assert.ok(d.querySelector('#reload'));
  for(const id of ['sync','account','areaSelect'])assert.equal(d.getElementById(id).disabled,false,id);
  h.intercept=null;await h.click('#reload');
  assert.ok(d.querySelector('[data-record]'));assert.equal(d.querySelector('#sync').disabled,false);assert.equal(d.querySelector('#account').disabled,false);
 }finally{await h.w.happyDOM.close();}
});

test('a repaired owner profile supplies navigation preference while capabilities still come from the server',async()=>{
 const h=await harness({admin:true,preferredArea:'admin',interceptRequest:url=>url.includes('atlas_access_context')?new Response(JSON.stringify({role:'admin',areas:['athlete','admin'],coach_status:'none',preferred_area:'athlete'})):url.includes('atlas_ensure_profile')?new Response(JSON.stringify({user_id:'admin',name:'Dono regularizado',available_days:[],preferred_area:'admin'})):null}),d=h.w.document;
 try{
  assert.equal(d.querySelector('#areaSelect').value,'admin');assert.equal(d.querySelector('#accountName').textContent,'Dono regularizado');assert.ok(d.querySelector('[data-page=team]'));
  assert.equal(h.calls.some(c=>c.url.includes('/rest/v1/atlas_profiles?select=*&user_id=')),false);
 }finally{await h.w.happyDOM.close();}
 const athlete=await harness({profileValues:{preferred_area:'admin'}});
 try{assert.equal(athlete.w.document.querySelector('#areaSelect').value,'athlete');assert.equal(athlete.w.document.querySelector('.management'),null,'a repaired preference cannot grant an unauthorized area');}finally{await athlete.w.happyDOM.close();}
});

test('a coach revocation received during switching prevents saving or opening the revoked area',async()=>{
 const h=await harness({coach:true,preferredArea:'athlete'}),d=h.w.document,access=responseGate(),start=h.calls.length;
 try{
  h.intercept=url=>url.includes('atlas_access_context')?access.response:null;await h.area('coach');
  assert.equal(h.calls.slice(start).some(c=>c.options.method==='PATCH'),false,'preference waits for current server capabilities');
  h.coachStatus='inactive';access.release();await tick();
  assert.equal(d.querySelector('#areaSelect').value,'athlete');assert.equal(d.querySelector('.management'),null);assert.equal(d.querySelector('#areaSelect option[value=coach]'),null);
  assert.match(d.querySelector('#notice').textContent,/não está disponível/);assert.ok(d.querySelector('[data-record]'));
  const calls=h.calls.slice(start);assert.equal(calls.some(c=>c.options.method==='PATCH'),false);assert.equal(calls.some(c=>c.url.includes('atlas_plan_drafts')||c.url.includes('atlas_list_users')),false);
 }finally{access.release();await h.w.happyDOM.close();}
});

test('late concurrent profile and access responses cannot restore private state after an account change',async()=>{
 const h=await harness(),d=h.w.document,repair=responseGate(),access=responseGate(),start=h.calls.length;
 const other={access_token:'other-access',refresh_token:'other-refresh',expires_at:Date.now()/1000+3600,user:{id:'other'}};
 try{
  h.intercept=url=>url.includes('atlas_ensure_profile')?repair.response:url.includes('atlas_access_context')?access.response:null;await h.click('#sync');
  const pending=h.calls.slice(start);assert.equal(pending.length,2);assert.ok(pending.every(c=>!c.options.signal.aborted));
  await storageChange(h,other);assert.ok(pending.every(c=>c.options.signal.aborted));repair.release();access.release();await tick();
  assert.equal(h.w.localStorage.getItem('atlas-session'),JSON.stringify(other));assert.equal(d.querySelector('#appMain').hidden,true);assert.equal(d.querySelector('#content').textContent,'');assert.equal(d.querySelector('#accountName').textContent,'');
  assert.equal(h.calls.slice(start).some(c=>c.url.includes('/rest/v1/atlas_plans?')),false);assert.match(h.w.location.href,/reason=changed/);
 }finally{repair.release();access.release();await h.w.happyDOM.close();}
});

test('the own avatar is reused across areas in memory and invalidated for a new path and logout',async()=>{
 const id='11111111-1111-4111-8111-111111111111',oldPath=id+'/22222222-2222-4222-8222-222222222222.jpg',newPath=id+'/33333333-3333-4333-8333-333333333333.jpg';
 const photo=url=>url.includes('/storage/v1/object/atlas-avatars/')?new Response(new Uint8Array([255,216,255]),{headers:{'Content-Type':'image/jpeg'}}):null;
 const h=await harness({coach:true,accountId:id,profileValues:{avatar_path:oldPath},interceptRequest:photo}),d=h.w.document;
 const downloads=()=>h.calls.filter(c=>c.url.includes('/storage/v1/object/atlas-avatars/'));
 try{
  assert.equal(downloads().length,1);assert.equal(d.querySelector('#accountAvatar').hidden,false);
  const firstURL=d.querySelector('#accountAvatar').src;await h.area('athlete');await h.area('coach');
  assert.equal(downloads().length,1);assert.equal(d.querySelector('#accountAvatar').src,firstURL);assert.deepEqual(h.revokedURLs,[]);
  h.intercept=url=>url.includes('atlas_ensure_profile')?new Response(JSON.stringify({user_id:id,name:'Atleta',available_days:[],preferred_area:'coach',avatar_path:newPath})):photo(url);
  await h.click('#sync');assert.equal(downloads().length,2);assert.ok(downloads()[1].url.endsWith(newPath));assert.deepEqual(h.revokedURLs,[firstURL]);
  const nextURL=d.querySelector('#accountAvatar').src;assert.notEqual(nextURL,firstURL);
  assert.equal(h.w.localStorage.length,1);assert.ok(!h.w.localStorage.getItem('atlas-session').includes('avatar_path'));
  await h.click('#account');assert.deepEqual(h.revokedURLs,[firstURL,nextURL]);assert.equal(d.querySelector('#accountAvatar').hasAttribute('src'),false);assert.equal(h.w.localStorage.length,0);
 }finally{await h.w.happyDOM.close();}
});


test('athlete progress changes weeks locally, preserves selection after saving and guards an unsaved report',async()=>{
 const calendarSessions=[{id:'first',date:'2030-01-14',type:'Corrida',km:4,minutes:24},{id:'second',date:'2030-01-21',type:'Força',km:null,minutes:30}];
 const activityRecords=[{user_id:'athlete',plan_id:'plan-1',session_id:'second',status:'feito',km:null,minutes:20,effort:0,pain:0,notes:'Relato',updated_at:'2030-01-21T12:00:00Z'}];
 const h=await harness({calendarSessions,activityRecords,now:'2030-01-22T12:00:00'}),d=h.w.document;
 const select=async week=>{const el=d.querySelector('#progressWeek');el.value=week;el.dispatchEvent(new h.w.Event('change',{bubbles:true}));await tick();};
 try{
  await h.click('[data-view=progress]');const calls=h.calls.length;
  await select('2030-01-21');assert.equal(d.activeElement.id,'progressWeek');assert.equal(h.calls.length,calls);
  assert.equal(d.querySelector('.progress-actual .progress-value').textContent,'Não informado');assert.match(d.querySelector('.progress-pace .progress-actual').textContent,/Indisponível/);
  await h.click('[data-record=second]');const form=d.querySelector('#recordForm');assert.equal(form.elements.effort.value,'0');form.elements.notes.value='Novo relato';
  await select('2030-01-14');assert.equal(d.querySelector('#progressWeek').value,'2030-01-21');assert.equal(d.querySelector('#activityDiscard').hidden,false);assert.equal(form.elements.notes.value,'Novo relato');
  await h.click('#keepActivity');await h.submit('#recordForm');assert.equal(h.rows[0].notes,'Novo relato');assert.equal(d.querySelector('#progressWeek').value,'2030-01-21');
  await h.click('[data-progress-week="2030-01-14"]');assert.equal(d.activeElement.id,'progressPeriod');assert.equal(d.querySelectorAll('[data-record]').length,0);
  await h.click('[data-view=calendar]');await h.click('[data-view=progress]');assert.equal(d.querySelector('#progressWeek').value,'2030-01-14');
 }finally{await h.w.happyDOM.close();}
});

test('progress week and records remain separate for archived versions and switching plans preserves each selection',async()=>{
 const calendarSessions=[{id:'same',date:'2030-01-14',type:'Corrida',km:4,minutes:24},{id:'other',date:'2030-01-21',type:'Força',minutes:30}];
 const h=await harness({calendarSessions,history:true,activityRecords:[{user_id:'athlete',plan_id:'plan-1',session_id:'same',status:'feito',km:4,minutes:24}],now:'2030-01-22T12:00:00'}),d=h.w.document;
 const change=async(id,value)=>{const el=d.querySelector(id);el.value=value;el.dispatchEvent(new h.w.Event('change',{bubbles:true}));await tick();};
 try{
  await h.click('[data-view=progress]');assert.equal(d.querySelectorAll('[data-record]').length,1);
  await change('#progressWeek','2030-01-21');await change('#planSelect','old');
  assert.equal(d.querySelector('#progressWeek').value,'2030-01-14');assert.equal(d.querySelectorAll('[data-record]').length,0);
  assert.match(d.querySelector('.progress-actual dd').textContent,/Não informado/);
  await change('#planSelect','plan-1');assert.equal(d.querySelector('#progressWeek').value,'2030-01-21');
 }finally{await h.w.happyDOM.close();}
});

test('athlete records each strength set, reopens exact zeros and exports the hybrid plan without credentials',async()=>{
 const strength=[{id:'ex-1',name:'Exercício de teste',sets:2,reps:10,load_kg:20,notes:'Orientação'}];
 const h=await harness({calendarSessions:[{id:'run',date:'2030-01-15',type:'Corrida',km:5,minutes:30},{id:'force',date:'2030-01-15',type:'Musculação',minutes:30,strength}],now:'2030-01-15T12:00:00'}),d=h.w.document;
 try{
  assert.equal(d.querySelectorAll('.training-session').length,2);assert.match(d.querySelector('.strength-prescription').textContent,/Exercício de teste/);
  await h.click('[data-record=force]');const form=d.querySelector('#recordForm');assert.equal(d.querySelector('[data-strength-actual=reps]').value,'');assert.equal(d.querySelector('#activityDistance').hidden,true);
  await h.click('[data-activity-status=adaptado]');for(const field of ['reps','load_kg']){const el=d.querySelector('[data-strength-actual='+field+']');el.value='0';el.dispatchEvent(new h.w.Event('input',{bubbles:true}));}form.elements.minutes.value='30';await h.submit('#recordForm');
  assert.deepEqual(h.rows[0].strength[0].sets,[{reps:0,load_kg:0},{reps:null,load_kg:null}]);await h.click('[data-record=force]');assert.equal(d.querySelector('[data-strength-actual=reps]').value,'0');await h.click('[data-close=recordDialog]');
  await h.click('[data-view=progress]');assert.match(d.querySelector('.strength-reported').textContent,/0 rep · 0 kg/);assert.match(d.querySelector('.progress-pace .progress-actual').textContent,/Indisponível/);
  await h.click('#export');const data=JSON.parse(await h.blobs[0].text());assert.equal(data.plans[0].sessions[1].strength[0].load_kg,20);assert.equal(data.records[0].strength[0].sets[0].load_kg,0);assert.ok(!JSON.stringify(data).includes('access_token'));assert.ok(!JSON.stringify(data).includes('user_id'));
 }finally{await h.w.happyDOM.close();}
});
