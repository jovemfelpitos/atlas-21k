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
 let root=null,details=null,busy=false,version=0;
 const $=selector=>root?.querySelector(selector);
 function status(text,error=false){const el=$('#profileStatus');if(el){el.textContent=text;el.setAttribute('role',error?'alert':'status');el.classList.toggle('error',error);}}
 function dirty(){
  const f=$('#profileForm');if(!f)return false;
  if(f.elements.name.value.trim()!==details.name||f.elements.birth_date.value!==(details.birth_date||''))return true;
  const days=[...f.querySelectorAll('[name=days]:checked')].map(x=>Number(x.value)).sort();
  if(JSON.stringify(days)!==JSON.stringify([...(details.available_days||[])].sort()))return true;
  return [...root.querySelectorAll('[autocomplete=current-password],[autocomplete=new-password],#newEmail')].some(input=>input.value!=='');
 }
 function state(value){busy=value;root?.querySelectorAll('button,input,select').forEach(el=>el.disabled=value);onState();}
 function credentials(){
  const user=getSession().user,pending=user.new_email||'';
  $('#profileEmail').textContent=user.email||'E-mail da conta';
  $('#pendingEmail').textContent=pending&&pending!==user.email?'Alteração pendente para '+pending+'. Confirme os links enviados ao endereço atual e ao novo.':'Seu e-mail só muda após confirmar os links nos dois endereços.';
 }
 async function avatar(){const target=root,expected=version;$('#profileInitials').textContent=initials(details.name);$('#removeAvatar').hidden=!details.avatar_path;$('#profileAvatar').hidden=true;$('#profileInitials').hidden=false;
  try{const url=await avatars.load(details.avatar_path);if(target!==root||expected!==version||!url)return;$('#profileAvatar').src=url;$('#profileAvatar').hidden=false;$('#profileInitials').hidden=true;}catch{if(target===root)$('#avatarHint').textContent='Não foi possível carregar sua foto. Você pode tentar sincronizar novamente.';}
 }
 async function patch(values,expectedPhoto){
  let path='/rest/v1/atlas_profiles?user_id=eq.'+encodeURIComponent(getSession().user.id);
  if(expectedPhoto!==undefined)path+='&avatar_path='+(expectedPhoto===null?'is.null':'eq.'+encodeURIComponent(expectedPhoto));
  const rows=await request(path,{method:'PATCH',body:JSON.stringify(values),headers:{Prefer:'return=representation'}});
  if(!rows?.length)throw Error('O perfil mudou em outra aba. Sincronize antes de tentar novamente.');details=rows[0];onProfile(details);return details;
 }
 async function removeFile(path){if(!photoPath(path))return;try{await request(bucket,{method:'DELETE',body:JSON.stringify({prefixes:[path]})});}catch{/* Unreferenced objects remain private to their owner; never undo a committed profile update. */}}
 async function submit(event){
  const form=event.target;if(!['profileForm','profileEmailForm','profilePasswordForm'].includes(form.id))return;event.preventDefault();if(busy)return;
  const repeat=form.elements.newPasswordConfirm;repeat?.setCustomValidity('');if(repeat&&repeat.value!==form.elements.newPassword.value){repeat.setCustomValidity('As novas senhas precisam ser iguais.');repeat.reportValidity();return;}if(!form.reportValidity())return;
  state(true);status('Salvando…');
  try{
   if(form.id==='profileForm'){
    const name=form.elements.name.value.trim();if(!name||name.length>120)throw Error('Informe um nome de até 120 caracteres.');
    await patch({name,birth_date:validateBirthDate(form.elements.birth_date.value),available_days:[...form.querySelectorAll('[name=days]:checked')].map(x=>Number(x.value))});
    form.elements.name.value=name;for(const input of form.querySelectorAll('input')){input.defaultValue=input.value;if(input.type==='checkbox')input.defaultChecked=input.checked;}await avatar();status('Perfil salvo. Seus dados valem para todas as áreas da conta.');
   }else if(form.id==='profilePasswordForm'){
    const user=await request('/auth/v1/user',{method:'PUT',body:JSON.stringify({password:form.elements.newPassword.value,current_password:form.elements.currentPassword.value})});
    if(user?.id!==getSession().user.id)throw Error('Não foi possível validar sua conta. Entre novamente.');keepSession({...getSession(),user});form.reset();status('Senha alterada. Use a nova senha nos próximos acessos.');
   }else{
    const session=getSession(),email=form.elements.newEmail.value.trim();if(email.toLowerCase()===session.user.email.toLowerCase())throw Error('Informe um e-mail diferente do atual.');
    const verified=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:session.user.email,password:form.elements.emailCurrentPassword.value})},false);
    if(verified?.user?.id!==session.user.id||!verified.access_token||!verified.refresh_token)throw Error('Não foi possível verificar sua identidade. Entre novamente.');
    keepSession({...verified,expires_at:Date.now()/1000+(verified.expires_in||3600)});
    const redirect=authRedirect(w.location.origin,'/confirmar-email?flow=email-change&next='+encodeURIComponent('/app?view=profile'),w.ATLAS_CONFIG?.siteUrl);
    const user=await request('/auth/v1/user?redirect_to='+encodeURIComponent(redirect),{method:'PUT',body:JSON.stringify({email})});
    if(user?.id!==session.user.id)throw Error('Não foi possível validar sua conta. Entre novamente.');keepSession({...getSession(),user});form.reset();credentials();status('Pedido enviado. Confirme a troca nos e-mails atual e novo; seu login atual continua válido até concluir.');
   }
  }catch(error){status(authError(error),true);}
  finally{form.querySelectorAll('[autocomplete=current-password]').forEach(input=>input.value='');form.querySelectorAll('[autocomplete=current-password],[autocomplete=new-password]').forEach(input=>input.type='password');form.querySelectorAll('[data-profile-show]').forEach(button=>{button.textContent='Mostrar';button.setAttribute('aria-pressed','false');button.setAttribute('aria-label','Mostrar '+form.querySelector('label[for="'+button.dataset.profileShow+'"]').textContent.toLowerCase());});state(false);}
 }
 async function change(event){
  if(event.target.id!=='avatarUpload'){if(!busy)status(dirty()?'Alterações ainda não salvas.':'');onState();return;}const file=event.target.files?.[0];if(!file||busy)return;
  state(true);status('Preparando sua foto…');const old=details.avatar_path||null;
  try{const blob=await convertPhoto(file);const path=getSession().user.id+'/'+w.crypto.randomUUID()+'.jpg';
   await request(bucket+'/'+path,{method:'POST',body:blob,headers:{'Content-Type':'image/jpeg','cache-control':'max-age=0','x-upsert':'false'}});
   await patch({avatar_path:path},old);await avatar();await removeFile(old);status('Foto atualizada em todas as áreas da conta.');
  }catch(error){status(authError(error),true);}finally{event.target.value='';state(false);}
 }
 async function click(event){
  const button=event.target.closest('button');if(!button||busy)return;
  if(button.dataset.profileShow){const input=$('#'+button.dataset.profileShow),show=input.type==='password';input.type=show?'text':'password';button.textContent=show?'Ocultar':'Mostrar';button.setAttribute('aria-pressed',String(show));button.setAttribute('aria-label',(show?'Ocultar ':'Mostrar ')+root.querySelector('label[for="'+input.id+'"]').textContent.toLowerCase());return;}
  if(button.id==='removeAvatar'){
   state(true);status('Removendo foto…');const old=details.avatar_path;
   try{await patch({avatar_path:null},old);await avatar();await removeFile(old);status('Foto removida. Seu perfil usa as iniciais.');}catch(error){status(authError(error),true);}finally{state(false);}
  }else if(button.id==='refreshProfileEmail'){
   state(true);try{const user=await request('/auth/v1/user');if(user?.id!==getSession().user.id)throw Error('Entre novamente para validar sua conta.');keepSession({...getSession(),user});credentials();status('Situação do e-mail atualizada.');}catch(error){status(authError(error),true);}finally{state(false);}
  }else if(button.id==='discardProfile'){discard();status('Alterações não salvas descartadas.');}
 }
 function input(event){if(['newPassword','newPasswordConfirm'].includes(event.target.name))$('#newPasswordConfirm')?.setCustomValidity('');if(!busy)status(dirty()?'Alterações ainda não salvas.':'');onState();}
 function detach(){if(root){root.removeEventListener('submit',submit);root.removeEventListener('click',click);root.removeEventListener('change',change);root.removeEventListener('input',input);}root=null;version++;}
 function discard(){root?.querySelectorAll('form').forEach(f=>f.reset());root?.querySelectorAll('[type=password]').forEach(i=>i.value='');onState();}
 return {get busy(){return busy;},get dirty(){return dirty();},discard,detach,mount(container,value){
  detach();root=container;details=value;
  root.innerHTML=`<section class="profile-panel"><h2>Meu perfil</h2><p class="muted">Seus dados são os mesmos nas áreas de atleta e treinador.</p><p id="profileStatus" role="status" aria-live="polite"></p>
   <section class="card profile-photo"><div class="profile-avatar"><span id="profileInitials">${esc(initials(details.name))}</span><img id="profileAvatar" alt="Sua foto de perfil" hidden></div><div><h3>Sua foto</h3><label class="photo-picker">Escolher foto<input id="avatarUpload" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Escolher foto"></label><button id="removeAvatar" type="button" ${details.avatar_path?'':'hidden'}>Remover foto</button><p id="avatarHint" class="muted">JPG, PNG ou WebP, até 8 MB. A foto é ajustada para um quadrado.</p></div></section>
   <section class="card"><h3>Dados pessoais</h3><form id="profileForm"><label>Nome completo<input name="name" autocomplete="name" maxlength="120" required value="${esc(details.name)}"></label><label>Data de nascimento <span class="muted">(opcional)</span><input name="birth_date" type="date" autocomplete="bday" max="${profileToday()}" value="${esc(details.birth_date)}"></label><fieldset class="profile-days"><legend>Dias disponíveis para treinar</legend>${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((day,i)=>`<label><input type="checkbox" name="days" value="${i}" ${(details.available_days||[]).includes(i)?'checked':''}>${day}</label>`).join('')}</fieldset><p class="muted">Preferências para futuros planos. As datas dos treinos existentes continuam iguais.</p><button type="submit" class="primary">Salvar perfil</button></form></section>
   <section class="card"><h3>Acesso à conta</h3><p>E-mail atual: <strong id="profileEmail"></strong></p><p id="pendingEmail" class="muted"></p><button id="refreshProfileEmail" type="button">Conferir confirmação do e-mail</button><details><summary>Alterar e-mail</summary><form id="profileEmailForm"><label>Novo e-mail<input id="newEmail" name="newEmail" type="email" autocomplete="email" maxlength="254" required></label>${passwordField('Senha atual','emailCurrentPassword')}<p class="muted">Vamos verificar sua senha e enviar um link para cada endereço. Seu histórico permanece nesta conta.</p><button type="submit" class="primary">Solicitar alteração de e-mail</button></form></details>
   <details><summary>Alterar senha</summary><form id="profilePasswordForm">${passwordField('Senha atual','currentPassword')}${passwordField('Nova senha','newPassword','new-password')}${passwordField('Repetir nova senha','newPasswordConfirm','new-password')}<p class="muted">Use pelo menos 8 caracteres. Prefira uma senha longa e exclusiva.</p><button type="submit" class="primary">Salvar nova senha</button><a href="/recuperar-senha">Esqueci minha senha</a></form></details></section>
   ${accountControls()}<button id="discardProfile" type="button" class="secondary">Descartar alterações não salvas</button></section>`;
  root.addEventListener('submit',submit);root.addEventListener('click',click);root.addEventListener('change',change);root.addEventListener('input',input);credentials();avatar();
 }};
}
