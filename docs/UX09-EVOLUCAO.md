# UX-09 — evolução do atleta

Execução autorizada em 17/10/2026, uma sprint por vez. Escopo aprovado: comparar semana prevista e realizada, apresentar distância, duração e pace, preservar ausência distinta de zero e reutilizar os cálculos atuais.

## Entrega

- Evolução organizada por semana, de segunda a domingo. Seletor e setas percorrem somente semanas com sessões desta versão; a data inicial e o intervalo completo ficam explícitos. Abre na semana atual quando existe, ou na última anterior/primeira futura com sessões. Há retorno à semana atual quando aplicável.
- Indicador de sessões realizadas entre as previstas até hoje, acompanhado dos totais da semana e estados sem registro, pendente hoje, não feito e futuro. Uma atividade futura relatada não aumenta o numerador até hoje.
- Distância e duração previstas/realizadas lado a lado, com quantidade de sessões que informaram cada métrica e identificação de total parcial. Valores vazios mostram Não informado; zero explícito permanece zero.
- Pace médio calculado pela soma das durações dividida pela soma das distâncias das mesmas sessões com ambos os valores positivos. Feito e Adaptado participam; Não feito fica fora. Não divide totais opcionais independentes nem calcula média simples dos paces. Mostra quantas sessões sustentam cada pace e Indisponível quando faltam pares válidos.
- Duração de força sem distância participa do tempo total e fica fora do pace. Isso prepara a leitura híbrida sem criar exercícios, séries ou cargas nesta sprint.
- Sessões da semana mostram data, tipo, situação, resultados, sensações/observações expansíveis e comentários da equipe. Edição abre o registrador existente. Comentários sem atividade registrada continuam visíveis. Não feito pode conservar valores no relato, identificados como excluídos dos totais.
- Semana escolhida permanece em memória por versão do plano durante navegação, sincronização e salvamento, e é descartada ao encerrar/trocar a conta. Mudança de semana é local, sem novos pedidos ao servidor.
- Exportação existente fica em Exportar meus dados, com escopo explicitamente maior que a semana selecionada. Remove o botão de sincronização repetido da Evolução; Atualizar dados permanece no cabeçalho.

## Implementação e conservação

`progress.js` compõe a tela usando `monitoringRows`, `weeklySummary` e `summarize` existentes. `progress.css` usa os tokens e a fonte oficiais. O formatador de pace foi extraído para `monitoring.js` e também é usado pelo registrador, preservando sua validação de campos/limites.

O Acompanhamento da gestão mantém seu resumo existente. Autorização, consultas paginadas, salvamento condicional, exportação sem credenciais, planos e versões, rascunhos e limpeza de sessão permanecem nos fluxos existentes. Nenhuma migration, mudança de RLS, chave/configuração de alertas ou escrita em dados reais. Símbolo, logotipos e fontes oficiais preservados. Landing fora do escopo desta sprint.

## Critérios e validação

- **143/143 testes aprovados**, incluindo oito novos de agregação e integração. Evidência local ignorada: `.artifacts/ux09-tests.tap`.
- Pace ponderado por distância, virada de segundos, soma semanal acima dos limites de uma atividade, valores incompletos/zero, duração de força, relato não feito com números conservados, atividade futura já relatada e semana sem sessões.
- Virada de ano, semanas sem sessões entre seleções, fallback após mudança dos dados, isolamento por conta/plano/versão, comentários sem relato e conteúdo autoral escapado.
- Troca de semana sem requisições, foco após seleção/setas, seleção preservada após salvar/voltar, proteção de relato não salvo e seleção independente em plano arquivado. Suítes existentes de permissões, gestão, notificações e registro também aprovadas.
- Navegador local com dados fictícios em 320, 390, 768 e 1280 px, sem rolagem horizontal nos cenários conferidos; seletor com fonte de 16 px e setas com área de 46 × 48 px. Semana futura, retorno à atual e edição/salvamento pelo histórico conferidos. Isto não substitui um teste em Android/iPhone físicos.
- `npm run build`: **74 arquivos públicos**, incluindo apenas os dois novos arquivos de execução. `git diff --check` sem erros de conteúdo. Nenhuma dependência adicionada.

## Publicação

Implementação pronta para preview pela integração Git existente. Registrar PR, commit/deploy e conferência pública após publicação. O aceite físico dos alertas da UX-07 continua pendente. Próxima sprint: **UX-10 — treinador no celular**.
