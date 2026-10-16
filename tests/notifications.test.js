import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Window} from 'happy-dom';
import {createNotificationSettings,notificationPreferences,notificationView,notificationTarget} from '../notifications.js';

const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const user=id=>({user:{id}});
function client({enabled=true,permission='default',prefs=[],role='athlete',supported=true,iphone=false,existing=false}={}){
 const w=new Window({url:'https://atlas.example/app?view=profile'});w.document.write('<main><input id="draft" value="relato ainda não salvo"><div id="alerts"></div></main>');
 let session=user('athlete-a'),fetchIntercept=null,requestIntercept=null,permissionResult='granted',sub=null,registered=existing,workerOK=true,workerBinding=existing?'athlete-a':null;
 const calls=[],fetches=[],workerMessages=[],registrations=[],subscriptions=[],unsubscribed=[];
 let permissionRequests=0;
 Object.defineProperty(w,'isSecureContext',{value:true,configurable:true});
 if(iphone){Object.defineProperty(w.navigator,'userAgent',{value:'iPhone',configurable:true});Object.defineProperty(w.navigator,'standalone',{value:false,configurable:true});}
 w.Notification={permission,requestPermission(){permissionRequests++;return Promise.resolve(permissionResult).then(value=>{w.Notification.permission=value;return value;});}};
 w.PushManager=class {};
 w.MessageChannel=class {constructor(){this.port1={onmessage:null,close(){}};this.port2={postMessage:data=>queueMicrotask(()=>this.port1.onmessage?.({data}))};}};
 const makeSubscription=()=>{const value={endpoint:'https://push.example/subscription',toJSON(){return {endpoint:this.endpoint,keys:{p256dh:'public-device-key',auth:'device-auth'}};},async unsubscribe(){unsubscribed.push(value);if(sub===value)sub=null;return true;}};return value;};
 const registration={active:{scriptURL:'https://atlas.example/notifications-sw.js',async postMessage(message,ports){workerMessages.push(message);if(workerOK&&message.type==='atlas-bind-notifications')workerBinding=message.user_id;if(workerOK&&message.type==='atlas-clear-notifications'&&(workerBinding===message.user_id||!workerBinding&&message.allow_unbound)){workerBinding=null;if(message.unsubscribe&&(!message.endpoint||sub?.endpoint===message.endpoint))await sub?.unsubscribe();}ports[0].postMessage({ok:workerOK,user_id:workerBinding});}},pushManager:{async getSubscription(){return sub;},async subscribe(options){subscriptions.push(options);sub=makeSubscription();return sub;}}};
 if(existing)sub=makeSubscription();
 const serviceWorker={async getRegistration(){return registered?registration:undefined;},async register(path,options){registrations.push({path,options});registered=true;return registration;},ready:Promise.resolve(registration)};
 Object.defineProperty(w.navigator,'serviceWorker',{value:supported?serviceWorker:undefined,configurable:true});
 w.fetch=async(path,options)=>{fetches.push({path,options});if(fetchIntercept)return fetchIntercept(path,options);return new Response(JSON.stringify({enabled,publicKey:'A'.repeat(87)}));};
 const request=async(path,options={})=>{const body=options.body?JSON.parse(options.body):null;calls.push({path,options,body,user:session?.user?.id});if(requestIntercept){const value=await requestIntercept(path,options,body);if(value!==undefined)return value;}return options.method==='POST'?[body]:prefs;};
 const settings=createNotificationSettings({window:w,request,getSession:()=>session,getRole:()=>role});
 settings.mount(w.document.querySelector('#alerts'));
 return {w,settings,calls,fetches,workerMessages,registrations,subscriptions,unsubscribed,registration,get permissionRequests(){return permissionRequests;},set permissionResult(value){permissionResult=value;},set session(value){session=value;},set requestIntercept(value){requestIntercept=value;},set fetchIntercept(value){fetchIntercept=value;},set workerOK(value){workerOK=value;},async click(selector){w.document.querySelector(selector).click();await tick();},async change(name,value){const input=w.document.querySelector(`[name="${name}"]`);if(input.type==='checkbox')input.checked=value;else input.value=value;input.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();},remount(){settings.mount(w.document.querySelector('#alerts'));},async close(){settings.detach();await w.happyDOM.close();}};
}

test('notification preferences accept only editable values and notification links stay inside the app',()=>{
 const prefs=notificationPreferences({user_id:'someone-else',enabled:'true',workout_reminders:true,coach_digest:false,reminder_time:'08:15:00',time_zone:'America/Manaus',access_token:'secret'});
 assert.equal(prefs.enabled,false);assert.equal(prefs.workout_reminders,true);assert.equal(prefs.reminder_time,'08:15');assert.equal(prefs.time_zone,'America/Manaus');assert.equal('user_id' in prefs,false);assert.equal('access_token' in prefs,false);
 assert.equal(notificationView('/app?view=calendar'),'calendar');
 assert.deepEqual(notificationTarget('/app?view=calendar&area=athlete'),{view:'calendar',area:'athlete'});
 assert.deepEqual(notificationTarget('/app?view=progress&area=coach'),{view:'progress',area:'coach'});
 for(const path of ['https://evil.example/app?view=profile','//evil.example/app?view=profile','/entrar?view=profile','/app?view=admin','/app?view=calendar&area=coach','/app?view=progress&area=admin','/app?view=progress&area=coach&area=athlete','javascript:alert(1)'])assert.equal(notificationView(path),null);
});

test('unconfigured delivery does not request browser permission, register a worker or read private preferences',async()=>{
 const h=client({enabled:false});try{await tick();assert.equal(h.permissionRequests,0);assert.equal(h.registrations.length,0);assert.equal(h.calls.length,0);assert.equal(h.w.document.querySelector('[data-notification-enable]').disabled,true);assert.match(h.w.document.querySelector('[data-notification-status]').textContent,/ainda não foi configurado/);}finally{await h.close();}
});

test('mounting reads only the current account, while only the explicit activation click asks for permission',async()=>{
 const h=client({prefs:[{user_id:'other',enabled:true,workout_reminders:true},{user_id:'athlete-a',enabled:false,coach_comments:true}]});try{
  await tick();assert.equal(h.permissionRequests,0);assert.equal(h.registrations.length,0);assert.match(h.calls[0].path,/user_id=eq\.athlete-a$/);assert.equal(h.w.document.querySelector('[name=enabled]').checked,false);assert.equal(h.w.document.querySelector('[name=coach_comments]').checked,true);assert.equal(h.w.document.querySelector('[name=workout_reminders]').checked,false);
  await h.click('[data-notification-enable]');assert.equal(h.permissionRequests,1);assert.deepEqual(h.registrations,[{path:'/notifications-sw.js',options:{scope:'/'}}]);assert.equal(h.subscriptions[0].userVisibleOnly,true);assert.equal(h.subscriptions[0].applicationServerKey.length,65);assert.deepEqual(h.workerMessages,[{type:'atlas-bind-notifications',user_id:'athlete-a',endpoint:'https://push.example/subscription'}]);assert.equal(h.calls.filter(call=>call.path.endsWith('/atlas_save_push_subscription')).length,1);assert.equal(h.w.document.querySelector('[data-notification-disable]').hidden,false);assert.equal(h.w.document.querySelector('#draft').value,'relato ainda não salvo');assert.equal(h.w.location.pathname,'/app');
 }finally{await h.close();}
});

test('iPhone outside the Home Screen explains installation without opening a permission prompt',async()=>{
 const h=client({iphone:true});try{await tick();assert.equal(h.w.document.querySelector('[data-notification-enable]').disabled,true);assert.match(h.w.document.querySelector('[data-device-state]').textContent,/Tela de Início/);await h.click('[data-notification-enable]');assert.equal(h.permissionRequests,0);assert.equal(h.subscriptions.length,0);}finally{await h.close();}
});

test('denied activation and a failed subscription save leave recoverable controls without a bound device',async()=>{
 const denied=client();try{await tick();denied.permissionResult='denied';await denied.click('[data-notification-enable]');assert.equal(denied.registrations.length,0);assert.equal(denied.settings.busy,false);assert.match(denied.w.document.querySelector('[data-notification-status]').textContent,/Permissão não concedida/);}finally{await denied.close();}
 const failed=client();try{await tick();failed.requestIntercept=async path=>{if(path.endsWith('/atlas_save_push_subscription'))throw Error('Sem conexão');};await failed.click('[data-notification-enable]');assert.equal(failed.unsubscribed.length,1);assert.equal(failed.workerMessages.at(-1).unsubscribe,true);assert.equal(failed.calls.filter(call=>call.path.endsWith('/atlas_remove_push_subscription')).length,1);assert.equal(failed.settings.busy,false);assert.equal(failed.w.document.querySelector('[data-notification-enable]').disabled,false);assert.match(failed.w.document.querySelector('[data-notification-status]').textContent,/Sem conexão/);}finally{await failed.close();}
});

test('automatic preference saving includes only this account and restores the previous values after failure',async()=>{
 const h=client({role:'coach',prefs:[{user_id:'athlete-a',enabled:true,coach_digest:true,reminder_time:'06:30',time_zone:'America/Manaus'}]});try{
  await tick();assert.equal(h.w.document.querySelector('[name=coach_digest]').checked,true);await h.change('workout_reminders',true);const saved=h.calls.find(call=>call.options.method==='POST');assert.equal(saved.body.user_id,'athlete-a');assert.equal(saved.body.workout_reminders,true);assert.equal(saved.body.reminder_time,'06:30');assert.equal(saved.body.time_zone,'America/Manaus');assert.equal('access_token' in saved.body,false);
  h.requestIntercept=async(path,options)=>{if(options.method==='POST')throw Error('Offline');};await h.change('enabled',false);assert.equal(h.w.document.querySelector('[name=enabled]').checked,true);assert.match(h.w.document.querySelector('[data-notification-status]').textContent,/preferências anteriores/);assert.equal(h.settings.busy,false);
 }finally{await h.close();}
});

test('a late preference response cannot replace the next account after remount',async()=>{
 const h=client();try{await tick();const old=deferred();h.requestIntercept=async(path,options)=>{if(!options.method&&path.endsWith('athlete-a'))return old.promise;if(!options.method&&path.endsWith('athlete-b'))return [{user_id:'athlete-b',enabled:false,coach_comments:true}];};h.remount();await tick();h.session=user('athlete-b');h.remount();await tick();old.resolve([{user_id:'athlete-a',enabled:true,workout_reminders:true}]);await tick();assert.equal(h.w.document.querySelector('[name=enabled]').checked,false);assert.equal(h.w.document.querySelector('[name=coach_comments]').checked,true);assert.equal(h.w.document.querySelector('[name=workout_reminders]').checked,false);assert.equal(h.settings.busy,false);}finally{await h.close();}
});

test('switching account while permission is pending never subscribes the previous account',async()=>{
 const h=client();try{await tick();const permission=deferred();h.permissionResult=permission.promise;h.w.document.querySelector('[data-notification-enable]').click();assert.equal(h.permissionRequests,1);assert.equal(h.settings.busy,true);h.session=user('athlete-b');h.remount();permission.resolve('granted');await tick();assert.equal(h.subscriptions.length,0);assert.equal(h.workerMessages.length,0);assert.equal(h.calls.some(call=>call.path.endsWith('/atlas_save_push_subscription')),false);assert.equal(h.settings.busy,false);}finally{await h.close();}
});

test('worker failure removes the backend subscription without blindly retiring another owner, and disabling clears its binding',async()=>{
 const failed=client();try{await tick();failed.workerOK=false;await failed.click('[data-notification-enable]');assert.equal(failed.unsubscribed.length,0);assert.ok(failed.calls.some(call=>call.path.endsWith('/atlas_remove_push_subscription')));assert.equal(failed.w.document.querySelector('[data-notification-disable]').hidden,true);assert.match(failed.w.document.querySelector('[data-notification-status]').textContent,/confirmar a configuração/);}finally{await failed.close();}
 const h=client({existing:true,permission:'granted'});try{await tick();await h.click('[data-notification-disable]');assert.deepEqual(h.workerMessages.filter(message=>message.type==='atlas-clear-notifications'),[{type:'atlas-clear-notifications',user_id:'athlete-a',endpoint:'https://push.example/subscription',unsubscribe:true}]);assert.equal(h.unsubscribed.length,1);assert.equal(h.w.document.querySelector('[data-notification-enable]').hidden,false);assert.equal(h.w.document.querySelector('[data-notification-disable]').hidden,true);assert.equal(h.calls.find(call=>call.path.endsWith('/atlas_remove_push_subscription')).body.p_endpoint,'https://push.example/subscription');}finally{await h.close();}
});

test('queued logout cleanup completes before the new account reads or activates this device',async()=>{
 const h=client({existing:true,permission:'granted'});try{
  await tick();const post=h.registration.active.postMessage;let releaseClear;
  h.registration.active.postMessage=(message,ports)=>{if(message.type==='atlas-clear-notifications')releaseClear=()=>post(message,ports);else post(message,ports);};
  const reset=h.settings.resetDevice('athlete-a');await tick();assert.equal(typeof releaseClear,'function');h.session=user('athlete-b');h.remount();await tick();releaseClear();await reset;await tick();
  assert.equal(h.w.document.querySelector('[data-notification-enable]').hidden,false);assert.equal(h.w.document.querySelector('[data-notification-disable]').hidden,true);await h.click('[data-notification-enable]');assert.equal(h.subscriptions.length,1);assert.equal(h.unsubscribed.length,1);assert.equal(h.workerMessages.filter(message=>message.type==='atlas-bind-notifications').at(-1).user_id,'athlete-b');assert.equal(h.w.document.querySelector('[data-notification-disable]').hidden,false);
 }finally{await h.close();}
});

test('a late subscription save finishes before logout cleanup and cannot bind or unsubscribe the next account',async()=>{
 const h=client({permission:'granted'});try{
  await tick();const pending=deferred();h.requestIntercept=async(path,options)=>{if(path.endsWith('/atlas_save_push_subscription')&&h.calls.at(-1).user==='athlete-a')return pending.promise;};h.w.document.querySelector('[data-notification-enable]').click();await tick();assert.equal(h.subscriptions.length,1);
  const reset=h.settings.resetDevice('athlete-a');h.session=user('athlete-b');h.remount();pending.resolve(null);await reset;await tick();await h.click('[data-notification-enable]');assert.equal(h.subscriptions.length,2);assert.equal(h.unsubscribed.length,1);assert.deepEqual(h.workerMessages.filter(message=>message.type==='atlas-bind-notifications'),[{type:'atlas-bind-notifications',user_id:'athlete-b',endpoint:'https://push.example/subscription'}]);assert.equal(h.w.document.querySelector('[data-notification-disable]').hidden,false);
 }finally{await h.close();}
});

test('a subscription bound to another account is not shown as active and identity checking clears it without prompting',async()=>{
 const h=client({existing:true,permission:'granted'});try{await tick();h.session=user('athlete-b');h.remount();await tick();assert.equal(h.w.document.querySelector('[data-notification-enable]').hidden,false);assert.equal(h.w.document.querySelector('[data-notification-disable]').hidden,true);await h.settings.checkDeviceIdentity();assert.equal(h.unsubscribed.length,1);assert.equal(h.permissionRequests,0);assert.equal(h.registrations.length,0);assert.deepEqual(h.workerMessages.filter(message=>message.type==='atlas-clear-notifications'),[{type:'atlas-clear-notifications',user_id:'athlete-a',unsubscribe:true}]);assert.equal(h.calls.some(call=>call.options.method),false);}finally{await h.close();}
});

function worker(){
 let binding;const handlers=new Map(),shown=[],opened=[],messages=[],closed=[],navigated=[],retired=[];let windows=[],notifications=[],beforeShow=null;
 let subscription={endpoint:'https://push.example/subscription',async unsubscribe(){retired.push(this.endpoint);subscription=null;}};
 const indexedDB={open(){const request={};queueMicrotask(()=>{request.result={createObjectStore(){},close(){},transaction(){const tx={objectStore(){return {get(){const read={};queueMicrotask(()=>{read.result=binding;read.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.());});return read;},put(value){binding=structuredClone(value);},delete(){binding=undefined;}};}};return tx;}};request.onsuccess?.();});return request;}};
 const self={location:{origin:'https://atlas.example'},addEventListener(name,callback){handlers.set(name,callback);},async skipWaiting(){},registration:{pushManager:{async getSubscription(){return subscription;}},async showNotification(title,options){await beforeShow?.(title,options);shown.push({title,options});},async getNotifications(){return notifications;}},clients:{async claim(){},async matchAll(){return windows;},async openWindow(url){opened.push(url);}}};
 vm.runInNewContext(readFileSync(new URL('../notifications-sw.js',import.meta.url),'utf8'),{self,indexedDB,URL,console});
 const dispatch=async(name,event)=>{const pending=[];handlers.get(name)({...event,waitUntil(promise){pending.push(promise);}});await Promise.all(pending);};
 return {shown,opened,messages,closed,navigated,handlers,retired,get binding(){return binding;},set beforeShow(value){beforeShow=value;},get subscription(){return subscription;},set subscription(value){subscription=value;},set notifications(value){notifications=value;},set windows(value){windows=value;},async message(data,url='https://atlas.example/app'){const replies=[];await dispatch('message',{source:{url},data,ports:[{postMessage:value=>replies.push(value)}]});return replies[0];},async bind(user_id){const replies=[];await dispatch('message',{source:{url:'https://atlas.example/app'},data:{type:'atlas-bind-notifications',user_id,endpoint:subscription?.endpoint},ports:[{postMessage:value=>replies.push(value)}]});assert.equal(replies[0]?.ok,true);},async clear(user_id,options={}){await dispatch('message',{source:{url:'https://atlas.example/app'},data:{type:'atlas-clear-notifications',user_id,...options},ports:[{postMessage(){}}]});},async push(payload){await dispatch('push',{data:{json(){return payload;}}});},async click(data){await dispatch('notificationclick',{notification:{data,close(){closed.push(data);}}});},client(url='https://atlas.example/app'){return {url,async focus(){return this;},navigate(url){navigated.push(url);},postMessage(message){messages.push(message);}};}};
}

test('worker binding queries are read-only and foreign pages cannot bind or read a device owner',async()=>{
 const h=worker();await h.bind('athlete-a');const before=await h.message({type:'atlas-notification-binding'});assert.equal(before.ok,true);assert.equal(before.user_id,'athlete-a');assert.equal(h.binding.user_id,'athlete-a');assert.equal(await h.message({type:'atlas-bind-notifications',user_id:'attacker'},'https://evil.example/app'),undefined);assert.equal(await h.message({type:'atlas-notification-binding'},'https://evil.example/app'),undefined);assert.equal(h.binding.user_id,'athlete-a');await h.clear('athlete-a');assert.equal((await h.message({type:'atlas-notification-binding'})).user_id,null);
});

test('worker ignores old-account and foreign-link pushes and keeps locked-screen contents generic',async()=>{
 const h=worker();assert.equal(h.handlers.has('fetch'),false);await h.bind('athlete-a');await h.push({kind:'plan_update',user_id:'athlete-b',url:'/app?view=calendar'});await h.push({kind:'plan_update',user_id:'athlete-a',url:'https://evil.example/app?view=calendar'});assert.equal(h.shown.length,0);
 await h.push({kind:'plan_update',user_id:'athlete-a',url:'/app?view=calendar',title:'Nome privado',body:'Dor 8/10 e relato privado',tag:'t'.repeat(150)});assert.equal(h.shown.length,1);assert.equal(h.shown[0].title,'Atlas Run');assert.equal(h.shown[0].options.body,'Um novo plano está disponível.');assert.equal(h.shown[0].options.tag.length,100);assert.equal(JSON.stringify(h.shown).includes('Dor 8/10'),false);
 await h.bind('athlete-b');await h.push({kind:'plan_update',user_id:'athlete-a',url:'/app?view=calendar'});assert.equal(h.shown.length,1);
});

test('notification clicks focus and message an existing app without navigating away from an unsaved form',async()=>{
 const h=worker();await h.bind('athlete-a');h.windows=[h.client('https://foreign.example/app'),h.client('https://atlas.example/app?view=profile')];await h.click({user_id:'athlete-a',url:'/app?view=calendar'});assert.equal(h.navigated.length,0);assert.equal(h.opened.length,0);assert.equal(h.messages.length,1);assert.equal(h.messages[0].type,'atlas-notification-open');assert.equal(h.messages[0].user_id,'athlete-a');assert.equal(h.messages[0].url,'/app?view=calendar&area=athlete');
 await h.bind('athlete-b');await h.click({user_id:'athlete-a',url:'/app?view=calendar'});assert.equal(h.messages.length,1);
});

test('a notification opens only the approved app view when no app window is available',async()=>{
 const h=worker();await h.bind('athlete-a');await h.click({user_id:'athlete-a',url:'/app?view=profile&token_hash=untrusted&next=https://evil.example'});assert.deepEqual(h.opened,['/app?view=profile&area=athlete']);
 await h.click({user_id:'athlete-a',url:'/entrar'});await h.click({user_id:'athlete-a',url:'https://evil.example/app?view=calendar'});assert.equal(h.opened.length,1);
});

test('late cleanup for the old account preserves the current binding and current account notifications',async()=>{
 const h=worker();await h.bind('athlete-b');const notification=id=>({data:{user_id:id},close(){h.closed.push(id);}});h.notifications=[notification('athlete-a'),notification('athlete-b')];await h.clear('athlete-a');assert.equal(h.binding.user_id,'athlete-b');assert.deepEqual(h.closed,['athlete-a']);await h.clear('athlete-b');assert.equal(h.binding,undefined);assert.deepEqual(h.closed,['athlete-a','athlete-b']);
});

test('worker routes each alert kind to its explicit area and rejects invalid area/view pairs',async()=>{
 const h=worker();await h.bind('athlete-a');
 for(const [kind,url] of Object.entries({workout_reminder:'/app?view=today&area=athlete',plan_update:'/app?view=calendar&area=athlete',coach_comment:'/app?view=today&area=athlete',coach_digest:'/app?view=progress&area=coach'})){
  await h.push({kind,user_id:'athlete-a',url:'/app?view=progress'});assert.equal(h.shown.at(-1).options.data.url,url);
 }
 const before=h.shown.length;await h.push({kind:'unknown',user_id:'athlete-a',url:'/app?view=calendar'});await h.push({kind:'plan_update',user_id:'athlete-a',url:'/app?view=calendar&area=coach'});assert.equal(h.shown.length,before);
 await h.click({user_id:'athlete-a',url:'/app?view=progress&area=coach'});assert.deepEqual(h.opened,['/app?view=progress&area=coach']);
});

test('atomic worker cleanup cannot retire a newer account subscription or bind a retired endpoint',async()=>{
 const h=worker();await h.bind('athlete-a');await h.bind('athlete-b');
 await h.clear('athlete-a',{unsubscribe:true});assert.equal(h.binding.user_id,'athlete-b');assert.deepEqual(h.retired,[]);assert.ok(h.subscription);
 const oldEndpoint=h.subscription.endpoint;await h.clear('athlete-b',{unsubscribe:true});assert.equal(h.binding,undefined);assert.deepEqual(h.retired,[oldEndpoint]);
 assert.equal((await h.message({type:'atlas-bind-notifications',user_id:'athlete-c',endpoint:oldEndpoint})).ok,false);assert.equal(h.binding,undefined);
});

test('logout cleanup waits for a pending push display and closes it before acknowledging',async()=>{
 const h=worker(),entered=deferred(),display=deferred();let cleared=false,visible=false;
 await h.bind('athlete-a');
 h.beforeShow=async(_title,options)=>{entered.resolve();await display.promise;visible=true;h.notifications=[{data:options.data,close(){visible=false;}}];};
 const pushing=h.push({kind:'plan_update',user_id:'athlete-a',url:'/app?view=calendar'});
 await entered.promise;
 const clearing=h.clear('athlete-a',{unsubscribe:true}).then(()=>{cleared=true;});
 try{await tick();assert.equal(cleared,false,'cleanup cannot acknowledge while display is pending');assert.equal(h.binding.user_id,'athlete-a');}
 finally{display.resolve();await Promise.all([pushing,clearing]);}
 assert.equal(cleared,true);assert.equal(visible,false);assert.equal(h.binding,undefined);assert.equal(h.shown.length,1);
 const clearedFirst=worker();await clearedFirst.bind('athlete-a');await clearedFirst.clear('athlete-a',{unsubscribe:true});
 await clearedFirst.push({kind:'plan_update',user_id:'athlete-a',url:'/app?view=calendar'});assert.equal(clearedFirst.shown.length,0,'push arriving after cleanup is discarded');
});
