// Date-only calculations use UTC for calendar arithmetic, independent of DST.
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const todayDate = () => {const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export const displayDate = value => value ? new Date(value+'T12:00:00').toLocaleDateString('pt-BR') : '—';
export const amount = (value, unit) => value == null ? 'Não informado' : Number(value).toLocaleString('pt-BR',{maximumFractionDigits:2})+' '+unit;
export const sessionKey = (user, plan, session) => JSON.stringify([user,plan,session]);
export async function readRows(request, path) {
 const rows = [], size = 500;
 for (let offset = 0; ; offset += size) {
  const batch = await request(`${path}${path.includes('?')?'&':'?'}limit=${size}&offset=${offset}`);
  rows.push(...batch); if (batch.length < size) return rows;
 }
}
export function weekStart(date) {const d = new Date(date+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7); return d.toISOString().slice(0,10);}
export function monitoringRows(plans, records, filters = {}, today = todayDate()) {
 const actual = new Map(records.map(r => [sessionKey(r.user_id,r.plan_id,r.session_id),r]));
 return plans.filter(p => (!filters.athlete || p.user_id === filters.athlete) && (!filters.plan || p.id === filters.plan)
   && (filters.plan || filters.history || p.state !== 'archived'))
  .flatMap(plan => (plan.atlas_sessions || plan.sessions || []).map(session => {
   const key = sessionKey(plan.user_id,plan.id,session.id), record = actual.get(key);
   const state = record ? record.status : session.date < today ? 'missing' : session.date === today ? 'today' : 'scheduled';
   return {key,plan,session,record,state,label:({'missing':'Sem registro','today':'Pendente hoje','scheduled':'Agendado','feito':'Feito','adaptado':'Adaptado','não feito':'Não feito'})[state]};
  }))
  .filter(row => (!filters.from || row.session.date >= filters.from) && (!filters.to || row.session.date <= filters.to) && (!filters.state || filters.state === 'all' || row.state === filters.state))
  .sort((a,b) => a.session.date.localeCompare(b.session.date) || a.key.localeCompare(b.key));
}
const total = (rows, get) => {const values = rows.map(get).filter(v => v != null); return {value:values.length ? values.reduce((n,v)=>n+Number(v),0) : null, informed:values.length};};
export function summarize(rows, today = todayDate()) {
 const done = rows.filter(r => ['feito','adaptado'].includes(r.record?.status)), due = rows.filter(r => r.session.date <= today);
 return {sessions:rows.length,due:due.length,done:done.length,doneDue:due.filter(r=>['feito','adaptado'].includes(r.record?.status)).length,
  missing:rows.filter(r=>r.state==='missing').length,today:rows.filter(r=>r.state==='today').length,scheduled:rows.filter(r=>r.state==='scheduled').length,
  skipped:rows.filter(r=>r.state==='não feito').length,
  plannedKm:total(rows,r=>r.session.km),plannedMinutes:total(rows,r=>r.session.minutes),
  actualKm:total(done,r=>r.record.km),actualMinutes:total(done,r=>r.record.minutes)};
}
export function weeklySummary(rows, today = todayDate()) {
 const weeks = new Map(); for (const row of rows) {const week = weekStart(row.session.date); if (!weeks.has(week)) weeks.set(week,[]); weeks.get(week).push(row);}
 return [...weeks].sort(([a],[b])=>a.localeCompare(b)).map(([week,group])=>({week,...summarize(group,today)}));
}
export function summaryHTML(rows, today = todayDate()) {
 const s = summarize(rows,today), esc = escapeHTML;
 return `<div class="metrics"><div class="metric"><strong>${s.doneDue}/${s.due}</strong><span>realizadas / sessões até hoje</span></div><div class="metric"><strong>${s.missing}</strong><span>datas passadas sem registro</span></div><div class="metric"><strong>${s.skipped}</strong><span>relatadas como não feitas</span></div></div>
  <p class="muted">${s.sessions} sessões na seleção · ${s.today} pendentes hoje · ${s.scheduled} futuras sem registro. Realizadas = feito + adaptado. Totais reais somam apenas os valores informados nessas atividades; campos vazios não contam como zero. O período usa a data da sessão.</p>
  <h3>Resumo por semana</h3>${weeklySummary(rows,today).map(w=>`<article class="card weekly-summary"><h4>Semana de ${esc(displayDate(w.week))}</h4><p>${w.done} realizadas de ${w.sessions} previstas · ${w.missing} sem registro em datas passadas · ${w.skipped} não feitas</p><div class="comparison"><div><strong>Prescrito</strong><p>${esc(amount(w.plannedKm.value,'km'))} · ${esc(amount(w.plannedMinutes.value,'min'))}</p><small>Distância em ${w.plannedKm.informed}/${w.sessions} sessões; duração em ${w.plannedMinutes.informed}/${w.sessions}.</small></div><div><strong>Realizado informado</strong><p>${esc(amount(w.actualKm.value,'km'))} · ${esc(amount(w.actualMinutes.value,'min'))}</p><small>Distância em ${w.actualKm.informed}/${w.done} realizadas; duração em ${w.actualMinutes.informed}/${w.done}.</small></div></div></article>`).join('') || '<p>Nenhuma sessão neste período.</p>'}`;
}
export function commentsHTML(comments) {
 const esc = escapeHTML;
 return `<section class="staff-comments"><h3>Comentários da equipe</h3>${comments.map(c=>`<article class="staff-comment"><strong>${esc(c.author_name)} · ${c.author_role==='admin'?'Admin dono':'Treinador'}</strong><small>${esc(new Date(c.created_at).toLocaleString('pt-BR'))}</small><p class="preserve-lines">${esc(c.body)}</p></article>`).join('') || '<p class="muted">Ainda não há comentários nesta sessão.</p>'}</section>`;
}
