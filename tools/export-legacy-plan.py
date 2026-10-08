"""Export the original plan as an importable reference, with dates unchanged."""
from pathlib import Path
import json,csv
root=Path(__file__).resolve().parent.parent
plan=json.loads((root/'legacy-plan.js').read_text(encoding='utf-8').split('=',1)[1].strip().rstrip(';'))
guide=json.loads((root/'legacy-guide.js').read_text(encoding='utf-8').split('=',1)[1].strip().rstrip(';'))
headers='registro,nome,meta_km,meta_min,data_meta,id,data,tipo,km,duracao_min,intensidade,descricao,musculacao,observacoes,tema,orientacao'.split(',')
rows=[dict(registro='plano',nome='Plano anterior — referência; prova não confirmada',meta_km='21.1',meta_min='150',data_meta='2026-11-15')]
for i,s in enumerate(plan):
 rows.append(dict(registro='treino',id=f'legacy-{i:03d}',data=s['date'],tipo=s['type'],km=s['km'],descricao=s['execution'],musculacao=s['gym'],observacoes=s['condition']))
rows.append(dict(registro='guia',tema='Referência histórica',orientacao='Plano anterior de 08/10/2026 a 15/11/2026. A prova não foi confirmada. Não é uma nova prescrição validada; histórico e resultado real dos 5 km não estão disponíveis.'))
for g in guide:rows.append(dict(registro='guia',**g))
with (root/'plano-anterior-referencia.csv').open('w',encoding='utf-8-sig',newline='') as f:
 writer=csv.DictWriter(f,fieldnames=headers);writer.writeheader();writer.writerows(rows)
