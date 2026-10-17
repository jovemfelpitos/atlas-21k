import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {monitoringRows} from '../monitoring.js';
import {createProgressState,progressData,progressHTML,selectProgressWeek,pairedPace,durationLabel} from '../progress.js';

const session=(id,date,km=null,minutes=null)=>({id,date,km,minutes,type:'Corrida'});
const plan={id:'p',user_id:'a',state:'published',sessions:[session('past','2026-12-28',5,30),session('run','2027-01-04',5,30),session('strength','2027-01-04',null,40),session('incomplete','2027-01-05',10,null),session('zero','2027-01-06',0,0),session('skip','2027-01-07',4,30),session('today','2027-01-08'),session('future','2027-01-10',6,36),session('next','2027-01-11',7,42)]};
const records=[
 {user_id:'a',plan_id:'p',session_id:'run',status:'feito',km:5,minutes:25},
 {user_id:'a',plan_id:'p',session_id:'strength',status:'feito',km:null,minutes:40},
 {user_id:'a',plan_id:'p',session_id:'incomplete',status:'adaptado',km:10,minutes:null},
 {user_id:'a',plan_id:'p',session_id:'zero',status:'feito',km:0,minutes:0},
 {user_id:'a',plan_id:'p',session_id:'skip',status:'não feito',km:99,minutes:999}
];
const today='2027-01-08',rows=()=>monitoringRows([plan],records,{plan:'p'},today);
test('weekly progress reuses totals, pairs pace and keeps strength, zero and skipped separate',()=>{
 const state=createProgressState(),data=progressData(rows(),state,today),s=data.summary;
 assert.equal(state.week,'2027-01-04');assert.equal(s.sessions,7);assert.equal(s.done,4);assert.equal(s.due,6);assert.equal(s.doneDue,4);
 assert.equal(s.actualKm.value,15);assert.equal(s.actualKm.informed,3);assert.equal(s.actualMinutes.value,65);assert.equal(s.actualMinutes.informed,3);
 assert.deepEqual(data.actualPace,{label:'5:00',informed:1});
 assert.deepEqual(data.plannedPace,{label:'6:24',informed:3});
 assert.equal(s.skipped,1);assert.equal(s.today,1);assert.equal(s.scheduled,1);
 const future=monitoringRows([plan],[...records,{user_id:'a',plan_id:'p',session_id:'future',status:'adaptado',km:6,minutes:30}],{plan:'p'},today);
 const fs=progressData(future,createProgressState(),today).summary;assert.equal(fs.done,5);assert.equal(fs.doneDue,4);
});
test('pace is distance-weighted with seconds carry and no per-session cap on weekly totals',()=>{
 const pace=pairedPace([{km:2,minutes:10},{km:8,minutes:48},{km:100,minutes:null}],r=>r);
 assert.deepEqual(pace,{label:'5:48',informed:2});
 assert.equal(pairedPace([{km:1,minutes:5.999}],r=>r).label,'6:00');
 assert.equal(pairedPace(Array.from({length:10},()=>({km:100,minutes:200})),r=>r).label,'2:00');
 assert.deepEqual(pairedPace([{km:0,minutes:30},{km:5,minutes:0},{km:null,minutes:40},{km:4,minutes:null}],r=>r),{label:'',informed:0});
 assert.equal(durationLabel(65.5),'1 h 5 min 30 s');assert.equal(durationLabel(0),'0 min');assert.equal(durationLabel(null),'Não informado');
});
test('all-zero actuals remain zero while a completed activity without metrics stays unknown',()=>{
 const p={...plan,sessions:[session('zero',today,0,0)]};
 const zero=progressData(monitoringRows([p],records,{plan:'p'},today),createProgressState(),today);
 assert.equal(zero.summary.actualKm.value,0);assert.equal(zero.summary.actualMinutes.value,0);assert.equal(zero.actualPace.label,'');
 const absent=progressData(monitoringRows([p],[{user_id:'a',plan_id:'p',session_id:'zero',status:'feito',km:null,minutes:null}],{plan:'p'},today),createProgressState(),today);
 assert.equal(absent.summary.done,1);assert.equal(absent.summary.actualKm.value,null);assert.equal(absent.summary.actualMinutes.value,null);
 assert.match(progressHTML({rows:[],state:createProgressState(),today}),/Ainda não há sessões/);
});
test('weeks cross years, skip empty weeks, preserve valid selection and recover when data changes',()=>{
 const state=createProgressState();progressData(rows(),state,'2027-02-05');assert.equal(state.week,'2027-01-11');
 state.week=null;progressData(rows(),state,'2026-12-01');assert.equal(state.week,'2026-12-28');
 assert.ok(selectProgressWeek(rows(),state,'2026-12-28',today));progressData(rows(),state,today);assert.equal(state.week,'2026-12-28');
 assert.equal(selectProgressWeek(rows(),state,'2027-02-01',today),false);assert.equal(state.week,'2026-12-28');
 progressData(rows().filter(r=>r.session.date>'2027-01-01'),state,today);assert.equal(state.week,'2027-01-04');
 const empty=createProgressState();assert.equal(progressData([],empty,today).summary.actualKm.value,null);assert.equal(empty.week,null);
});
test('weekly presentation distinguishes unreported metrics, explicit zero, partial totals and future-only weeks',()=>{
 const w=new Window();try{
  w.document.body.innerHTML=progressHTML({rows:rows(),state:createProgressState(),today});
  const d=w.document;assert.match(d.querySelector('.progress-comparisons').textContent,/total parcial/);
  assert.equal(d.querySelectorAll('.progress-session').length,7);assert.equal(d.querySelectorAll('[data-record]').length,5);
  assert.match(d.querySelector('[data-record=zero]').closest('article').textContent,/0 km · 0 min/);
  assert.match(d.querySelector('[data-record=skip]').closest('article').textContent,/não entram nos totais/);
  const state={week:'2027-01-11'};w.document.body.innerHTML=progressHTML({rows:rows(),state,today});
  assert.equal(d.querySelector('progress'),null);assert.match(d.querySelector('.progress-completion').textContent,/Nenhuma sessão prevista até hoje/);
  assert.match(d.querySelector('.progress-actual').textContent,/Não informado/);assert.match(d.querySelector('.progress-pace .progress-actual').textContent,/Indisponível/);
  assert.equal(d.querySelector('[aria-label="Próxima semana com sessões"]').disabled,true);
 }finally{w.happyDOM.close();}
});
test('progress isolates versions and accounts, retains comments without a record and escapes authored content',()=>{
 const hostile={...plan,sessions:[{...plan.sessions[0],type:'<img src=x>',date:today}]};
 const all=monitoringRows([hostile,{...hostile,id:'old',state:'archived'},{...hostile,user_id:'b'}],records,{athlete:'a',plan:'p'},today);
 const comments=[{user_id:'a',plan_id:'p',session_id:'past',author_name:'<b>Nome</b>',author_role:'coach',body:'<script>Texto</script>',created_at:'2027-01-08T12:00:00Z'},
 {user_id:'b',plan_id:'p',session_id:'past',author_name:'Outro',body:'Vazamento',created_at:'2027-01-08T12:00:00Z'},
 {user_id:'a',plan_id:'old',session_id:'past',author_name:'Antigo',body:'Versão anterior',created_at:'2027-01-08T12:00:00Z'}];
 const w=new Window();try{
  w.document.body.innerHTML=progressHTML({rows:all,state:createProgressState(),comments,today});
  assert.equal(w.document.querySelectorAll('.progress-session').length,1);assert.equal(w.document.querySelectorAll('.staff-comment').length,1);
  assert.equal(w.document.querySelector('img,script,b'),null);assert.match(w.document.body.textContent,/<script>Texto/);assert.ok(!w.document.body.textContent.includes('Vazamento'));
  assert.equal(w.document.querySelector('[data-record]'),null);
 }finally{w.happyDOM.close();}
});
