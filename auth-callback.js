// Validate redirect tokens with Auth before accepting a session. Never leave tokens in URL history.
export async function consumeAuthCallback(location,history,request,{expectedType}={}){
 const hash=new URLSearchParams(location.hash.replace(/^#/,''));
 const query=new URLSearchParams(location.search||'');
 if(!hash.has('access_token')&&!hash.has('error')&&!hash.has('error_description')&&!query.has('token_hash'))return null;
 const clean=new URLSearchParams(query);for(const key of ['token_hash','type','code','access_token','refresh_token','error','error_description','error_code'])clean.delete(key);
 history.replaceState(null,'',location.pathname+(clean.size?'?'+clean:''));
 if(hash.has('error')||hash.has('error_description'))throw Error(hash.get('error_description')||'Não foi possível confirmar a conta.');
 const type=hash.get('type')||query.get('type')||'signup';
 if(expectedType==='recovery'&&type!=='recovery')throw Error('Este link não é de recuperação de senha. Peça um novo link.');
 if(expectedType==='signup'&&!['signup','email','email_change'].includes(type))throw Error('Use a tela de recuperação para redefinir sua senha.');
 let access_token=hash.get('access_token'),refresh_token=hash.get('refresh_token'),expires_in=hash.get('expires_in');
 if(query.has('token_hash')){
  if(!['signup','email','recovery','email_change'].includes(type))throw Error('Este link não é válido. Peça um novo link.');
  const verified=await request('/auth/v1/verify',{method:'POST',body:JSON.stringify({token_hash:query.get('token_hash'),type})},false);
  access_token=verified?.access_token;refresh_token=verified?.refresh_token;expires_in=verified?.expires_in;
 }
 if(!access_token||!refresh_token)throw Error('O link de confirmação está incompleto. Entre novamente.');
 const user=await request('/auth/v1/user',{headers:{Authorization:'Bearer '+access_token}},false);
 if(!user?.id)throw Error('O link de confirmação não contém uma conta válida.');
 return {access_token,refresh_token,user,auth_type:type,expires_at:Date.now()/1000+Math.min(3600,Math.max(0,Number(expires_in)||0))};
}
