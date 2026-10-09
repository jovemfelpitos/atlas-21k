import {validatePlanDocument} from './plan-editor.js';
export function csvRows(text) {
 text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],field='',quoted=false,closed=false,line=1,startLine=1;const sep=text.split(/\r?\n/,1)[0].includes(';')?';':',';
 const finish=()=>{row.push(field);if(row.some(x=>x.trim())){Object.defineProperty(row,'sourceLine',{value:startLine});rows.push(row);}row=[];field='';closed=false;};
 for(let i=0;i<text.length;i++){const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(quoted){quoted=false;closed=true;}else if(field||closed)throw Error('Linha '+line+': Aspas inválidas.');else quoted=true;}
  else if(c===sep&&!quoted){row.push(field);field='';closed=false;}
  else if((c==='\n'||c==='\r')&&!quoted){finish();if(c==='\r'&&text[i+1]==='\n')i++;line++;startLine=line;}
  else{if(closed)throw Error('Linha '+line+': caractere após as aspas de fechamento.');field+=c;if(c==='\n'||(c==='\r'&&text[i+1]!=='\n'))line++;}
 }
 if(quoted)throw Error('Linha '+startLine+': Aspas não fechadas.');finish();return rows;
}
const date=x=>/^\d{4}-\d{2}-\d{2}$/.test(x)&&!isNaN(Date.parse(x))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
function num(x,label,max){if(x==='')return null;const n=Number(x.replace(',','.'));if(!Number.isFinite(n)||n<0||n>max)throw Error(label+': número inválido.');return n;}
export function parsePlan(text){
 const rows=csvRows(text),headers=rows.shift()?.map(x=>x.trim());if(!headers)throw Error('Arquivo vazio.');if(new Set(headers).size!==headers.length)throw Error('Colunas repetidas.');
 for(const k of ['registro','nome','meta_km','meta_min','data_meta','id','data','tipo','km','duracao_min','intensidade','descricao','musculacao','observacoes','tema','orientacao'])if(!headers.includes(k))throw Error('Coluna ausente: '+k);
 const data=rows.map((r,i)=>{if(r.length!==headers.length)throw Error('Linha '+r.sourceLine+': quantidade de colunas incorreta.');return {...Object.fromEntries(headers.map((k,j)=>[k,r[j].trim()])),sourceLine:r.sourceLine};});const metas=data.filter(r=>r.registro==='plano');if(metas.length!==1)throw Error('Use exatamente uma linha plano.');const m=metas[0];if(!m.nome||m.nome.length>200)throw Error('Nome obrigatório, até 200 caracteres.');if(m.data_meta&&!date(m.data_meta))throw Error('Data da meta inválida.');
 const sessions=[],guide=[],ids=new Set();for(const [i,r] of data.entries()){try{if(r.registro==='plano')continue;if(r.registro==='guia'){if(!r.tema||!r.orientacao)throw Error('Guia: tema e orientação obrigatórios.');guide.push({tema:r.tema,orientacao:r.orientacao});continue;}if(r.registro!=='treino')throw Error('Linha '+r.sourceLine+': registro inválido.');if(!/^[A-Za-z0-9_-]{1,80}$/.test(r.id)||ids.has(r.id))throw Error('ID inválido ou repetido: '+r.id);ids.add(r.id);if(!date(r.data)||!r.tipo||!r.descricao)throw Error('Sessão '+r.id+': data, tipo e descrição obrigatórios.');sessions.push({id:r.id,date:r.data,type:r.tipo,km:num(r.km,'Distância',1000),minutes:num(r.duracao_min,'Duração',1440),intensity:r.intensidade,description:r.descricao,gym:r.musculacao,notes:r.observacoes});}catch(e){throw Error('Linha '+r.sourceLine+': '+e.message);}}
 if(!sessions.length||sessions.length>1000)throw Error('Use de 1 a 1000 sessões.');if(!guide.length)throw Error('Inclua pelo menos uma linha guia.');return validatePlanDocument({name:m.nome,goal_km:num(m.meta_km,'Meta km',1000),goal_minutes:num(m.meta_min,'Meta minutos',100000),goal_date:m.data_meta||null,guide,sessions:sessions.sort((a,b)=>a.date.localeCompare(b.date))});
}
