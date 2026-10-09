import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {readFileSync} from 'node:fs';
import {createManagement} from '../management.js';
import {parsePlan} from '../importer.js';
import {validatePlanDocument} from '../plan-editor.js';

const tick = () => new Promise(r => setTimeout(r, 15));
const model = readFileSync(new URL('../modelo-plano.csv', import.meta.url), 'utf8');
async function harness(role = 'admin') {
 const w = new Window({url: 'http://localhost/'}); w.document.write('<div id="content"></div>');
 const doc = parsePlan(model), owner = role === 'admin';
 const people = [{user_id:'owner',name:'Dono',is_admin:true}, {user_id:'coach',name:'Treinadora'}, {user_id:'a',name:'Marina',available_days:[2,4]}, ...(owner ? [{user_id:'b',name:'Rafael'}] : [])];
 let drafts = [], plans = [{...doc, id:'p1', user_id:'a', state:'published', version:1, atlas_sessions:doc.sessions}], failSave = false, failPublish = false;
 const calls = [];
 const request = async (path, options = {}) => {
  const body = options.body ? JSON.parse(options.body) : null; calls.push({path, body, method: options.method});
  if (path.includes('rpc/atlas_save_draft')) {if (failSave) throw Error('Falha de rede'); const old = drafts.find(d => d.id === body.draft_id); const row = {id: old?.id || 'd' + (drafts.length + 1), athlete_id:body.athlete, author_id:owner?'owner':'coach', document:body.document, revision:old ? old.revision + 1 : 1, state:'draft', base_plan_id:body.base_plan}; drafts = drafts.filter(d => d.id !== row.id).concat(row); return structuredClone(row);}
  if (path.includes('rpc/atlas_publish_draft')) {if (failPublish) throw Error('Conflito de edição'); const row = drafts.find(d => d.id === body.draft_id); row.state = 'published'; const base = plans.find(p => p.id === row.base_plan_id); if (base) base.state = 'archived'; plans.unshift({...row.document,id:'p2',user_id:row.athlete_id,state:'published',version:base?base.version+1:1,previous_plan_id:base?.id,atlas_sessions:row.document.sessions}); return 'p2';}
  if (path.includes('rpc/atlas_archive_plan')) {plans.find(p => p.id === body.plan).state = 'archived'; return null;}
  if (path.includes('atlas_profiles')) return structuredClone(people);
  if (path.includes('atlas_coaches')) return [{user_id:'coach',active:true}];
  if (path.includes('atlas_coach_athletes')) return [{coach_id:'coach',athlete_id:'a',active:true}];
  if (path.includes('atlas_plan_drafts')) return structuredClone(drafts);
  if (path.includes('atlas_plan_events')) return [];
  if (path.includes('atlas_plans')) return structuredClone(plans);
  throw Error('Unexpected request ' + path);
 };
 const portal = createManagement({root:w.document.querySelector('#content'),role,userId:owner?'owner':'coach',request,notice:()=>{},saveProfile:async()=>{}});
 await portal.load(); portal.render();
 return {w,portal,calls,get drafts(){return drafts;},get plans(){return plans;},set failSave(value){failSave=value;},set failPublish(value){failPublish=value;},async click(selector){const el=w.document.querySelector(selector);assert.ok(el,selector);el.click();await tick();},async input(selector,value){const el=w.document.querySelector(selector);el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));await tick();},async file(){const el=w.document.querySelector('#importFile');Object.defineProperty(el,'files',{configurable:true,value:[new w.File([model],'model.csv')]});el.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();},async submit(){w.document.querySelector('#planEditor').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();},async close(){portal.destroy();await w.happyDOM.close();}};
}

test('management import requires athlete, saves draft, reviews entire content and publishes saved revision', async () => {
 const h = await harness(), d = h.w.document;
 try {
  await h.click('[data-page=plans]'); await h.click('#importPlan'); await h.file(); assert.match(d.querySelector('#importError').textContent,/Selecione um atleta/); assert.equal(h.drafts.length,0);
  d.querySelector('#athlete').value = 'a'; await h.file(); assert.match(d.querySelector('#preview').textContent,/Guia completo/); assert.match(d.querySelector('#preview').textContent,/sessao-002/); assert.equal(d.querySelector('#reviewPublish').disabled,true);
  h.failSave = true; await h.submit(); assert.match(d.querySelector('#editorError').textContent,/Falha de rede/); assert.equal(d.querySelector('[data-field=name]').value,parsePlan(model).name); assert.equal(h.drafts.length,0);
  h.failSave = false; await h.submit(); assert.equal(h.drafts.length,1); assert.equal(d.querySelector('#reviewPublish').disabled,false);
  await h.input('[data-field=name]','Plano editado'); assert.equal(d.querySelector('#reviewPublish').disabled,true); await h.submit(); assert.equal(h.drafts[0].revision,2);
  await h.click('#reviewPublish'); assert.match(d.querySelector('#managementDialog').textContent,/Marina/); assert.match(d.querySelector('#managementDialog').textContent,/sessao-002/); assert.match(d.querySelector('#managementDialog').textContent,/Guia completo/);
  h.failPublish = true; await h.click('#confirmAction'); assert.match(d.querySelector('#actionError').textContent,/Conflito/); assert.equal(h.drafts[0].state,'draft');
  h.failPublish = false; await h.click('#confirmAction'); assert.equal(h.drafts[0].state,'published'); assert.equal(h.plans[0].name,'Plano editado'); const call=h.calls.findLast(c=>c.path.includes('atlas_publish_draft')); assert.deepEqual(call.body,{draft_id:'d1',expected_revision:2});
 } finally {await h.close();}
});

test('coach navigation is scoped; revision, duplicate and unsaved navigation protect historical plan', async () => {
 const h = await harness('coach'), d = h.w.document;
 try {
  assert.equal(d.querySelector('[data-page=team]'),null); await h.click('[data-page=athletes]'); assert.match(d.querySelector('#athleteResults').textContent,/Marina/); assert.ok(!d.querySelector('#athleteResults').textContent.includes('Rafael'));
  await h.click('[data-athlete=a]'); await h.click('[data-plan=p1]'); await h.click('[data-revise=p1]'); assert.match(d.querySelector('#content').textContent,/versão publicada continua disponível/);
  await h.input('[data-field=name]','Revisão 2'); await h.click('[data-page=plans]'); assert.match(d.querySelector('#managementDialog').textContent,/Descartar alterações/); await h.click('[data-dismiss]'); assert.equal(d.querySelector('[data-field=name]').value,'Revisão 2');
  await h.submit(); assert.equal(h.drafts[0].base_plan_id,'p1'); await h.click('#reviewPublish'); await h.click('#confirmAction'); assert.equal(h.plans.find(p=>p.id==='p1').state,'archived'); assert.equal(h.plans.find(p=>p.id==='p2').version,2);
  await h.click('[data-plan=p2]'); await h.click('[data-copy-plan=p2]'); assert.equal(d.querySelector('#destination').value,''); await h.click('#confirmAction'); assert.match(d.querySelector('#actionError').textContent,/Selecione/); d.querySelector('#destination').value='a'; await h.click('#confirmAction'); await h.submit(); assert.equal(h.drafts.at(-1).base_plan_id,null); assert.equal(h.drafts.at(-1).athlete_id,'a');
 } finally {await h.close();}
});

test('editor rejects empty guide, invalid dates and duplicate session IDs', () => {
 const doc = parsePlan(model);
 assert.throws(()=>validatePlanDocument({...doc,guide:[]}),/orientações/);
 assert.throws(()=>validatePlanDocument({...doc,sessions:[{...doc.sessions[0],date:'2026-02-30'}]}),/data inválida/);
 assert.throws(()=>validatePlanDocument({...doc,sessions:[doc.sessions[0],doc.sessions[0]]}),/repetido/);
});

test('CSV validation identifies the row of duplicate sessions', () => {
 assert.throws(()=>parsePlan(model.replace('sessao-002','sessao-001')),/Linha \d+: ID inválido ou repetido/);
});
