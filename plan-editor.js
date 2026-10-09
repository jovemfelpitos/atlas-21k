const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value)) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
const text = (value, label, max, required = false) => {
 const result = String(value ?? '').trim();
 if ((required && !result) || result.length > max) throw Error(`${label}: ${required ? 'preencha o campo; ' : ''}máximo de ${max} caracteres.`);
 return result;
};
const number = (value, label, max) => {
 if (value === '' || value == null) return null;
 const result = Number(String(value).replace(',', '.'));
 if (!Number.isFinite(result) || result < 0 || result > max) throw Error(`${label}: número inválido.`);
 return result;
};
export function validatePlanDocument(input) {
 if (!input || typeof input !== 'object') throw Error('Plano inválido.');
 const name = text(input.name, 'Nome', 200, true);
 const goal_date = input.goal_date || null;
 if (goal_date && !validDate(goal_date)) throw Error('Data da meta inválida.');
 if (!Array.isArray(input.sessions) || input.sessions.length < 1 || input.sessions.length > 1000) throw Error('Inclua de 1 a 1000 sessões.');
 if (!Array.isArray(input.guide) || input.guide.length < 1 || input.guide.length > 100) throw Error('Inclua de 1 a 100 orientações no guia.');
 const ids = new Set();
 const sessions = input.sessions.map((session, index) => {
  const label = `Sessão ${index + 1}`;
  const id = text(session.id, label + ' · ID', 80, true);
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id) || ids.has(id)) throw Error(`${label}: ID inválido ou repetido (${id}).`);
  ids.add(id);
  if (!validDate(session.date)) throw Error(`${label}: data inválida.`);
  return {id, date: session.date, type: text(session.type, label + ' · modalidade', 120, true), km: number(session.km, label + ' · distância', 1000), minutes: number(session.minutes, label + ' · duração', 1440), intensity: text(session.intensity, label + ' · intensidade', 500), description: text(session.description, label + ' · descrição', 10000, true), gym: text(session.gym, label + ' · musculação', 3000), notes: text(session.notes, label + ' · observações', 3000)};
 });
 const guide = input.guide.map((item, index) => ({tema: text(item.tema, `Guia ${index + 1} · tema`, 200, true), orientacao: text(item.orientacao, `Guia ${index + 1} · orientação`, 10000, true)}));
 return {name, goal_km: number(input.goal_km, 'Meta km', 1000), goal_minutes: number(input.goal_minutes, 'Meta minutos', 100000), goal_date, guide, sessions: sessions.sort((a, b) => a.date.localeCompare(b.date))};
}
export function prescription(plan) {
 return validatePlanDocument({...plan, sessions: plan.sessions || plan.atlas_sessions});
}
export function blankPlan() {
 return {name: '', goal_km: null, goal_minutes: null, goal_date: null, guide: [{tema: '', orientacao: ''}], sessions: [newSession()]};
}
export function newSession(existing = []) {
 let n = existing.length + 1;
 while (existing.some(s => s.id === `sessao-${String(n).padStart(3, '0')}`)) n++;
 return {id: `sessao-${String(n).padStart(3, '0')}`, date: '', type: '', km: null, minutes: null, intensity: '', description: '', gym: '', notes: ''};
}
