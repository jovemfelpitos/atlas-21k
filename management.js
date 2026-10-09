import {parsePlan} from './importer.js';
import {blankPlan, newSession, prescription, validatePlanDocument} from './plan-editor.js';
import {readRows, monitoringRows, summaryHTML, commentsHTML, amount, sessionKey} from './monitoring.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const date = value => value ? new Date(value + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
const copy = value => JSON.parse(JSON.stringify(value));
const status = value => ({draft: 'Rascunho', published: 'Publicado', archived: 'Arquivado'}[value] || value);
const field = (label, key, value, type = 'text', extras = '') => `<label>${esc(label)}<input data-field="${key}" type="${type}" value="${esc(value)}" ${extras}></label>`;
const area = (label, key, value, max) => `<label>${esc(label)}<textarea data-field="${key}" rows="3" maxlength="${max}">${esc(value)}</textarea></label>`;

export function createManagement({root, role, enabled = true, userId, request, notice, saveProfile}) {
 let people = [], coaches = [], links = [], plans = [], drafts = [], events = [], records = [], comments = [];
 let monitor = {athlete:'',plan:'',from:'',to:'',state:'all',history:false}, inspected = null, commentDraft = {id:null,text:''};
 let page = 'overview', selectedAthlete = '', search = '', filter = 'all', detail = null, editor = null;
 let dirty = false, busy = false, preview = 'list', pending = null;
 const owner = role === 'admin';
 const listeners = [];
 const listen = (type, handler) => {root.addEventListener(type, handler); listeners.push([type, handler]);};
 const post = (path, body, headers = {}) => request(path, {method: 'POST', body: JSON.stringify(body), headers});
 const rpc = (name, body) => post('/rest/v1/rpc/' + name, body);
 const name = id => people.find(p => p.user_id === id)?.name || 'Atleta';
 const athletes = () => people.filter(p => p.user_id !== userId && !p.is_admin && !coaches.some(c => c.user_id === p.user_id));
 const options = selected => `<option value="">Selecione um atleta</option>` + athletes().map(p => `<option value="${esc(p.user_id)}" ${p.user_id === selected ? 'selected' : ''}>${esc(p.name)} · ${esc(p.user_id.slice(-6))}</option>`).join('');
 const message = (text, error = false) => {const el = root.querySelector('#managementError'); if (el) {el.textContent = text; el.classList.toggle('error', error); el.setAttribute('role', error ? 'alert' : 'status');} notice(text);};

 async function load() {
  const result = await Promise.all([
   '/rest/v1/atlas_profiles?select=*&order=name,user_id', '/rest/v1/atlas_coaches?select=*&order=user_id', '/rest/v1/atlas_coach_athletes?select=*&order=coach_id,athlete_id',
   '/rest/v1/atlas_plans?select=*,atlas_sessions(*)&order=created_at.desc,id', '/rest/v1/atlas_plan_drafts?select=*&order=updated_at.desc,id', '/rest/v1/atlas_plan_events?select=*&order=created_at.desc,id',
   '/rest/v1/atlas_activity_records?select=*&order=user_id,plan_id,session_id', '/rest/v1/atlas_session_comments?select=*&order=created_at,id'
  ].map(path => readRows(request,path)));
  [people, coaches, links, plans, drafts, events, records, comments] = result;
 }

 function previewPlan(document) {
  const sessions = document.sessions;
  const session = s => `<article class="session-preview"><h4>${esc(s.type)} <span class="tag">${esc(s.id)}</span></h4><p>${s.km ?? '—'} km · ${s.minutes ?? '—'} min · ${esc(s.intensity)}</p><p>${esc(s.description)}</p>${s.gym ? `<p>Musculação: ${esc(s.gym)}</p>` : ''}${s.notes ? `<p>Observações: ${esc(s.notes)}</p>` : ''}</article>`;
  const days = [...new Set(sessions.map(s => s.date))].sort();
  return `<div class="review-summary"><strong>${esc(document.name || 'Plano sem nome')}</strong><p>${sessions.length} sessões · ${date(days[0])} a ${date(days.at(-1))}</p><p>Meta: ${document.goal_km ?? '—'} km · ${document.goal_minutes ?? '—'} min · ${date(document.goal_date)}</p></div>
   ${preview === 'calendar' ? `<div class="calendar-preview">${days.map(day => `<section class="calendar-day"><h3>${date(day)}</h3>${sessions.filter(s => s.date === day).map(session).join('')}</section>`).join('')}</div>` : sessions.map(s => `<section><h3>${date(s.date)}</h3>${session(s)}</section>`).join('')}
   <h3>Guia completo</h3>${document.guide.map(g => `<article class="session-preview"><h4>${esc(g.tema)}</h4><p class="preserve-lines">${esc(g.orientacao)}</p></article>`).join('')}`;
 }

 function overview() {
  const open = drafts.filter(d => d.state === 'draft');
  return `<h2>${owner ? 'Admin dono' : 'Área do treinador'}</h2><p>${owner ? 'Gerencie sua equipe, os atletas e os planos.' : 'Crie e publique planos para os atletas vinculados a você.'}</p>
   <div class="metrics"><div class="metric"><strong>${athletes().length}</strong><span>atletas ${owner ? 'cadastrados' : 'vinculados'}</span></div><div class="metric"><strong>${open.length}</strong><span>rascunhos</span></div><div class="metric"><strong>${plans.filter(p => p.state === 'published').length}</strong><span>planos publicados</span></div></div>
   <div class="actions"><button data-page="athletes">Ver atletas</button><button data-page="plans">Gerenciar planos</button><button data-page="monitoring">Acompanhar atividades</button></div><h3>Rascunhos recentes</h3>${open.slice(0, 5).map(draftCard).join('') || '<p>Nenhum rascunho. Escolha um atleta para começar.</p>'}`;
 }
 function athleteList() {
  const list = athletes().filter(p => p.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  return `<h2>Atletas</h2><label>Buscar pelo nome<input id="athleteSearch" value="${esc(search)}" type="search" placeholder="Nome do atleta"></label><div id="athleteResults">${list.map(p => {
   const assigned = plans.filter(plan => plan.user_id === p.user_id && plan.state === 'published').length;
   return `<article class="card"><h3>${esc(p.name)}</h3><p>${assigned ? assigned + ' plano(s) publicado(s)' : 'Sem plano publicado'}</p><button data-athlete="${esc(p.user_id)}">Abrir atleta</button></article>`;
  }).join('') || '<p>Nenhum atleta encontrado. ' + (owner ? 'Os atletas aparecem aqui depois de criar sua conta e entrar no app.' : 'O dono precisa vincular os atletas à sua conta de treinador.') + '</p>'}</div>`;
 }
 function athleteDetail() {
  const person = people.find(p => p.user_id === selectedAthlete);
  if (!person) return '<p>Atleta indisponível. Atualize os dados.</p>';
  const week = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return `<button data-page="athletes">← Atletas</button><h2>${esc(person.name)}</h2><p>Dias disponíveis: ${(person.available_days || []).map(d => week[d]).join(', ') || 'não informados'}</p><p>Preferências não alteram datas de planos publicados.</p>
   <div class="actions"><button data-new="${esc(selectedAthlete)}" class="primary">Criar plano</button><button data-import="${esc(selectedAthlete)}">Importar CSV</button><button data-monitor-athlete="${esc(selectedAthlete)}">Acompanhar atividades</button></div>
   ${owner ? `<h3>Treinadores responsáveis</h3>${coaches.filter(c => c.active).map(c => {const link = links.find(l => l.coach_id === c.user_id && l.athlete_id === selectedAthlete); return `<div class="team-row"><span>${esc(name(c.user_id))}</span><button data-link-coach="${esc(c.user_id)}" data-link-athlete="${esc(selectedAthlete)}" data-link-active="${!link?.active}">${link?.active ? 'Revogar vínculo' : 'Vincular treinador'}</button></div>`;}).join('') || '<p>Cadastre um treinador na página Equipe.</p>'}` : ''}
   <h3>Planos e histórico</h3>${plans.filter(p => p.user_id === selectedAthlete).map(planCard).join('') || '<p>Sem planos publicados.</p>'}<h3>Rascunhos</h3>${drafts.filter(d => d.athlete_id === selectedAthlete && d.state === 'draft').map(draftCard).join('') || '<p>Sem rascunhos.</p>'}`;
 }
 function draftCard(d) {return `<article class="card"><span class="tag">Rascunho · revisão ${d.revision}</span><h3>${esc(d.document.name)}</h3><p>${esc(name(d.athlete_id))} · ${d.document.sessions.length} sessões</p><button data-draft="${esc(d.id)}">Editar e revisar</button><button data-copy-draft="${esc(d.id)}">Duplicar</button></article>`;}
 function planCard(p) {return `<article class="card"><span class="tag">${status(p.state)} · versão ${p.version}</span><h3>${esc(p.name)}</h3><p>${esc(name(p.user_id))} · ${p.atlas_sessions.length} sessões</p><button data-plan="${esc(p.id)}">Ver plano e histórico</button></article>`;}
 function planList() {
  return `<h2>Planos de treino</h2><div class="actions"><button id="newPlan" class="primary">Criar plano</button><button id="importPlan">Importar CSV</button></div><div class="form-grid"><label>Atleta<select id="filterAthlete"><option value="">Todos os atletas</option>${options(selectedAthlete).replace('<option value="">Selecione um atleta</option>', '')}</select></label><label>Situação<select id="filterState">${[['all', 'Todas'], ['draft', 'Rascunhos'], ['published', 'Publicados'], ['archived', 'Arquivados']].map(([v, label]) => `<option value="${v}" ${filter === v ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div>
   <div>${(filter === 'all' || filter === 'draft' ? drafts.filter(d => d.state === 'draft' && (!selectedAthlete || d.athlete_id === selectedAthlete)).map(draftCard).join('') : '') + plans.filter(p => (filter === 'all' || filter === p.state) && (!selectedAthlete || p.user_id === selectedAthlete)).map(planCard).join('') || '<p>Nenhum plano nesta seleção.</p>'}</div>`;
 }
 function planDetail() {
  const p = plans.find(p => p.id === detail);
  if (!p) return '<p>Plano indisponível.</p>';
  return `<button data-page="plans">← Planos</button><h2>${esc(p.name)}</h2><p>${esc(name(p.user_id))} · ${status(p.state)} · versão ${p.version}</p><div class="actions">${p.state === 'published' ? `<button data-revise="${esc(p.id)}" class="primary">Criar revisão</button><button data-archive="${esc(p.id)}">Arquivar plano</button>` : ''}<button data-copy-plan="${esc(p.id)}">Duplicar para outro atleta</button></div>
   <button data-monitor-plan="${esc(p.id)}">Acompanhar este plano</button><p>Revisões geram uma nova versão. As sessões e atividades anteriores permanecem no histórico.</p>${previewPlan(prescription(p))}<h3>Histórico de publicação</h3>${p.previous_plan_id ? `<button data-plan="${esc(p.previous_plan_id)}">Abrir versão anterior</button>` : ''}${plans.filter(next => next.previous_plan_id === p.id).map(next => `<button data-plan="${esc(next.id)}">Abrir versão ${next.version}</button>`).join('')}<ul>${events.filter(e => e.plan_id === p.id).map(e => `<li>${({published: 'Publicado', archived: 'Arquivado', replaced: 'Substituído por nova versão'})[e.event]} · ${esc(name(e.actor_id))} · ${new Date(e.created_at).toLocaleString('pt-BR')}</li>`).join('') || '<li>Plano anterior à implementação do histórico de eventos.</li>'}</ul>`;
 }
 const sessionComments = row => comments.filter(c => sessionKey(c.user_id,c.plan_id,c.session_id) === row.key);
 function monitoringPage() {
  const rows = monitoringRows(plans,records,monitor), available = plans.filter(p=>!monitor.athlete || p.user_id===monitor.athlete);
  return `<h2>Acompanhamento</h2><p>Compare o treino prescrito com o relato do atleta e deixe comentários na sessão.</p><form id="monitorFilters" class="form-grid">
   <label>Atleta<select name="athlete"><option value="">Todos os atletas</option>${options(monitor.athlete).replace('<option value="">Selecione um atleta</option>','')}</select></label>
   <label>Plano<select name="plan"><option value="">Todos os planos publicados</option>${available.map(p=>`<option value="${esc(p.id)}" ${monitor.plan===p.id?'selected':''}>${esc(p.name)} · v${p.version}${p.state==='archived'?' · histórico':''}</option>`).join('')}</select></label>
   <label>De<input name="from" type="date" value="${esc(monitor.from)}"></label><label>Até<input name="to" type="date" value="${esc(monitor.to)}"></label>
   <label>Situação<select name="state">${[['all','Todas'],['missing','Sem registro em data passada'],['today','Pendente hoje'],['scheduled','Agendado'],['feito','Feito'],['adaptado','Adaptado'],['não feito','Não feito']].map(([v,l])=>`<option value="${v}" ${monitor.state===v?'selected':''}>${l}</option>`).join('')}</select></label>
   <label class="checkbox-label"><input name="history" type="checkbox" ${monitor.history?'checked':''}> Incluir versões arquivadas nos totais</label><button class="primary">Aplicar filtros</button><button type="button" id="clearMonitor">Limpar filtros</button><p id="filterError" class="error" role="alert"></p></form>
   <p class="muted">Versões arquivadas ficam fora dos totais por padrão. Selecione um plano histórico ou marque a opção para consultá-las; cada versão mantém seus próprios registros.</p>
   ${summaryHTML(rows)}<h3>Sessões · ${rows.length}</h3>${rows.map((row,i)=>`<article class="card"><span class="tag">${esc(row.label)}</span><h3>${date(row.session.date)} · ${esc(row.session.type)}</h3><p>${esc(name(row.plan.user_id))} · ${esc(row.plan.name)} · v${row.plan.version}${row.plan.state==='archived'?' · histórico':''}</p><div class="comparison"><div><strong>Prescrito</strong><p>${esc(amount(row.session.km,'km'))} · ${esc(amount(row.session.minutes,'min'))}</p></div><div><strong>Relatado pelo atleta</strong><p>${row.record?`${esc(amount(row.record.km,'km'))} · ${esc(amount(row.record.minutes,'min'))}`:'Sem relato de execução'}</p></div></div><button data-inspect="${i}">Ver relato e comentários (${sessionComments(row).length})</button></article>`).join('')}`;
 }
 function inspectedRow() {return monitoringRows(plans,records,{history:true}).find(r=>r.key===inspected);}
 function activityPage() {
  const row = inspectedRow(); if (!row) return '<button data-page="monitoring">← Acompanhamento</button><p>Sessão indisponível. Sincronize os dados.</p>';
  const s = row.session, r = row.record;
  return `<button data-page="monitoring">← Acompanhamento</button><h2>${date(s.date)} · ${esc(s.type)}</h2><p>${esc(name(row.plan.user_id))} · ${esc(row.plan.name)} · versão ${row.plan.version}</p><span class="tag">${esc(row.label)}</span>
   <section class="card"><h3>Prescrição</h3><p>${esc(amount(s.km,'km'))} · ${esc(amount(s.minutes,'min'))} · ${esc(s.intensity)}</p><p class="preserve-lines">${esc(s.description)}</p>${s.gym?`<p>Musculação: ${esc(s.gym)}</p>`:''}${s.notes?`<p>Observações: ${esc(s.notes)}</p>`:''}</section>
   <section class="card"><h3>Relato do atleta · somente leitura</h3>${r?`<p>${esc(r.status)} · ${esc(amount(r.km,'km'))} · ${esc(amount(r.minutes,'min'))}</p><p>Esforço: ${r.effort??'não informado'}/10 · Dor: ${r.pain??'não informada'}/10</p><p>Recuperação: ${esc(r.recovery||'Não informada')}</p><p class="preserve-lines">${esc(r.notes||'Sem observações')}</p><small>Atualizado em ${esc(new Date(r.updated_at).toLocaleString('pt-BR'))}</small>`:'<p>O atleta ainda não registrou esta sessão.</p>'}</section>
   ${commentsHTML(sessionComments(row))}<form id="commentForm"><label>Adicionar comentário para o atleta<textarea name="body" rows="4" maxlength="3000" required>${esc(commentDraft.text)}</textarea></label><p class="muted">O atleta verá este comentário. Ele será mantido no histórico com seu nome e data, separado do relato de execução.</p><p id="commentError" class="error" role="alert"></p><button class="primary">Enviar comentário</button></form>`;
 }
 function importPage() {return `<h2>Importar um plano</h2><p>O arquivo será revisado antes de salvar como rascunho. O atleta recebe o conteúdo depois da publicação.</p><a href="modelo-plano.csv" download>Baixar modelo CSV</a> · <a href="IMPORTACAO.md" target="_blank" rel="noopener">Formato e prompt GPT</a><label>Atleta<select id="athlete">${options(selectedAthlete)}</select></label><label>CSV UTF-8 (até 2 MB)<input id="importFile" type="file" accept=".csv,text/csv"></label><p id="importError" role="alert"></p>`;}
 function editorPage() {
  const d = editor.document;
  return `<h2>${editor.base_plan_id ? 'Revisar plano' : 'Editar rascunho'}</h2><p>Atleta: <strong>${esc(name(editor.athlete_id))}</strong> · ${editor.id ? 'rascunho salvo, revisão ' + editor.revision : 'ainda não salvo'}</p>${editor.base_plan_id ? '<p>A versão publicada continua disponível até você publicar esta revisão.</p>' : ''}<form id="planEditor" novalidate>
   ${field('Nome do plano', 'name', d.name, 'text', 'maxlength="200" required')}
   <div class="form-grid">${field('Meta de distância (km)', 'goal_km', d.goal_km, 'number', 'min="0" max="1000" step="0.01"')}${field('Meta de tempo (min)', 'goal_minutes', d.goal_minutes, 'number', 'min="0" max="100000" step="0.01"')}${field('Data da meta', 'goal_date', d.goal_date, 'date')}</div>
   <h3>Sessões</h3>${d.sessions.map((s, i) => `<details class="editor-session" ${i === 0 ? 'open' : ''} data-session-index="${i}"><summary>Sessão ${i + 1} · ${date(s.date)} · ${esc(s.type || 'nova sessão')}</summary><div class="form-grid">${field('ID da sessão', 'id', s.id, 'text', 'maxlength="80" required')}${field('Data', 'date', s.date, 'date', 'required')}${field('Modalidade', 'type', s.type, 'text', 'maxlength="120" required')}${field('Distância prevista (km)', 'km', s.km, 'number', 'min="0" max="1000" step="0.01"')}${field('Duração prevista (min)', 'minutes', s.minutes, 'number', 'min="0" max="1440" step="0.01"')}${field('Intensidade', 'intensity', s.intensity, 'text', 'maxlength="500"')}</div>${area('Descrição do treino', 'description', s.description, 10000)}${area('Musculação', 'gym', s.gym, 3000)}${area('Observações', 'notes', s.notes, 3000)}<button type="button" data-remove-session="${i}">Remover sessão</button></details>`).join('')}
   <button type="button" id="addSession">Adicionar sessão</button><h3>Guia do plano</h3>${d.guide.map((g, i) => `<fieldset class="editor-guide" data-guide-index="${i}"><legend>Orientação ${i + 1}</legend>${field('Tema', 'tema', g.tema, 'text', 'maxlength="200" required')}${area('Orientação', 'orientacao', g.orientacao, 10000)}<button type="button" data-remove-guide="${i}">Remover orientação</button></fieldset>`).join('')}<button type="button" id="addGuide">Adicionar orientação</button>
   <p id="editorError" class="error" role="alert"></p><p id="draftState" role="status">${dirty ? 'Alterações ainda não salvas.' : editor.id ? 'Rascunho salvo.' : 'Preencha os campos para salvar.'}</p><div class="actions sticky-actions"><button class="primary" type="submit">Salvar rascunho</button><button type="button" id="reviewPublish" ${!editor.id || dirty ? 'disabled' : ''}>Revisar publicação</button><button type="button" data-page="plans">Voltar aos planos</button></div></form>
   <h3>Prévia completa</h3><div class="actions"><button type="button" data-preview="list" aria-pressed="${preview === 'list'}">Lista</button><button type="button" data-preview="calendar" aria-pressed="${preview === 'calendar'}">Calendário por data</button></div><div id="preview">${previewPlan(d)}</div>`;
 }
 function teamPage() {
  if (!owner) return '';
  const candidates = people.filter(p => p.user_id !== userId && !p.is_admin && !coaches.some(c => c.user_id === p.user_id) && !plans.some(plan => plan.user_id === p.user_id) && !drafts.some(d => d.athlete_id === p.user_id));
  return `<h2>Equipe</h2><p>O dono concede acesso de treinador a contas separadas, sem planos de atleta. A desativação preserva os planos e retira o acesso de gestão.</p><form id="coachForm"><label>Conta já cadastrada<select name="coach" required><option value="">Selecione uma conta</option>${candidates.map(p => `<option value="${esc(p.user_id)}">${esc(p.name)} · ${esc(p.user_id.slice(-6))}</option>`).join('')}</select></label><button class="primary">Conceder acesso de treinador</button></form>
   ${coaches.map(c => `<article class="card"><h3>${esc(name(c.user_id))}</h3><p>${c.active ? 'Ativo' : 'Inativo'} · ${links.filter(l => l.coach_id === c.user_id && l.active).length} vínculo(s)</p><button data-coach="${esc(c.user_id)}" data-enabled="${!c.active}">${c.active ? 'Desativar treinador' : 'Reativar treinador'}</button></article>`).join('') || '<p>Nenhum treinador cadastrado. Crie a conta pelo acesso do app e entre uma vez para criar o perfil.</p>'}`;
 }
 function profilePage() {
  const p = people.find(p => p.user_id === userId);
  return `<h2>Meu perfil</h2><form id="staffProfile"><label>Nome<input name="name" maxlength="120" required value="${esc(p?.name)}"></label><button class="primary">Salvar nome</button></form><p>Perfil: ${owner ? 'admin dono' : 'treinador'}. Para registrar atividades pessoais, use sua conta de atleta.</p>`;
 }
 function render() {
  root.innerHTML = `<div class="management"><nav class="management-nav" aria-label="Gestão">${[['overview', 'Visão geral'], ['athletes', 'Atletas'], ['plans', 'Planos'], ['monitoring','Acompanhamento'], ...(owner ? [['team', 'Equipe']] : []), ['staffProfile', 'Meu perfil']].map(([key, label]) => `<button data-page="${key}" class="${page === key || (page==='activity'&&key==='monitoring') ? 'active' : ''}" ${busy ? 'disabled' : ''}>${label}</button>`).join('')}</nav><p id="managementError" class="error" role="alert"></p>${!enabled ? '<h2>Acesso de treinador desativado</h2><p>Fale com o dono para reativar sua conta.</p>' : ({overview, athletes: athleteList, athlete: athleteDetail, plans: planList, plan: planDetail, monitoring:monitoringPage,activity:activityPage, import: importPage, editor: editorPage, team: teamPage, staffProfile: profilePage})[page]()}</div>`;
  root.querySelector('#filterAthlete')?.setAttribute('data-current', selectedAthlete);
  if (root.querySelector('#filterAthlete')) root.querySelector('#filterAthlete').value = selectedAthlete;
 }
 function capture() {
  if (!editor || page !== 'editor') return;
  const form = root.querySelector('#planEditor');
  for (const key of ['name', 'goal_km', 'goal_minutes', 'goal_date']) editor.document[key] = form.querySelector(`[data-field="${key}"]`).value;
  editor.document.sessions = [...form.querySelectorAll('[data-session-index]')].map(row => Object.fromEntries([...row.querySelectorAll('[data-field]')].map(input => [input.dataset.field, input.value])));
  editor.document.guide = [...form.querySelectorAll('[data-guide-index]')].map(row => Object.fromEntries([...row.querySelectorAll('[data-field]')].map(input => [input.dataset.field, input.value])));
 }
 function markDirty() {dirty = true; const button = root.querySelector('#reviewPublish'); if (button) button.disabled = true; const state = root.querySelector('#draftState'); if (state) state.textContent = 'Alterações ainda não salvas.';}
 function dialog(title, content, label, action) {
  root.querySelector('#managementDialog')?.remove();
  root.insertAdjacentHTML('beforeend', `<dialog id="managementDialog"><div class="dialog-head"><h2>${esc(title)}</h2><button data-dismiss aria-label="Fechar">✕</button></div>${content}<p id="actionError" role="alert" class="error"></p><div class="actions"><button id="confirmAction" class="primary">${esc(label)}</button><button data-dismiss>Cancelar</button></div></dialog>`);
  pending = action; root.querySelector('#managementDialog').showModal();
 }
 function navigate(action) {
  if (dirty) dialog('Descartar alterações não salvas?', '<p>O conteúdo já salvo continuará disponível. As alterações desta tela serão descartadas.</p>', 'Descartar e continuar', async () => {dirty = false; commentDraft={id:null,text:''}; action();});
  else action();
 }
 function start(athlete, document = blankPlan(), base = null) {editor = {id: null, revision: null, athlete_id: athlete, base_plan_id: base, document: copy(document)}; dirty = true; page = 'editor'; render();}
 function selectAthlete(action) {
  dialog('Selecionar atleta', `<label>Destinatário<select id="destination">${options('')}</select></label>`, 'Continuar', async () => {const id = root.querySelector('#destination').value; if (!id) throw Error('Selecione um atleta.'); action(id);});
 }
 function duplicate(document) {selectAthlete(id => start(id, {...document, name: 'Cópia · ' + document.name}, null));}
 async function refresh() {await load(); render();}
 async function save() {
  capture(); const document = validatePlanDocument(editor.document);
  const row = await rpc('atlas_save_draft', {draft_id: editor.id, athlete: editor.athlete_id, document, expected_revision: editor.revision, base_plan: editor.base_plan_id});
  editor = row; editor.document = copy(row.document); dirty = false;
  // Update the local list before refresh so a subsequent read failure cannot lose a saved draft.
  drafts = drafts.filter(d => d.id !== row.id).concat(copy(row)); render(); message('Rascunho salvo. Revise antes de publicar.');
 }
 async function command(action) {
  if (busy) return;
  busy = true; const buttons = [...root.querySelectorAll('button,input,textarea,select')]; const prior = buttons.map(b => b.disabled); buttons.forEach(b => b.disabled = true);
  try {await action();} catch (error) {const el = root.querySelector('#managementDialog[open] #actionError') || root.querySelector('#editorError') || root.querySelector('#importError') || root.querySelector('#commentError') || root.querySelector('#filterError'); if (el) el.textContent = error.message; else message(error.message, true);}
  finally {busy = false; buttons.forEach((b, i) => {if (b.isConnected) b.disabled = prior[i];}); root.querySelectorAll('.management-nav button').forEach(b => b.disabled = false);}
 }
 listen('input', e => {
  if (e.target.closest('#planEditor')) markDirty();
  if (e.target.closest('#commentForm')) {commentDraft.text=e.target.value; commentDraft.id=null; dirty=!!commentDraft.text.trim();}
  if (e.target.id === 'athleteSearch') {search = e.target.value; const value = search; const selection = e.target.selectionStart; render(); const input = root.querySelector('#athleteSearch'); input.value = value; input.focus(); input.setSelectionRange(selection, selection);}
 });
 listen('change', async e => {
  if (busy) return;
  if (e.target.closest('#monitorFilters') && e.target.name==='athlete') {const id=e.target.value;root.querySelector('#monitorFilters select[name=plan]').innerHTML='<option value="">Todos os planos publicados</option>'+plans.filter(p=>!id||p.user_id===id).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+' · v'+p.version+(p.state==='archived'?' · histórico':'')+'</option>').join('');}
  if (e.target.id === 'filterAthlete') {selectedAthlete = e.target.value; render();}
  if (e.target.id === 'filterState') {filter = e.target.value; render();}
  if (e.target.id === 'athlete') selectedAthlete = e.target.value;
  if (e.target.id === 'importFile') {
   const athlete = root.querySelector('#athlete').value;
   await command(async () => {if (!athlete) throw Error('Selecione um atleta antes de carregar o arquivo.'); const file = e.target.files[0]; if (!file) return; if (file.size > 2e6) throw Error('Limite de arquivo: 2 MB.'); const document = validatePlanDocument(parsePlan(await file.text())); start(athlete, document);});
  }
 });
 listen('submit', async e => {
  if (!['planEditor', 'coachForm', 'staffProfile','monitorFilters','commentForm'].includes(e.target.id)) return;
  e.preventDefault();
  await command(async () => {
   if (e.target.id === 'planEditor') await save();
   if (e.target.id === 'monitorFilters') {const f=e.target.elements; if(f.from.value&&f.to.value&&f.from.value>f.to.value) throw Error('A data inicial deve ser anterior ou igual à final.'); monitor={athlete:f.athlete.value,plan:f.plan.value,from:f.from.value,to:f.to.value,state:f.state.value,history:f.history.checked}; if(monitor.plan&&!plans.some(p=>p.id===monitor.plan&&(!monitor.athlete||p.user_id===monitor.athlete))) monitor.plan=''; render();}
   if (e.target.id === 'commentForm') {const row=inspectedRow(); if(!row)throw Error('Sessão indisponível.'); const text=commentDraft.text.trim(); if(!text||text.length>3000)throw Error('Escreva um comentário de até 3000 caracteres.'); commentDraft.id??=crypto.randomUUID(); const saved=await rpc('atlas_add_session_comment',{comment_id:commentDraft.id,athlete:row.plan.user_id,plan:row.plan.id,session:row.session.id,comment_text:text}); comments=comments.filter(c=>c.id!==saved.id).concat(saved).sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));commentDraft={id:null,text:''};dirty=false;render();message('Comentário salvo e disponível para o atleta.');}
   if (e.target.id === 'coachForm') {const id = e.target.elements.coach.value; if (!id) throw Error('Selecione uma conta.'); await post('/rest/v1/atlas_coaches', {user_id: id}); await refresh(); message('Acesso de treinador concedido. Vincule os atletas na página Atletas.');}
   if (e.target.id === 'staffProfile') {const value = e.target.elements.name.value.trim(); if (!value) throw Error('Preencha o nome.'); await saveProfile(value); await refresh(); message('Perfil salvo.');}
  });
 });
 listen('click', async e => {
  const b = e.target.closest('button'); if (!b || busy) return;
  if (b.hasAttribute('data-dismiss')) {root.querySelector('#managementDialog').close(); pending = null; return;}
  if (b.id === 'confirmAction') {const action = pending; await command(async () => {await action?.(); const modal = root.querySelector('#managementDialog'); if (modal?.open) modal.close(); pending = null;}); return;}
  if (b.dataset.page) {navigate(() => {page = b.dataset.page; if (page === 'plans') selectedAthlete = ''; editor = null; render();}); return;}
  if (b.dataset.athlete) {navigate(() => {selectedAthlete = b.dataset.athlete; page = 'athlete'; render();}); return;}
  if (b.dataset.monitorAthlete || b.dataset.monitorPlan) {navigate(()=>{const p=plans.find(p=>p.id===b.dataset.monitorPlan); monitor={athlete:p?.user_id||b.dataset.monitorAthlete,plan:p?.id||'',from:'',to:'',state:'all',history:false};page='monitoring';render();});return;}
  if (b.id==='clearMonitor') {monitor={athlete:'',plan:'',from:'',to:'',state:'all',history:false};render();return;}
  if (b.dataset.inspect!==undefined) {const row=monitoringRows(plans,records,monitor)[Number(b.dataset.inspect)];if(row){inspected=row.key;commentDraft={id:null,text:''};page='activity';render();}return;}
  if (b.id === 'newPlan' || b.dataset.new) {navigate(() => b.dataset.new ? start(b.dataset.new) : selectAthlete(id => start(id))); return;}
  if (b.id === 'importPlan' || b.dataset.import) {navigate(() => {selectedAthlete = b.dataset.import || ''; page = 'import'; editor = null; render();}); return;}
  if (b.dataset.draft) {navigate(() => {editor = copy(drafts.find(d => d.id === b.dataset.draft)); page = 'editor'; dirty = false; render();}); return;}
  if (b.dataset.plan) {navigate(() => {detail = b.dataset.plan; page = 'plan'; render();}); return;}
  if (b.dataset.revise) {navigate(() => {const p = plans.find(p => p.id === b.dataset.revise); start(p.user_id, prescription(p), p.id);}); return;}
  if (b.dataset.copyPlan || b.dataset.copyDraft) {navigate(() => {const document = b.dataset.copyPlan ? prescription(plans.find(p => p.id === b.dataset.copyPlan)) : drafts.find(d => d.id === b.dataset.copyDraft).document; duplicate(document);}); return;}
  if (b.dataset.archive) {const p = plans.find(p => p.id === b.dataset.archive); dialog('Arquivar plano?', `<p><strong>${esc(p.name)}</strong> · ${esc(name(p.user_id))}</p><p>O plano e os registros permanecem no histórico. Novas atividades não poderão ser registradas nesta versão.</p>`, 'Arquivar plano', async () => {await rpc('atlas_archive_plan', {plan: p.id}); await refresh(); message('Plano arquivado. Histórico preservado.');}); return;}
  if (b.dataset.coach) {const id = b.dataset.coach; const active = b.dataset.enabled === 'true'; dialog(active ? 'Reativar treinador?' : 'Desativar treinador?', `<p>${esc(name(id))}</p><p>${active ? 'Os vínculos ativos voltarão a permitir a gestão dos atletas.' : 'O acesso de gestão será retirado. Planos e histórico serão preservados.'}</p>`, active ? 'Reativar' : 'Desativar', async () => {await request('/rest/v1/atlas_coaches?user_id=eq.' + encodeURIComponent(id), {method: 'PATCH', body: JSON.stringify({active}), headers: {Prefer: 'return=representation'}}).then(rows => {if (!rows.length) throw Error('Acesso não atualizado. Atualize a página.');}); await refresh();}); return;}
  if (b.dataset.linkCoach) {const coach = b.dataset.linkCoach, athlete = b.dataset.linkAthlete, active = b.dataset.linkActive === 'true'; dialog(active ? 'Vincular treinador?' : 'Revogar vínculo?', `<p>${esc(name(coach))} → ${esc(name(athlete))}</p><p>${active ? 'O treinador poderá consultar o perfil e gerenciar os planos deste atleta.' : 'O treinador perderá o acesso de gestão deste atleta. O histórico permanece.'}</p>`, active ? 'Vincular' : 'Revogar', async () => {const existing = links.some(l => l.coach_id === coach && l.athlete_id === athlete); if (existing) {const rows = await request(`/rest/v1/atlas_coach_athletes?coach_id=eq.${encodeURIComponent(coach)}&athlete_id=eq.${encodeURIComponent(athlete)}`, {method: 'PATCH', body: JSON.stringify({active}), headers: {Prefer: 'return=representation'}}); if (!rows.length) throw Error('Vínculo não atualizado.');} else await post('/rest/v1/atlas_coach_athletes', {coach_id: coach, athlete_id: athlete}); await refresh();}); return;}
  if (page !== 'editor') return;
  if (b.id === 'reviewPublish') {
   await command(async () => {capture(); const document = validatePlanDocument(editor.document); if (dirty || JSON.stringify(document) !== JSON.stringify(validatePlanDocument(drafts.find(d => d.id === editor.id).document))) {markDirty(); throw Error('Salve as alterações antes de publicar.');} const reviewed = copy(editor); dialog('Revisão final de publicação', `<p>Destinatário: <strong>${esc(name(reviewed.athlete_id))}</strong></p>${reviewed.base_plan_id ? '<p>A versão anterior será arquivada com seus registros preservados.</p>' : ''}${previewPlan(document)}`, 'Publicar para ' + name(reviewed.athlete_id), async () => {await rpc('atlas_publish_draft', {draft_id: reviewed.id, expected_revision: reviewed.revision}); dirty = false; editor = null; page = 'plans'; selectedAthlete = reviewed.athlete_id; await refresh(); message('Plano publicado. O atleta verá o plano ao sincronizar.');});}); return;
  }
  if (b.dataset.preview) {capture(); preview = b.dataset.preview; render(); return;}
  if (b.id === 'addSession' || b.id === 'addGuide' || b.dataset.removeSession !== undefined || b.dataset.removeGuide !== undefined) {capture(); if (b.id === 'addSession') editor.document.sessions.push(newSession(editor.document.sessions)); if (b.id === 'addGuide') editor.document.guide.push({tema: '', orientacao: ''}); if (b.dataset.removeSession !== undefined) editor.document.sessions.splice(Number(b.dataset.removeSession), 1); if (b.dataset.removeGuide !== undefined) editor.document.guide.splice(Number(b.dataset.removeGuide), 1); dirty = true; render();}
 });
 return {load, render, destroy() {listeners.forEach(([type, handler]) => root.removeEventListener(type, handler));}, get busy() {return busy;}, get dirty() {return dirty;}};
}
