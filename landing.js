import {readSession} from './auth-client.js';
// Older confirmation links used the site root. Keep those links working after
// splitting the public presentation from access and private app pages.
const hash=new URLSearchParams(window.location.hash.replace(/^#/,''));
const query=new URLSearchParams(window.location.search);
if(hash.has('access_token')||hash.has('error')||hash.has('error_description')||query.has('token_hash')){
 const recovery=(hash.get('type')||query.get('type'))==='recovery',fragment=window.location.hash,search=window.location.search;
 window.history.replaceState(null,'','/');
 window.location.replace((recovery?'/redefinir-senha':'/confirmar-email')+search+fragment);
}else{
 const session=readSession(window.localStorage),link=window.document.querySelector('#landingLogin');
 if(session?.user?.id&&session?.access_token){link.href='/app';link.textContent='Abrir meu app';}
}
