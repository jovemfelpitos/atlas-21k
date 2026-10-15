import {authError,authRedirect} from './auth-client.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bucket='/storage/v1/object/atlas-avatars';
const photoPath=path=>/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/.test(path||'');
export const initials=name=>String(name||'Atlas Run').trim().split(/\s+/).filter(Boolean).slice(0,2).map(word=>Array.from(word)[0]).join('').toUpperCase();
export function profileToday(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const part=type=>parts.find(p=>p.type===type).value;return `${part('year')}-${part('month')}-${part('day')}`;
}
export function validateBirthDate(value,today=profileToday()){
 if(!value)return null;
 const parsed=new Date(value+'T12:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'0001-01-01'||value>today||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)throw Error('Informe uma data de nascimento válida, até hoje.');
 return value;
}
export async function prepareAvatar(file,w=window){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size<=0||file.size>8*1024*1024)throw Error('Escolha uma foto JPG, PNG ou WebP de até 8 MB.');
 const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
 const valid=file.type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:file.type==='image/png'?[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b):String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 if(!valid)throw Error('Esse arquivo não é uma foto válida. Escolha JPG, PNG ou WebP.');
 let picture,temporary;
 try{
  if(w.createImageBitmap)picture=await w.createImageBitmap(file);
  else{temporary=w.URL.createObjectURL(file);picture=await new Promise((resolve,reject)=>{const image=new w.Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=temporary;});}
  const width=picture.width||picture.naturalWidth,height=picture.height||picture.naturalHeight;
  if(!width||!height||width*height>40000000)throw Error('Foto muito grande. Escolha uma imagem de até 40 megapixels.');
  const canvas=w.document.createElement('canvas');canvas.width=canvas.height=Math.min(640,width,height);
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Não foi possível preparar a foto neste navegador.');
  const side=Math.min(width,height);ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(picture,(width-side)/2,(height-side)/2,side,side,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.85));
  if(!blob||blob.size>524288)throw Error('Não foi possível reduzir essa foto. Escolha outra imagem.');return blob;
 }catch(error){if(error instanceof Error&&/Foto|foto|navegador/.test(error.message))throw error;throw Error('Não foi possível abrir essa foto. Escolha outra imagem.');}
 finally{picture?.close?.();if(temporary)w.URL.revokeObjectURL(temporary);}
}
export function createAvatarStore({request,urlAPI=URL}){
 let path=null,url=null,pending=null,version=0;
 function clear(){version++;path=null;pending=null;if(url)urlAPI.revokeObjectURL(url);url=null;}
 return {clear,load(value){
  if(!value){clear();return Promise.resolve(null);}if(!photoPath(value))return Promise.reject(Error('Foto indisponível.'));
  if(value===path&&pending)return pending;clear();path=value;const expected=version;
  pending=request(bucket+'/'+value,{responseType:'blob',cache:'no-store'}).then(blob=>{
   if(expected!==version)return null;if(blob.type!=='image/jpeg')throw Error('Foto indisponível.');url=urlAPI.createObjectURL(blob);return url;
  }).catch(error=>{if(expected===version)clear();throw error;});return pending;
 }};
}
const passwordField=(label,id,autocomplete='current-password')=>`<label for="${id}">${label}</label><div class="profile-password"><input id="${id}" name="${id}" type="password" autocomplete="${autocomplete}" ${autocomplete==='new-password'?'minlength="8"':''} required><button type="button" data-profile-show="${id}" aria-label="Mostrar ${label.toLowerCase()}" aria-pressed="false">Mostrar</button></div>`;

export function createProfileEditor({window:w,request,getSession,keepSession,onProfile,avatars,accountControls=()=>'',onState=()=>{},convertPhoto=file=>prepareAvatar(file,w)}){
 let root=null,details=null,busy=false,version=0,mode='overview',baseline='';
 const $=selector=>root?.querySelector(selector);
 const formIDs={personal:'profileForm',email:'profileEmailForm',password:'profilePasswordForm'};
 function status(text,error=false){const el=$('#profileStatus');if(el){el.textContent=text;el.setAttribute('role',error?'alert':'status');el.classList.toggle('error',error);}}
 function personalValues(form){return {name:form.elements.name.value.trim(),birth_date:form.elements.birth_date.value,available_days:[...form.querySelectorAll('[name=days]:checked')].map(input=>Number(input.value)).sort((a,b)=>a-b)};}
 function dirty(){
  const form=$('#'+formIDs[mode]);if(!form)return false;
  if(mode==='personal')return JSON.stringify(personalValues(form))!==baseline;
  // A password manager can fill the current credentials without a new change.
  if(mode==='email'){const value=form.elements.newEmail.value.trim().toLowerCase();return !!value&&value!==(getSession()?.user.email||'').toLowerCase();}
  return !!(form.elements.newPassword.value||form.elements.newPasswordConfirm.value);
 }
 function state(value){busy=value;root?.querySelectorAll('button,input,select').forEach(el=>el.disabled=value);onState();}
 function credentials(){
  const user=getSession()?.user;if(!user)return;const pending=user.new_email||'';
  const email=$('#profileEmail'),note=$('#pendingEmail');if(email)email.textContent=user.email||'E-mail da conta';
  if(note)note.textContent=pending&&pending!==user.email?'Alteração pendente para '+pending+'. Confirme os links enviados ao endereço atual e ao novo.':'Seu e-mail só muda após confirmar os links nos dois endereços.';
 }
 async function avatar(){
  const image=$('#profileAvatar'),initial=$('#profileInitials'),remove=$('#removeAvatar'),hint=$('#avatarHint'),expected=version;
  if(!image||!initial)return;initial.textContent=initials(details.name);remove.hidden=!details.avatar_path;image.hidden=true;initial.hidden=false;
  try{const url=await avatars.load(details.avatar_path);if(expected!==version||!image.isConnected||!url)return;image.src=url;image.hidden=false;initial.hidden=true;}catch{if(expected===version&&hint?.isConnected)hint.textContent='Não foi possível carregar sua foto. Você pode tentar sincronizar novamente.';}
 }
 function clearCredentials(form){form?.querySelectorAll('[autocomplete=current-password],[autocomplete=new-password],#newEmail').forEach(input=>input.value='');}
 function actions(label){return `<div class="profile-actions"><button type="submit" class="primary">${label}</button><button type="button" id="discardProfile" class="secondary">Cancelar edição</button></div><p class="muted profile-edit-note">Cancelar descarta somente esta edição.</p>`;}
 function overview(){
  if(!root)return;clearCredentials($('#'+formIDs[mode]));mode='overview';baseline='';
  const days=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'],available=[...new Set((details.available_days||[]).map(Number))].filter(day=>day>=0&&day<=6).sort((a,b)=>a-b).map(day=>days[day]).join(', ');
  const birth=details.birth_date?details.birth_date.split('-').reverse().join('/'):'Não informada';
  $('#profileBody').innerHTML=`<section class="card profile-photo"><div class="profile-avatar"><span id="profileInitials"></span><img id="profileAvatar" alt="Sua foto de perfil" hidden></div><div><h3>Sua foto</h3><label class="photo-picker">Escolher foto<input id="avatarUpload" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Escolher foto"></label><button id="removeAvatar" type="button" ${details.avatar_path?'':'hidden'}>Remover foto</button><p id="avatarHint" class="muted">JPG, PNG ou WebP, até 8 MB. A foto é ajustada para um quadrado.</p></div></section>
   <section class="card"><h3>Dados pessoais</h3><dl class="profile-summary"><div><dt>Nome</dt><dd>${esc(details.name)}</dd></div><div><dt>Data de nascimento</dt><dd>${esc(birth)}</dd></div><div><dt>Dias disponíveis</dt><dd>${esc(available||'Não informados')}</dd></div></dl><button id="editProfile" type="button" class="secondary">Editar dados pessoais</button></section>
   <section class="card"><h3>Acesso à conta</h3><p>E-mail atual: <strong id="profileEmail"></strong></p><p id="pendingEmail" class="muted"></p><div class="profile-access-actions"><button id="editEmail" type="button">Alterar e-mail</button><button id="editPassword" type="button">Alterar senha</button><button id="refreshProfileEmail" type="button">Conferir confirmação do e-mail</button></div></section>${accountControls()}`;
  credentials();avatar();onState();
 }
 function edit(next){
  if(!formIDs[next]||busy)return;mode=next;status('');
  const back='<button type="button" id="backProfile" class="profile-back">← Meu perfil</button>';
  let content;
  if(mode==='personal')content=`<h3>Editar dados pessoais</h3><form id="profileForm"><label>Nome completo<input name="name" autocomplete="name" maxlength="120" required value="${esc(details.name)}"></label><label>Data de nascimento <span class="muted">(opcional)</span><input name="birth_date" type="date" autocomplete="bday" max="${profileToday()}" value="${esc(details.birth_date)}"></label><fieldset class="profile-days"><legend>Dias disponíveis para treinar</legend>${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((day,i)=>`<label><input type="checkbox" name="days" value="${i}" ${(details.available_days||[]).map(Number).includes(i)?'checked':''}>${day}</label>`).join('')}</fieldset><p class="muted">Preferências para futuros planos. As datas dos treinos existentes continuam iguais.</p>${actions('Salvar dados pessoais')}</form>`;
  else if(mode==='email')content=`<h3>Alterar e-mail</h3><form id="profileEmailForm"><label>Novo e-mail<input id="newEmail" name="newEmail" type="email" autocomplete="email" maxlength="254" required></label>${passwordField('Senha atual','emailCurrentPassword')}<p class="muted">Vamos verificar sua senha e enviar um link para cada endereço. Seu histórico permanece nesta conta.</p>${actions('Solicitar alteração de e-mail')}</form>`;
  else content=`<h3>Alterar senha</h3><form id="profilePasswordForm">${passwordField('Senha atual','currentPassword')}${passwordField('Nova senha','newPassword','new-password')}${passwordField('Repetir nova senha','newPasswordConfirm','new-password')}<p class="muted">Use pelo menos 8 caracteres. Prefira uma senha longa e exclusiva.</p>${actions('Salvar nova senha')}<a href="/recuperar-senha">Esqueci minha senha</a></form>`;
  $('#profileBody').innerHTML=back+'<section class="card profile-edit">'+content+'</section><section id="profileDiscard" class="notice" hidden><p>Descartar as alterações desta edição?</p><button type="button" id="keepProfile">Continuar editando</button><button type="button" id="confirmDiscardProfile">Descartar e voltar</button></section>';
  baseline=mode==='personal'?JSON.stringify(personalValues($('#profileForm'))):'';
  $('#'+formIDs[mode]).querySelector('input')?.focus();onState();
 }
 async function patch(values,expectedPhoto){
  const expected=version;let path='/rest/v1/atlas_profiles?user_id=eq.'+encodeURIComponent(getSession().user.id);
  if(expectedPhoto!==undefined)path+='&avatar_path='+(expectedPhoto===null?'is.null':'eq.'+encodeURIComponent(expectedPhoto));
  const rows=await request(path,{method:'PATCH',body:JSON.stringify(values),headers:{Prefer:'return=representation'}});
  if(expected!==version)throw Error('A tela do perfil foi encerrada.');
  if(!rows?.length)throw Error('O perfil mudou em outra aba. Sincronize antes de tentar novamente.');details=rows[0];onProfile(details);return details;
 }
 async function removeFile(path){if(!photoPath(path))return;try{await request(bucket,{method:'DELETE',body:JSON.stringify({prefixes:[path]})});}catch{/* Unreferenced objects remain private to their owner; never undo a committed profile update. */}}
 async function submit(event){
  const form=event.target;if(form.id!==formIDs[mode])return;event.preventDefault();if(busy)return;
  const repeat=form.elements.newPasswordConfirm;repeat?.setCustomValidity('');if(repeat&&repeat.value!==form.elements.newPassword.value){repeat.setCustomValidity('As novas senhas precisam ser iguais.');repeat.reportValidity();return;}if(!form.reportValidity())return;
  const expected=version;state(true);status('Salvando…');
  try{
   let message;
   if(mode==='personal'){
    const values=personalValues(form);if(!values.name||values.name.length>120)throw Error('Informe um nome de até 120 caracteres.');
    await patch({...values,birth_date:validateBirthDate(values.birth_date)});message='Dados pessoais salvos. Seus dados valem para todas as áreas da conta.';
   }else if(mode==='password'){
    const user=await request('/auth/v1/user',{method:'PUT',body:JSON.stringify({password:form.elements.newPassword.value,current_password:form.elements.currentPassword.value})});
    if(expected!==version)return;if(user?.id!==getSession().user.id)throw Error('Não foi possível validar sua conta. Entre novamente.');keepSession({...getSession(),user});message='Senha alterada. Use a nova senha nos próximos acessos.';
   }else{
    const session=getSession(),email=form.elements.newEmail.value.trim();if(email.toLowerCase()===session.user.email.toLowerCase())throw Error('Informe um e-mail diferente do atual.');
    const verified=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:session.user.email,password:form.elements.emailCurrentPassword.value})},false);
    if(expected!==version)return;if(verified?.user?.id!==session.user.id||!verified.access_token||!verified.refresh_token)throw Error('Não foi possível verificar sua identidade. Entre novamente.');
    keepSession({...verified,expires_at:Date.now()/1000+(verified.expires_in||3600)});
    const redirect=authRedirect(w.location.origin,'/confirmar-email?flow=email-change&next='+encodeURIComponent('/app?view=profile'),w.ATLAS_CONFIG?.siteUrl);
    const user=await request('/auth/v1/user?redirect_to='+encodeURIComponent(redirect),{method:'PUT',body:JSON.stringify({email})});
    if(expected!==version)return;if(user?.id!==session.user.id)throw Error('Não foi possível validar sua conta. Entre novamente.');keepSession({...getSession(),user});message='Pedido enviado. Confirme a troca nos e-mails atual e novo; seu login atual continua válido até concluir.';
   }
   if(expected!==version)return;clearCredentials(form);overview();status(message);$('#profileStatus')?.focus();
  }catch(error){if(expected===version)status(authError(error),true);}
  finally{form.querySelectorAll('[autocomplete=current-password]').forEach(input=>input.value='');form.querySelectorAll('[autocomplete=current-password],[autocomplete=new-password]').forEach(input=>input.type='password');form.querySelectorAll('[data-profile-show]').forEach(button=>{button.textContent='Mostrar';button.setAttribute('aria-pressed','false');button.setAttribute('aria-label','Mostrar '+form.querySelector('label[for="'+button.dataset.profileShow+'"]').textContent.toLowerCase());});if(expected===version)state(false);}
 }
 async function change(event){
  if(event.target.id!=='avatarUpload'){input(event);return;}const file=event.target.files?.[0];if(!file||busy)return;
  const expected=version;state(true);status('Preparando sua foto…');const old=details.avatar_path||null;
  try{const blob=await convertPhoto(file);if(expected!==version)return;const path=getSession().user.id+'/'+w.crypto.randomUUID()+'.jpg';
   await request(bucket+'/'+path,{method:'POST',body:blob,headers:{'Content-Type':'image/jpeg','cache-control':'max-age=0','x-upsert':'false'}});
   if(expected!==version)return;await patch({avatar_path:path},old);await avatar();if(expected!==version)return;await removeFile(old);status('Foto atualizada em todas as áreas da conta.');
  }catch(error){if(expected===version)status(authError(error),true);}finally{event.target.value='';if(expected===version)state(false);}
 }
 async function click(event){
  const button=event.target.closest('button');if(!button||busy)return;
  const edits={editProfile:'personal',editEmail:'email',editPassword:'password'},origin={personal:'editProfile',email:'editEmail',password:'editPassword'}[mode];
  if(edits[button.id]){edit(edits[button.id]);return;}
  if(button.id==='backProfile'){if(dirty()){$('#profileDiscard').hidden=false;$('#keepProfile').focus();}else{overview();status('');$('#'+origin)?.focus();}return;}
  if(['discardProfile','confirmDiscardProfile'].includes(button.id)){discard();status('Edição cancelada.');$('#'+origin)?.focus();return;}
  if(button.id==='keepProfile'){$('#profileDiscard').hidden=true;$('#'+formIDs[mode]).querySelector('input')?.focus();return;}
  if(button.dataset.profileShow){const field=$('#'+button.dataset.profileShow),show=field.type==='password';field.type=show?'text':'password';button.textContent=show?'Ocultar':'Mostrar';button.setAttribute('aria-pressed',String(show));button.setAttribute('aria-label',(show?'Ocultar ':'Mostrar ')+root.querySelector('label[for="'+field.id+'"]').textContent.toLowerCase());return;}
  if(button.id==='removeAvatar'){
   const expected=version;state(true);status('Removendo foto…');const old=details.avatar_path;
   try{await patch({avatar_path:null},old);await avatar();if(expected!==version)return;await removeFile(old);status('Foto removida. Seu perfil usa as iniciais.');}catch(error){if(expected===version)status(authError(error),true);}finally{if(expected===version)state(false);}
  }else if(button.id==='refreshProfileEmail'){
   const expected=version;state(true);try{const user=await request('/auth/v1/user');if(expected!==version)return;if(user?.id!==getSession().user.id)throw Error('Entre novamente para validar sua conta.');keepSession({...getSession(),user});credentials();status('Situação do e-mail atualizada.');}catch(error){if(expected===version)status(authError(error),true);}finally{if(expected===version)state(false);}
  }
 }
 function input(event){if(['newPassword','newPasswordConfirm'].includes(event.target.name))$('#newPasswordConfirm')?.setCustomValidity('');if(!busy)status(dirty()?'Alterações nesta edição ainda não salvas.':'');onState();}
 function detach(){clearCredentials($('#'+formIDs[mode]));if(root){root.removeEventListener('submit',submit);root.removeEventListener('click',click);root.removeEventListener('change',change);root.removeEventListener('input',input);}root=null;version++;mode='overview';baseline='';busy=false;}
 function discard(){clearCredentials($('#'+formIDs[mode]));if(root){if(getSession()?.user)overview();else root.replaceChildren();}onState();}
 return {get busy(){return busy;},get dirty(){return dirty();},discard,detach,mount(container,value){
  detach();root=container;details=value;
  root.innerHTML='<section class="profile-panel"><h2>Meu perfil</h2><p class="muted">Consulte seus dados ou escolha o que quer alterar.</p><p id="profileStatus" tabindex="-1" role="status" aria-live="polite"></p><div id="profileBody"></div></section>';
  root.addEventListener('submit',submit);root.addEventListener('click',click);root.addEventListener('change',change);root.addEventListener('input',input);overview();
 }};
}
