import {createManagement} from '../management.js';

const people = [{user_id:'owner',name:'Admin dono',is_admin:true}, {user_id:'coach',name:'Luana · treinadora'}, {user_id:'athlete-a',name:'Marina',available_days:[2,4,6]}, {user_id:'athlete-b',name:'Rafael',available_days:[1,3,5]}];
const document = {name:'Plano ilustrativo · revisão da interface',goal_km:null,goal_minutes:null,goal_date:null,guide:[{tema:'Exemplo de orientação',orientacao:'Conteúdo fictício para conferir o editor. A prescrição será inserida pelo responsável.'}],sessions:[{id:'sessao-001',date:'2026-10-12',type:'Sessão ilustrativa',km:null,minutes:null,intensity:'A definir pelo responsável',description:'Exemplo de descrição editável.',gym:'',notes:''},{id:'sessao-002',date:'2026-10-12',type:'Segunda sessão no mesmo dia',km:null,minutes:null,intensity:'',description:'Exemplo para testar sessões múltiplas na mesma data.',gym:'',notes:''}]};
let roles=[{user_id:'coach',active:true}],links=[{coach_id:'coach',athlete_id:'athlete-a',active:true}],drafts=[],plans=[{...structuredClone(document),id:'plan-example',user_id:'athlete-a',state:'published',version:1,atlas_sessions:structuredClone(document.sessions)}],events=[],portal,sequence=1;
let currentRole='admin',userId='owner';
const clone=x=>structuredClone(x);
async function request(path, options={}) {
 const data=options.body?JSON.parse(options.body):null;
 const permitted=id=>currentRole==='admin'||links.some(l=>l.coach_id===userId&&l.athlete_id===id&&l.active);
 if(path.includes('/rpc/atlas_save_draft')){
  if(!permitted(data.athlete))throw Error('Atleta não autorizado.');
  let row=drafts.find(d=>d.id===data.draft_id);
  if(row){if(row.revision!==data.expected_revision||row.state!=='draft')throw Error('Conflito de edição.');row.document=clone(data.document);row.revision++;}
  else {row={id:'draft-'+sequence++,athlete_id:data.athlete,author_id:userId,document:clone(data.document),base_plan_id:data.base_plan,revision:1,state:'draft'};drafts.unshift(row);}
  return clone(row);
 }
 if(path.includes('/rpc/atlas_publish_draft')){
  const row=drafts.find(d=>d.id===data.draft_id);if(!row||!permitted(row.athlete_id)||row.revision!==data.expected_revision||row.state!=='draft')throw Error('Atualize e revise antes de publicar.');
  const base=plans.find(p=>p.id===row.base_plan_id);if(base&&base.state!=='published')throw Error('Versão já substituída.');
  const id='plan-'+sequence++;if(base){base.state='archived';events.push({plan_id:base.id,actor_id:userId,event:'replaced',created_at:new Date().toISOString()});}
  plans.unshift({...clone(row.document),id,user_id:row.athlete_id,state:'published',version:base?base.version+1:1,previous_plan_id:base?.id,atlas_sessions:clone(row.document.sessions)});row.state='published';row.published_plan_id=id;events.push({plan_id:id,actor_id:userId,event:'published',created_at:new Date().toISOString()});return id;
 }
 if(path.includes('/rpc/atlas_archive_plan')){const p=plans.find(p=>p.id===data.plan);if(!p||!permitted(p.user_id))throw Error('Plano não autorizado.');p.state='archived';events.push({plan_id:p.id,actor_id:userId,event:'archived',created_at:new Date().toISOString()});return null;}
 if(path.includes('atlas_profiles'))return clone(people.filter(p=>currentRole==='admin'||p.user_id===userId||permitted(p.user_id)));
 if(path.includes('atlas_coaches')){if(options.method){if(currentRole!=='admin')throw Error('Somente o dono.');if(options.method==='POST')roles.push({user_id:data.user_id,active:true});else roles.find(c=>path.includes(c.user_id)).active=data.active;}return clone(roles.filter(c=>currentRole==='admin'||c.user_id===userId));}
 if(path.includes('atlas_coach_athletes')){if(options.method){if(currentRole!=='admin')throw Error('Somente o dono.');if(options.method==='POST')links.push({...data,active:true});else links.find(l=>path.includes(l.coach_id)&&path.includes(l.athlete_id)).active=data.active;}return clone(links.filter(l=>currentRole==='admin'||l.coach_id===userId));}
 if(path.includes('atlas_plan_drafts'))return clone(drafts.filter(d=>permitted(d.athlete_id)));
 if(path.includes('atlas_plan_events'))return clone(events.filter(e=>permitted(plans.find(p=>p.id===e.plan_id)?.user_id)));
 if(path.includes('atlas_plans'))return clone(plans.filter(p=>permitted(p.user_id)));
 throw Error('Ação indisponível no protótipo.');
}
async function initialize(){portal?.destroy();currentRole=documentElementRole();userId=currentRole==='admin'?'owner':'coach';portal=createManagement({root:window.document.querySelector('#content'),role:currentRole,userId,request,notice:t=>window.document.querySelector('#notice').textContent=t,saveProfile:async name=>people.find(p=>p.user_id===userId).name=name});await portal.load();portal.render();}
function documentElementRole(){return window.document.querySelector('#previewRole').value;}
window.document.querySelector('#previewRole').onchange=initialize;
window.document.querySelector('#restart').onclick=()=>window.location.reload();
initialize();
