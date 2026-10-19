import {escapeHTML as esc} from './monitoring.js';

const number=(value,label,max,{integer=false,required=false,min=0,decimals=null}={})=>{
 if(value==null||String(value).trim()===''){if(required)throw Error(label+': informe um valor.');return null;}
 const text=String(value).trim().replace(',','.'),n=Number(text);
 if(!/^\d*(?:\.\d+)?$/.test(text)||!Number.isFinite(n)||n<min||n>max||integer&&!Number.isInteger(n))throw Error(label+`: use ${integer?'um inteiro':'um número'} de ${min} a ${max}.`);
 if(decimals!=null&&(text.split('.')[1]||'').replace(/0+$/,'').length>decimals)throw Error(label+`: use até ${decimals} casas decimais.`);
 return n;
};
const text=(value,label,max,required=false)=>{const result=String(value??'').trim();if(required&&!result||result.length>max)throw Error(label+`: ${required?'preencha; ':''}máximo de ${max} caracteres.`);return result;};
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(value);
const keys=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>allowed.includes(k));
export function validateStrengthPrescription(value=[]) {
 if(!Array.isArray(value)||value.length>30)throw Error('Musculação: use até 30 exercícios por sessão.');
 const ids=new Set();return value.map((e,i)=>{
  if(!keys(e,['id','name','sets','reps','load_kg','notes'])||!id(e.id)||ids.has(e.id))throw Error('Exercício: identificação inválida ou repetida.');ids.add(e.id);
  const label='Exercício '+(i+1);
  return {id:e.id,name:text(e.name,label+' · nome',200,true),sets:number(e.sets,label+' · séries',20,{integer:true,required:true,min:1}),reps:number(e.reps,label+' · repetições',1000,{integer:true,min:1}),load_kg:number(e.load_kg,label+' · carga',1000,{decimals:3}),notes:text(e.notes,label+' · orientação',1000)};
 });
}
export function validateStrengthResults(value=[]) {
 if(!Array.isArray(value)||value.length>30)throw Error('Resultados: use até 30 exercícios.');
 const ids=new Set();return value.map((e,i)=>{
  if(!keys(e,['exercise_id','sets'])||!id(e.exercise_id)||ids.has(e.exercise_id)||!Array.isArray(e.sets)||e.sets.length<1||e.sets.length>20)throw Error('Resultados: exercício ou séries inválidos.');ids.add(e.exercise_id);
  return {exercise_id:e.exercise_id,sets:e.sets.map((s,j)=>{
   if(!keys(s,['reps','load_kg']))throw Error('Série inválida.');const label=`Exercício ${i+1}, série ${j+1}`;
   const row={};for(const [metric,title] of [['reps','repetições'],['load_kg','carga']]){try{row[metric]=number(s[metric],label+' · '+title,1000,{integer:metric==='reps',decimals:metric==='load_kg'?3:null});}catch(error){throw Object.assign(error,{exerciseIndex:i,setIndex:j,metric});}}return row;
  })};
 }).filter(e=>e.sets.some(s=>s.reps!=null||s.load_kg!=null));
}
export const canonicalStrength=value=>JSON.stringify(validateStrengthResults(value??[]));
const numeric=value=>Number(value).toLocaleString('pt-BR',{maximumFractionDigits:3});
const valueLabel=(value,unit)=>value==null?'Não informado':numeric(value)+(unit?' '+unit:'');
const prescriptionLine=e=>`${e.sets} ${e.sets===1?'série':'séries'}${e.reps==null?'':' · '+e.reps+' repetições'}${e.load_kg==null?'':' · '+valueLabel(e.load_kg,'kg')}`;
export const strengthHelp='Carga externa total em kg. Some os pesos dos halteres; 0 = sem carga externa. Em branco = não informado.';
export function strengthPrescriptionHTML(exercises=[],open=false){
 if(!exercises?.length)return '';
 return `<details class="strength-prescription" ${open?'open':''}><summary>Musculação · ${exercises.length} ${exercises.length===1?'exercício':'exercícios'}</summary><p class="strength-help">${strengthHelp}</p>${exercises.map(e=>`<article class="strength-exercise"><h4>${esc(e.name)}</h4><p>${esc(prescriptionLine(e))}</p>${e.notes?'<p class="preserve-lines">'+esc(e.notes)+'</p>':''}</article>`).join('')}</details>`;
}
export function strengthResultsHTML(exercises=[],results=[]){
 if(!results?.length)return '';
 return `<details class="strength-reported"><summary>Séries relatadas · ${results.length} ${results.length===1?'exercício':'exercícios'}</summary>${results.map(e=>`<article class="strength-exercise"><h4>${esc(exercises.find(p=>p.id===e.exercise_id)?.name||e.exercise_id)}</h4>${e.sets.map((s,i)=>`<p>Série ${i+1}: ${esc(valueLabel(s.reps,'rep'))} · ${esc(valueLabel(s.load_kg,'kg'))}</p>`).join('')}</article>`).join('')}</details>`;
}
const input=(label,key,value,extras='')=>`<label>${label}<input data-strength-field="${key}" value="${esc(value??'')}" ${extras}></label>`;
export function strengthEditorHTML(exercises=[]){
 return `<section class="strength-editor"><h4>Musculação estruturada</h4><p class="strength-help">Use uma sessão separada da corrida, mesmo quando for no mesmo dia. Deixe a distância vazia ou zero. ${strengthHelp}</p>${exercises.map((e,i)=>`<fieldset data-exercise-index="${i}" class="strength-editor-exercise"><legend>Exercício ${i+1}</legend><input type="hidden" data-strength-field="id" value="${esc(e.id)}">${input('Exercício','name',e.name,'maxlength="200" required')}<div class="strength-prescription-fields">${input('Séries','sets',e.sets,'type="number" min="1" max="20" step="1" required')}${input('Repetições','reps',e.reps,'type="number" min="1" max="1000" step="1"')}${input('Carga (kg)','load_kg',e.load_kg,'inputmode="decimal" maxlength="30"')}</div><label>Orientação (opcional)<textarea data-strength-field="notes" maxlength="1000" rows="2">${esc(e.notes)}</textarea></label><button type="button" data-remove-exercise="${i}">Remover exercício</button></fieldset>`).join('')}<button type="button" data-add-exercise ${exercises.length>=30?'disabled':''}>Adicionar exercício</button></section>`;
}
export function readStrengthEditor(container){return [...container.querySelectorAll('[data-exercise-index]')].map(row=>Object.fromEntries([...row.querySelectorAll('[data-strength-field]')].map(el=>[el.dataset.strengthField,el.value])));}
export function newStrengthExercise(existing=[]){let n=1;while(existing.some(e=>e.id==='ex-'+n))n++;return {id:'ex-'+n,name:'',sets:1,reps:null,load_kg:null,notes:''};}
export function createStrengthResults(container,exercises=[],results=[],onChange=()=>{}) {
 const rowHTML=(exercise,index,s={})=>`<div class="strength-set" data-strength-set><span>Série ${index+1}</span><label>Repetições<input data-strength-actual="reps" inputmode="numeric" maxlength="4" aria-label="${esc(exercise.name)} · série ${index+1} · repetições" value="${esc(s.reps??'')}" placeholder="—"></label><label>Carga (kg)<input data-strength-actual="load_kg" inputmode="decimal" maxlength="30" aria-label="${esc(exercise.name)} · série ${index+1} · carga em kg" value="${esc(s.load_kg??'')}" placeholder="—"></label></div>`;
 container.hidden=!exercises.length;
 container.innerHTML=exercises.length?`<h3>O que você realizou na musculação</h3><p class="strength-help">Opcional · informe apenas o que realizou.</p><details class="strength-units"><summary>Carga, zero e campos vazios</summary><p class="strength-help">${strengthHelp} Use até 3 casas decimais. Os valores previstos não preenchem seu relato.</p></details>${exercises.map((e,i)=>{const actual=results.find(r=>r.exercise_id===e.id)?.sets||[],count=Math.max(e.sets,actual.length);return `<details class="strength-result-exercise" data-strength-result="${i}" ${i===0?'open':''}><summary>${esc(e.name)}</summary><p class="strength-help">Previsto: ${esc(prescriptionLine(e))}</p>${e.notes?'<p class="strength-help preserve-lines">'+esc(e.notes)+'</p>':''}<div class="strength-sets">${Array.from({length:count},(_,j)=>rowHTML(e,j,actual[j])).join('')}</div><button type="button" data-add-strength-set="${i}" ${count>=20?'disabled':''}>Adicionar série</button></details>`;}).join('')}`:'';
 const onClick=event=>{const button=event.target.closest('[data-add-strength-set]');if(!button||button.disabled)return;event.preventDefault();event.stopPropagation();const index=Number(button.dataset.addStrengthSet),section=button.closest('[data-strength-result]'),list=section.querySelector('.strength-sets'),count=list.children.length;if(count>=20)return;list.insertAdjacentHTML('beforeend',rowHTML(exercises[index],count));button.disabled=count+1>=20;list.lastElementChild.querySelector('input').focus();onChange();};
 container.addEventListener('click',onClick);
 return {refresh(){container.querySelectorAll('[data-add-strength-set]').forEach(button=>button.disabled=button.closest('[data-strength-result]').querySelectorAll('[data-strength-set]').length>=20);},read:()=>exercises.map((e,i)=>({exercise_id:e.id,sets:[...container.querySelectorAll(`[data-strength-result="${i}"] [data-strength-set]`)].map(row=>Object.fromEntries([...row.querySelectorAll('[data-strength-actual]')].map(el=>[el.dataset.strengthActual,el.value])))})),destroy(){container.removeEventListener('click',onClick);container.replaceChildren();}};
}
