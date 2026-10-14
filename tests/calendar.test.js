import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {monitoringRows} from '../monitoring.js';
import {monthDays,shiftMonth,createCalendarState,filterCalendarRows,calendarHTML,handleCalendarAction} from '../calendar.js';

const today='2026-10-14';
const sessions=[
 {id:'run',date:today,type:'Corrida <leve>'},
 {id:'gym',date:today,type:'Força'},
 {id:'past',date:'2026-10-13',type:'Corrida'},
 {id:'skip',date:'2026-10-12',type:'Corrida'},
 {id:'future',date:'2026-10-15',type:'Corrida'},
 {id:'next',date:'2026-11-01',type:'Corrida'}
];
const plan={id:'p',user_id:'a',state:'published',atlas_sessions:sessions};
const records=[{user_id:'a',plan_id:'p',session_id:'run',status:'adaptado'}, {user_id:'a',plan_id:'p',session_id:'skip',status:'não feito'}];
const rows=monitoringRows([plan],records,{},today);

test('month navigation preserves date-only boundaries across leap years, DST and year changes',()=>{
 assert.equal(shiftMonth('2026-12',1),'2027-01');assert.equal(shiftMonth('2026-01',-1),'2025-12');
 assert.equal(shiftMonth('2024-01',1),'2024-02');
 for(const month of ['2024-02','2026-02','2026-03','2026-10','2026-12','2027-01']){
  const days=monthDays(month);assert.equal(days.length%7,0);assert.equal(new Date(days[0]+'T12:00:00Z').getUTCDay(),1);
  assert.equal(new Date(days.at(-1)+'T12:00:00Z').getUTCDay(),0);assert.equal(new Set(days).size,days.length);
  assert.equal(days.filter(d=>d.startsWith(month)).length,month==='2024-02'?29:month==='2026-02'?28:31);
 }
 assert.ok(monthDays('2024-02').includes('2024-02-29'));assert.ok(!monthDays('2026-02').includes('2026-02-29'));
});

test('execution filters distinguish an explicit skipped report from missing, today and scheduled records',()=>{
 assert.deepEqual(filterCalendarRows(rows,'done').map(r=>r.session.id),['run']);
 assert.deepEqual(filterCalendarRows(rows,'skipped').map(r=>r.session.id),['skip']);
 assert.deepEqual(new Set(filterCalendarRows(rows,'pending').map(r=>r.state)),new Set(['missing','today','scheduled']));
 const old={...plan,id:'old',state:'archived'};
 const wrongRecords=[...records,{user_id:'a',plan_id:'old',session_id:'gym',status:'feito'},{user_id:'b',plan_id:'p',session_id:'gym',status:'feito'}];
 const current=monitoringRows([plan,old],wrongRecords,{plan:'p'},today);
 assert.equal(current.length,sessions.length);assert.equal(current.find(r=>r.session.id==='gym').state,'today');
 assert.equal(monitoringRows([plan,old],wrongRecords,{plan:'old'},today).find(r=>r.session.id==='gym').state,'feito');
 assert.deepEqual(plan.atlas_sessions,sessions);
});

test('calendar retains two sessions on a day, explains empty filters and restores keyboard focus',async()=>{
 const w=new Window();w.document.write('<main></main>');const root=w.document.querySelector('main'),state=createCalendarState(rows,today);
 const render=()=>root.innerHTML=calendarHTML({rows,state,today,renderSession:row=>`<article>${row.session.id}</article>`});
 root.addEventListener('click',e=>handleCalendarAction(e,state,render,today));render();
 try{
  assert.equal(root.querySelectorAll('.calendar-day-detail article').length,2);
  const day=root.querySelector(`.calendar-grid [data-cal-day="${today}"]`);assert.match(day.getAttribute('aria-label'),/2 sessões/);assert.match(day.getAttribute('aria-label'),/Adaptado/);assert.match(day.getAttribute('aria-label'),/Pendente hoje/);assert.equal(day.getAttribute('aria-current'),'date');
  assert.ok(!root.querySelector('leve'));assert.match(day.getAttribute('aria-label'),/<leve>/);
  root.querySelector('[data-cal-filter=skipped]').click();assert.match(root.querySelector('.calendar-day-detail').textContent,/Nenhuma sessão/);
  assert.equal(w.document.activeElement.dataset.calFilter,'skipped');root.querySelector('.calendar-day-detail [data-cal-filter=all]').click();assert.equal(root.querySelectorAll('.calendar-day-detail article').length,2);
  root.querySelector('[data-cal-mode=agenda]').click();assert.equal(root.querySelectorAll('.calendar-agenda-day article').length,6);assert.match(root.textContent,/novembro/);
  root.querySelector('[data-cal-mode=month]').click();root.querySelector('[data-cal-shift="1"]').click();assert.equal(state.month,'2026-11');assert.equal(state.day,'2026-11-01');
  root.querySelector('[data-cal-today]').click();assert.equal(state.month,'2026-10');assert.equal(state.day,today);
 }finally{await w.happyDOM.close();}
});

test('an empty or out-of-period plan has an explicit location and a way to return to today',async()=>{
 assert.equal(createCalendarState([],today).day,today);
 assert.equal(createCalendarState(rows,'2026-01-01').day,'2026-10-12');assert.equal(createCalendarState(rows,'2027-01-01').day,'2026-11-01');
 const w=new Window();try{
  w.document.write(calendarHTML({rows:[],state:createCalendarState([],today),today,renderSession:()=>''}));
  assert.match(w.document.body.textContent,/0 sessões neste mês/);assert.match(w.document.body.textContent,/Nenhuma sessão/);assert.ok(w.document.querySelector('[data-cal-today]'));
 }finally{await w.happyDOM.close();}
});
