// Notifications only: no fetch handler, offline cache, credentials or user reports.
const bindingDB='atlas-notification-device';
function storage(action){return new Promise((resolve,reject)=>{const request=indexedDB.open(bindingDB,1);request.onupgradeneeded=()=>request.result.createObjectStore('device');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('device','readwrite'),store=tx.objectStore('device');let value;const read=store.get('binding');read.onsuccess=()=>{value=action(store,read.result);};tx.oncomplete=()=>{db.close();resolve(value);};tx.onerror=()=>{db.close();reject(tx.error);};};});}
function validView(url){try{const parsed=new URL(url,self.location.origin),view=parsed.searchParams.get('view'),area=parsed.searchParams.get('area')||'athlete';return parsed.origin===self.location.origin&&parsed.pathname==='/app'&&parsed.searchParams.getAll('view').length===1&&parsed.searchParams.getAll('area').length<=1&&['today','calendar','progress','profile'].includes(view)&&(area==='athlete'||area==='coach'&&view==='progress')?'/app?view='+view+'&area='+area:null;}catch{return null;}}
const destinations={workout_reminder:'/app?view=today&area=athlete',plan_update:'/app?view=calendar&area=athlete',coach_comment:'/app?view=today&area=athlete',coach_digest:'/app?view=progress&area=coach'};
// Push display, bind and cleanup share a queue across tabs. Cleanup must also
// close a notification whose icon/display was still pending when logout began.
let deviceTask=Promise.resolve();
function deviceOperation(operation){const next=deviceTask.then(operation);deviceTask=next.catch(()=>{});return next;}
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
 if(!event.source?.url||new URL(event.source.url).origin!==self.location.origin)return;
 const message=event.data;if(!['atlas-notification-binding','atlas-bind-notifications','atlas-clear-notifications'].includes(message?.type))return;
 event.waitUntil(deviceOperation(async()=>{try{
  const binding=await storage((_store,value)=>value);
  if(message.type==='atlas-notification-binding'){event.ports?.[0]?.postMessage({ok:true,user_id:binding?.user_id||null});return;}
  if(typeof message.user_id!=='string'||!message.user_id)throw Error('Missing device owner');
  if(message.type==='atlas-bind-notifications'){
   const subscription=await self.registration.pushManager.getSubscription();
   if(!subscription||subscription.endpoint!==message.endpoint)throw Error('Device subscription changed');
   await storage(store=>store.put({user_id:message.user_id,endpoint:message.endpoint},'binding'));
  }else{
   const owned=binding?.user_id===message.user_id&&(!message.endpoint||!binding.endpoint||binding.endpoint===message.endpoint);
   const unbound=!binding&&message.allow_unbound===true&&typeof message.endpoint==='string';
   if(owned||unbound){
    if(owned)await storage(store=>store.delete('binding'));
    if(message.unsubscribe){const subscription=await self.registration.pushManager.getSubscription(),endpoint=message.endpoint||binding?.endpoint;if(subscription&&(!endpoint||subscription.endpoint===endpoint))await subscription.unsubscribe();}
   }
   const notifications=await self.registration.getNotifications();notifications.filter(notification=>notification.data?.user_id===message.user_id).forEach(notification=>notification.close());
  }
  event.ports?.[0]?.postMessage({ok:true});
 }catch{event.ports?.[0]?.postMessage({ok:false});}}));
});
self.addEventListener('push',event=>event.waitUntil(deviceOperation(async()=>{
 let payload;try{payload=event.data.json();}catch{return;}const url=Object.hasOwn(destinations,payload?.kind)?destinations[payload.kind]:null;if(!url||!validView(payload?.url)||typeof payload.user_id!=='string')return;
 const binding=await storage((_store,value)=>value).catch(()=>null);if(binding?.user_id!==payload.user_id)return;
 const messages={workout_reminder:'Seu treino de hoje está disponível.',plan_update:'Um novo plano está disponível.',coach_comment:'Sua equipe deixou uma atualização.',coach_digest:'Há novos registros para acompanhar.'};
 await self.registration.showNotification('Atlas Run',{body:messages[payload.kind],icon:'/assets/brand/v1.0/icons/atlas-run-192x192.png',badge:'/assets/brand/v1.0/icons/atlas-run-48x48.png',tag:typeof payload.tag==='string'?payload.tag.slice(0,100):'atlas-update',data:{url,user_id:payload.user_id},renotify:false});
})));
self.addEventListener('notificationclick',event=>{
 const data=event.notification.data;event.notification.close();event.waitUntil((async()=>{
  const binding=await storage((_store,value)=>value).catch(()=>null);if(!binding||binding.user_id!==data?.user_id)return;
  const url=validView(data.url);if(!url)return;
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});const existing=clients.find(client=>{const path=new URL(client.url).pathname;return new URL(client.url).origin===self.location.origin&&['/app','/app.html'].includes(path);});
  if(existing){await existing.focus();existing.postMessage({type:'atlas-notification-open',url,user_id:data.user_id});}else await self.clients.openWindow(url);
 })());
});
