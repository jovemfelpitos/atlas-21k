import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {readFileSync} from 'node:fs';
import {createAuthPage} from '../auth-page.js';
import {createAuthClient,safeNext} from '../auth-client.js';

const html=readFileSync(new URL('../auth.html',import.meta.url),'utf8').replace(/<script[\s\S]*?<\/script>/g,'');
const tick=()=>new Promise(r=>setTimeout(r,20));

test('partial email-change confirmation asks for both inboxes without accepting an unvalidated session',async()=>{
 const h=await harness('/confirmar-email?flow=email-change&next=%2Fapp%3Fview%3Dprofile');
 try{assert.match(h.w.document.querySelector('#authTitle').textContent,/dois endereços/);assert.equal(h.client.session,null);assert.equal(h.destinations.length,0);assert.equal(h.w.document.querySelector('#accessForm'),null);}finally{await h.close();}
});
async function harness(route='/entrar',callback={}){
 const w=new Window({url:'http://127.0.0.1:4173'+route});w.document.write(html);w.ATLAS_CONFIG={supabaseUrl:'https://example.supabase.co',supabaseKey:'sb_publishable_test'};
 const calls=[],destinations=[];let fail=null;
 const user={id:'account',email:'person@example.com',user_metadata:{account_type:'coach'}},session={access_token:'access',refresh_token:'refresh',expires_in:3600,user};
 const fetch=async(url,options)=>{const body=options.body?JSON.parse(options.body):null;calls.push({url,body,options});if(fail&&url.includes(fail.path))return new Response(JSON.stringify({error_code:fail.code,message:'Falha simulada'}),{status:fail.status});let result={};if(url.includes('grant_type=password')||url.includes('grant_type=refresh_token'))result=session;else if(url.includes('/signup'))result={user};else if(url.includes('/auth/v1/user'))result=user;else if(url.includes('/verify'))result=session;else if(url.includes('complete_onboarding'))result={areas:['athlete','coach']};return new Response(JSON.stringify(result));};
 const client=createAuthClient(w.ATLAS_CONFIG,{storage:w.localStorage,fetch});await createAuthPage({window:w,client,navigate:url=>destinations.push(url),...callback});
 return {w,client,calls,destinations,set fail(value){fail=value;},async submit(){w.document.querySelector('#accessForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();},async close(){await w.happyDOM.close();}};
}

test('signup has dedicated fields, validates repeated password and sends only necessary account data',async()=>{
 const h=await harness('/criar-conta?tipo=treinador'),d=h.w.document;
 try{
  const f=d.querySelector('#accessForm');f.elements.name.value='  Érica  ';f.elements.email.value='person@example.com';f.elements.password.value='long-password';f.elements.passwordConfirm.value='different';await h.submit();assert.equal(h.calls.length,0);assert.match(f.elements.passwordConfirm.validationMessage,/iguais/);
  f.elements.passwordConfirm.value='long-password';await h.submit();const call=h.calls.find(c=>c.url.includes('/signup'));assert.deepEqual(call.body,{email:'person@example.com',password:'long-password',data:{full_name:'Érica',account_type:'coach'}});assert.match(call.url,/redirect_to=/);assert.equal(h.destinations[0],'/verifique-seu-email');
  assert.equal(h.w.localStorage.getItem('atlas-session'),null);assert.ok(!h.w.sessionStorage.getItem('atlas-auth-pending').includes('long-password'));assert.equal(f.elements.password.value,'');
 }finally{await h.close();}
});

test('login saves one session, applies limited onboarding and refuses external return targets',async()=>{
 const h=await harness('/entrar?next=https%3A%2F%2Fevil.example%2F'),d=h.w.document;
 try{const f=d.querySelector('#accessForm');f.elements.email.value='person@example.com';f.elements.password.value='long-password';await h.submit();assert.equal(h.destinations[0],'/app');assert.equal(JSON.parse(h.w.localStorage.getItem('atlas-session')).user.id,'account');assert.deepEqual(h.calls.find(c=>c.url.includes('complete_onboarding')).body,{initial_area:'coach'});assert.equal(f.elements.password.value,'');}finally{await h.close();}
 assert.equal(safeNext('//evil.example/app'),'/app');assert.equal(safeNext('/app?view=calendar'),'/app?view=calendar');assert.equal(safeNext('/app?next=https://evil.example'),'/app');
});

test('password recovery uses a neutral accepted response and never claims success on service failure',async()=>{
 const h=await harness('/recuperar-senha'),d=h.w.document;
 try{d.querySelector('#email').value='person@example.com';h.fail={path:'/recover',code:'unexpected_failure',status:500};await h.submit();assert.equal(d.querySelector('#authStatus').textContent,'');assert.match(d.querySelector('#authError').textContent,/Não foi possível/);assert.equal(d.querySelector('#email').value,'person@example.com');h.fail=null;await h.submit();assert.match(d.querySelector('#authStatus').textContent,/Se houver uma conta/);assert.match(h.calls.find(c=>c.url.includes('/recover')).url,/redefinir-senha/);}finally{await h.close();}
});

test('confirmation links are validated before onboarding; name and area stay server-bound',async()=>{
 const h=await harness('/confirmar-email#access_token=access&refresh_token=refresh&expires_in=3600&type=signup');
 try{assert.equal(h.w.location.hash,'');assert.equal(h.destinations[0],'/app');assert.ok(h.calls.some(c=>c.url.includes('/auth/v1/user')));assert.ok(h.calls.some(c=>c.url.includes('complete_onboarding')));}finally{await h.close();}
});

test('recovery credentials remain in memory and only update the verified account password',async()=>{
 const h=await harness('/redefinir-senha#access_token=recovery&refresh_token=refresh&expires_in=3600&type=recovery'),d=h.w.document;
 try{assert.equal(h.w.location.hash,'');assert.equal(h.w.localStorage.getItem('atlas-session'),null);const f=d.querySelector('#accessForm');f.elements.password.value='new-long-password';f.elements.passwordConfirm.value='new-long-password';await h.submit();const update=h.calls.find(c=>c.options.method==='PUT');assert.deepEqual(update.body,{password:'new-long-password'});assert.equal(update.options.headers.Authorization,'Bearer recovery');assert.equal(h.w.localStorage.getItem('atlas-session'),null);assert.match(d.querySelector('#authTitle').textContent,/Senha atualizada/);}finally{await h.close();}
});

test('wrong-purpose and expired recovery links do not expose a password form or normal app session',async()=>{
 const h=await harness('/redefinir-senha#access_token=normal&refresh_token=r&expires_in=3600&type=signup');
 try{assert.equal(h.w.document.querySelector('#accessForm'),null);assert.match(h.w.document.querySelector('#authError').textContent,/não é de recuperação/);assert.equal(h.calls.length,0);assert.equal(h.w.localStorage.getItem('atlas-session'),null);}finally{await h.close();}
 const expired=await harness('/redefinir-senha#error=access_denied&error_description=Link+expirado&type=recovery');try{assert.equal(expired.w.document.querySelector('#accessForm'),null);assert.match(expired.w.document.querySelector('#authError').textContent,/expirado/);}finally{await expired.close();}
});

test('resend protects repeated clicks and keeps the email when rate-limited',async()=>{
 const h=await harness('/verifique-seu-email'),d=h.w.document;
 try{d.querySelector('#email').value='person@example.com';h.fail={path:'/resend',code:'over_email_send_rate_limit',status:429};await h.submit();assert.match(d.querySelector('#authError').textContent,/Aguarde/);h.fail=null;await h.submit();await h.submit();assert.equal(h.calls.filter(c=>c.url.includes('/resend')).length,2);assert.match(d.querySelector('#authStatus').textContent,/Aguarde um minuto/);}finally{await h.close();}
});
