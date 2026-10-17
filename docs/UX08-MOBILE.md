# UX-08 — fluidez mobile

Implementação autorizada em 16/10/2026, após a publicação da UX-07. Escopo: reduzir esperas ao trocar de área e tornar carregamento, falha e retomada mais claros no celular. Evolução, novas telas de treinador e registro estruturado de musculação permanecem nas sprints seguintes. O aceite físico dos alertas da UX-07 continua pendente.

## Diagnóstico e mudança

Antes, trocar área aguardava `PATCH preferred_area → ensure_profile → access_context → GET perfil próprio → dados`. O admin também aguardava a lista de usuários após as oito consultas da gestão. Para respostas menores que a página de 500 linhas, eram cinco rodadas dependentes para atleta/treinador e seis para admin.

Agora são duas rodadas comuns:

1. Regularizar/ler o perfil por `atlas_ensure_profile` e consultar as capacidades atuais por `atlas_access_context`, em paralelo. Ambas precisam terminar. A regularização já devolve o perfil inteiro; elimina o GET individual redundante.
2. Selecionar uma área permitida pelo contexto atual e carregar seus dados em paralelo à gravação da preferência. O PATCH pede representação e exige a linha própria retornada. A tela só declara sucesso após todas as respostas. Na gestão do dono, a lista de usuários participa da mesma rodada das oito consultas existentes e os resultados são aplicados juntos.

A preferência do perfil retornado resolve o caso em que o contexto é consultado antes de um perfil ausente ser criado. Essa preferência seleciona somente entre as capacidades autorizadas pelo servidor. Uma área revogada não recebe PATCH nem abre a gestão. A sincronização e cada troca continuam consultando o contexto atual; o onboarding mantém seu comando de inicialização existente.

O avatar mantém somente o blob já existente em memória entre áreas da mesma conta. Caminho novo, saída, expiração ou troca de conta invalidam o objeto. Não há cache de planos/acessos entre áreas, gravação de dados de treino no navegador, fila offline ou cache de páginas.

## Experiência no celular

- Feedback imediato de carregamento, com conteúdo anterior retirado, controles bloqueados e indicação acessível de estado ocupado.
- Indicador animado respeita a preferência de movimento reduzido.
- Foco vai à seção de destino depois de reabilitar seus controles. Navegação da gestão identifica a seção ativa por `aria-current`.
- Falha de conexão/tempo esgotado tem mensagem em português, ação para tentar novamente e controles recuperáveis. Uma preferência não confirmada nunca aparece como troca concluída.
- Seletor de área/plano com fonte de 16 px no mobile; Atualizar dados tem área de toque de pelo menos 46 px de largura. Botões mantêm suas dimensões e recebem `touch-action: manipulation`.
- Guardas de formulário, rascunho, comentário e registro permanecem ativos; saída entre abas cancela requisições e oculta dados imediatamente.

## Medição

Mesmo harness de interface, com respostas fictícias e atraso fixo de 100 ms por requisição. Uma amostra por fluxo; tempo até a área pronta. Não é latência medida em produção, rede móvel ou aparelho físico. Páginas adicionais, renovação de token e desempenho do servidor podem acrescentar espera.

| Fluxo | Antes | Depois | Requisições antes/depois |
| --- | ---: | ---: | ---: |
| Treinador → atleta | 558 ms | 237 ms | 7 / 6 |
| Atleta → treinador | 557 ms | 220 ms | 12 / 11 |
| Dono → atleta | 548 ms | 222 ms | 7 / 6 |
| Atleta → admin dono | 646 ms | 229 ms | 13 / 12 |

O principal ganho vem da redução de dependências, não de reutilizar dados privados antigos. A inicialização comum cai estruturalmente de seis rodadas (sete no dono) para quatro, sem considerar paginação/renovação. Sucesso parcial é recusado.

## Validação

- `npm test`: **135/135 aprovados**; inclui testes de banco/RLS existentes, atividade, perfil, alertas, gestão e navegação.
- Barreiras controladas comprovam concorrência, espera por preferência + dados nas duas ordens, ausência de resultado parcial, falha HTTP/zero linhas/offline/timeout e recuperação, regularização de perfil de dono, preferência sem poder de autorização, revogação durante troca e respostas após troca de conta.
- Avatar: um download para o mesmo caminho entre áreas, invalidação por caminho novo/logout e somente a sessão no armazenamento local.
- Gestão: lista do dono concorrente/atômica, dados anteriores preservados após erro de refresh e resposta descartada após `destroy`. Paginação de 500 e teste existente de 1.001 linhas preservados.
- Navegador com dados fictícios em 320, 390, 768 e 1280 px, sem rolagem horizontal nos cenários conferidos; conexão lenta, falha/retomada e foco após trocar de área. Seletor mobile conferido em 16 px; botão Atualizar dados em 46 × 48 px.
- Build explícito com 72 arquivos públicos; `diff --check` sem erros. Nenhuma migration, alteração de política, credencial, vínculo, prescrição ou registro real nesta sprint.

Evidências locais ignoradas: `.artifacts/ux08-before.json`, `.artifacts/ux08-after.json`, `.artifacts/ux08-tests.tap`, `.artifacts/ux08-loading-390.png`. A prévia local em `127.0.0.1:4175` usa apenas fixtures e permissão simulada; não entrega push real.

## Publicação

Publicar pela branch `main`, após preview e revisão do diff. Conferir os arquivos app/gestão publicados e o endpoint de configuração existente, preservando funções e agendamento da UX-07. Registrar commit/deploy verificados após a publicação. Próxima: UX-09, evolução do atleta.
