import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createActivityEditor,validateActivity,persistActivity} from '../activity.js';
import {monitoringRows,summarize} from '../monitoring.js';

const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
const values=(extra={})=>({status:'feito',km:'',minutes:'',effort:'',pain:'',recovery:'',notes:'',...extra});
const identity={user_id:'athlete',plan_id:'plan',session_id:'session'};
const existing={...identity,...validateActivity(values({km:'3.5',minutes:'25',effort:'7',pain:'0',recovery:'Normal',notes:'Original'})),updated_at:'2026-10-14T12:00:00.000+00:00'};
const context=record=>({...identity,record:record?structuredClone(record):null});

test('activity validation keeps blank distinct from zero, accepts Portuguese decimals and requires an explicit status',()=>{
 const empty=validateActivity(values({status:'não feito',notes:'Motivo opcional'}));
 assert.deepEqual([empty.km,empty.minutes,empty.effort,empty.pain],[null,null,null,null]);
 const zero=validateActivity(values({km:'0',minutes:'25,5',effort:'0',pain:'0'}));assert.equal(zero.km,0);assert.equal(zero.minutes,25.5);assert.equal(zero.effort,0);assert.equal(zero.pain,0);
 assert.equal(validateActivity(values({km:'.5'})).km,0.5);
 for(const [key,value] of [['status',''],['status','feito<script>'],['km','-1'],['km','1001'],['km','NaN'],['km','1e2'],['km','1,2.3'],['minutes','1441'],['effort','1.5'],['effort','11'],['pain','-1'],['pain','Infinity']])assert.throws(()=>validateActivity(values({[key]:value})),error=>error.field===key);
 assert.throws(()=>validateActivity(values({notes:'x'.repeat(3001)})),/3.000/);
});

function storage(initial=null){
 let row=initial?structuredClone(initial):null,lose=false,race=false;const calls=[];
 const request=async(path,options={})=>{
  const body=options.body?JSON.parse(options.body):null;calls.push({path,options,body});
  const url=new URL(path,'https://example.com');
  if(!options.method){return row&&Object.entries(identity).every(([k,v])=>url.searchParams.get(k)==='eq.'+row[k])?[structuredClone(row)]:[];}
  if(race&&options.method==='PATCH'){row={...row,notes:'Outro dispositivo',updated_at:'2026-10-14T12:00:05.000+00:00'};race=false;}
  if(options.method==='PATCH'&&url.searchParams.get('updated_at')!=='eq.'+row.updated_at)return [];
  if(options.method==='POST'&&row)throw Object.assign(Error('Duplicate'),{status:409});
  row={...row,...body};for(const k of ['km','minutes'])if(row[k]!=null)row[k]=String(row[k]);row.updated_at=row.updated_at.replace('Z','+00:00');
  if(lose){lose=false;throw TypeError('Lost response');}return [structuredClone(row)];
 };
 return {request,calls,get row(){return row;},set lose(value){lose=value;},set race(value){race=value;}};
}
test('confirmed writes use the exact session and retry an uncertain insertion without duplicating it',async()=>{
 const h=storage(),ctx=context(),report=validateActivity(values({status:'não feito'}));h.lose=true;
 await assert.rejects(persistActivity({request:h.request,context:ctx,values:report}),/Lost response/);
 const confirmed=await persistActivity({request:h.request,context:ctx,values:report});assert.equal(confirmed.status,'não feito');assert.equal(confirmed.effort,null);assert.equal(h.calls.filter(c=>c.options.method==='POST').length,1);
 assert.ok(h.calls.every(c=>!c.options.method||c.options.headers.Prefer==='return=representation'));
 assert.match(h.calls[0].path,/user_id=eq.athlete&plan_id=eq.plan&session_id=eq.session/);
});
test('an uncertain update can be retried or revised while preserving the saved values and server representation',async()=>{
 const h=storage(existing),ctx=context(existing);h.lose=true;
 const first=validateActivity(values({km:'3,75',pain:'0',notes:'Primeira tentativa'}));
 await assert.rejects(persistActivity({request:h.request,context:ctx,values:first,now:()=>existing.updated_at}),/Lost response/);
 const second={...first,notes:'Revisado depois da falha'};
 const saved=await persistActivity({request:h.request,context:ctx,values:second,now:()=>existing.updated_at});
 assert.equal(saved.km,'3.75');assert.equal(saved.pain,0);assert.equal(saved.effort,null);assert.equal(saved.notes,second.notes);
 assert.ok(h.calls.filter(c=>c.options.method).every(c=>c.options.method==='PATCH'&&!('user_id' in c.body)&&c.path.includes('updated_at=eq.')));
 assert.ok(Date.parse(saved.updated_at)>Date.parse(existing.updated_at));
});
test('a changed device version or a conditional update race never replaces another report',async()=>{
 const current={...existing,notes:'Outro dispositivo',updated_at:'2026-10-14T12:01:00.000+00:00'},h=storage(current);
 await assert.rejects(persistActivity({request:h.request,context:context(existing),values:validateActivity(values())}),/outra aba/);assert.equal(h.calls.filter(c=>c.options.method).length,0);assert.equal(h.row.notes,'Outro dispositivo');
 const raced=storage(existing);raced.race=true;
 await assert.rejects(persistActivity({request:raced.request,context:context(existing),values:validateActivity(values({notes:'Minha edição'}))}),/outra aba/);assert.equal(raced.row.notes,'Outro dispositivo');
});

async function editorHarness({record=null,save=async(ctx,v)=>({...identity,...v,updated_at:existing.updated_at})}={}){
 const w=new Window();w.document.write('<button data-record="session">Abrir atividade</button><dialog id="recordDialog"></dialog>');
 const dialog=w.document.querySelector('dialog'),saved=[];const editor=createActivityEditor({window:w,dialog,save,onSaved:row=>saved.push(row)});
 const plan={id:'plan',name:'Plano <teste>',version:2,state:'published',sessions:[{id:'session',date:'2026-10-14',type:'Corrida <leve>',km:5,minutes:30,description:'<script>Prescrição</script>'}]};
 const open=()=>editor.open({user_id:'athlete',plan,session:plan.sessions[0],record});open();
 return {w,dialog,editor,plan,form:dialog.querySelector('form'),saved,open,async change(key,value){const field=dialog.querySelector('form').elements[key];field.value=value;field.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();},async submit(){dialog.querySelector('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();},async close(){await w.happyDOM.close();}};
}
test('the form explains both scales, defaults to no answer and saves a skipped session with only an optional reason',async()=>{
 const h=await editorHarness();try{
  assert.equal(h.form.elements.status.value,'');assert.equal(h.form.elements.effort.value,'');assert.equal(h.form.elements.pain.value,'');assert.equal(h.form.elements.km.value,'');assert.equal(h.dialog.querySelectorAll('script').length,0);
  assert.equal(h.form.elements.effort.options.length,12);assert.equal(h.form.elements.pain.options.length,12);assert.match(h.dialog.querySelector('#painHelp').textContent,/diferente de cansaço/);
  await h.submit();assert.equal(h.saved.length,0);assert.equal(h.form.elements.status.getAttribute('aria-invalid'),'true');
  await h.change('status','não feito');await h.change('notes','Não consegui ir.');await h.submit();assert.equal(h.saved.length,1);assert.equal(h.saved[0].km,null);assert.equal(h.saved[0].effort,null);assert.equal(h.saved[0].notes,'Não consegui ir.');assert.equal(h.dialog.open,false);
 }finally{await h.close();}
});
test('editing keeps existing values, zero and custom recovery; status changes never clear hidden or stored results',async()=>{
 const record={...existing,recovery:'Relato anterior livre'},h=await editorHarness({record});try{
  const original=structuredClone(h.plan);assert.equal(h.form.elements.km.value,'3.5');assert.equal(h.form.elements.pain.value,'0');assert.equal(h.form.elements.recovery.value,'Relato anterior livre');
  await h.change('status','não feito');assert.equal(h.form.elements.km.value,'3.5');assert.equal(h.form.elements.effort.value,'7');assert.match(h.dialog.querySelector('#activityStatusHelp').textContent,/não são apagados/);
  await h.change('pain','');await h.submit();assert.equal(h.saved[0].pain,null);assert.equal(h.saved[0].km,3.5);assert.equal(h.saved[0].recovery,record.recovery);assert.deepEqual(h.plan,original);
 }finally{await h.close();}
});
test('a dirty form requires discard on close or Escape and keeps its draft when the user continues',async()=>{
 const h=await editorHarness();try{
  await h.change('notes','Rascunho local');assert.equal(h.editor.dirty,true);assert.equal(h.editor.close(),false);assert.equal(h.dialog.querySelector('#activityDiscard').hidden,false);
  h.dialog.querySelector('#keepActivity').click();assert.equal(h.form.elements.notes.value,'Rascunho local');assert.equal(h.dialog.querySelector('#activityDiscard').hidden,true);
  const event=new h.w.Event('cancel',{cancelable:true});h.dialog.dispatchEvent(event);assert.equal(event.defaultPrevented,true);assert.equal(h.dialog.open,true);
  h.dialog.querySelector('#discardActivity').click();assert.equal(h.editor.dirty,false);assert.equal(h.dialog.open,false);h.open();assert.equal(h.form.elements.notes.value,'');
 }finally{await h.close();}
});
test('a pending save blocks duplicate submissions and closing; a network failure keeps every value and has no success',async()=>{
 let rejectSave,submissions=0;const h=await editorHarness({save:()=>{submissions++;return new Promise((resolve,reject)=>rejectSave=reject);}});try{
  await h.change('status','adaptado');await h.change('km','3,5');await h.change('pain','0');await h.change('notes','Rascunho');await h.submit();
  assert.equal(h.editor.busy,true);assert.equal(h.editor.close(),false);assert.equal(h.form.getAttribute('aria-busy'),'true');assert.equal(h.form.querySelector('[type=submit]').disabled,true);await h.submit();assert.equal(submissions,1);
  rejectSave(TypeError('Network unavailable'));await tick();assert.equal(h.editor.busy,false);assert.equal(h.dialog.open,true);assert.equal(h.form.elements.km.value,'3,5');assert.equal(h.form.elements.pain.value,'0');assert.equal(h.form.elements.notes.value,'Rascunho');assert.equal(h.saved.length,0);assert.match(h.dialog.querySelector('#saveError').textContent,/campos foram mantidos/);assert.equal(h.form.querySelector('[type=submit]').disabled,false);
 }finally{await h.close();}
});
test('blank and zero remain distinct in calendar records and monitoring totals after a report',()=>{
 const plan={id:'plan',user_id:'athlete',state:'published',atlas_sessions:[{id:'session',date:'2026-10-14'},{id:'other',date:'2026-10-14'}]};
 const record={...identity,...validateActivity(values({km:'0',pain:'0'}))};const rows=monitoringRows([plan],[record],{},'2026-10-14');
 assert.equal(rows[0].state,'today');assert.equal(rows[1].record.pain,0);assert.equal(rows[1].record.effort,null);const summary=summarize(rows,'2026-10-14');assert.equal(summary.actualKm.value,0);assert.equal(summary.actualKm.informed,1);assert.equal(summary.actualMinutes.value,null);assert.equal(summary.actualMinutes.informed,0);
});
