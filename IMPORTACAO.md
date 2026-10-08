# Planos Atlas Run

Use CSV UTF-8, separado por vírgula ou ponto e vírgula. XLSX não é suportado nesta versão; no Excel ou Google Sheets, exporte a tabela como CSV UTF-8. Baixe modelo-plano.csv. O modelo é ilustrativo, não uma prescrição.

Mantenha todas as 16 colunas do modelo. Use exatamente uma linha `registro=plano`, uma ou mais `treino` e uma ou mais `guia`:

- Plano: nome obrigatório; meta_km, meta_min e data_meta opcionais.
- Treino: id, data, tipo e descricao obrigatórios. id aceita letras sem acentos, números, hífen e sublinhado, até 80 caracteres, único dentro do plano. Datas AAAA-MM-DD. Duas sessões podem ter a mesma data, com IDs distintos.
- Treino: km, duracao_min opcionais, números não negativos. intensidade, musculacao e observacoes são texto livre.
- Guia: tema e orientacao obrigatórios. Uma linha por tema.
- Demais campos da linha ficam vazios. Texto com delimitador, aspas ou quebra de linha precisa estar entre aspas; aspas internas são duplicadas. Prefira ponto decimal.

Limites: 2 MB por arquivo, 1000 sessões por plano. A prévia exibe todas as sessões, metas e guia. Escolha obrigatoriamente um atleta; só então confirme. Cada confirmação cria um novo plano, sem substituir anteriores. Não confirme duas vezes o mesmo arquivo se não quiser dois planos.

## Prompt para copiar no GPT

Gere um arquivo CSV UTF-8 para importar no Atlas Run, a partir dos dados esportivos que eu fornecer. Não invente histórico, resultados de avaliações, lesões ou datas de provas. Pergunte o que faltar antes de prescrever. Considere meus dias disponíveis sem alterar datas de planos existentes sem minha decisão. Use as colunas exatamente nesta ordem:
registro,nome,meta_km,meta_min,data_meta,id,data,tipo,km,duracao_min,intensidade,descricao,musculacao,observacoes,tema,orientacao
Inclua exatamente uma linha plano com nome e metas, linhas treino com IDs únicos por sessão (inclusive quando há duas no mesmo dia), datas AAAA-MM-DD, tipo e descrição, e linhas guia com tema e orientação. Campos que não correspondem ao tipo da linha ficam vazios. Use ponto decimal, vírgula separadora e aspas CSV corretas. Inclua todo o plano e guia, sem reticências. Mostre metas condicionais como tais. Entregue somente o CSV depois de esclarecer os dados necessários.
