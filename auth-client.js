const SESSION_KEY='atlas-session';
export function readSession(storage){try{return JSON.parse(storage.getItem(SESSION_KEY)||'null');}catch{return null;}}
export function safeNext(value){
 try{const url=new URL(value||'/app','https://atlas.invalid');if(url.origin!=='https://atlas.invalid'||!['/app','/app/'].includes(url.pathname))return '/app';const view=url.searchParams.get('view');return '/app'+(['today','calendar','progress','guide','profile'].includes(view)?'?view='+view:'');}catch{return '/app';}
}
export function authRedirect(origin,path,site='https://atlasrun.netlify.app'){
 const base=origin==='http://127.0.0.1:4173'?origin:site;
 return new URL(path,base).href;
}
export function authError(error){
 if(error.status===429||['over_email_send_rate_limit','over_request_rate_limit'].includes(error.code))return 'Aguarde um pouco antes de tentar novamente.';
 if(error.code==='invalid_credentials')return 'E-mail ou senha incorretos.';
 if(error.code==='email_not_confirmed')return 'Confirme seu e-mail para entrar. Você pode pedir um novo link.';
 if(['current_password_required','current_password_mismatch'].includes(error.code))return 'Confira sua senha atual e tente novamente.';
 if(['email_exists','user_already_exists'].includes(error.code))return 'Não foi possível usar esse e-mail. Confira o endereço ou entre com a conta existente.';
 if(['weak_password','same_password'].includes(error.code))return error.code==='same_password'?'Escolha uma senha diferente da anterior.':'Use uma senha mais forte, com pelo menos 8 caracteres.';
 if(error.code==='otp_expired')return 'Este link expirou ou já foi usado. Peça um novo link.';
 if(error.status>=500||['email_address_not_authorized','email_rate_limit_exceeded'].includes(error.code))return 'Não foi possível concluir a solicitação agora. Tente novamente em alguns minutos.';
 if(error.name==='AbortError'||error instanceof TypeError)return 'Não foi possível conectar. Verifique sua internet e tente novamente.';
 return error.message||'Não foi possível concluir. Tente novamente.';
}
export function createAuthClient(config,{storage,fetch:fetcher=globalThis.fetch}={}){
 let session=readSession(storage),refresh=null;
 const base=config.supabaseUrl.replace(/\/$/,'');
 let publicKey=config.supabaseKey?.startsWith('sb_publishable_');
 if(!publicKey){try{publicKey=JSON.parse(atob(config.supabaseKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='anon';}catch{}}
 if(!/^https:\/\/[^/]+\.supabase\.co$/.test(base)||!publicKey)throw Error('Acesso indisponível. Tente novamente mais tarde.');
 function save(value){
  try{if(value)storage.setItem(SESSION_KEY,JSON.stringify(value));else storage.removeItem(SESSION_KEY);}catch{throw Error('Não foi possível manter sua sessão neste navegador.');}
  session=value;
 }
 async function request(path,options={},token=true){
  if(token){
   if(!session?.access_token)throw Error('Entre na sua conta para continuar.');
   if(!Number.isFinite(session.expires_at)||session.expires_at<Date.now()/1000+60){
    if(!refresh)refresh=request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})},false).then(setSession).finally(()=>refresh=null);
    await refresh;
   }
  }
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
   const response=await fetcher(base+path,{...options,signal:controller.signal,headers:{apikey:config.supabaseKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+session.access_token}:{}),...options.headers}});
   const raw=await response.text();let data;try{data=raw?JSON.parse(raw):null;}catch{data=null;}
   if(!response.ok){const error=Error(data?.error_description||data?.msg||data?.message||'Não foi possível concluir a solicitação.');error.status=response.status;error.code=data?.error_code||data?.code;throw error;}
   if(raw&&data===null)throw Error('Não foi possível ler a resposta. Tente novamente.');
   return data;
  }finally{clearTimeout(timer);}
 }
 function setSession(value){if(!value?.access_token||!value?.refresh_token||!value?.user?.id)throw Error('Não foi possível validar sua sessão. Entre novamente.');const expires_at=value.expires_at||Date.now()/1000+(value.expires_in||3600);save({...value,expires_at});return session;}
 const post=(path,body,token=false)=>request(path,{method:'POST',body:JSON.stringify(body)},token);
 return {
  request,setSession,clear:()=>save(null),get session(){return session;},
  async signIn(email,password){return setSession(await post('/auth/v1/token?grant_type=password',{email,password}));},
  signUp:({name,email,password,area,redirect})=>post('/auth/v1/signup?redirect_to='+encodeURIComponent(redirect),{email,password,data:{full_name:name,account_type:area}}),
  recover:(email,redirect)=>post('/auth/v1/recover?redirect_to='+encodeURIComponent(redirect),{email}),
  resend:(email,redirect)=>post('/auth/v1/resend?redirect_to='+encodeURIComponent(redirect),{type:'signup',email}),
  async onboard(){const area=session?.user?.user_metadata?.account_type==='coach'?'coach':'athlete';return post('/rest/v1/rpc/atlas_complete_onboarding',{initial_area:area},true);},
  async logout(){try{if(session)await request('/auth/v1/logout',{method:'POST'});}finally{save(null);}}
 };
}
