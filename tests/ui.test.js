import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parsePlan} from '../importer.js';
import {consumeAuthCallback} from '../auth-callback.js';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(/<script[\s\S]*?<\/script>/g,'');
const tick=()=>new Promise(r=>setTimeout(r,20));
async function harness({admin=false,loggedIn=true}={}){
 const w=new Window({url:'http://localhost/'});w.document.write(html);w.ATLAS_CONFIG={supabaseUrl:'https://example.supabase.co',supabaseKey:'sb_publishable_test'};
 const id=admin?'admin':'athlete',profile={user_id:id,name:admin?'Admin':'Atleta',available_days:[2,4],is_admin:admin};
 const doc=parsePlan(readFileSync(new URL('../modelo-plano.csv',import.meta.url),'utf8'));
 const plan={...doc,id:'plan-1',user_id:id,atlas_sessions:doc.sessions};let rows=[],fail=false,imported=0;
 if(loggedIn)w.localStorage.setItem('atlas-session',JSON.stringify({access_token:'test',expires_at:Date.now()/1000+3600,user:{id}}));
 const blobs=[];w.URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:http://localhost/test';};w.URL.revokeObjectURL=()=>{};
 const calls=[];
 w.fetch=async(url,options)=>{calls.push({url,options});let data=[];
 if(url.includes('/auth/v1/signup'))data={user:{id}};
 else if(url.includes('/auth/v1/token'))data={access_token:'test',expires_in:3600,user:{id}};
 else if(url.includes('atlas_admins'))data=admin?[{user_id:id}]:[];
 else if(url.includes('atlas_profiles'))data=admin?[profile,{user_id:'athlete',name:'Atleta',is_admin:false}]:[profile];
 else if(url.includes('atlas_plans'))data=[plan];
 else if(url.includes('atlas_activity_records')){if(options.method==='POST'){if(fail)return new Response(JSON.stringify({message:'Falha de rede simulada'}),{status:503});rows=[JSON.parse(options.body)];}data=rows;}
 else if(url.includes('atlas_import_plan')){imported++;data='plan-2';}
 return new Response(JSON.stringify(data));};
 const context=vm.createContext({window:w,document:w.document,localStorage:w.localStorage,fetch:w.fetch,FormData:w.FormData,Blob:w.Blob,URL:w.URL,navigator:w.navigator,parsePlan,consumeAuthCallback,console,setTimeout,clearTimeout});
 vm.runInContext(source,context);await tick();
 return {w,calls,blobs,get rows(){return rows;},get imported(){return imported;},set fail(v){fail=v;},async click(sel){w.document.querySelector(sel).click();await tick();},async submit(sel){w.document.querySelector(sel).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();}};
}
test('athlete form keeps failed fields, saves and edits exact session, exports no auth data',async()=>{
 const h=await harness(),d=h.w.document;await h.click('[data-view=calendar]');assert.equal(d.querySelectorAll('[data-record]').length,2);
 await h.click('[data-record="sessao-001"]');const f=d.querySelector('#recordForm');f.elements.km.value='3.25';f.elements.minutes.value='25';f.elements.notes.value='Teste';h.fail=true;await h.submit('#recordForm');assert.match(d.querySelector('#saveError').textContent,/campos foram mantidos/);assert.equal(f.elements.notes.value,'Teste');assert.equal(h.rows.length,0);
 h.fail=false;await h.submit('#recordForm');assert.equal(h.rows[0].session_id,'sessao-001');assert.equal(h.rows[0].plan_id,'plan-1');assert.equal(h.rows[0].user_id,'athlete');
 await h.click('[data-record="sessao-001"]');assert.equal(f.elements.km.value,'3.25');f.elements.recovery.value='Normal';await h.submit('#recordForm');assert.equal(h.rows[0].recovery,'Normal');
 await h.click('[data-view=progress]');assert.match(d.querySelector('#content').textContent,/3.3/);assert.equal(d.querySelectorAll('[data-record]').length,1);
 await h.click('#export');const exported=JSON.parse(await h.blobs[0].text());assert.equal(exported.plans.length,1);assert.equal(exported.records.length,1);assert.equal(exported.plans[0].guide.length,1);assert.ok(!JSON.stringify(exported).includes('user_id'));assert.ok(!JSON.stringify(exported).includes('access_token'));
 await h.click('[data-view=profile]');await h.submit('#profileForm');assert.match(d.querySelector('#profileError').textContent,/salvo/);
 assert.ok(h.calls.some(c=>c.options.method==='PATCH'));await h.w.happyDOM.close();
});
test('signup confirmation, password sign-in and logout with simulated Auth responses',async()=>{
 const h=await harness({loggedIn:false}),d=h.w.document;await h.click('#account');const f=d.querySelector('#authForm');f.elements.email.value='teste@example.com';f.elements.password.value='senha-de-teste';await h.click('#signup');assert.match(d.querySelector('#authError').textContent,/Confirme/);assert.equal(h.w.localStorage.getItem('atlas-session'),null);
 await h.submit('#authForm');assert.match(d.querySelector('#notice').textContent,/sincronizados/);assert.equal(d.querySelector('#sync').hidden,false);await h.click('#account');assert.equal(h.w.localStorage.getItem('atlas-session'),null);assert.equal(d.querySelector('#sync').hidden,true);assert.match(d.querySelector('#content').textContent,/crie sua conta/);await h.w.happyDOM.close();
});
test('admin sees only administration and must choose athlete before import',async()=>{
 const h=await harness({admin:true}),d=h.w.document;assert.equal(d.querySelector('nav').hidden,true);assert.match(d.querySelector('#content').textContent,/Importar um plano/);assert.equal(d.querySelector('#athlete').value,'');assert.equal(d.querySelectorAll('[data-record]').length,0);
 // Exercise file selection using a synthetic local file, not a real Supabase request.
 const file=new h.w.File([readFileSync(new URL('../modelo-plano.csv',import.meta.url),'utf8')],'model.csv');
 Object.defineProperty(d.querySelector('#importFile'),'files',{value:[file]});d.querySelector('#importFile').dispatchEvent(new h.w.Event('change',{bubbles:true}));await tick();
 assert.match(d.querySelector('#preview').textContent,/Guia completo/);assert.match(d.querySelector('#preview').textContent,/sessao-002/);
 await h.click('#confirmImport');assert.equal(h.imported,0);d.querySelector('#athlete').value='athlete';await h.click('#confirmImport');assert.equal(h.imported,1);assert.match(d.querySelector('#preview').textContent,/sucesso/);await h.w.happyDOM.close();
});
