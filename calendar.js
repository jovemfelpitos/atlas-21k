import {escapeHTML as esc, todayDate, displayDate} from './monitoring.js';

const iso = date => date.toISOString().slice(0,10);
const utc = date => new Date(date+'T12:00:00Z');
const fullDate = date => utc(date).toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
const group = row => ['feito','adaptado'].includes(row.state) ? 'done' : row.state==='não feito' ? 'skipped' : 'pending';
const symbols = {done:'✓',pending:'○',skipped:'×'};
const filters = [['all','Todas'],['done','Realizadas'],['pending','Sem registro'],['skipped','Não feitas']];

// All arithmetic uses date-only values in UTC, including leap years and DST changes.
export function shiftMonth(month, offset) {
 const d=utc(month+'-15'); d.setUTCMonth(d.getUTCMonth()+offset);
 return d.getUTCFullYear()<1 || d.getUTCFullYear()>9999 ? month : iso(d).slice(0,7);
}
export function monthDays(month) {
 const first=utc(month+'-01'), next=utc(month+'-15'); next.setUTCMonth(next.getUTCMonth()+1,1);
 const count=Math.round((next-first)/86400000), leading=(first.getUTCDay()+6)%7;
 return Array.from({length:Math.ceil((leading+count)/7)*7},(_,i)=>{
  const d=utc(month+'-01'); d.setUTCDate(i-leading+1);
  return d.getUTCFullYear()<1 || d.getUTCFullYear()>9999 ? null : iso(d);
 });
}
export function createCalendarState(rows, today=todayDate()) {
 const dates=rows.map(r=>r.session.date).sort();
 const day=!dates.length || (dates[0]<=today && dates.at(-1)>=today) ? today : dates.find(d=>d>=today)||dates.at(-1);
 return {mode:'month',month:day.slice(0,7),day,filter:'all'};
}
export const filterCalendarRows = (rows, filter) => rows.filter(r=>filter==='all'||group(r)===filter);

export function calendarHTML({rows,state,renderSession,today=todayDate()}) {
 const filtered=filterCalendarRows(rows,state.filter), monthRows=filtered.filter(r=>r.session.date.startsWith(state.month));
 const byDay=new Map();
 for(const row of filtered){const day=row.session.date;if(!byDay.has(day))byDay.set(day,[]);byDay.get(day).push(row);}
 const cards=list=>list.map(row=>`<div class="calendar-session" data-calendar-key="${esc(row.key)}"><p class="calendar-status ${group(row)}"><span aria-hidden="true">${symbols[group(row)]}</span> ${esc(row.label)}</p>${renderSession(row)}</div>`).join('');
 const empty='<p class="calendar-empty">Nenhuma sessão nesta seleção.</p>';
 const title=utc(state.month+'-01').toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'});
 const nearest=rows.find(r=>r.session.date>=today)||rows.at(-1);
 return `<section class="training-calendar" aria-label="Calendário de treinos">
  <h2>Calendário de treinos</h2>
  <div class="calendar-modes" role="group" aria-label="Visualização do calendário">${[['month','Mês'],['agenda','Agenda']].map(([value,label])=>`<button type="button" data-cal-mode="${value}" aria-pressed="${state.mode===value}">${label}</button>`).join('')}</div>
  <div class="calendar-filters" role="group" aria-label="Filtrar sessões por execução">${filters.map(([value,label])=>`<button type="button" data-cal-filter="${value}" aria-pressed="${state.filter===value}">${label} <span>${filterCalendarRows(rows,value).length}</span></button>`).join('')}</div>
  <p class="calendar-help">Realizadas = feito + adaptado. Sem registro inclui datas passadas, hoje e futuras; não significa que o treino não foi feito. Filtros e contagens consideram apenas esta versão do plano.</p>
  ${state.mode==='month'?`<div class="calendar-toolbar"><button type="button" data-cal-shift="-1" aria-label="Mês anterior" ${shiftMonth(state.month,-1)===state.month?'disabled':''}>←</button><h3 aria-live="polite" aria-atomic="true">${esc(title)}</h3><button type="button" data-cal-shift="1" aria-label="Próximo mês" ${shiftMonth(state.month,1)===state.month?'disabled':''}>→</button></div>
   <div class="calendar-shortcuts"><button type="button" data-cal-today>Hoje · ${displayDate(today)}</button>${nearest?`<button type="button" data-cal-day="${esc(nearest.session.date)}">Ir para um treino</button>`:''}</div>
   <div class="calendar-weekdays" aria-hidden="true">${['SEG','TER','QUA','QUI','SEX','SÁB','DOM'].map(d=>`<span>${d}</span>`).join('')}</div>
   <div class="calendar-grid" role="group" aria-label="Dias de ${esc(title)}">${monthDays(state.month).map(day=>{
    if(!day)return '<span></span>';
    const dayRows=byDay.get(day)||[], counts=['done','pending','skipped'].map(g=>[g,dayRows.filter(r=>group(r)===g).length]).filter(([,count])=>count);
    const label=fullDate(day)+(day===today?', hoje':'')+`, ${dayRows.length} ${dayRows.length===1?'sessão':'sessões'}${state.filter==='all'?'':' no filtro'}`+(dayRows.length?': '+dayRows.map(r=>r.label+' · '+r.session.type).join('; '):'');
    return `<button type="button" class="calendar-date ${day.startsWith(state.month)?'':'outside'}" data-cal-day="${day}" aria-label="${esc(label)}" aria-pressed="${day===state.day}" ${day===today?'aria-current="date"':''}><span class="calendar-number">${Number(day.slice(-2))}</span><span class="calendar-markers" aria-hidden="true">${counts.map(([g])=>`<span class="${g}">${symbols[g]}</span>`).join('')}</span><span class="calendar-count" aria-hidden="true">${dayRows.length?dayRows.length+' '+(dayRows.length===1?'treino':'treinos'):'·'}</span></button>`;
   }).join('')}</div>
   <p class="calendar-legend"><span class="done">✓ Realizadas</span><span class="pending">○ Sem registro</span><span class="skipped">× Não feitas</span><span class="calendar-today-key">Contorno: hoje</span></p>
   <p class="calendar-help" role="status">${monthRows.length} ${monthRows.length===1?'sessão':'sessões'} neste mês${state.filter==='all'?'':' com o filtro selecionado'}. Toque em um dia para ver todos os treinos.</p>
   <section class="calendar-day-detail" aria-label="Treinos do dia selecionado"><h3 aria-live="polite" aria-atomic="true">${esc(fullDate(state.day))}${state.day===today?' · Hoje':''}</h3>${byDay.has(state.day)?cards(byDay.get(state.day)):empty}${state.filter!=='all' && rows.some(r=>r.session.date===state.day)?'<button type="button" data-cal-filter="all">Ver todas as sessões deste dia</button>':''}</section>`
   :`<h3>Agenda completa do plano</h3><p class="calendar-help">Todas as datas desta versão, em ordem cronológica${state.filter==='all'?'':', com o filtro selecionado'}. ${filtered.length} sessões.</p>${[...byDay].sort(([a],[b])=>a.localeCompare(b)).map(([day,list])=>`<section class="calendar-agenda-day"><h3>${esc(fullDate(day))}${day===today?' · Hoje':''}</h3>${cards(list)}</section>`).join('')||empty}`}
 </section>`;
}

// The parent owns state and rendering, so saving a record keeps the chosen day/filter.
export function handleCalendarAction(event,state,render,today=todayDate()) {
 const button=event.target.closest('button');
 if(!button?.closest('.training-calendar')||button.disabled)return false;
 let focus;
 if(button.dataset.calMode){state.mode=button.dataset.calMode;focus=`[data-cal-mode="${state.mode}"]`;}
 else if(button.dataset.calFilter){state.filter=button.dataset.calFilter;focus=`[data-cal-filter="${state.filter}"]`;}
 else if(button.dataset.calShift){state.month=shiftMonth(state.month,Number(button.dataset.calShift));state.day=state.month+'-01';focus=`[data-cal-shift="${button.dataset.calShift}"]`;}
 else if(button.hasAttribute('data-cal-today')){state.day=today;state.month=today.slice(0,7);focus='[data-cal-today]';}
 else if(button.dataset.calDay){state.day=button.dataset.calDay;state.month=state.day.slice(0,7);focus=`.calendar-grid [data-cal-day="${state.day}"]`;}
 else return false;
 const document=button.ownerDocument;
 render();document.querySelector('.training-calendar '+focus)?.focus({preventScroll:true});return true;
}
