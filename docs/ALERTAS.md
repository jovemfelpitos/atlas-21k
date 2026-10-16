# Alertas opcionais do Atlas Run

Implementação preparada em 16/10/2026 e ativação autorizada pelo proprietário na UX-07. A migration foi aplicada no projeto existente e as credenciais de produção foram cadastradas no Netlify. O envio depende da publicação e da adesão explícita de cada usuário/aparelho. Situação, evidências remotas e aceite físico em [UX07-PUBLICACAO.md](UX07-PUBLICACAO.md). A interface continua funcionando sem o serviço.

## Experiência e alcance

O Perfil permite escolher categorias, horário, fuso e ativar este aparelho por um clique explícito. A autorização do navegador é independente das preferências da conta. Desligar este aparelho remove somente sua assinatura; desligar `enabled` silencia a conta inteira. O logout limpa o vínculo local para que uma notificação antiga não apareça para outra conta no mesmo aparelho.

O cliente usa Web Push e um service worker exclusivo para mensagens, sem cache de páginas, interceptação de fetch ou dados de treino offline. Android depende de suporte do navegador e permissão; no iPhone, o aplicativo precisa estar adicionado à Tela de Início em iOS/iPadOS 16.4 ou superior e a permissão deve partir de uma ação da pessoa. A entrega depende do navegador, sistema, rede e configurações de bateria; não é um alarme exato nem há garantia de horário.

As mensagens contêm somente título e texto genéricos, tipo, ID do evento, UUID da conta destinatária e rota interna. Não contêm nome, e-mail, distância, pace, dor, recuperação, notas ou conteúdo dos comentários. O UUID serve apenas para o service worker descartar mensagens de uma conta anterior; não é credencial. O clique foca o app e oferece uma ação explícita, respeitando a proteção dos formulários abertos. O resumo de treinador é encaminhado ao Acompanhamento da área de treinador, inclusive se a conta estava na área de atleta; o acesso atual é validado novamente. Um vínculo ou área revogada não é reativado pela notificação.

## Categorias e regras

| Categoria | Origem | Regra |
| --- | --- | --- |
| Lembrete de treino | Agendador a cada cinco minutos | Uma mensagem por plano/dia, no horário local escolhido; somente plano publicado com sessão hoje ainda sem qualquer registro. `feito`, `adaptado` e `não feito` impedem novo lembrete da sessão. |
| Novo plano | Publicação real de uma nova versão | Somente se a categoria já estava ativa naquele momento. Rascunhos e planos arquivados não geram aviso. |
| Comentário da equipe | Novo comentário existente no fluxo atual | Sem texto privado no push. O vínculo atual do treinador ou a autorização de dono é conferido antes de enviar. |
| Resumo para treinador | Agendador no horário local escolhido | No máximo uma mensagem diária se atletas atualmente vinculados fizeram/alteraram registros desde o último intervalo diário. Não envia uma mensagem por atleta. |

O horário é compartilhado entre lembrete e resumo. A janela para recuperar uma execução perdida do agendador é de duas horas; não há recuperação de dias anteriores. O resumo considera o horário escolhido no dia local anterior até o horário de hoje, incluindo mudanças de horário de verão do fuso IANA, limitado à ativação das preferências. O banco registra separadamente o horário real de cada alteração da atividade para o resumo, sem depender do campo legado `updated_at` que o cliente pode informar. Uma edição após o horário do resumo não apaga o sinal anterior. A migration não popula sinais de atividades antigas. Esses sinais contêm somente os identificadores da sessão e o horário, com retenção de sete dias.

Ativar, reativar ou alterar categorias/horário/fuso reinicia o marco temporal no servidor. Eventos antigos não são enviados nessa ativação. Um aparelho recém cadastrado recebe somente eventos posteriores ao seu cadastro. Repetir o cadastro do mesmo aparelho/conta é idempotente. Há limite de dez aparelhos por conta.

## Contrato do cliente

`GET /api/notification-config` retorna exclusivamente `{ "enabled": boolean, "publicKey": string }`, com `Cache-Control: no-store`. A chave pública vem vazia se o envio não estiver configurado e explicitamente habilitado. Nenhum segredo sai nessa resposta. O cliente consulta e grava preferências apenas quando o serviço estiver disponível.

Tabela pública `atlas_notification_preferences`:

| Coluna | Tipo / padrão | Escrita |
| --- | --- | --- |
| `user_id` | UUID da conta, chave primária | Própria conta, vínculo imutável |
| `enabled` | Booleano / `false` | Própria conta |
| `workout_reminders` | Booleano / `false` | Própria conta |
| `plan_updates` | Booleano / `false` | Própria conta |
| `coach_comments` | Booleano / `false` | Própria conta |
| `coach_digest` | Booleano / `false` | Própria conta |
| `reminder_time` | `time` / `07:00`, sem segundos | Própria conta |
| `time_zone` | Nome IANA / `America/Sao_Paulo` | Própria conta; validado no banco |
| `created_at`, `updated_at`, `activated_at` | `timestamptz` | Somente servidor |

O cliente usa o request autenticado existente para `GET /rest/v1/atlas_notification_preferences?select=*` e upsert por `user_id`. RLS impede leitura/escrita entre contas, inclusive por treinador e dono. Não há acesso anônimo nem DELETE direto. Os campos de data não têm permissão de escrita pelo cliente.

RPCs autenticadas:

- `atlas_save_push_subscription(p_subscription jsonb)` recebe o resultado de `PushSubscription.toJSON()`, valida o usuário confirmado e grava apenas endpoint, expiração e chaves de criptografia. Retorna `{ "saved": true }`.
- `atlas_remove_push_subscription(p_endpoint text)` remove somente o endpoint pertencente à conta atual. Retorna `{ "removed": true }`, inclusive em uma repetição.

Assinaturas, chaves, eventos, sinais de atividade e tentativas ficam em `atlas_private`, sem acesso SELECT do cliente. RPCs de fila são exclusivas de `service_role`; o cliente não pode preparar, reivindicar, autorizar nem confirmar envios. Não foram alteradas permissões/políticas de planos, atividades, perfis ou equipe.

## Servidor e entrega

Arquivos:

- `supabase/migrations/20261016192208_atlas_run_notification_delivery.sql`: tabelas, RLS, triggers aditivos e RPCs; criada com Supabase CLI 2.121.0.
- `netlify/functions/notification-config.mjs`: configuração pública mínima.
- `netlify/functions/notification-dispatch.mjs`: scheduled function moderna, `*/5 * * * *` em UTC.
- `lib/server/notifications.js`: RPC autenticada de servidor, payloads genéricos e transporte real `web-push` 3.6.7, versão fixada no lockfile.

O servidor prepara eventos e entregas idempotentes, depois usa até três workers e vinte envios por execução. Cada worker reivindica somente a próxima entrega que vai processar, preservando as tentativas de quem está aguardando. Novos ciclos começam até 11 segundos após o início, reservando até quatro segundos para cada uma das etapas de claim, autorização, envio e confirmação. Isso deixa margem dentro do limite de 30 segundos de uma scheduled function.

Cada entrega tem lease/token, autorização imediatamente antes do transporte e até cinco tentativas com espera exponencial. Desligar preferências, registrar a sessão, arquivar plano, trocar a conta do aparelho ou revogar o vínculo impede o envio pendente. Uma revogação que aconteça depois da autorização pode coincidir com uma requisição já em trânsito; o conteúdo genérico e a verificação de conta do service worker reduzem a exposição. Mensagens já exibidas não podem ser retiradas remotamente com garantia.

HTTP 404/410 elimina a assinatura e as entregas associadas. Erros transitórios, 408 e 429 podem repetir; outros erros 4xx encerram a tentativa. Endpoints ficam restritos a HTTPS sem credenciais/porta personalizada, nos serviços `fcm.googleapis.com`, `updates.push.services.mozilla.com` e `web.push.apple.com`/subdomínios. Não há redirecionamentos no transporte push; requests RPC também bloqueiam redirects. TTL de transporte é de cinco minutos.

O evento e o aparelho são únicos no banco; o ID estável também define `tag`/`topic` para substituir uma repetição quando o provedor suporta. Se o processo cair entre a aceitação do provedor e a confirmação no banco, pode ocorrer uma repetição. Não se promete entrega exatamente uma vez. O lote seguinte retoma leases expirados. Eventos de entrega expiram em 24 horas, lembretes/resumos em duas horas; metadados de eventos são eliminados sete dias após a expiração. Assinaturas persistem até remoção, troca de conta, exclusão do usuário ou resposta 404/410.

## Procedimento de ativação

1. Revisar e aplicar a migration no projeto correto, após as migrations UX existentes; executar advisors e testes de RLS nesse ambiente.
2. Gerar um par VAPID próprio do projeto em um local seguro. Não gravar chaves, tokens ou saída de geração no repositório, no chat ou no diretório público.
3. Cadastrar as variáveis abaixo no Netlify, preferencialmente com escopo **Functions** quando o plano permitir; secrets nunca entram em `config.js`, HTML, JavaScript público ou `netlify.toml`. No plano atual, credenciais privadas usam **Contains secret values**, somente em **production**, nos escopos permitidos Builds/Functions/Runtime; Post processing fica excluído. O build não injeta essas variáveis no cliente. Ver a configuração efetivamente aplicada em [UX07-PUBLICACAO.md](UX07-PUBLICACAO.md).
4. Fazer deploy do código revisado. O agendador roda automaticamente somente em deploy publicado. Deploy Previews não disparam pelo cron; teste manual deve usar contas de teste consentidas.
5. Conferir o config endpoint, adesão voluntária e entrega real em Android e iPhone instalado; depois validar silenciamento, logout, troca de conta, revogação de vínculo e assinatura expirada.

| Variável de Functions | Conteúdo |
| --- | --- |
| `ATLAS_NOTIFICATIONS_ENABLED` | `true` somente após migração/configuração revisadas; ausente mantém tudo desligado |
| `SUPABASE_URL` | Origem HTTPS do projeto |
| `SUPABASE_SERVICE_ROLE_KEY` | Credencial exclusiva do servidor; nunca distribuir ao navegador |
| `ATLAS_VAPID_PUBLIC_KEY` | Chave pública do par; única chave enviada ao cliente |
| `ATLAS_VAPID_PRIVATE_KEY` | Chave privada correspondente; exclusiva do servidor |
| `ATLAS_VAPID_SUBJECT` | Contato válido `mailto:` ou HTTPS do responsável |

Config valida formato e correspondência das chaves. Desabilitar `ATLAS_NOTIFICATIONS_ENABLED` e republicar interrompe o dispatcher sem apagar preferências. Mudanças de variáveis de Functions exigem novo deploy. Rotação de chave VAPID requer reinscrição dos aparelhos; não trocar esse par sem preparar a migração.

## Verificação local e limites desta entrega

`node --test tests/notifications-database.test.js tests/notifications-server.test.js` passou: nove testes com PGlite e transporte simulado, sem chamar serviços de push ou banco remoto. Cobrem RLS entre contas, ausência de acesso anônimo, funções exclusivas do servidor, metadados imutáveis, endpoint malicioso, adesão sem histórico, quota, rebind do aparelho, deduplicação, lease antigo, limite de tentativas, 410, silenciamento, todos os status explícitos, revogação de treinador e limite de tempo. O teste de VAPID gera chaves efêmeras em memória e valida a criptografia real da biblioteca sem enviar mensagens.

Na preparação local, `supabase db advisors --local --type security --fail-on error` e `supabase migration list --local` não puderam executar porque não há instância Supabase em `127.0.0.1:54322`. A UX-07 aplicou a migration pelo conector, executou o advisor remoto e verificou RLS/permissões em transação revertida, preservando os dados existentes. Entrega real nos aparelhos permanece como aceite físico; detalhes em [UX07-PUBLICACAO.md](UX07-PUBLICACAO.md).

Referências oficiais verificadas nesta rodada: [RLS do Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [changelog Supabase](https://supabase.com/changelog), [scheduled functions do Netlify](https://docs.netlify.com/build/functions/scheduled-functions/), [web-push para Node](https://github.com/web-push-libs/web-push), [Web Push no iOS/iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
