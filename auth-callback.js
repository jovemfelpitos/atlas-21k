// Validate redirect tokens with Auth before accepting a session. Never leave tokens in URL history.
export async function consumeAuthCallback(location,history,request){
 const hash=new URLSearchParams(location.hash.replace(/^#/,''));
 if(!hash.has('access_token')&&!hash.has('error')&&!hash.has('error_description'))return null;
 history.replaceState(null,'',location.pathname+location.search);
 if(hash.has('error')||hash.has('error_description'))throw Error(hash.get('error_description')||'Não foi possível confirmar a conta.');
 const access_token=hash.get('access_token'),refresh_token=hash.get('refresh_token');
 if(!access_token||!refresh_token)throw Error('O link de confirmação está incompleto. Entre novamente.');
 const user=await request('/auth/v1/user',{headers:{Authorization:'Bearer '+access_token}},false);
 if(!user?.id)throw Error('O link de confirmação não contém uma conta válida.');
 return {access_token,refresh_token,user,expires_at:Date.now()/1000+Math.min(3600,Math.max(0,Number(hash.get('expires_in'))||0))};
}
