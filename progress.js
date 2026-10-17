import {escapeHTML as esc,todayDate,displayDate,amount,weekStart,weeklySummary,summarize,paceLabel,commentsHTML} from './monitoring.js';

const completed=row=>['feito','adaptado'].includes(row.record?.status);
const endOfWeek=week=>{const d=new Date(week+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+6);return d.toISOString().slice(0,10);};
const range=week=>displayDate(week)+' a '+displayDate(endOfWeek(week));
export const createProgressState=()=>({week:null});
export function durationLabel(value) {
 if(value==null)return 'Não informado';
 const total=Math.round(Number(value)*60),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60),seconds=total%60;
 return [hours?hours+' h':'',minutes||!hours&&!seconds?minutes+' min':'',seconds?seconds+' s':''].filter(Boolean).join(' ');
}
// Pair distance and duration within each session before adding. Independent
// optional totals cannot be divided to obtain a meaningful average pace.
export function pairedPace(rows,get) {
 const pairs=rows.map(get).filter(v=>paceLabel(v?.km,v?.minutes));
 return {label:paceLabel(pairs.reduce((sum,v)=>sum+Number(v.km),0),pairs.reduce((sum,v)=>sum+Number(v.minutes),0)),informed:pairs.length};
}
export function progressData(rows,state,today=todayDate()) {
 const weeks=weeklySummary(rows,today).map(w=>w.week),current=weekStart(today);
 if(!weeks.includes(state.week))state.week=weeks.includes(current)?current:weeks.filter(w=>w<current).at(-1)||weeks[0]||null;
 const selected=rows.filter(r=>weekStart(r.session.date)===state.week),done=selected.filter(completed);
 return {weeks,index:weeks.indexOf(state.week),rows:selected,summary:summarize(selected,today),plannedPace:pairedPace(selected,r=>r.session),actualPace:pairedPace(done,r=>r.record)};
}
export function selectProgressWeek(rows,state,week,today=todayDate()) {
 if(!weeklySummary(rows,today).some(w=>w.week===week))return false;
 state.week=week;return true;
}
const coverage=(informed,count)=>count?`${informed} de ${count} ${count===1?'sessão':'sessões'} com valor${informed<count?' · total parcial':''}`:'Nenhuma sessão realizada';
const counted=(count,one,many)=>count+' '+(count===1?one:many);
const metricHTML=(title,planned,actual,plannedCount,actualCount,s,format)=>`<article class="progress-metric"><h3>${title}</h3><dl><div class="progress-actual"><dt>Realizado</dt><dd><span class="progress-value">${esc(format(actual))}</span><small>${coverage(actualCount,s.done)}</small></dd></div><div><dt>Previsto</dt><dd><span class="progress-value">${esc(format(planned))}</span><small>${coverage(plannedCount,s.sessions)}</small></dd></div></dl></article>`;
function sessionHTML(row,comments) {
 const {session,record,plan}=row,done=completed(row),feedback=comments.filter(c=>c.plan_id===plan.id&&c.session_id===session.id&&c.user_id===plan.user_id);
 const pace=done?paceLabel(record.km,record.minutes):'';
 const values=record?[record.km==null?'':amount(record.km,'km'),record.minutes==null?'':durationLabel(record.minutes),pace?pace+' min/km':''].filter(Boolean):[];
 const feeling=record?[record.effort==null?'':'Esforço '+record.effort+'/10',record.pain==null?'':'Dor '+record.pain+'/10',record.recovery||''].filter(Boolean):[];
 return `<article class="progress-session"><div class="progress-session-heading"><div><p class="progress-date">${esc(displayDate(session.date))}</p><h3>${esc(session.type)}</h3></div><span class="progress-status ${done?'done':''}">${done?'<span aria-hidden="true">✓ </span>':''}${esc(row.label)}</span></div>
 ${record?`<p class="progress-session-values">${values.length?esc(values.join(' · ')):'Distância e duração não informadas.'}</p>${!done&&values.length?'<p class="muted">Valores guardados; não entram nos totais realizados.</p>':''}${feeling.length||record.notes?`<details class="progress-report"><summary>Sensações e observações</summary>${feeling.length?'<p>'+esc(feeling.join(' · '))+'</p>':''}${record.notes?'<p class="preserve-lines">'+esc(record.notes)+'</p>':''}</details>`:''}<button type="button" class="progress-edit" data-record="${esc(session.id)}" aria-label="Editar registro de ${esc(session.type)} em ${esc(displayDate(session.date))}">Editar registro</button>`:''}
 ${feedback.length?commentsHTML(feedback):''}</article>`;
}
export function progressHTML({rows,state,comments=[],today=todayDate()}) {
 const data=progressData(rows,state,today),{weeks,index,summary:s,plannedPace,actualPace}=data;
 if(!weeks.length)return '<section class="athlete-progress"><div class="card"><h2>A evolução começa com seu plano</h2><p>Ainda não há sessões nesta versão. Quando elas forem publicadas, você poderá acompanhar cada semana aqui.</p></div></section>';
 const current=weekStart(today),context=state.week===current?'Semana atual':state.week<current?'Semana anterior à atual':'Semana futura';
 return `<section class="athlete-progress" aria-label="Sua evolução por semana">
 <div class="progress-toolbar"><button type="button" data-progress-week="${weeks[index-1]||''}" aria-label="Semana anterior com sessões" ${index===0?'disabled':''}>←</button><label for="progressWeek">Semana iniciada em<select id="progressWeek">${weeks.map(w=>`<option value="${w}" ${w===state.week?'selected':''}>${esc(displayDate(w))}</option>`).join('')}</select></label><button type="button" data-progress-week="${weeks[index+1]||''}" aria-label="Próxima semana com sessões" ${index===weeks.length-1?'disabled':''}>→</button></div>
 <div class="progress-period"><p id="progressPeriod" tabindex="-1" aria-live="polite"><strong>${esc(range(state.week))}</strong>${context} · ${index+1} de ${weeks.length} semanas com sessões</p>${weeks.includes(current)&&state.week!==current?`<button type="button" data-progress-week="${current}">Semana atual</button>`:''}</div>
 <article class="progress-consistency"><div><h2>Seu ritmo na semana</h2><p class="progress-completion">${s.due?`<strong>${s.doneDue}<span> / ${s.due}</span></strong> ${s.doneDue===1?'realizada':'realizadas'} até hoje`:'Nenhuma sessão prevista até hoje nesta semana.'}</p>${s.due?`<progress value="${s.doneDue}" max="${s.due}" aria-label="Sessões realizadas entre as previstas até hoje">${s.doneDue} de ${s.due}</progress>`:''}</div><p class="progress-counts">${counted(s.sessions,'prevista','previstas')} na semana · ${counted(s.done,'realizada','realizadas')} no total<br>${s.missing} sem registro em datas passadas · ${counted(s.today,'pendente','pendentes')} hoje<br>${counted(s.skipped,'não feita','não feitas')} · ${counted(s.scheduled,'futura','futuras')} sem registro</p></article>
 <div class="progress-comparisons" aria-label="Previsto e realizado na semana">
 ${metricHTML('Distância',s.plannedKm.value,s.actualKm.value,s.plannedKm.informed,s.actualKm.informed,s,value=>amount(value,'km'))}
 ${metricHTML('Duração',s.plannedMinutes.value,s.actualMinutes.value,s.plannedMinutes.informed,s.actualMinutes.informed,s,durationLabel)}
 <article class="progress-metric progress-pace"><h3>Pace médio</h3><dl><div class="progress-actual"><dt>Realizado</dt><dd>${actualPace.label?esc(actualPace.label)+' <span>min/km</span>':'Indisponível'}<small>${s.done?actualPace.informed+' de '+counted(s.done,'realizada','realizadas')+' com distância e duração válidas':'Nenhuma sessão realizada'}</small></dd></div><div><dt>Previsto</dt><dd>${plannedPace.label?esc(plannedPace.label)+' <span>min/km</span>':'Indisponível'}<small>${plannedPace.informed} de ${counted(s.sessions,'prevista','previstas')} com distância e duração válidas</small></dd></div></dl></article></div>
 <details class="progress-about"><summary>Como ler os números</summary><p>Previsto considera a semana inteira. Realizado soma apenas valores informados em sessões Feito ou Adaptado desta semana, pela data da sessão. Não feito é um relato; sem registro não significa que você deixou de treinar. Campos vazios não viram zero.</p><p>O pace divide a duração somada pela distância somada somente das mesmas sessões com ambos os valores maiores que zero. Duração sem distância, como uma sessão de força, participa do tempo total e fica fora do pace. Um pace parcial não representa todas as atividades nem indica, sozinho, melhora de desempenho.</p><p>Esta seleção usa apenas a versão do plano escolhida. As setas percorrem semanas com sessões, de segunda a domingo.</p></details>
 <div class="progress-history-heading"><h2>Sessões da semana</h2><p class="muted">Relatos e comentários da equipe.</p></div><div class="progress-history">${data.rows.map(row=>sessionHTML(row,comments)).join('')}</div>
 </section>`;
}
