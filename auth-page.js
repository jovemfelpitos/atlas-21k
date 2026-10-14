import {createAuthClient,authError,authRedirect,safeNext} from './auth-client.js';
import {consumeAuthCallback} from './auth-callback.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const emailField=(value='')=>`<label for="email">E-mail</label><input id="email" name="email" type="email" autocomplete="email" maxlength="254" required value="${esc(value)}">`;
const passwordField=(label,id,autocomplete='new-password')=>`<label for="${id}">${label}</label><div class="password-field"><input id="${id}" name="${id}" type="password" autocomplete="${autocomplete}" ${autocomplete==='current-password'?'':'minlength="8"'} required aria-describedby="passwordHint"><button type="button" data-password="${id}" aria-label="Mostrar ${label.toLowerCase()}" aria-pressed="false">Mostrar</button></div>`;

export async function createAuthPage({window:w,client=createAuthClient(w.ATLAS_CONFIG,{storage:w.localStorage,fetch:w.fetch.bind(w)}),navigate=url=>w.location.assign(url)}){
 const d=w.document,$=s=>d.querySelector(s),path=w.location.pathname.replace(/\/$/,'');
 const callbackHash=new URLSearchParams(w.location.hash.replace(/^#/,'')),callbackQuery=new URLSearchParams(w.location.search);
 if(!['/confirmar-email','/redefinir-senha'].includes(path)&&(callbackHash.has('access_token')||callbackHash.has('error')||callbackHash.has('error_description')||callbackQuery.has('token_hash'))){const target=(callbackHash.get('type')||callbackQuery.get('type'))==='recovery'?'/redefinir-senha':'/confirmar-email',fragment=w.location.hash,search=w.location.search;w.history.replaceState(null,'',path);navigate(target+search+fragment);return {client};}
 const next=safeNext(new URLSearchParams(w.location.search).get('next'));
 const confirmRedirect=authRedirect(w.location.origin,'/confirmar-email?next='+encodeURIComponent(next),w.ATLAS_CONFIG.siteUrl);
 const recoveryRedirect=authRedirect(w.location.origin,'/redefinir-senha',w.ATLAS_CONFIG.siteUrl);
 let pending={},busy=false,recovery=null,resendAt=0;
 try{pending=JSON.parse(w.sessionStorage.getItem('atlas-auth-pending')||'{}');}catch{}
 const link=(route,label)=>`<a href="${route}${['/entrar','/criar-conta'].includes(route)?'?next='+encodeURIComponent(next):''}">${label}</a>`;
 const heading=(title,intro)=>{$('#authTitle').textContent=title;$('#authIntro').textContent=intro;d.title=title+' · Atlas Run';};
 const formHTML=(content,label)=>`<form id="accessForm">${content}<button class="primary" type="submit">${label}</button></form>`;
 const showError=error=>{$('#authStatus').textContent='';$('#authError').textContent=authError(error);$('#authError').focus();};
 const status=text=>{$('#authError').textContent='';$('#authStatus').textContent=text;};
 const remember=value=>{pending=value;try{w.sessionStorage.setItem('atlas-auth-pending',JSON.stringify(value));}catch{}};
 const forget=()=>{try{w.sessionStorage.removeItem('atlas-auth-pending');}catch{}};
 async function enterApp(){await client.onboard();forget();navigate(next);}
 function resendForm(){return formHTML(emailField(pending.email||''),'Enviar novo link')+`<p class="auth-bottom">${link('/entrar','Voltar para entrar')}</p>`;}
 if(path==='/criar-conta'){
  const area=new URLSearchParams(w.location.search).get('tipo')==='treinador'?'coach':pending.area==='coach'?'coach':'athlete';
  heading('Crie sua conta','Escolha como quer começar. Depois, você pode usar as duas áreas com o mesmo login.');
  $('#authContent').innerHTML=formHTML(`<label for="name">Nome completo</label><input id="name" name="name" autocomplete="name" maxlength="120" required value="${esc(pending.name||'')}">${emailField(pending.email||'')}${passwordField('Senha','password')}${passwordField('Repetir senha','passwordConfirm')}<p id="passwordHint" class="field-hint">Use pelo menos 8 caracteres. Prefira uma senha longa e exclusiva.</p><fieldset class="account-choice"><legend>Como você quer começar?</legend><label><input type="radio" name="area" value="athlete" ${area==='athlete'?'checked':''}><span><strong>Atleta</strong><small>Acompanhar meus treinos</small></span></label><label><input type="radio" name="area" value="coach" ${area==='coach'?'checked':''}><span><strong>Treinador</strong><small>Organizar e acompanhar atletas</small></span></label></fieldset>`,'Criar conta')+`<p class="auth-bottom">Já tem uma conta? ${link('/entrar','Entrar')}</p>`;
 }else if(path==='/recuperar-senha'){
  heading('Esqueceu sua senha?','Informe o e-mail da sua conta. Você receberá um link para escolher uma nova senha.');
  $('#authContent').innerHTML=formHTML(emailField(),'Enviar link de recuperação')+`<p class="auth-bottom">${link('/entrar','Voltar para entrar')}</p>`;
 }else if(path==='/verifique-seu-email'){
  heading('Confirme seu e-mail','Se o cadastro precisar de confirmação, você receberá um link para ativar sua conta. Se já tem conta, entre com seu e-mail e senha.');
  $('#authContent').innerHTML=`<p class="mail-note">Confira sua caixa de entrada e a pasta de spam. Não recebeu? Peça um novo link abaixo.</p>${resendForm()}`;
 }else if(path==='/confirmar-email'||path==='/redefinir-senha'){
  const resetting=path==='/redefinir-senha';heading(resetting?'Validando seu link':'Confirmando seu e-mail','Só mais um instante.');
  try{
   const confirmed=await consumeAuthCallback(w.location,w.history,client.request,{expectedType:resetting?'recovery':'signup'});
   if(!confirmed&&!resetting&&callbackQuery.get('flow')==='email-change'){heading('Confirme a troca nos dois endereços','Abra os links enviados ao e-mail atual e ao novo. Depois, volte ao perfil para conferir a alteração.');$('#authContent').innerHTML='<a class="primary button-link" href="/app?view=profile">Voltar ao meu perfil</a>';return {client};}
   if(!confirmed)throw Error(resetting?'Abra o link de recuperação recebido por e-mail.':'Abra o link de confirmação recebido por e-mail.');
   if(resetting){recovery=confirmed;heading('Escolha sua nova senha',confirmed.user.email?'Nova senha para '+confirmed.user.email+'.':'Defina uma senha para voltar à sua conta.');$('#authContent').innerHTML=formHTML(`${passwordField('Nova senha','password')}${passwordField('Repetir nova senha','passwordConfirm')}<p id="passwordHint" class="field-hint">Use pelo menos 8 caracteres. Prefira uma senha longa e exclusiva.</p>`,'Salvar nova senha');}
   else{client.setSession(confirmed);await enterApp();}
  }catch(error){if(!resetting&&client.session?.user?.id){heading('E-mail confirmado','Seu acesso foi validado. Tente abrir o app novamente.');$('#authContent').innerHTML='<a class="primary button-link" href="/app">Abrir meu app</a>';showError(error);}else{heading(resetting?'Vamos recuperar seu acesso':'Não foi possível confirmar','Você pode pedir outro link para continuar.');$('#authContent').innerHTML=resetting?`<p>${link('/recuperar-senha','Pedir novo link de recuperação')}</p><p>${link('/entrar','Voltar para entrar')}</p>`:resendForm();showError(error);}}
 }else{
  heading('Entre na sua conta','Bom te ver por aqui. Seu próximo treino está a um passo.');
  $('#authContent').innerHTML=formHTML(`${emailField()}${passwordField('Senha','password','current-password')}<p id="passwordHint" class="field-hint"></p><p class="forgot-link">${link('/recuperar-senha','Esqueci minha senha')}</p>`,'Entrar')+`<p class="auth-bottom">Novo por aqui? ${link('/criar-conta','Criar conta')}</p>`;
  if(new URLSearchParams(w.location.search).get('reason')==='expired')status('Sua sessão terminou. Entre novamente para continuar.');
  if(new URLSearchParams(w.location.search).get('reason')==='changed')status('A conta mudou em outra aba. Entre novamente para abrir seus dados.');
 }
 d.addEventListener('click',event=>{
  const button=event.target.closest('[data-password]');if(!button)return;
  const input=$('#'+button.dataset.password),show=input.type==='password';input.type=show?'text':'password';button.textContent=show?'Ocultar':'Mostrar';button.setAttribute('aria-pressed',String(show));button.setAttribute('aria-label',(show?'Ocultar ':'Mostrar ')+$('label[for="'+input.id+'"]').textContent.toLowerCase());
 });
 d.addEventListener('input',event=>{if(event.target.id==='passwordConfirm'||event.target.id==='password')$('#passwordConfirm')?.setCustomValidity('');});
 d.addEventListener('submit',async event=>{
  if(event.target.id!=='accessForm')return;event.preventDefault();if(busy)return;const f=event.target;
  const repeat=f.elements.passwordConfirm;
  repeat?.setCustomValidity('');
  if(repeat&&repeat.value!==f.elements.password.value){repeat.setCustomValidity('As senhas precisam ser iguais.');repeat.reportValidity();return;}
  if(!f.reportValidity())return;
  const isResend=['/verifique-seu-email','/confirmar-email'].includes(path);
  if(isResend&&Date.now()<resendAt){status('Aguarde um minuto antes de pedir outro link.');return;}
  busy=true;const buttons=[...f.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);status('Só um instante…');
  try{
   const email=f.elements.email?.value.trim();
   if(path==='/criar-conta'){
    const name=f.elements.name.value.trim();if(!name)throw Error('Informe seu nome completo.');
    const area=f.elements.area.value==='coach'?'coach':'athlete';
    const result=await client.signUp({name,email,password:f.elements.password.value,area,redirect:confirmRedirect});
    f.elements.password.value='';repeat.value='';remember({name,email,area});
    if(result?.access_token){client.setSession(result);await enterApp();}else navigate('/verifique-seu-email');
   }else if(path==='/recuperar-senha'){
    await client.recover(email,recoveryRedirect);status('Se houver uma conta com esse e-mail, você receberá as instruções de recuperação.');
   }else if(isResend){await client.resend(email,confirmRedirect);remember({...pending,email});resendAt=Date.now()+60000;status('Se houver um cadastro pendente para esse e-mail, você receberá um novo link.');}
   else if(path==='/redefinir-senha'){
    if(!recovery)throw Error('Abra um link válido de recuperação.');
    await client.request('/auth/v1/user',{method:'PUT',headers:{Authorization:'Bearer '+recovery.access_token},body:JSON.stringify({password:f.elements.password.value})},false);
    recovery=null;client.clear();f.reset();heading('Senha atualizada','Você já pode entrar com sua nova senha.');$('#authContent').innerHTML=`<a class="primary button-link" href="/entrar">Entrar na minha conta</a>`;status('Sua nova senha foi salva.');
   }else{await client.signIn(email,f.elements.password.value);f.elements.password.value='';await enterApp();}
  }catch(error){showError(error);if(error.code==='email_not_confirmed'){remember({email:f.elements.email.value.trim()});$('#authStatus').innerHTML=link('/verifique-seu-email','Pedir novo link de confirmação');}}
  finally{busy=false;buttons.forEach(b=>{if(b.isConnected)b.disabled=false;});}
 });
 return {client};
}

if(typeof window!=='undefined')createAuthPage({window}).catch(error=>{const el=window.document.querySelector('#authError');if(el)el.textContent=authError(error);});
