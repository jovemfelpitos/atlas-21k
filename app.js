import {createManagement} from './management.js';
import {safeNext} from './auth-client.js';
import {createAvatarStore,createProfileEditor,initials} from './profile.js';
import {accountAreas, areaLabels} from './account-areas.js';
import {readRows, monitoringRows, summaryHTML, commentsHTML} from './monitoring.js';
import {createCalendarState,calendarHTML,handleCalendarAction} from './calendar.js';
import {createActivityEditor,persistActivity} from './activity.js';
import {createNotificationSettings,notificationTarget} from './notifications.js';
const $=s=>document.querySelector(s),cfg=window.ATLAS_CONFIG;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let session=null,plans=[],records=[],comments=[],profile=null,admin=false,view='today',active=null,role='athlete',management=null,demo=false,loaded=false,busy=false;
let activityEditor=null,notificationSettings=null;
let accessState={areas:['athlete'],selected:'athlete',coachStatus:'none'},loading=false,loadError='';
try{session=JSON.parse(localStorage.getItem('atlas-session')||'null')}catch{}
const configured=()=>{if(!/^https:\/\/[^/]+\.supabase\.co\/?$/.test(cfg.supabaseUrl))return false;if(cfg.supabaseKey?.startsWith('sb_publishable_'))return true;try{return JSON.parse(atob(cfg.supabaseKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='anon';}catch{return false;}};
function keepSession(s){session=s;if(s)localStorage.setItem('atlas-session',JSON.stringify(s));else localStorage.removeItem('atlas-session');}
let refresh=null,sessionVersion=0;
const pendingRequests=new Set();
const changedSession=()=>Object.assign(Error('A sessão mudou em outra aba. Entre novamente.'),{code:'local_session_changed',status:401});
async function request(path,options={},token=true){
 const version=sessionVersion;
 if(!configured())throw Error('Configure a URL e a chave pública do Supabase.');
 if(token){if(!session)throw Error('Entre na sua conta.');if(!Number.isFinite(session.expires_at)||session.expires_at<Date.now()/1000+60){if(!refresh)refresh=request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})},false).then(r=>{if(version!==sessionVersion)throw changedSession();keepSession({...r,expires_at:Date.now()/1000+r.expires_in});}).finally(()=>refresh=null);await refresh;}}
 if(version!==sessionVersion)throw changedSession();
 const {responseType,...fetchOptions}=options;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);pendingRequests.add(controller);
 try{
 const res=await fetch(cfg.supabaseUrl.replace(/\/$/,'')+path,{...fetchOptions,signal:controller.signal,headers:{apikey:cfg.supabaseKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+session.access_token}:{}),...options.headers}});
 if(version!==sessionVersion)throw changedSession();
 if(res.ok&&responseType==='blob'){const blob=await res.blob();if(version!==sessionVersion)throw changedSession();return blob;}
 const text=await res.text();if(version!==sessionVersion)throw changedSession();let data;try{data=text?JSON.parse(text):null}catch{throw Error('Resposta inesperada do servidor.');}if(!res.ok){const error=Error(data?.msg||data?.message||data?.error_description||'Falha no servidor.');error.code=data?.error_code||data?.code;error.status=res.status;throw error;}return data;
 }catch(error){if(version!==sessionVersion)throw changedSession();throw error;}finally{clearTimeout(timer);pendingRequests.delete(controller);}
}
const post=(path,data,headers={})=>request(path,{method:'POST',headers,body:JSON.stringify(data)});
const avatars=createAvatarStore({request,urlAPI:window.URL});
const profileEditor=createProfileEditor({window,request,getSession:()=>session,keepSession,avatars,accountControls:areaControls,onState:profileStateChanged,onProfile:value=>{if(!session||value.user_id!==session.user.id)return;profile=value;management?.updateProfile(value);updateIdentity();}});
notificationSettings=createNotificationSettings({window,request,getSession:()=>session,getRole:()=>role,onState:profileStateChanged});
function profileStateChanged(){const disabled=loading||busy||profileEditor.busy||!!activityEditor?.busy||!!notificationSettings?.busy;$('#sync').disabled=disabled;$('#areaSelect').disabled=disabled;$('#account').disabled=disabled;$('#planSelect').disabled=disabled;document.querySelectorAll('nav button').forEach(b=>b.disabled=disabled);}
activityEditor=createActivityEditor({window,dialog:$('#recordDialog'),onState:profileStateChanged,save:async(context,values)=>{
 if(admin||(!demo&&(!loaded||!session||session.user.id!==context.user_id)))throw Error('Entre e sincronize sua conta antes de salvar.');
 return demo?{user_id:context.user_id,plan_id:context.plan_id,session_id:context.session_id,...values,updated_at:new Date().toISOString()}:persistActivity({request,context,values});
},onSaved:row=>{records=records.filter(r=>!(r.user_id===row.user_id&&r.plan_id===row.plan_id&&r.session_id===row.session_id)).concat(row);notice(demo?'Registro temporário na demonstração. Não foi sincronizado.':'Atividade salva e sincronizada.');render();}});
function activityBlocksNavigation(){if(!activityEditor?.isOpen)return false;if(activityEditor.close())return false;notice('Salve ou descarte as alterações do registro antes de sair.');return true;}
function mountProfile(container){notificationSettings.detach();if(container){profileEditor.mount(container,profile);if(!admin)container.querySelector('.profile-panel>h2')?.remove();const panel=document.createElement('div');container.append(panel);notificationSettings.mount(panel);}else profileEditor.detach();}
function updateIdentity(){const identity=$('#accountIdentity');identity.hidden=!session||!profile||!!loadError;if(identity.hidden)return;$('#accountName').textContent=profile.name;$('#accountArea').textContent=areaLabels[role];$('#accountInitials').textContent=initials(profile.name);$('#accountAvatar').hidden=true;$('#accountInitials').hidden=false;const path=profile.avatar_path;avatars.load(path).then(url=>{if(!url||profile?.avatar_path!==path||!session)return;$('#accountAvatar').src=url;$('#accountAvatar').hidden=false;$('#accountInitials').hidden=true;}).catch(()=>{});}
function notice(t){$('#notice').textContent=t;$('#account').textContent=session?'Sair':'Entrar';}
const current=()=>plans.find(p=>p.id===active);
const calendars=new Map();
function calendarState(){if(!calendars.has(active))calendars.set(active,createCalendarState(monitoringRows([current()],records,{plan:active})));return calendars.get(active);}
const rec=id=>records.find(r=>r.plan_id===active&&r.session_id===id);
const dateLabel=d=>new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
async function load(preferred,staffPage){if(activityBlocksNavigation())return;if(notificationSettings.busy||profileEditor.busy||profileEditor.dirty){notice('Salve ou cancele a edição do perfil antes de sincronizar.');return;}profileEditor.detach();notificationSettings.detach();avatars.clear();loaded=false;loading=true;loadError='';management?.destroy();management=null;plans=[];records=[];comments=[];$('#areaSelect').disabled=true;$('#sync').disabled=true;$('#content').innerHTML='<p role="status">Carregando sua área…</p>';try{
 if(!session){render();return;}
 const expected=sessionVersion;
 await post('/rest/v1/rpc/atlas_ensure_profile',{});
 const access=await post('/rest/v1/rpc/atlas_access_context',{});accessState=accountAreas(access,preferred);role=accessState.selected;admin=role!=='athlete';
 const ps=await request('/rest/v1/atlas_profiles?select=*&user_id=eq.'+encodeURIComponent(session.user.id));profile=ps.find(p=>p.user_id===session.user.id);
 if(!profile)throw Error('Seu perfil não está disponível. Tente sincronizar novamente.');
 if(admin){const initialPage=staffPage==='monitoring'?'monitoring':view==='profile'?'staffProfile':'overview';view='admin';management=createManagement({root:$('#content'),role,userId:session.user.id,request,notice,accountControls:areaControls,enableCoach,initialPage,renderProfile:mountProfile,profileState:()=>profileEditor,saveProfile:async name=>{await request('/rest/v1/atlas_profiles?user_id=eq.'+session.user.id,{method:'PATCH',body:JSON.stringify({name})});profile={...profile,name};}});await management.load();}
 else{if(view==='admin')view='today';const own='&user_id=eq.'+encodeURIComponent(session.user.id);const data=await Promise.all(['/rest/v1/atlas_plans?select=*,atlas_sessions(*)&order=created_at.desc,id','/rest/v1/atlas_activity_records?select=*&order=user_id,plan_id,session_id','/rest/v1/atlas_session_comments?select=*&order=created_at,id'].map(path=>readRows(request,path+own)));[plans,records,comments]=data;plans.sort((a,b)=>(a.state==='archived')-(b.state==='archived'));plans=plans.map(p=>({...p,sessions:p.atlas_sessions.sort((a,b)=>a.date.localeCompare(b.date))}));if(!plans.some(p=>p.id===active))active=plans[0]?.id;}
 if(expected!==sessionVersion)throw changedSession();
 loading=false;
 loaded=true;notice(admin?(role==='admin'?'Área do admin dono.':'Área do treinador.'):'Dados sincronizados.');render();
 }catch(e){if(e.code==='local_session_changed')return;loading=false;loaded=false;management?.destroy();management=null;plans=[];records=[];comments=[];if(expiredAccess(e)){await endPrivateView('expired',true);return;}loadError=e.message;notice('Não foi possível carregar os dados. '+e.message);render();}finally{$('#sync').disabled=false;}}
function areaControls(){return `<section class="account-areas"><h3>Áreas da conta</h3><p>Mesmo login e histórico pessoal. Área atual: <strong>${esc(areaLabels[role])}</strong>.</p><div class="actions">${accessState.areas.map(area=>`<button type="button" data-area="${area}" aria-pressed="${area===role}">${area===role?'✓ ':''}${esc(areaLabels[area])}</button>`).join('')}</div>${accessState.coachStatus==='none'?'<p>Você também pode acompanhar atletas como treinador. O dono precisa autorizar os vínculos.</p><button type="button" data-enable-coach>Ativar área de treinador</button>':accessState.coachStatus==='inactive'?'<p>Acesso de treinador desativado pelo dono. Sua área de atleta continua disponível.</p>':''}</section>`;}
async function enableCoach(){await post('/rest/v1/rpc/atlas_enable_coach',{});await request('/rest/v1/atlas_profiles?user_id=eq.'+encodeURIComponent(session.user.id),{method:'PATCH',body:JSON.stringify({preferred_area:'coach'})});await load('coach');}
async function switchArea(area,staffPage){if(activityBlocksNavigation()){$('#areaSelect').value=role;return;}if(!session||loading||busy||notificationSettings.busy||profileEditor.busy||management?.busy||!accessState.areas.includes(area)){$('#areaSelect').value=role;return;}if(management?.dirty||profileEditor.dirty){notice(profileEditor.dirty?'Salve ou cancele a edição do perfil antes de trocar de área.':'Salve ou descarte as alterações antes de trocar de área.');$('#areaSelect').value=role;return;}busy=true;$('#areaSelect').disabled=true;try{await request('/rest/v1/atlas_profiles?user_id=eq.'+encodeURIComponent(session.user.id),{method:'PATCH',body:JSON.stringify({preferred_area:area})});await load(area,staffPage);}catch(e){notice('Não foi possível trocar de área. '+e.message);render();}finally{busy=false;profileStateChanged();}}
async function openNotification(target){const expected=sessionVersion;view=target.view;await load(target.area,target.area==='coach'?'monitoring':undefined);if(expected===sessionVersion&&loaded&&!accessState.areas.includes(target.area))notice('Sua área de treinador não está disponível.');}
const feedback=id=>comments.filter(c=>c.plan_id===active&&c.session_id===id);
const hasMetric=value=>value!==null&&value!==undefined&&value!=='';
const metricLabel=value=>esc(Number.isFinite(Number(value))?Number(value).toLocaleString('pt-BR'):value);
function workout(s){
 const r=rec(s.id),archived=current()?.state==='archived';
 const prescribed=[['Distância prevista',s.km,'km'],['Duração prevista',s.minutes,'min']].filter(([,value])=>hasMetric(value));
 const recorded=r?[['km',r.km],['min',r.minutes]].filter(([,value])=>hasMetric(value)).map(([unit,value])=>`${metricLabel(value)} ${unit}`).join(' · '):'';
 return `<article class="card training-session"><time class="tag" datetime="${esc(s.date)}">${esc(dateLabel(s.date))}</time><h2>${esc(s.type)}</h2>
 ${prescribed.length?`<dl class="workout-prescription" aria-label="Prescrição">${prescribed.map(([label,value,unit])=>`<div><dt>${label}</dt><dd>${metricLabel(value)} <small>${unit}</small></dd></div>`).join('')}</dl>`:''}
 ${s.description?`<p class="workout-description preserve-lines">${esc(s.description)}</p>`:''}
 ${s.intensity?`<p class="workout-intensity">Intensidade: <strong>${esc(s.intensity)}</strong></p>`:''}
 ${s.gym?`<div class="workout-instructions"><h3>Complemento</h3><p class="preserve-lines">${esc(s.gym)}</p></div>`:''}
 ${s.notes?`<div class="workout-instructions"><h3>Observações</h3><p class="preserve-lines">${esc(s.notes)}</p></div>`:''}
 ${r?`<section class="workout-record" aria-label="Seu registro"><h3>Seu registro</h3><p class="status">${esc(r.status)}</p>${recorded?`<p class="muted">${recorded}</p>`:''}</section>`:''}
 ${archived&&!r?'<p class="muted">Plano arquivado · novas atividades indisponíveis.</p>':`<button class="primary" data-record="${esc(s.id)}">${r?'Editar registro':'Registrar atividade'}</button>`}
 ${feedback(s.id).length?commentsHTML(feedback(s.id)):''}</article>`;
}
function render(){
 profileEditor.detach();notificationSettings.detach();updateIdentity();
 $('#planContext').hidden=true;$('#athleteHeading').hidden=admin||!!loadError;$('#workoutContext').hidden=true;
 $('#areaSwitcher').hidden=!session||demo||accessState.areas.length<2;$('#areaSelect').innerHTML=accessState.areas.map(area=>`<option value="${area}">${esc(areaLabels[area])}</option>`).join('');$('#areaSelect').value=role;$('#areaSelect').disabled=loading||busy;
 $('#sync').hidden=!session;
 if(session&&loadError){$('nav[aria-label="Seções"]').hidden=true;$('#planSelect').hidden=true;$('#goal').textContent='';$('#content').innerHTML='<article class="card"><h2>Não foi possível abrir sua área</h2><p>'+esc(loadError)+'</p><button id="reload" class="primary">Tentar sincronizar novamente</button></article>';return;}
 if(admin){$('nav').hidden=true;$('#planSelect').hidden=true;$('#goal').textContent=role==='admin'?'Gestão · admin dono':'Gestão · treinador';if(management)management.render();else $('#content').innerHTML='<p>Não foi possível abrir a gestão. Sincronize novamente.</p>';return;}
 $('#planSelect').hidden=admin||!plans.length;$('#planSelect').innerHTML=plans.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}${p.version!=null?' · v'+p.version:''}${p.state==='archived'?' · histórico':''}</option>`).join('');$('#planSelect').value=active||'';
 $('nav').hidden=admin;document.querySelectorAll('nav[aria-label="Seções"] button').forEach(b=>{const selected=b.dataset.view===view;b.classList.toggle('active',selected);if(selected)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 $('#viewHeading').textContent=({today:'Seu treino',calendar:'Calendário',progress:'Evolução',guide:'Guia do plano',profile:'Perfil'})[view];
 const p=current();$('#planContext').hidden=!p||view==='profile';
 const goals=p?[hasMetric(p.goal_km)?metricLabel(p.goal_km)+' km':'',hasMetric(p.goal_minutes)?metricLabel(p.goal_minutes)+' min':'',p.goal_date?esc(dateLabel(p.goal_date)):''].filter(Boolean):[];
 $('#goal').innerHTML=goals.length?'Meta · '+goals.join(' · '):'';
 let html='';
 if(!session&&!demo){html='<article class="card"><h2>Seu próximo passo começa aqui.</h2><p>Entre ou crie sua conta para acessar seus planos e registrar atividades.</p><button id="login" class="primary">Entrar / criar conta</button><button id="demo" class="secondary">Explorar plano anterior em demonstração</button><p class="muted">A demonstração mantém dados apenas em memória. A prova antiga não está confirmada.</p></article>';}
 else if(view==='profile'){html=demo?'<p>Entre na sua conta para editar seu perfil.</p>':'<div id="profilePanel"></div>';}
 else if(!p){html='<div class="card"><h2>Nenhum plano atribuído</h2><p>Configure seu perfil. O administrador poderá vincular seu plano à sua conta.</p></div>';}
 else if(view==='today'){const today=new Date().toLocaleDateString('en-CA');const ss=p.sessions.filter(s=>s.date===today),next=p.sessions.find(s=>s.date>today),selected=ss.length?ss:[next||p.sessions.at(-1)].filter(Boolean);$('#workoutContext').hidden=false;$('#workoutContext').textContent=ss.length?`Hoje · ${ss.length} ${ss.length===1?'sessão':'sessões'}`:next?'Próxima sessão do plano':selected.length?'Última sessão do plano':'Ainda não há sessões neste plano';html=selected.map(workout).join('');}
 else if(view==='calendar')html=calendarHTML({rows:monitoringRows([p],records,{plan:active}),state:calendarState(),renderSession:row=>workout(row.session),showHeading:false});
 else if(view==='guide')html=p.guide.map(g=>`<details><summary>${esc(g.tema)}</summary><p>${esc(g.orientacao)}</p></details>`).join('');
 else if(view==='progress'){const rs=records.filter(r=>r.plan_id===active);html=`${summaryHTML(monitoringRows([p],records,{plan:active}))}${rs.map(r=>`<article class="card"><h3>${esc(p.sessions.find(s=>s.id===r.session_id)?.type)} · ${esc(r.status)}</h3><p>${r.km??'—'} km · ${r.minutes??'—'} min · esforço ${r.effort??'—'}/10 · dor ${r.pain??'—'}/10</p><p>${esc(r.recovery)} · ${esc(r.notes)}</p><button data-record="${esc(r.session_id)}">Editar</button>${feedback(r.session_id).length?commentsHTML(feedback(r.session_id)):''}</article>`).join('')}${p.sessions.filter(s=>!rec(s.id)&&feedback(s.id).length).map(s=>`<article class="card"><h3>${esc(dateLabel(s.date))} · ${esc(s.type)}</h3>${commentsHTML(feedback(s.id))}</article>`).join('')}<button id="export" class="primary">Exportar plano, registros e comentários para GPT</button><button id="reload" class="secondary">Sincronizar novamente</button>`;}
 $('#content').innerHTML=html+(session&&!demo&&view==='profile'?'<details class="app-data-access"><summary>Quem pode consultar meus registros?</summary><p>Seus relatos podem ser consultados pelo admin dono e pelos treinadores vinculados a você. Somente você pode editar seus registros de atividade.</p></details>':'');
 if(view==='profile'&&!demo)mountProfile($('#profilePanel'));
}
function download(name,text){const u=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function openRecord(id){if(admin||loading||busy||activityEditor.busy)return;const plan=current(),workout=plan?.sessions.find(s=>s.id===id);if(!plan||!workout)return;if(plan.state==='archived'&&!rec(id)){notice('Plano arquivado. Apenas registros existentes podem ser corrigidos.');return;}if(!demo&&(!loaded||!session)){notice('Entre e sincronize antes de editar.');return;}activityEditor.open({user_id:session?.user.id,plan,session:workout,record:rec(id)});}

document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b||b.closest('#recordDialog')||b.closest('.notification-panel'))return;if(notificationSettings.busy)return;if(activityBlocksNavigation())return;
 if(b.dataset.notificationView){if(loading||busy)return;if(profileEditor.dirty||profileEditor.busy||management?.dirty||management?.busy){notice('Salve ou cancele a edição antes de abrir a atualização.');return;}const target=notificationTarget('/app?view='+encodeURIComponent(b.dataset.notificationView)+'&area='+encodeURIComponent(b.dataset.notificationArea));if(target)await openNotification(target);return;}
 if(!admin&&view==='calendar'&&!loading&&current()&&handleCalendarAction(e,calendarState(),render))return;
 if(loading&&b.dataset.view)return;
 if(b.dataset.area){await switchArea(b.dataset.area);return;}if(b.hasAttribute('data-enable-coach')&&!admin){if(busy||loading||profileEditor.busy)return;if(profileEditor.dirty){notice('Salve ou cancele a edição do perfil antes de ativar outra área.');return;}busy=true;b.disabled=true;try{await enableCoach();}catch(error){notice(error.message);}finally{busy=false;render();}return;}
 if(b.dataset.view){if(notificationSettings.busy||profileEditor.busy||profileEditor.dirty){notice('Salve ou cancele a edição do perfil antes de sair.');return;}view=b.dataset.view;render();}if(b.dataset.close)$('#'+b.dataset.close).close();if(b.dataset.record)openRecord(b.dataset.record);
 if(b.id==='login')$('#account').click();if(b.id==='reload'||b.id==='sync'){if(loading||busy||management?.busy)return;if(management?.dirty){notice('Salve ou descarte as alterações antes de sincronizar.');return;}await load();}
 if(b.id==='demo'){demo=true;profile=null;plans=[{id:'legacy',name:'Plano anterior · referência, prova não confirmada',goal_km:21.1,goal_minutes:150,goal_date:'2026-11-15',guide:window.ATLAS_LEGACY_GUIDE,sessions:window.ATLAS_PLAN.map((s,i)=>({id:'legacy-'+i,date:s.date,type:s.type,km:s.km,description:s.execution,gym:s.gym,notes:s.condition}))}];active='legacy';records=[];comments=[];notice('DEMONSTRAÇÃO — dados temporários em memória, sem sincronização. Prova não confirmada.');render();}
 if(b.id==='export'){if(!demo&&!loaded)return;download('atlas-run-dados.json',JSON.stringify({app:'Atlas Run',demo,exported_at:new Date().toISOString(),plans:plans.map(({user_id,published_by,source_draft_id,atlas_sessions,...p})=>({...p,sessions:p.sessions.map(({user_id,plan_id,...s})=>s)})),records:records.map(({user_id,...r})=>r),comments:comments.map(({id,user_id,author_id,...c})=>c)},null,2));}

});
document.addEventListener('change',e=>{if(e.target.id==='areaSelect'){switchArea(e.target.value);}if(e.target.id==='planSelect'){if(activityBlocksNavigation()){e.target.value=active;return;}if(notificationSettings.busy||profileEditor.busy||profileEditor.dirty){notice('Salve ou cancele a edição do perfil antes de trocar de plano.');e.target.value=active;return;}active=e.target.value;render();}});
function loginDestination(reason=''){return '/entrar?next='+encodeURIComponent(safeNext('/app'+window.location.search))+(reason?'&reason='+reason:'');}
function expiredAccess(error){return error.status===401||error.status===403||['refresh_token_not_found','refresh_token_already_used','session_not_found','bad_jwt'].includes(error.code);}
$('#account').onclick=async()=>{if(activityBlocksNavigation())return;if(busy||loading||notificationSettings.busy||profileEditor.busy||management?.busy)return;if(management?.dirty||profileEditor.dirty){notice(profileEditor.dirty?'Salve ou cancele a edição do perfil antes de sair.':'Salve ou descarte as alterações antes de sair.');return;}if(session){const expected=sessionVersion;try{await request('/auth/v1/logout',{method:'POST'})}catch{}if(expected!==sessionVersion)return;endPrivateView('logout',true);return;}window.location.assign('/entrar');};
async function endPrivateView(reason='expired',removeStored=false){
 const previousUser=session?.user?.id,cleanup=notificationSettings.resetDevice(previousUser);
 sessionVersion++;for(const controller of pendingRequests)controller.abort();pendingRequests.clear();refresh=null;
 if(removeStored)keepSession(null);else session=null;
 activityEditor?.reset();profileEditor.discard();profileEditor.detach();avatars.clear();management?.destroy();management=null;
 plans=[];records=[];comments=[];calendars.clear();profile=null;active=null;loaded=false;loading=false;loadError='';
 $('#content').replaceChildren();$('#accountIdentity').hidden=true;$('#accountName').textContent='';$('#accountArea').textContent='';$('#accountInitials').textContent='';$('#accountAvatar').removeAttribute('src');$('#goal').textContent='';$('#notice').textContent='';$('#appMain').hidden=true;
 // Hide and invalidate private state before awaiting browser cleanup. Navigation must
 // not tear down its worker messages, but an unavailable device must not trap logout.
 const expected=sessionVersion;let timer;
 try{await Promise.race([cleanup,new Promise(resolve=>{timer=setTimeout(resolve,2000);})]);}catch{}finally{clearTimeout(timer);}
 if(expected===sessionVersion)window.location.replace(reason==='logout'?'/entrar':loginDestination(reason));
}
window.addEventListener('storage',event=>{
 if(event.storageArea&&event.storageArea!==localStorage||event.key!==null&&event.key!=='atlas-session'||!session)return;
 let next;try{next=JSON.parse(event.newValue||'null');}catch{}
 if(next?.user?.id===session.user.id&&next.access_token&&Number.isFinite(next.expires_at)){session=next;return;}
 endPrivateView(next?'changed':'expired');
});
window.addEventListener('beforeunload',event=>{if(session&&(activityEditor?.busy||activityEditor?.dirty||profileEditor.busy||profileEditor.dirty||management?.dirty)){event.preventDefault();event.returnValue='';}});
async function initialize(){
 const hash=new URLSearchParams(window.location.hash.replace(/^#/,'')),query=new URLSearchParams(window.location.search);
 if(hash.has('access_token')||hash.has('error')||hash.has('error_description')||query.has('token_hash')){const destination=(hash.get('type')||query.get('type'))==='recovery'?'/redefinir-senha':'/confirmar-email',fragment=window.location.hash,search=window.location.search;window.history.replaceState(null,'','/app');window.location.replace(destination+search+fragment);return;}
 if(!session){window.location.replace(loginDestination());return;}
 try{
  const user=await request('/auth/v1/user');if(!user?.id)throw Error('Não foi possível validar sua conta.');keepSession({...session,user});notificationSettings.checkDeviceIdentity();
  await post('/rest/v1/rpc/atlas_complete_onboarding',{initial_area:user.user_metadata?.account_type==='coach'?'coach':'athlete'});
  const target=query.has('area')?notificationTarget('/app'+window.location.search):null;
  const requestedView=query.get('view');if(['today','calendar','progress','guide','profile'].includes(requestedView))view=requestedView;
  $('#appMain').hidden=false;if(target)await openNotification(target);else await load();
 }catch(e){if(e.code==='local_session_changed')return;if(expiredAccess(e)){await endPrivateView('expired',true);return;}$('#appMain').hidden=false;loadError=e.message;render();notice('Não foi possível abrir sua conta. '+e.message);}
}
initialize();

window.navigator.serviceWorker?.addEventListener('message',event=>{
 if(event.data?.type!=='atlas-notification-open'||event.data.user_id!==session?.user?.id)return;
 const target=notificationTarget(event.data.url);if(!target)return;
 notice('Você recebeu uma atualização no Atlas Run.');const button=document.createElement('button');button.type='button';button.dataset.notificationView=target.view;button.dataset.notificationArea=target.area;button.textContent='Abrir atualização';$('#notice').append(' ',button);
});
