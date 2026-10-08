import {test} from 'node:test';
import assert from 'node:assert/strict';
import {consumeAuthCallback} from '../auth-callback.js';
test('confirmation tokens are validated with Auth and stripped before network request',async()=>{
 let cleaned=false;const session=await consumeAuthCallback({hash:'#access_token=example&refresh_token=refresh&expires_in=3600',pathname:'/',search:''},{replaceState(a,b,path){assert.equal(path,'/');cleaned=true;}},async(path,opts,token)=>{assert.equal(cleaned,true);assert.equal(path,'/auth/v1/user');assert.equal(opts.headers.Authorization,'Bearer example');assert.equal(token,false);return {id:'athlete'};});assert.equal(session.user.id,'athlete');assert.equal(session.refresh_token,'refresh');
});
test('expired, erroneous and incomplete callbacks cannot create sessions',async()=>{
 const loc={pathname:'/',search:''},history={replaceState(){}};
 await assert.rejects(consumeAuthCallback({...loc,hash:'#error=access_denied&error_description=Link+expirado'},history,()=>{}),/Link expirado/);
 await assert.rejects(consumeAuthCallback({...loc,hash:'#access_token=test'},history,()=>{}),/incompleto/);
 await assert.rejects(consumeAuthCallback({...loc,hash:'#access_token=test&refresh_token=r'},history,async()=>{throw Error('JWT inválido');}),/JWT inválido/);
 assert.equal(await consumeAuthCallback({...loc,hash:''},history,()=>{}),null);
});
