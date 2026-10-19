import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {readFileSync} from 'node:fs';
import {validateStrengthPrescription,validateStrengthResults,canonicalStrength,strengthPrescriptionHTML,strengthResultsHTML} from '../strength.js';
import {createActivityEditor,persistActivity,validateActivity} from '../activity.js';
import {validatePlanDocument} from '../plan-editor.js';
import {parsePlan} from '../importer.js';
import {monitoringRows} from '../monitoring.js';
import {progressData,createProgressState} from '../progress.js';
const tick=()=>new Promise(r=>setTimeout(r,15));
const exercise={id:'ex-1',name:'Exercício de teste',sets:2,reps:10,load_kg:20,notes:'Orientação de teste'};
const strength=[exercise];
const values={status:'adaptado',km:null,minutes:30,effort:null,pain:0,recovery:'',notes:''};
const identity={user_id:'a',plan_id:'p',session_id:'s'};
test('strength contracts retain zero versus unknown, require unique exercises and reject invalid ranges',()=>{
 assert.equal(validateStrengthPrescription([{...exercise,load_kg:'12,5'}])[0].load_kg,12.5);
 for(const edit of [{sets:0},{sets:21},{sets:1.5},{reps:0},{load_kg:-1},{name:''},{notes:'x'.repeat(1001)},{extra:'unsupported'}])assert.throws(()=>validateStrengthPrescription([{...exercise,...edit}]));
 assert.throws(()=>validateStrengthPrescription([exercise,exercise]),/repetida/);
 const result=validateStrengthResults([{exercise_id:'ex-1',sets:[{reps:'0',load_kg:'0'},{reps:'',load_kg:''},{reps:'8',load_kg:'12,5'}]}]);
 assert.deepEqual(result[0].sets,[{reps:0,load_kg:0},{reps:null,load_kg:null},{reps:8,load_kg:12.5}]);
 assert.deepEqual(validateStrengthResults([{exercise_id:'ex-1',sets:[{reps:null,load_kg:''}]}]),[]);
 for(const set of [{reps:-1},{reps:2.5},{load_kg:1001},{load_kg:'NaN'},{load_kg:'0.0001'},{reps:1,extra:'bad'}])assert.throws(()=>validateStrengthResults([{exercise_id:'ex-1',sets:[set]}]));
 assert.equal(canonicalStrength(result),canonicalStrength([{sets:[{load_kg:0,reps:0},{load_kg:null,reps:null},{load_kg:12.5,reps:8}],exercise_id:'ex-1'}]));
});
test('old CSV stays compatible; hybrid template separates sessions and preserves strength through revisions and export-shaped objects',()=>{
 const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const old=parsePlan(read('modelo-plano.csv'));assert.equal(Object.hasOwn(old.sessions[0],'strength'),false);
 const hybrid=parsePlan(read('modelo-plano-hibrido.csv'));assert.equal(hybrid.sessions.length,2);assert.equal(hybrid.sessions[0].date,hybrid.sessions[1].date);assert.equal(hybrid.sessions[1].strength.length,1);
 assert.deepEqual(validatePlanDocument(hybrid),hybrid);const mixed=structuredClone(hybrid);mixed.sessions[1].km=5;assert.throws(()=>validatePlanDocument(mixed),/duas sessões/);
 const clear=structuredClone(hybrid);clear.sessions[1].strength=[];assert.deepEqual(validatePlanDocument(clear).sessions[1].strength,[]);
 const hostile=[{...exercise,name:'<img src=x>',notes:'<script>não executar</script>'}];const w=new Window();try{w.document.body.innerHTML=strengthPrescriptionHTML(hostile,true)+strengthResultsHTML(hostile,[{exercise_id:'ex-1',sets:[{reps:0,load_kg:0}]}]);assert.equal(w.document.querySelector('img,script'),null);assert.match(w.document.body.textContent,/0 rep · 0 kg/);}finally{w.happyDOM.close();}
});
test('strength report is optional, does not copy prescribed values, keeps a failed draft and clears on the next session',async()=>{
 const w=new Window({url:'http://localhost/'});w.document.write('<dialog id="d"></dialog>');const dialog=w.document.querySelector('#d');let fail=true,saved=null;
 const editor=createActivityEditor({window:w,dialog,save:async(_context,v)=>{if(fail)throw TypeError('Sem rede');return {...identity,...v};},onSaved:r=>saved=r});
 const session={id:'s',date:'2026-10-19',type:'Musculação',strength,minutes:30,description:'Descrição'};
 const change=async(selector,value)=>{const el=dialog.querySelector(selector);el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));await tick();};
 const submit=async()=>{dialog.querySelector('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();};
 try{
  editor.open({user_id:'a',plan:{id:'p',name:'Plano'},session});assert.equal(editor.dirty,false);assert.equal(dialog.querySelector('#activityDistance').hidden,true);assert.equal(dialog.querySelector('#activityPacePanel').hidden,true);
  assert.deepEqual([...dialog.querySelectorAll('[data-strength-actual]')].map(el=>el.value),['','','','']);
  dialog.querySelector('[data-activity-status=adaptado]').click();await change('[data-strength-set] [data-strength-actual=reps]','0');await change('[data-strength-set] [data-strength-actual=load_kg]','0');
  const second=dialog.querySelectorAll('[data-strength-actual=reps]')[1];second.value='1.5';second.dispatchEvent(new w.Event('input',{bubbles:true}));await submit();assert.equal(w.document.activeElement,second);assert.match(dialog.querySelector('#saveError').textContent,/inteiro/);second.value='';second.dispatchEvent(new w.Event('input',{bubbles:true}));
  await submit();assert.equal(editor.dirty,true);assert.match(dialog.querySelector('#saveError').textContent,/campos foram mantidos/);assert.equal(dialog.querySelector('[data-strength-actual=reps]').value,'0');
  dialog.querySelector('[data-activity-status="não feito"]').click();assert.equal(dialog.querySelector('#activityMetrics').hidden,true);assert.equal(dialog.querySelector('[data-strength-actual=reps]').value,'0');
  dialog.querySelector('[data-activity-status=adaptado]').click();dialog.querySelector('[data-add-strength-set]').click();assert.equal(dialog.querySelectorAll('[data-strength-set]').length,3);assert.equal(w.document.activeElement.dataset.strengthActual,'reps');
  assert.equal(editor.close(),false);dialog.querySelector('#keepActivity').click();fail=false;await submit();assert.equal(dialog.open,false);assert.equal(saved.strength[0].sets[0].reps,0);assert.equal(saved.strength[0].sets[1].reps,null);assert.equal(saved.strength[0].sets.length,3);
  editor.open({user_id:'a',plan:{id:'p',name:'Plano'},session:{...session,id:'other',strength:[]}});assert.equal(dialog.querySelectorAll('[data-strength-actual]').length,0);assert.equal(dialog.querySelector('#activityDistance').hidden,false);assert.equal(editor.dirty,false);editor.reset();assert.equal(dialog.textContent.includes('Exercício de teste'),false);
 }finally{await w.happyDOM.close();}
});
test('confirmed persistence compares structured values, retries a lost response once and refuses a stale device',async()=>{
 let row=null,lose=true,writes=0;const request=async(_path,o={})=>{if(!o.method)return row?[structuredClone(row)]:[];writes++;row={...row,...JSON.parse(o.body)};if(lose){lose=false;throw TypeError('Resposta perdida');}return [structuredClone(row)];};
 const report=validateActivity({...values,strength:[{exercise_id:'ex-1',sets:[{reps:8,load_kg:0}]}]}),context={...identity,record:null};
 await assert.rejects(persistActivity({request,context,values:report}),/Resposta perdida/);await persistActivity({request,context,values:report});assert.equal(writes,1);
 const previous=structuredClone(row);row.strength[0].sets[0].reps=9;
 await assert.rejects(persistActivity({request,context:{...identity,record:previous},values:{...report,notes:'Outra edição'}}),/outra aba/);assert.equal(writes,1);
});
test('a hybrid week keeps force duration in totals and out of running pace',()=>{
 const plan={id:'p',user_id:'a',sessions:[{id:'run',date:'2026-10-19',km:5,minutes:30},{id:'s',date:'2026-10-19',km:null,minutes:40,strength}]};
 const records=[{...identity,session_id:'run',status:'feito',km:5,minutes:25},{...identity,status:'adaptado',km:null,minutes:45,strength:[{exercise_id:'ex-1',sets:[{reps:10,load_kg:20}]}]}];
 const data=progressData(monitoringRows([plan],records,{plan:'p'},'2026-10-19'),createProgressState(),'2026-10-19');assert.equal(data.summary.actualMinutes.value,70);assert.equal(data.summary.done,2);assert.deepEqual(data.actualPace,{label:'5:00',informed:1});
});
