import {test} from 'node:test';
import assert from 'node:assert/strict';
import {monitoringRows, summarize, weeklySummary, weekStart, commentsHTML, readRows} from '../monitoring.js';

const session = (id,date,km=null,minutes=null) => ({id,date,km,minutes,type:'Treino'});
const plans = [{id:'current',user_id:'a',state:'published',atlas_sessions:[session('one','2026-10-05',5,30),session('two','2026-10-08',null,20),session('three','2026-10-09',0,0),session('future','2026-10-12',6,40)]},
 {id:'old',user_id:'a',state:'archived',atlas_sessions:[session('one','2026-10-05',3,25)]},
 {id:'other',user_id:'b',state:'published',atlas_sessions:[session('one','2026-10-06',4,20)]}];
const records = [{user_id:'a',plan_id:'current',session_id:'one',status:'adaptado',km:0,minutes:null},
 {user_id:'a',plan_id:'old',session_id:'one',status:'feito',km:3,minutes:24},
 {user_id:'b',plan_id:'other',session_id:'one',status:'não feito',km:null,minutes:null}];

test('monitoring keeps versions and users separate; absent records differ from today/future/skipped',()=>{
 const rows=monitoringRows(plans,records,{},'2026-10-09');
 assert.equal(rows.length,5);assert.deepEqual(rows.map(r=>r.state),['adaptado','não feito','missing','today','scheduled']);
 const historical=monitoringRows(plans,records,{athlete:'a',plan:'old'},'2026-10-09');assert.equal(historical[0].record.km,3);
 assert.equal(monitoringRows(plans,records,{athlete:'a',history:true},'2026-10-09').length,5);
 assert.equal(monitoringRows(plans,records,{from:'2026-10-08',to:'2026-10-09',state:'missing'},'2026-10-09').length,1);
});
test('weekly totals distinguish missing values from zero and exclude future sessions from due denominator',()=>{
 const rows=monitoringRows(plans,records,{athlete:'a'},'2026-10-09'), s=summarize(rows,'2026-10-09');
 assert.equal(s.doneDue,1);assert.equal(s.due,3);assert.equal(s.actualKm.value,0);assert.equal(s.actualKm.informed,1);assert.equal(s.actualMinutes.value,null);
 assert.equal(s.plannedKm.value,11);assert.equal(s.plannedKm.informed,3);assert.equal(s.missing,1);
 const weeks=weeklySummary(rows,'2026-10-09');assert.equal(weeks.length,2);assert.equal(weeks[0].week,'2026-10-05');assert.equal(weeks[1].due,0);
 const futureDone=monitoringRows(plans,[...records,{user_id:'a',plan_id:'current',session_id:'future',status:'feito',km:6}],{athlete:'a'},'2026-10-09');
 assert.equal(summarize(futureDone,'2026-10-09').done,2);assert.equal(summarize(futureDone,'2026-10-09').doneDue,1);
});
test('Monday week grouping spans year boundaries; comments escape author and body',()=>{
 assert.equal(weekStart('2027-01-03'),'2026-12-28');assert.equal(weekStart('2027-01-04'),'2027-01-04');
 const html=commentsHTML([{author_name:'<img src=x>',author_role:'coach',body:'<script>alert(1)</script>',created_at:'2026-10-09T12:00:00Z'}]);
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;script&gt;'));
});
test('paged reads include rows beyond the API limit',async()=>{
 const data=Array.from({length:1001},(_,i)=>({id:i})),calls=[];
 const rows=await readRows(async path=>{calls.push(path);const url=new URL(path,'http://example/');const offset=Number(url.searchParams.get('offset'));return data.slice(offset,offset+500);},'/rest/v1/records?order=id');
 assert.equal(rows.length,1001);assert.equal(calls.length,3);assert.match(calls[2],/offset=1000/);
});
