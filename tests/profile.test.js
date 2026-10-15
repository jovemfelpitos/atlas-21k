import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createProfileEditor,createAvatarStore,validateBirthDate,profileToday,prepareAvatar} from '../profile.js';

const uid='11111111-1111-4111-8111-111111111111',oldPhoto=uid+'/22222222-2222-4222-8222-222222222222.jpg';
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
function harness({photo=null,values={},converter=async()=>new Blob(['jpeg'],{type:'image/jpeg'})}={}){
 const w=new Window({url:'https://atlasrun.netlify.app/app'});w.document.body.innerHTML='<main></main>';
 let session={user:{id:uid,email:'athlete@example.com'},access_token:'original',refresh_token:'refresh'},profile={user_id:uid,name:'Ana Silva',birth_date:null,available_days:[1,3],avatar_path:photo,...values};
 let fail=false,wrongIdentity=false,mutations=0;const calls=[],revoked=[];
 const request=async(path,options={})=>{
  calls.push({path,options});if(fail)throw Object.assign(Error('Falha simulada'),{status:503});
  if(path.includes('/token')){const body=JSON.parse(options.body);if(body.password==='wrong')throw Object.assign(Error('Invalid login credentials'),{code:'invalid_credentials'});return {access_token:'verified',refresh_token:'refresh-new',expires_in:3600,user:{id:wrongIdentity?'other':uid,email:session.user.email}};}
  if(path.startsWith('/auth/v1/user')){if(options.method==='PUT'){const body=JSON.parse(options.body);mutations++;if(body.current_password==='wrong')throw Object.assign(Error('Wrong password'),{code:'current_password_mismatch'});if(body.email)return {...session.user,new_email:body.email};}return session.user;}
  if(path.startsWith('/rest/v1/atlas_profiles')){profile={...profile,...JSON.parse(options.body)};return [profile];}
  if(options.responseType==='blob')return new Blob(['jpeg'],{type:'image/jpeg'});
  return {Key:'saved'};
 };
 const avatars=createAvatarStore({request,urlAPI:{createObjectURL:()=> 'blob:test/'+calls.length,revokeObjectURL:url=>revoked.push(url)}});
 const editor=createProfileEditor({window:w,request,getSession:()=>session,keepSession:value=>session=value,onProfile:value=>profile=value,avatars,convertPhoto:converter});editor.mount(w.document.querySelector('main'),profile);
 return {w,editor,calls,revoked,get profile(){return profile;},get session(){return session;},get mutations(){return mutations;},set fail(value){fail=value;},set wrongIdentity(value){wrongIdentity=value;},async submit(id){w.document.querySelector('#'+id).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();},async click(id){w.document.querySelector('#'+id).click();await tick();},async upload(){const input=w.document.querySelector('#avatarUpload');input.files=[new w.File(['photo'],'photo.jpg',{type:'image/jpeg'})];input.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();}};
}

test('birth dates are optional, real calendar dates and follow the product timezone',()=>{
 assert.equal(validateBirthDate(''),null);assert.equal(validateBirthDate('2000-02-29','2026-10-14'),'2000-02-29');
 for(const value of ['2001-02-29','2026-10-15','0000-01-01','garbage'])assert.throws(()=>validateBirthDate(value,'2026-10-14'),/válida/);
 assert.equal(profileToday(new Date('2026-10-15T01:00:00Z')),'2026-10-14');
});
test('opening the profile does not mount hidden credential forms or create an unsaved edit',async()=>{
 const h=harness();try{const d=h.w.document;assert.equal(h.editor.dirty,false);assert.equal(!!d.querySelector('[autocomplete=current-password]'),false);assert.equal(!!d.querySelector('#newEmail'),false);assert.equal(!!d.querySelector('#profileForm'),false);assert.ok(d.querySelector('#editProfile'));}finally{await h.w.happyDOM.close();}
});
test('autofilled current credentials do not block leaving an unchanged account editor',async()=>{
 const h=harness(),d=h.w.document;try{
  await h.click('editPassword');d.querySelector('#currentPassword').value='autofilled-current';assert.equal(h.editor.dirty,false);await h.click('backProfile');assert.equal(!!d.querySelector('#currentPassword'),false);
  await h.click('editEmail');d.querySelector('#emailCurrentPassword').value='autofilled-current';d.querySelector('#newEmail').value=h.session.user.email;assert.equal(h.editor.dirty,false);await h.click('backProfile');assert.equal(!!d.querySelector('#newEmail'),false);assert.equal(h.mutations,0);
 }finally{await h.w.happyDOM.close();}
});
test('the active editor protects a real draft and cancel discards only that action',async()=>{
 const h=harness(),d=h.w.document;try{
  await h.click('editProfile');const f=d.querySelector('#profileForm');f.elements.name.value='Rascunho';await h.click('backProfile');assert.equal(d.querySelector('#profileDiscard').hidden,false);assert.equal(h.editor.dirty,true);await h.click('keepProfile');assert.equal(f.elements.name.value,'Rascunho');await h.click('confirmDiscardProfile');assert.equal(h.editor.dirty,false);assert.equal(h.profile.name,'Ana Silva');assert.equal(!!d.querySelector('#profileForm'),false);
  await h.click('editEmail');d.querySelector('#newEmail').value='draft@example.com';assert.equal(h.editor.dirty,true);await h.click('discardProfile');assert.equal(h.editor.dirty,false);await h.click('editPassword');assert.equal(d.querySelector('#currentPassword').value,'');assert.equal(d.querySelector('#newPassword').value,'');assert.equal(!!d.querySelector('#newEmail'),false);
 }finally{await h.w.happyDOM.close();}
});
test('personal edit compares rendered values and returns clean when an actual change is undone',async()=>{
 const h=harness({values:{name:' Ana Silva ',available_days:[3,1,1]}});try{await h.click('editProfile');const f=h.w.document.querySelector('#profileForm');assert.equal(h.editor.dirty,false);f.elements.name.value='Outro nome';assert.equal(h.editor.dirty,true);f.elements.name.value='Ana Silva';assert.equal(h.editor.dirty,false);f.querySelector('[name=days][value="1"]').checked=false;assert.equal(h.editor.dirty,true);f.querySelector('[name=days][value="1"]').checked=true;assert.equal(h.editor.dirty,false);}finally{await h.w.happyDOM.close();}
});
test('profile keeps failed values and saves only personal fields without changing roles',async()=>{
 const h=harness();await h.click('editProfile');const form=h.w.document.querySelector('#profileForm');form.elements.name.value='Maria';form.elements.birth_date.value='2000-03-10';
 assert.equal(h.editor.dirty,true);h.fail=true;await h.submit('profileForm');assert.equal(form.elements.name.value,'Maria');assert.equal(h.profile.name,'Ana Silva');assert.equal(h.editor.busy,false);
 h.fail=false;await h.submit('profileForm');assert.equal(h.profile.name,'Maria');assert.equal(h.profile.birth_date,'2000-03-10');assert.equal(h.editor.dirty,false);
 const body=JSON.parse(h.calls.findLast(c=>c.path.startsWith('/rest/')).options.body);assert.deepEqual(Object.keys(body).sort(),['available_days','birth_date','name']);assert.deepEqual(body.available_days,[1,3]);
});
test('password changes reject mismatches and require the current password in the Auth request',async()=>{
 const h=harness();await h.click('editPassword');let f=h.w.document.querySelector('#profilePasswordForm');f.elements.currentPassword.value='correct';f.elements.newPassword.value='long-new-password';f.elements.newPasswordConfirm.value='different';
 await h.submit('profilePasswordForm');assert.equal(h.mutations,0);
 f.elements.newPasswordConfirm.value='long-new-password';await h.submit('profilePasswordForm');assert.equal(h.mutations,1);
 const body=JSON.parse(h.calls.find(c=>c.path.startsWith('/auth/v1/user')).options.body);assert.deepEqual(body,{password:'long-new-password',current_password:'correct'});
 assert.equal(h.editor.dirty,false);assert.equal(JSON.stringify(h.session).includes('long-new-password'),false);
 await h.click('editPassword');f=h.w.document.querySelector('#profilePasswordForm');f.elements.currentPassword.value='wrong';f.elements.newPassword.value=f.elements.newPasswordConfirm.value='another-long-password';await h.submit('profilePasswordForm');assert.match(h.w.document.querySelector('#profileStatus').textContent,/senha atual/);assert.equal(f.elements.currentPassword.value,'');
});
test('email changes verify identity before mutation and keep the current email while pending',async()=>{
 const h=harness();await h.click('editEmail');const f=h.w.document.querySelector('#profileEmailForm');f.elements.newEmail.value='new@example.com';f.elements.emailCurrentPassword.value='wrong';await h.submit('profileEmailForm');assert.equal(h.mutations,0);assert.equal(f.elements.newEmail.value,'new@example.com');
 f.elements.emailCurrentPassword.value='correct';h.wrongIdentity=true;await h.submit('profileEmailForm');assert.equal(h.mutations,0);assert.equal(h.session.access_token,'original');
 h.wrongIdentity=false;f.elements.emailCurrentPassword.value='correct';await h.submit('profileEmailForm');assert.equal(h.mutations,1);assert.equal(h.session.user.email,'athlete@example.com');assert.equal(h.session.user.new_email,'new@example.com');assert.equal(h.session.access_token,'verified');
 assert.match(h.w.document.querySelector('#pendingEmail').textContent,/new@example.com/);const call=h.calls.find(c=>c.path.startsWith('/auth/v1/user?'));assert.equal(new URL('https://test'+call.path).searchParams.get('redirect_to'),'https://atlasrun.netlify.app/confirmar-email?flow=email-change&next=%2Fapp%3Fview%3Dprofile');
});
test('photos upload with a new private path and failure never deletes the previously saved photo',async()=>{
 const h=harness({photo:oldPhoto});await tick();h.fail=true;await h.upload();assert.equal(h.profile.avatar_path,oldPhoto);assert.equal(h.calls.some(c=>c.options.method==='DELETE'),false);
 h.fail=false;await h.upload();assert.notEqual(h.profile.avatar_path,oldPhoto);const upload=h.calls.find(c=>c.options.method==='POST'&&c.path.startsWith('/storage/'));assert.equal(upload.options.headers['x-upsert'],'false');assert.equal(upload.options.body.type,'image/jpeg');
 const patch=h.calls.find(c=>c.path.startsWith('/rest/'));assert.ok(patch.path.includes('avatar_path=eq.'));assert.equal(JSON.parse(h.calls.find(c=>c.options.method==='DELETE').options.body).prefixes[0],oldPhoto);
 await h.click('removeAvatar');assert.equal(h.profile.avatar_path,null);assert.equal(h.w.document.querySelector('#profileInitials').hidden,false);assert.equal(h.w.document.querySelector('#profileInitials').textContent,'AS');
});
test('invalid and spoofed images are rejected before decoding or contacting Storage',async()=>{
 for(const file of [new File(['bad'],'x.svg',{type:'image/svg+xml'}),new File(['not jpeg'],'x.jpg',{type:'image/jpeg'}),new File([],'empty.png',{type:'image/png'})])await assert.rejects(()=>prepareAvatar(file,{}),/foto|JPG/);
 const h=harness({converter:async()=>{throw Error('Foto inválida');}});await h.upload();assert.equal(h.calls.some(c=>c.path.startsWith('/storage/')),false);assert.match(h.w.document.querySelector('#profileStatus').textContent,/inválida/);
});
test('private photo downloads share one request and revoke object URLs when cleared',async()=>{
 let calls=0;const revoked=[];const avatars=createAvatarStore({request:async(path,options)=>{calls++;assert.equal(options.cache,'no-store');assert.equal(options.responseType,'blob');return new Blob(['jpg'],{type:'image/jpeg'});},urlAPI:{createObjectURL:()=> 'blob:private',revokeObjectURL:url=>revoked.push(url)}});
 assert.deepEqual(await Promise.all([avatars.load(oldPhoto),avatars.load(oldPhoto)]),['blob:private','blob:private']);assert.equal(calls,1);avatars.clear();assert.deepEqual(revoked,['blob:private']);await assert.rejects(()=>avatars.load('https://public.example/photo.jpg'),/indisponível/);
});
test('a new password draft remains protected when shown and cancel removes all credentials',async()=>{
 const h=harness();await h.click('editPassword');const input=h.w.document.querySelector('#currentPassword');input.value='not-stored';h.w.document.querySelector('#newPassword').value='draft-new-password';h.w.document.querySelector('[data-profile-show=currentPassword]').click();assert.equal(input.type,'text');assert.equal(h.editor.dirty,true);await h.click('discardProfile');assert.equal(input.value,'');assert.equal(h.editor.dirty,false);
});
