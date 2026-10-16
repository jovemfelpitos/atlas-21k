# UX-07 — publicação e alertas

Execução autorizada pelo proprietário em 16/10/2026, uma sprint por vez. Esta entrega reúne a identidade e a interface mobile já aprovadas, corrige a navegação e a saída dos alertas e prepara o serviço de produção. O aceite em aparelhos físicos permanece separado da verificação técnica.

## Publicação verificada

Publicado em 16/10/2026 às 18:01 BRT em [atlasrun.netlify.app](https://atlasrun.netlify.app), pela integração Git da branch `main`. [PR #1](https://github.com/jovemfelpitos/atlas-21k/pull/1) integrado; commit de produção `96ce4bc0dd956dab8325a43194eae2fba46b831c`, deploy `6ad2909793f8e03c1e29366f`, estado `ready`. O preview passou antes da integração e retorna alertas indisponíveis por não receber as credenciais de produção.

Em produção, páginas de apresentação/acesso/cadastro/ajuda, símbolo/logotipo, fonte, manifesto e worker responderam com sucesso. O manifesto usa `application/manifest+json` e revalidação; o worker usa `no-cache` e corresponde ao código revisado. `/lib/server/notifications.js` retorna 404. `/api/notification-config` retorna exclusivamente `enabled: true` e a chave pública válida, com `no-store`. `/app` sem sessão redireciona para o acesso separado. Conferência visual publicada em 390 px sem rolagem horizontal; isto não substitui dispositivo físico.

As duas funções constam no deploy, com `notification-dispatch` em `*/5 * * * *`. Uma execução pelo painel foi aceita às 18:02:58 BRT. O log de API do Supabase confirma `POST atlas_prepare_notifications` e três `POST atlas_claim_notifications`, todos HTTP 200 sob `service_role`. Zero contas aderentes, aparelhos, eventos e entregas; nenhuma mensagem foi enviada nem foi fabricado treino/comentário para teste.

Situação: publicação e configuração técnica concluídas; **aceite físico de instalação, permissão, entrega e silenciamento em Android/iPhone pendente**. A próxima sprint é UX-08; este aceite pendente não deve ser descrito como concluído.

## Escopo

- Publicar os ativos oficiais, Sora local, tokens e acabamento já aprovados, sem modificar os caminhos ou as proporções do símbolo.
- Publicar o registrador com distância decimal, duração em horas/minutos/segundos e pace calculado, preservando o contrato dos registros anteriores.
- Disponibilizar alertas opcionais no Perfil, com categorias, horário/fuso e ativação explícita de cada aparelho.
- Direcionar treino/plano/comentário à área de atleta e resumo ao Acompanhamento do treinador. O acesso é consultado novamente no servidor e a abertura não regrava a preferência da conta.
- Ocultar dados privados imediatamente na saída/expiração e aguardar a limpeza do aparelho por até dois segundos antes de navegar. O worker confere o dono e o endpoint para preservar uma assinatura reassociada em outra aba.
- Serializar recebimento, exibição e limpeza no worker. Se a exibição esperar o carregamento do ícone, a limpeza aguarda e fecha o aviso antes de confirmar; se a limpeza ocorrer primeiro, o push antigo é descartado.

## Banco e conservação

Projeto existente `atlasrun`, referência `acmzbjynzsutwdrbvxuw`. Migration remota aplicada: `20261016205043_atlas_run_notification_delivery`; fonte local gerada pelo CLI: `supabase/migrations/20261016192208_atlas_run_notification_delivery.sql`. A diferença de timestamp resulta da aplicação pelo conector; não reaplicar a fonte.

Antes e depois da aplicação: cinco perfis, três planos, 45 sessões, dez registros e nenhum comentário. Os hashes das linhas de planos, sessões e registros permaneceram idênticos. Nenhuma preferência ou inscrição de aparelho foi criada para os usuários.

Verificação remota sob os papéis reais, em transação revertida: leitura/escrita da preferência própria; recusa de leitura/escrita entre contas; recusa de leitura anônima; dispositivos privados e fila inacessíveis ao cliente. RLS ativa nas cinco tabelas novas. A transação deixou zero preferências persistidas.

O advisor manteve o aviso anterior de proteção contra senhas vazadas desativada. Quatro informações novas `rls_enabled_no_policy` correspondem às tabelas privadas intencionalmente sem acesso direto: subscriptions, events, deliveries e activity_signals. As operações passam pelos comandos protegidos; não adicionar políticas públicas para remover esses avisos informativos.

## Configuração do Netlify

Projeto existente `atlasrun`, ID `7fe59a9f-15a5-478a-a2e6-abd4056fce25`, repositório `jovemfelpitos/atlas-21k`, produção pela branch `main`. Os valores ficam no Netlify, fora do código e da distribuição pública. Não foi criado projeto, assinatura paga ou conta nova.

O plano atual bloqueia a seleção de escopos individuais. As duas credenciais privadas usam a proteção **Contains secret values**, somente no contexto **production**, nos escopos que o plano oferece para secrets: Builds, Functions e Runtime. Post processing fica excluído. Previews, branches e desenvolvimento local não recebem essas credenciais. A política de aprovação para deploys não confiáveis foi preservada. O build não lê essas variáveis nem as injeta em arquivos públicos.

As chaves VAPID foram geradas uma única vez para este projeto. A credencial Supabase de servidor já existente é usada somente no serviço. Não gravar esses valores em documentação, logs, config.js ou repositório. O contato VAPID usa a página HTTPS pública de ajuda do Atlas Run. Os valores privados cadastrados não devem ser trocados sem planejar a reinscrição dos aparelhos.

O endpoint público expõe apenas disponibilidade e chave pública. O dispatcher agendado executa a cada cinco minutos somente no deploy de produção. Todos os usuários começam sem adesão; a publicação não inscreve aparelhos nem ativa categorias em seu nome.

## Critérios e validação

- `npm test`: 124/124 testes aprovados, incluindo 29 de notificações. Cobertura de registro, permissões, fila, transporte, cliente/worker e regressões da saída, destinos entre áreas e exibição concorrente com limpeza. `diff --check` limpo para o código e os documentos do projeto; a licença oficial `assets/fonts/sora/OFL.txt` mantém um espaço final original, preservando o arquivo e seu hash de origem.
- Build explícito com 72 arquivos públicos, sem servidor, SQL, ferramentas, fixtures ou documentação interna.
- Os 43 arquivos originais da marca e os três arquivos oficiais da fonte conferem com seus hashes de origem. `.gitattributes` preserva seus bytes entre Windows e Linux, inclusive documentos/licença, sem normalizar os caminhos vetoriais.
- Conferir no deploy: páginas públicas e rotas de acesso, fonte/ativos oficiais, manifest, worker, configuração pública mínima e duas funções presentes com o agendamento correto.
- Conferir uma execução do dispatcher sem inscrições, sem fabricar mensagens ou alterar treinos reais.
- Android e iPhone físicos: instalar/abrir, entrar na própria conta, ativar voluntariamente um aparelho e categoria, receber um evento real posterior à ativação, abrir o destino, silenciar e sair. No iPhone, usar o app adicionado à Tela de Início. Não considerar viewport ou permissão simulada como evidência de entrega física.

O aceite de instalação/entrega em Android e iPhone exige a participação do proprietário ou dos usuários do piloto. As sprints seguintes continuam autorizadas na ordem abaixo; qualquer dependência desse aceite deve permanecer explícita.

## Próximas sprints, em sequência

| Sprint | Entrega | Critério principal |
| --- | --- | --- |
| UX-08 | Fluidez mobile | Medir a troca de área, reduzir trabalho/requisições redundantes e conferir carregamento/toque sem enfraquecer autorização ou proteção de rascunhos. |
| UX-09 | Evolução do atleta | Comparar semana prevista e realizada e apresentar distância, duração e pace com ausência distinta de zero, reutilizando os cálculos atuais. |
| UX-10 | Treinador no celular | Simplificar atletas, sessões, comentários, revisão e publicação nos componentes existentes, preservando vínculos e versões. |
| UX-11 | Corrida + musculação | Definir os contratos de exercícios/séries/repetições/cargas e implementar o fluxo híbrido incrementalmente, preservando o histórico da corrida. |

Biblioteca avançada, equipes independentes e cobrança continuam fora deste ciclo. A landing pode receber uma rodada curta para apresentar a experiência efetivamente publicada, instalação e alertas.
