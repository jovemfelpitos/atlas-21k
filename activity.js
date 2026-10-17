import {escapeHTML as esc,displayDate,amount,sessionKey,paceLabel} from './monitoring.js';

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
const durationOptions=max=>'<option value="">—</option>'+Array.from({length:max+1},(_,i)=>`<option value="${i}">${String(i).padStart(2,'0')}</option>`).join('');
const numericText=value=>Number(String(value).trim().replace(',','.'));
const storedDecimal=value=>{
 const text=String(value);if(!/^\d+(?:\.\d+)?e[+-]?\d+$/i.test(text))return text;
 const [coefficient,exponent]=text.toLowerCase().split('e'),[whole,fraction='']=coefficient.split('.'),digits=whole+fraction,point=whole.length+Number(exponent);
 return point<=0?'0.'+'0'.repeat(-point)+digits:point>=digits.length?digits+'0'.repeat(point-digits.length):digits.slice(0,point)+'.'+digits.slice(point);
};
export function activityPace(km,minutes,status){
 if(!/^\d*(?:[.,]\d+)?$/.test(String(km).trim())||!/^\d*(?:[.,]\d+)?$/.test(String(minutes).trim()))return '';
 const distance=numericText(km),duration=numericText(minutes);
 if(status==='não feito'||!Number.isFinite(distance)||!Number.isFinite(duration)||distance<=0||distance>1000||duration<=0||duration>1440)return '';
 return paceLabel(distance,duration);
}
// Decimal arithmetic keeps a typed exact distance intact when a 100 m step is used.
export function stepActivityDistance(value,direction){
 const text=String(value).trim().replace(',','.');
 if(text&&!/^\d*(?:\.\d+)?$/.test(text))return null;
 const number=Number(text||0);if(!Number.isFinite(number)||number<0||number>1000)return null;
 const digits=Math.max(1,(text.split('.')[1]||'').length),scale=10n**BigInt(digits);
 const [whole='',fraction='']=text.split('.'),integer=BigInt(whole||0)*scale+BigInt((fraction+'0'.repeat(digits)).slice(0,digits));
 const next=integer+BigInt(direction)*scale/10n,clamped=next<0n?0n:next>1000n*scale?1000n*scale:next;
 const raw=String(clamped).padStart(digits+1,'0');
 return (raw.slice(0,-digits)+'.'+raw.slice(-digits)).replace(/0+$/,'').replace(/\.$/,'');
}
const formHTML=()=>`<form id="recordForm" novalidate>
 <div class="dialog-head"><div><p class="activity-eyebrow">SEU RELATO</p><h2 id="recordTitle">Registrar atividade</h2></div><button type="button" data-close="recordDialog" aria-label="Fechar registro">✕</button></div>
 <div class="activity-scroll"><div id="recordContext" class="activity-context"></div><input name="session_id" type="hidden">
 <p id="activityStatusLabel" class="activity-label">Como foi o treino? <small>Obrigatório</small></p><select id="activityStatus" name="status" required hidden aria-describedby="activityStatusHelp activityStatusError"><option value="">Selecione a situação</option><option value="feito">Feito</option><option value="adaptado">Adaptado</option><option value="não feito">Não feito</option></select><div id="activityStatusButtons" class="activity-status-buttons" role="group" aria-labelledby="activityStatusLabel" aria-describedby="activityStatusHelp activityStatusError"><button type="button" data-activity-status="feito" aria-pressed="false"><span aria-hidden="true">✓</span> Feito</button><button type="button" data-activity-status="adaptado" aria-pressed="false">Adaptado</button><button type="button" data-activity-status="não feito" aria-pressed="false">Não feito</button></div><p id="activityStatusError" class="activity-field-error" role="alert"></p><p id="activityStatusHelp" class="activity-help" aria-live="polite"></p>
 <div id="activitySkipped" class="activity-skipped" hidden><p>Você pode salvar só a situação e um motivo opcional. Os valores preenchidos foram mantidos.</p><button type="button" id="activityShowResults" aria-controls="activityMetrics" aria-expanded="false">Revisar valores e sensações</button></div>
 <div id="activityMetrics">
 <section class="activity-section activity-measurements" aria-labelledby="activityResults"><h3 id="activityResults" class="activity-sr-only">O que você realizou</h3>
 <div class="activity-label-row"><label for="activityKm">Distância realizada</label><button type="button" class="activity-clear" data-activity-clear="km" aria-label="Limpar distância">Limpar</button></div><div class="activity-distance-stepper"><button type="button" data-distance-step="-1" aria-label="Diminuir 100 metros">−</button><div class="activity-distance-input"><input id="activityKm" name="km" type="text" inputmode="decimal" maxlength="30" placeholder="—" aria-describedby="activityDecimalHelp activityKmError"><span>km</span></div><button type="button" data-distance-step="1" aria-label="Aumentar 100 metros">+</button></div><p id="activityKmError" class="activity-field-error" role="alert"></p><p id="activityDecimalHelp" class="activity-help">Ajuste de 100 m ou toque no número para digitar. Opcional.</p>
 <div class="activity-label-row"><p id="activityDurationLabel" class="activity-label">Duração realizada</p><button type="button" class="activity-clear" data-activity-clear="minutes" aria-label="Limpar duração">Limpar</button></div><input id="activityMinutes" name="minutes" type="hidden"><div id="activityDuration" class="activity-duration" role="group" aria-labelledby="activityDurationLabel" aria-describedby="activityMinutesError"><label for="activityHours">Horas<select id="activityHours" name="durationHours">${durationOptions(24)}</select></label><label for="activityDurationMinutes">Minutos<select id="activityDurationMinutes" name="durationMinutes">${durationOptions(59)}</select></label><label for="activitySeconds">Segundos<select id="activitySeconds" name="durationSeconds">${durationOptions(59)}</select></label></div><p id="activityMinutesError" class="activity-field-error" role="alert"></p><p id="activityDurationHelp" class="activity-help">Opcional. Em branco é diferente de zero.</p>
 <div class="activity-pace"><div><span>Pace médio</span><output id="activityPace" aria-live="polite">—</output></div><p id="activityPaceHelp">Informe distância e duração.</p></div></section>
 <details id="activityFeelings" class="activity-feelings"><summary>Esforço, dor e recuperação <span>Opcional</span></summary><div class="activity-feelings-body">
 <section class="activity-section" aria-labelledby="effortLabel"><label id="effortLabel" for="activityEffort">Esforço percebido · 0 a 10</label><p id="effortHelp" class="activity-help">Quanto esforço o treino exigiu de você? Pense na atividade como um todo.</p><select id="activityEffort" name="effort" aria-describedby="effortHelp effortValue activityEffortError">${scaleOptions('effort')}</select><p id="activityEffortError" class="activity-field-error" role="alert"></p><p id="effortValue" class="activity-scale-value" aria-live="polite"></p>
 <details><summary>Entenda a escala de esforço</summary><p>0 indica nenhum esforço; 10, seu esforço máximo. Como referência, 5–6 representam esforço moderado e 7–8, intenso. Considere sua própria sensação.</p><p>Em esforço moderado, costuma ser possível conversar; em esforço intenso, falar frases fica mais difícil.</p><a href="https://www.cdc.gov/physical-activity-basics/measuring/" target="_blank" rel="noopener noreferrer">Referência de intensidade · CDC</a></details></section>
 <section class="activity-section" aria-labelledby="painLabel"><label id="painLabel" for="activityPain">Dor durante a atividade · 0 a 10</label><p id="painHelp" class="activity-help">Qual foi a maior dor que você sentiu? Dor é diferente de cansaço.</p><select id="activityPain" name="pain" aria-describedby="painHelp painValue activityPainError">${scaleOptions('pain')}</select><p id="activityPainError" class="activity-field-error" role="alert"></p><p id="painValue" class="activity-scale-value" aria-live="polite"></p>
 <details><summary>Entenda a escala de dor</summary><p>0 significa nenhuma dor; 10, a pior dor imaginável. Escolha o número que melhor descreve o que você sentiu. Se quiser, conte onde doeu nas observações.</p><a href="https://my.clevelandclinic.org/-/scassets/files/org/prepare-for-surgery/pacc-brochure-15-pai-2380.ashx?la=en#page=7" target="_blank" rel="noopener noreferrer">Referência da escala numérica · Cleveland Clinic, p. 7</a></details></section>
 <section class="activity-section"><label for="activityRecovery">Recuperação</label><select id="activityRecovery" name="recovery"><option value="">Ainda não avaliei</option><option>Normal</option><option>Pernas pesadas</option><option>Dor persistente</option></select></section></div></details></div>
 <section class="activity-notes"><label for="activityNotes" id="activityNotesLabel">Observações (opcional)</label><textarea id="activityNotes" name="notes" rows="2" maxlength="3000" aria-describedby="activityNotesError" placeholder="Como você se sentiu? Mudou algo no treino?"></textarea><p id="activityNotesError" class="activity-field-error" role="alert"></p></section>
 <details class="activity-about"><summary>Sobre este registro</summary><p>Os campos além da situação são opcionais. Use os valores reais; o treino previsto fica só como referência. Em branco é diferente de zero.</p><p>Seu relato fica separado dos comentários da equipe. Somente você pode editá-lo; dono e treinadores vinculados podem consultá-lo.</p></details>
 <div id="activityDiscard" class="activity-discard" hidden role="alert"><strong>Descartar alterações não salvas?</strong><p>O preenchimento desta tela será perdido. O registro salvo permanece no histórico.</p><div><button type="button" id="keepActivity">Continuar editando</button><button type="button" id="discardActivity">Descartar e fechar</button></div></div>
 <p id="saveError" class="error" role="alert" tabindex="-1"></p><p id="activitySaveState" class="activity-help" role="status"></p></div><div class="activity-actions"><button type="button" data-close="recordDialog" class="activity-cancel">Fechar</button><button type="submit" class="primary">Salvar atividade</button></div>
 </form>`;

export function createActivityEditor({window,dialog,save,onSaved,onState=()=>{}}) {
 dialog.innerHTML=formHTML();
 const form=dialog.querySelector('form'),get=id=>dialog.querySelector('#'+id);
 let context=null,baseline='',busy=false,version=0,reviewSkipped=false,viewportBound=false;
 const setText=(id,value)=>{if(get(id).textContent!==value)get(id).textContent=value;};
 const dirty=()=>!!context&&JSON.stringify(valuesOf(form))!==baseline;
 const focusStatus=()=>{const buttons=get('activityStatusButtons');(buttons.querySelector('[aria-pressed="true"]')||buttons.querySelector('button')).focus();};
 const fieldErrors={status:'activityStatusError',km:'activityKmError',minutes:'activityMinutesError',effort:'activityEffortError',pain:'activityPainError',notes:'activityNotesError'};
 const resetErrors=()=>{get('saveError').textContent='';form.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));Object.values(fieldErrors).forEach(id=>get(id).textContent='');};
 const viewport=window.visualViewport;
 const updateViewport=()=>{if(!viewport)return;dialog.style.setProperty('--activity-viewport-height',viewport.height+'px');dialog.style.setProperty('--activity-viewport-top',viewport.offsetTop+'px');};
 function bindViewport(){if(viewportBound||!viewport)return;viewportBound=true;viewport.addEventListener('resize',updateViewport);viewport.addEventListener('scroll',updateViewport);updateViewport();}
 function unbindViewport(){if(viewportBound){viewport.removeEventListener('resize',updateViewport);viewport.removeEventListener('scroll',updateViewport);}viewportBound=false;dialog.style.removeProperty('--activity-viewport-height');dialog.style.removeProperty('--activity-viewport-top');}
 function showDuration(){
  const text=form.elements.minutes.value;
  get('activitySeconds').querySelectorAll('[data-precise]').forEach(el=>el.remove());
  if(!text.trim()||!Number.isFinite(numericText(text))||numericText(text)<0){for(const name of ['durationHours','durationMinutes','durationSeconds'])form.elements[name].value='';return;}
  const total=numericText(text)*60;let hours=Math.floor(total/3600),minutes=Math.floor((total-hours*3600)/60),seconds=Math.round((total-hours*3600-minutes*60)*1e9)/1e9;
  // Carry display rounding at a boundary; the untouched decimal minutes stay exact.
  if(seconds>=60){seconds=0;minutes++;}if(minutes>=60){minutes=0;hours++;}
  if(!Number.isInteger(seconds)){const option=window.document.createElement('option');option.dataset.precise='true';option.value=String(seconds);option.textContent=storedDecimal(seconds).replace('.',',');get('activitySeconds').append(option);}
  form.elements.durationHours.value=String(hours);form.elements.durationMinutes.value=String(minutes);form.elements.durationSeconds.value=String(seconds);
 }
 function readDuration(){
  const names=['durationHours','durationMinutes','durationSeconds'],parts=names.map(name=>form.elements[name].value);
  if(parts.every(value=>value==='')){form.elements.minutes.value='';return;}
  names.forEach((name,index)=>{if(parts[index]==='')form.elements[name].value='0';});
  // Only an explicit edit of a time selector rewrites the persisted decimal minutes.
  form.elements.minutes.value=storedDecimal(Number(parts[0]||0)*60+Number(parts[1]||0)+Number(parts[2]||0)/60);
 }
 function update(){
  const status=form.elements.status.value;
  form.querySelectorAll('[data-activity-status]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.activityStatus===status)));
  setText('activityStatusHelp',({'feito':'Realizou a sessão conforme o previsto.','adaptado':'Realizou a sessão com mudanças.','não feito':'Não realizou a sessão. Os valores preenchidos não são apagados.'})[status]||'Escolha uma situação para registrar.');
  get('activitySkipped').hidden=status!=='não feito';get('activityMetrics').hidden=status==='não feito'&&!reviewSkipped;
  get('activityShowResults').setAttribute('aria-expanded',String(reviewSkipped));get('activityShowResults').textContent=reviewSkipped?'Recolher valores e sensações':'Revisar valores e sensações';
  const pace=activityPace(form.elements.km.value,form.elements.minutes.value,status);setText('activityPace',pace?pace+' min/km':'—');setText('activityPaceHelp',pace?'Calculado com os valores realizados.':status==='não feito'?'Não calculado para treino não feito.':'Informe distância e duração.');
  get('activityNotesLabel').textContent=status==='não feito'?'Motivo ou observações (opcional)':'Observações (opcional)';
  form.elements.notes.placeholder=status==='não feito'?'Se quiser, conte por que não treinou.':'Como você se sentiu? Mudou algo no treino?';
  for(const kind of ['effort','pain']){const select=form.elements[kind],label=select.selectedOptions[0]?.textContent.split(' · ')[1],text=select.value===''?'Não informado. Zero só é registrado se você escolher 0.':select.value+' / 10'+(label?' · '+label:'');setText(kind+'Value',text);}
  onState();
 }
 function close(){if(busy)return false;if(dirty()){get('activityDiscard').hidden=false;get('keepActivity').focus();return false;}finish();return true;}
 function finish(){version++;context=null;baseline='';unbindViewport();dialog.close();get('activityDiscard').hidden=true;form.reset();form.elements.minutes.value='';reviewSkipped=false;onState();}
 function reset(){finish();busy=false;form.elements.session_id.value='';form.elements.recovery.innerHTML=recoveryOptions.map(value=>`<option value="${esc(value)}">${esc(value||'Ainda não avaliei')}</option>`).join('');get('recordContext').replaceChildren();get('recordTitle').textContent='Registrar atividade';resetErrors();get('activitySaveState').textContent='';get('effortValue').textContent='';get('painValue').textContent='';get('activityStatusHelp').textContent='';form.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=false);form.removeAttribute('aria-busy');form.querySelector('[type=submit]').textContent='Salvar atividade';onState();}
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||busy)return;
  event.stopPropagation();
  if(button.dataset.close==='recordDialog'){event.stopPropagation();close();}
  if(button.id==='keepActivity'){get('activityDiscard').hidden=true;focusStatus();}
  if(button.id==='discardActivity')finish();
  if(button.dataset.activityStatus){form.elements.status.value=button.dataset.activityStatus;reviewSkipped=false;resetErrors();update();}
  if(button.id==='activityShowResults'){reviewSkipped=!reviewSkipped;update();}
  if(button.dataset.distanceStep){const next=stepActivityDistance(form.elements.km.value,Number(button.dataset.distanceStep));resetErrors();if(next==null){get('activityKmError').textContent='Confira a distância antes de usar os ajustes.';form.elements.km.setAttribute('aria-invalid','true');form.elements.km.focus();}else{form.elements.km.value=next.replace('.',',');update();}}
  if(button.dataset.activityClear){form.elements[button.dataset.activityClear].value='';if(button.dataset.activityClear==='minutes')showDuration();resetErrors();update();}
 });
 function onEdit(event){if(/^duration(?:Hours|Minutes|Seconds)$/.test(event.target.name))readDuration();else if(event.target.name==='minutes')showDuration();if(event.target.name==='status')reviewSkipped=false;resetErrors();update();}
 form.addEventListener('input',onEdit);form.addEventListener('change',onEdit);
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!context)return;
  resetErrors();get('activityDiscard').hidden=true;
  let values;try{values=validateActivity(valuesOf(form));}catch(error){get('saveError').textContent=error.message;if(fieldErrors[error.field])get(fieldErrors[error.field]).textContent=error.message;const field=form.elements[error.field];field?.setAttribute('aria-invalid','true');if(error.field==='status'){get('activityStatusButtons').setAttribute('aria-invalid','true');focusStatus();}else{reviewSkipped=true;get('activityMetrics').hidden=false;if(['effort','pain'].includes(error.field))get('activityFeelings').open=true;if(error.field==='minutes'){get('activityDuration').setAttribute('aria-invalid','true');get('activityHours').focus();}else field?.focus();}return;}
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
   form.reset();form.elements.minutes.value='';reviewSkipped=false;form.querySelectorAll('details').forEach(details=>details.open=false);form.elements.session_id.value=session.id;
   form.elements.recovery.innerHTML=recoveryOptions.map(value=>`<option value="${esc(value)}">${esc(value||'Ainda não avaliei')}</option>`).join('');
   if(record?.recovery&&!recoveryOptions.includes(record.recovery)){const option=window.document.createElement('option');option.value=record.recovery;option.textContent=record.recovery;form.elements.recovery.append(option);}
   for(const key of fields)if(record?.[key]!=null)form.elements[key].value=numbers.includes(key)?storedDecimal(record[key]):String(record[key]);
   get('recordTitle').textContent=record?'Editar atividade':'Registrar atividade';
   const prescribed=[session.km!=null&&session.km!==''?amount(session.km,'km'):null,session.minutes!=null&&session.minutes!==''?amount(session.minutes,'min'):null].filter(Boolean);
   get('recordContext').innerHTML=`<strong>${esc(session.type)}</strong><p>${esc(displayDate(session.date))} · ${esc(plan.name)}${plan.version!=null?' · v'+esc(plan.version):''}${plan.state==='archived'?' · histórico':''}</p><details><summary>Ver treino previsto${prescribed.length?' · '+esc(prescribed.join(' · ')):''}</summary>${session.description?'<p class="preserve-lines">'+esc(session.description)+'</p>':''}${session.intensity?'<p>'+esc(session.intensity)+'</p>':''}${session.gym?'<p>Musculação: '+esc(session.gym)+'</p>':''}${session.notes?'<p>Observações: '+esc(session.notes)+'</p>':''}</details>`;
   showDuration();resetErrors();get('activityDiscard').hidden=true;baseline=JSON.stringify(valuesOf(form));update();if(!dialog.open)dialog.showModal();bindViewport();dialog.querySelector('.activity-scroll').scrollTop=0;focusStatus();
  },close,reset,get dirty(){return dirty();},get busy(){return busy;},get isOpen(){return !!context;}
 };
}
