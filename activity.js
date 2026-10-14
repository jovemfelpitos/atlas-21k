import {escapeHTML as esc,displayDate,amount,sessionKey} from './monitoring.js';

const fields=['status','km','minutes','effort','pain','recovery','notes'];
const numbers=['km','minutes','effort','pain'];
const statuses=['feito','adaptado','não feito'];
const recoveryOptions=['','Normal','Pernas pesadas','Dor persistente'];
const fieldError=(field,message)=>Object.assign(Error(message),{field});
const valuesOf=form=>Object.fromEntries(fields.map(key=>[key,form.elements[key].value]));
const numeric=value=>value==null?null:Number(value);
const sameValues=(a,b)=>fields.every(key=>numbers.includes(key)?numeric(a[key])===numeric(b[key]):(a[key]??'')===(b[key]??''));
const conflict=()=>Error('O registro mudou em outra aba ou dispositivo. Seus campos foram mantidos. Feche, sincronize e confira a versão atual antes de editar novamente.');

export function validateActivity(values) {
 if(!statuses.includes(values.status))throw fieldError('status','Escolha Feito, Adaptado ou Não feito.');
 const result={status:values.status,recovery:values.recovery??'',notes:values.notes??''};
 if(result.notes.length>3000)throw fieldError('notes','Use até 3.000 caracteres nas observações.');
 for(const [key,label,max] of [['km','Distância',1000],['minutes','Tempo',1440],['effort','Esforço',10],['pain','Dor',10]]){
  const text=String(values[key]??'').trim();
  if(!text){result[key]=null;continue;}
  const value=Number(text.replace(',','.'));
  if(!/^\d*(?:[.,]\d+)?$/.test(text)||!Number.isFinite(value)||value<0||value>max||(key==='effort'||key==='pain')&&!Number.isInteger(value))throw fieldError(key,`${label}: informe ${max===10?'um número inteiro de 0 a 10':'um valor de 0 a '+max}, ou deixe em branco.`);
  result[key]=value;
 }
 return result;
}

// Read before writing and compare the last version. A lost response can be retried
// without duplicating an activity or silently replacing a newer device's report.
export async function persistActivity({request,context,values,now=()=>new Date().toISOString()}) {
 const identity={user_id:context.user_id,plan_id:context.plan_id,session_id:context.session_id};
 const query=Object.entries(identity).map(([k,v])=>k+'=eq.'+encodeURIComponent(v)).join('&');
 const path='/rest/v1/atlas_activity_records?'+query;
 const key=sessionKey(identity.user_id,identity.plan_id,identity.session_id);
 const exact=rows=>Array.isArray(rows)?rows.find(r=>sessionKey(r.user_id,r.plan_id,r.session_id)===key):undefined;
 const current=exact(await request(path+'&select=*&limit=1'));
 if(current&&sameValues(current,values))return current;
 if(current&&context.pending&&sameValues(current,context.pending)&&Date.parse(current.updated_at)===Date.parse(context.pending.updated_at))context.record={...current};
 if(current ? !context.record||!sameValues(current,context.record)||current.updated_at!==context.record.updated_at : !!context.record)throw conflict();
 const stamp=new Date(Math.max(Date.parse(now()),current?Date.parse(current.updated_at)+1:0)).toISOString();
 const row={...identity,...values,updated_at:stamp};
 context.pending=row;
 let saved;
 if(current){
  const {user_id,plan_id,session_id,...body}=row;
  saved=exact(await request(path+'&updated_at=eq.'+encodeURIComponent(current.updated_at),{method:'PATCH',body:JSON.stringify(body),headers:{Prefer:'return=representation'}}));
  if(!saved)throw conflict();
 }else saved=exact(await request('/rest/v1/atlas_activity_records',{method:'POST',body:JSON.stringify(row),headers:{Prefer:'return=representation'}}));
 if(!saved)saved=exact(await request(path+'&select=*&limit=1'));
 if(!saved||!sameValues(saved,values))throw Error('Não foi possível confirmar o registro salvo. Tente novamente para conferir, sem perder o preenchimento.');
 return saved;
}

const scaleOptions=kind=>'<option value="">Não informei</option>'+Array.from({length:11},(_,i)=>{
 const label=kind==='effort'?({0:'Nenhum esforço',5:'Moderado',6:'Moderado',7:'Intenso',8:'Intenso',10:'Esforço máximo'})[i]:({0:'Nenhuma dor',10:'Pior dor imaginável'})[i];
 return `<option value="${i}">${i}${label?' · '+label:''}</option>`;
}).join('');
const formHTML=()=>`<form id="recordForm" novalidate>
 <div class="dialog-head"><div><p class="activity-eyebrow">SEU RELATO</p><h2 id="recordTitle">Registrar atividade</h2></div><button type="button" data-close="recordDialog" aria-label="Fechar registro">✕</button></div>
 <div id="recordContext" class="activity-context"></div><input name="session_id" type="hidden">
 <p class="activity-help">Escolha a situação. Os outros campos são opcionais: informe o que souber. Em branco é diferente de zero.</p>
 <label for="activityStatus">Como foi o treino? <span>(obrigatório)</span></label><select id="activityStatus" name="status" required aria-describedby="activityStatusHelp"><option value="">Selecione a situação</option><option value="feito">Feito</option><option value="adaptado">Adaptado</option><option value="não feito">Não feito</option></select><p id="activityStatusHelp" class="activity-help" aria-live="polite"></p>
 <section class="activity-section" aria-labelledby="activityResults"><h3 id="activityResults">O que você realizou</h3><p class="activity-help">Use os valores reais. O treino previsto fica só como referência.</p>
 <div class="activity-results"><div><label for="activityKm">Distância (km)</label><input id="activityKm" name="km" type="text" inputmode="decimal" maxlength="30" placeholder="Não informei" aria-describedby="activityDecimalHelp"></div><div><label for="activityMinutes">Tempo (min)</label><input id="activityMinutes" name="minutes" type="text" inputmode="decimal" maxlength="30" placeholder="Não informei" aria-describedby="activityDecimalHelp"></div></div><p id="activityDecimalHelp" class="activity-help">Aceita vírgula ou ponto, como 3,5 km e 25,5 min.</p></section>
 <section class="activity-section" aria-labelledby="effortLabel"><label id="effortLabel" for="activityEffort">Esforço percebido · 0 a 10</label><p id="effortHelp" class="activity-help">Quanto esforço o treino exigiu de você? Pense na atividade como um todo.</p><select id="activityEffort" name="effort" aria-describedby="effortHelp effortValue">${scaleOptions('effort')}</select><p id="effortValue" class="activity-scale-value" aria-live="polite"></p>
 <details><summary>Entenda a escala de esforço</summary><p>0 indica nenhum esforço; 10, seu esforço máximo. Como referência, 5–6 representam esforço moderado e 7–8, intenso. Considere sua própria sensação.</p><p>Em esforço moderado, costuma ser possível conversar; em esforço intenso, falar frases fica mais difícil.</p><a href="https://www.cdc.gov/physical-activity-basics/measuring/" target="_blank" rel="noopener noreferrer">Referência de intensidade · CDC</a></details></section>
 <section class="activity-section" aria-labelledby="painLabel"><label id="painLabel" for="activityPain">Dor durante a atividade · 0 a 10</label><p id="painHelp" class="activity-help">Qual foi a maior dor que você sentiu? Dor é diferente de cansaço.</p><select id="activityPain" name="pain" aria-describedby="painHelp painValue">${scaleOptions('pain')}</select><p id="painValue" class="activity-scale-value" aria-live="polite"></p>
 <details><summary>Entenda a escala de dor</summary><p>0 significa nenhuma dor; 10, a pior dor imaginável. Escolha o número que melhor descreve o que você sentiu. Se quiser, conte onde doeu nas observações.</p><a href="https://my.clevelandclinic.org/-/scassets/files/org/prepare-for-surgery/pacc-brochure-15-pai-2380.ashx?la=en#page=7" target="_blank" rel="noopener noreferrer">Referência da escala numérica · Cleveland Clinic, p. 7</a></details></section>
 <section class="activity-section"><label for="activityRecovery">Recuperação (opcional)</label><select id="activityRecovery" name="recovery"><option value="">Ainda não avaliei</option><option>Normal</option><option>Pernas pesadas</option><option>Dor persistente</option></select><label for="activityNotes" id="activityNotesLabel">Observações (opcional)</label><textarea id="activityNotes" name="notes" rows="3" maxlength="3000" placeholder="Como você se sentiu? Mudou algo no treino?"></textarea></section>
 <p class="activity-help">Seu relato fica separado dos comentários da equipe. Somente você pode editá-lo; dono e treinadores vinculados podem consultá-lo.</p>
 <div id="activityDiscard" class="activity-discard" hidden role="alert"><strong>Descartar alterações não salvas?</strong><p>O preenchimento desta tela será perdido. O registro salvo permanece no histórico.</p><div><button type="button" id="keepActivity">Continuar editando</button><button type="button" id="discardActivity">Descartar e fechar</button></div></div>
 <p id="saveError" class="error" role="alert" tabindex="-1"></p><p id="activitySaveState" class="activity-help" role="status"></p><div class="activity-actions"><button type="button" data-close="recordDialog" class="activity-cancel">Fechar</button><button type="submit" class="primary">Salvar atividade</button></div>
 </form>`;

export function createActivityEditor({window,dialog,save,onSaved,onState=()=>{}}) {
 dialog.innerHTML=formHTML();
 const form=dialog.querySelector('form'),get=id=>dialog.querySelector('#'+id);
 let context=null,baseline='',busy=false,version=0;
 const setText=(id,value)=>{if(get(id).textContent!==value)get(id).textContent=value;};
 const dirty=()=>!!context&&JSON.stringify(valuesOf(form))!==baseline;
 const resetErrors=()=>{get('saveError').textContent='';form.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));};
 function update(){
  const status=form.elements.status.value;
  setText('activityStatusHelp',({'feito':'Realizou a sessão conforme o previsto.','adaptado':'Realizou a sessão com mudanças. Se quiser, explique nas observações.','não feito':'Não realizou a sessão. Pode salvar só a situação e um motivo opcional. Os valores já preenchidos não são apagados ao trocar a situação.'})[status]||'Feito: conforme o previsto. Adaptado: com mudanças. Não feito: não realizou.');
  get('activityNotesLabel').textContent=status==='não feito'?'Motivo ou observações (opcional)':'Observações (opcional)';
  form.elements.notes.placeholder=status==='não feito'?'Se quiser, conte por que não treinou.':'Como você se sentiu? Mudou algo no treino?';
  for(const kind of ['effort','pain']){const select=form.elements[kind],label=select.selectedOptions[0]?.textContent.split(' · ')[1],text=select.value===''?'Não informado. Zero só é registrado se você escolher 0.':select.value+' / 10'+(label?' · '+label:'');setText(kind+'Value',text);}
  onState();
 }
 function close(){if(busy)return false;if(dirty()){get('activityDiscard').hidden=false;get('keepActivity').focus();return false;}finish();return true;}
 function finish(){version++;context=null;baseline='';dialog.close();get('activityDiscard').hidden=true;form.reset();onState();}
 function reset(){finish();busy=false;form.elements.session_id.value='';form.elements.recovery.innerHTML=recoveryOptions.map(value=>`<option value="${esc(value)}">${esc(value||'Ainda não avaliei')}</option>`).join('');get('recordContext').replaceChildren();get('recordTitle').textContent='Registrar atividade';resetErrors();get('activitySaveState').textContent='';get('effortValue').textContent='';get('painValue').textContent='';get('activityStatusHelp').textContent='';form.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=false);form.removeAttribute('aria-busy');form.querySelector('[type=submit]').textContent='Salvar atividade';onState();}
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||busy)return;
  if(button.dataset.close==='recordDialog'){event.stopPropagation();close();}
  if(button.id==='keepActivity'){get('activityDiscard').hidden=true;form.elements.status.focus();}
  if(button.id==='discardActivity')finish();
 });
 form.addEventListener('input',()=>{resetErrors();update();});form.addEventListener('change',()=>{resetErrors();update();});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!context)return;
  resetErrors();get('activityDiscard').hidden=true;
  let values;try{values=validateActivity(valuesOf(form));}catch(error){get('saveError').textContent=error.message;const field=form.elements[error.field];field?.setAttribute('aria-invalid','true');field?.focus();return;}
  busy=true;form.setAttribute('aria-busy','true');form.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=true);const submit=form.querySelector('[type=submit]');submit.textContent='Salvando…';get('activitySaveState').textContent='Confirmando o salvamento do seu relato…';onState();
  let saved;const expected=version;
  try{saved=await save(context,values);if(!saved)throw Error('Tente salvar novamente para conferir o registro.');}catch(error){if(expected!==version)return;const detail=error.status===401||error.status===403?'Sua sessão ou acesso mudou. Entre novamente ou sincronize sua conta antes de tentar de novo.':error.status===409?'Já existe um registro para esta sessão. Tente salvar novamente para conferir ou sincronize os dados.':error.status>=500||error.name==='TypeError'||error.name==='AbortError'?'Verifique sua conexão e tente novamente.':error.message;get('saveError').textContent='Não foi possível confirmar o salvamento. Seus campos foram mantidos. '+detail;get('saveError').focus();}
  finally{if(expected===version){busy=false;form.removeAttribute('aria-busy');form.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=false);submit.textContent='Salvar atividade';get('activitySaveState').textContent='';onState();}}
  if(expected!==version)return;
  if(saved){const sessionId=context.session_id;finish();onSaved(saved);window.document.querySelector(`[data-record="${window.CSS.escape(sessionId)}"]`)?.focus({preventScroll:true});}
 });
 return {
  open({user_id,plan,session,record}){
   if(busy)return;if(context&&dirty()){close();return;}
   context={user_id,plan_id:plan.id,session_id:session.id,record:record?{...record}:null};
   form.reset();form.elements.session_id.value=session.id;
   form.elements.recovery.innerHTML=recoveryOptions.map(value=>`<option value="${esc(value)}">${esc(value||'Ainda não avaliei')}</option>`).join('');
   if(record?.recovery&&!recoveryOptions.includes(record.recovery)){const option=window.document.createElement('option');option.value=record.recovery;option.textContent=record.recovery;form.elements.recovery.append(option);}
   for(const key of fields)if(record?.[key]!=null)form.elements[key].value=String(record[key]);
   get('recordTitle').textContent=record?'Editar atividade':'Registrar atividade';
   get('recordContext').innerHTML=`<strong>${esc(session.type)}</strong><p>${esc(displayDate(session.date))} · ${esc(plan.name)}${plan.version!=null?' · v'+esc(plan.version):''}${plan.state==='archived'?' · histórico':''}</p><p>Previsto: ${esc(amount(session.km,'km'))} · ${esc(amount(session.minutes,'min'))}</p><details><summary>Ver treino previsto</summary><p class="preserve-lines">${esc(session.description)}</p>${session.intensity?'<p>'+esc(session.intensity)+'</p>':''}${session.gym?'<p>Musculação: '+esc(session.gym)+'</p>':''}${session.notes?'<p>Observações: '+esc(session.notes)+'</p>':''}</details>`;
   resetErrors();get('activityDiscard').hidden=true;baseline=JSON.stringify(valuesOf(form));update();if(!dialog.open)dialog.showModal();form.elements.status.focus();
  },close,reset,get dirty(){return dirty();},get busy(){return busy;},get isOpen(){return !!context;}
 };
}
