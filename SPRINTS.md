# Atlas Run — sprints 0 a 4

## Próximo ciclo: revisão de experiência

Planejamento de 12/10/2026 em [PLANEJAMENTO-UX.md](PLANEJAMENTO-UX.md): conta única com áreas atleta/treinador, gestão de usuários, landing, acesso e recuperação, perfil, calendário e registro. UX-01 foi implementada em 13/10/2026; UX-02 tem frontend/banco implementados em 14/10/2026 e aguarda SMTP/validação de e-mails. UX-03 a UX-06 permanecem planejadas. Ao final desse ciclo será decidida a execução das antigas sprints 5 (biblioteca), 6 (equipes) e 7 (cobrança).

O contrato exclusivo abaixo é o registro histórico das sprints 0 a 4. UX-01 o substitui por áreas cumulativas: relato pessoal permanece editável pelo próprio usuário mesmo quando também é treinador/dono, e gestão de terceiros continua restrita aos vínculos ou ao dono. Consulte o manual atualizado em GESTAO.md.

Decisão de produto, 09/10/2026: três perfis exclusivos por conta — atleta, treinador e admin dono. A conta de treino do dono continua atleta; a administração usa uma conta separada.

## Sprint 0: contrato e fluxos

- Atleta consulta planos publicados e históricos, registra somente sua execução e edita seu perfil.
- Treinador ativo consulta perfis e planos somente dos atletas vinculados, cria/importa rascunhos, revisa, publica, duplica e arquiva planos desses atletas. Na sprint 4, consulta os relatos de execução e acrescenta comentários separados, sem editar o relato.
- Admin dono gerencia todos os atletas, treinadores e vínculos, além dos planos. O acesso inicial de dono é provisionado exclusivamente no banco, nunca por autoinscrição.
- Navegação de gestão: Visão geral → Atletas → Planos → Acompanhamento → Meu perfil; dono também tem Equipe.
- Importação: selecionar atleta → carregar CSV → validar linhas → revisar lista/calendário e guia → salvar rascunho → revisão final com destinatário → publicar.
- Editor: metadados, metas, guia e sessões; várias sessões na mesma data. Rascunhos não aparecem para atletas.
- Revisão de publicado: cópia para rascunho → nova publicação com novo ID e número de versão → anterior arquivado e preservado com seus registros. Sessões e planos publicados são imutáveis.
- Arquivamento retira do destaque; histórico permanece acessível. Nenhum plano é apagado. Atleta pode corrigir registros existentes no histórico, mas não criar novos registros em planos arquivados.
- Salvamento/publicação utiliza revisão esperada; conflitos de edição não sobrescrevem o trabalho de outra aba. Publicação usa o rascunho persistido e não o conteúdo enviado pelo navegador.

## Sprint 1: acesso e atletas

Área própria por perfil, busca e detalhe do atleta, treinadores ativos/inativos, atribuição/revogação de vínculos pelo dono, perfil pessoal e estados vazios. Treinadores precisam de contas sem planos de atleta. Desativação preserva histórico e retira acesso imediatamente no banco.

## Sprint 2: importação e revisão

CSV UTF-8 até 2 MB/1.000 sessões, validação compartilhada no cliente e validação independente no banco, erros por linha, prévia em lista e por data, guia completo e salvamento como rascunho. Arquivo inválido não grava plano parcial.

## Sprint 3: editor e publicação

Editor de sessões e guia, duplicação para outro atleta autorizado, revisão de publicados, confirmação do destinatário, publicação transacional, arquivamento e histórico de versões/eventos. Registros do atleta permanecem ligados à versão original.

## Sprint 4: acompanhamento e comentários

Aba Acompanhamento com filtros por atleta, plano, intervalo inclusivo de datas e situação. Resumo por semana iniciando na segunda-feira, distância/duração prescritas e realizadas informadas, sessões até hoje, datas passadas sem registro, pendências de hoje e futuras. Feito/adaptado contam como realizadas; não feito é um relato explícito distinto da ausência de registro. Campos vazios não viram zero. Totais semanais informam quantas sessões têm valores preenchidos. O período usa a data da sessão, e versões arquivadas ficam fora do total por padrão; histórico exige seleção explícita.

Dono e treinador autorizado consultam esforço, dor, recuperação e observações sem modificar atividades. Comentários são vinculados à sessão e versão original, aparecem ao atleta, guardam nome/papel do autor e data gerados pelo banco e não podem ser editados/apagados pelo cliente. Reenvio com o mesmo ID não duplica comentário. Falha de rede mantém o texto; navegação com texto não enviado pede descarte. Revogação do vínculo/desativação retira leitura e envio no banco. Indicadores apenas organizam relatos, sem diagnóstico ou alteração automática da prescrição.

Atleta vê comentários em Treino/Calendário e Evolução, recebe resumo semanal do plano selecionado e exporta comentários junto ao plano e registros, sem identificadores da equipe ou credenciais. Leituras são paginadas para não truncar resumos no limite de linhas da API.

## Matriz de acesso

| Operação | Atleta | Treinador ativo | Admin dono |
|---|---|---|---|
| Perfil pessoal | próprio | próprio | próprio |
| Consultar perfis de atletas | próprio | vinculados | todos |
| Consultar planos publicados/histórico | próprios | vinculados | todos |
| Criar/editar/importar rascunhos | não | vinculados | todos |
| Publicar/revisar/arquivar/duplicar | não | vinculados | todos |
| Alterar vínculos/ativação de treinador | não | não | sim |
| Registrar/editar atividade | própria | não | não |
| Ler relato pessoal de atividade | próprio | vinculados | todos |
| Ler comentários da equipe | próprios | vinculados | todos |
| Acrescentar comentário na sessão | não | vinculados | todos |
| Conceder papel dono | não | não | provisionamento no banco |

## Aceite e revisão

Testes de PostgreSQL cobrem separação entre treinadores, vínculo revogado, autoelevação negada, rascunhos invisíveis, importação atômica, concorrência, versões e preservação de registros. Testes de interface cobrem importação, edição, confirmação de publicação, erros e navegação por perfil. O upgrade do banco foi aplicado e a conta separada de dono informada pelo usuário foi confirmada e ativada. A interface segue o fluxo de publicação por Git/Netlify depois da revisão. Testes locais cobrem a matriz; a leitura sob o papel real do dono foi verificada no banco remoto. A suíte completa de fixtures remotas não foi concluída pelo conector; a tentativa não deixou fixtures persistidas.

Fora deste ciclo: biblioteca de modelos, múltiplas equipes, convites por e-mail, assinatura e cobrança. Plano comercial e plano de treino continuam conceitos separados.

Aceite da sprint 4: 25 testes locais passaram (cálculos, interface e PostgreSQL com dois treinadores/atletas). No banco remoto, o dono leu 1 registro e tentou atualizar 0 linhas; o comando de comentário confirmou autoria e papel em transação revertida. Nenhum comentário de teste foi persistido. O banco preservou 1 plano, 39 sessões e 1 atividade. A atualização foi dividida em três migrações menores por erro de requestState no conector; o script schema-v4.sql representa o mesmo estado final.

## UX-01 — conta única e gestão de acessos · entregue

Migração `atlas_run_ux01_accounts_and_areas`, gerada pelo CLI e mantida em `supabase/migrations/20261013205525_atlas_run_ux01_accounts_and_areas.sql`. Perfil automático e regularização idempotente; metadados do usuário não autorizam papéis. Listagem paginada de contas/confirmação/e-mail exclusiva do dono, áreas cumulativas, ativação pessoal limitada de treinador, bloqueio da reativação após desativação pelo dono e preferência de área sem poder de autorização. A lista Usuários permite ativar um atleta com planos/rascunhos. Treinadores podem ser atletas vinculados a outros treinadores. Atividades pessoais continuam editáveis somente pelo titular, inclusive com duas áreas. Prescrições publicadas, versões, registros e comentários mantêm seus IDs.

Aceite: 30 testes locais, build público de 17 arquivos e interface de gestão conferida em viewport mobile. Verificação remota da lista do dono e promoção do atleta com plano em transação revertida; quatro perfis, um plano, 39 sessões, uma atividade e um treinador persistido após a verificação. Testes completos com login em dispositivos reais permanecem em UX-06. Landing, cadastro separado, escolha inicial de área e recuperação de senha continuam em UX-02.

## UX-02 — apresentação, acesso e recuperação · e-mails pendentes

Landing e formulários separados, nome/e-mail/senha/repetição/área no cadastro, mostrar/ocultar senha, confirmação/reenvio, recuperação neutra e redefinição com link validado; retornos externos ao app recusados. Credenciais de recuperação ficam somente em memória. Retornos antigos para a raiz continuam funcionando. Onboarding concede no máximo a capacidade pessoal de treinador e mantém bloqueios do dono, sem vínculos automáticos ou admin. Contas anteriores preservam nome, área e histórico. Migração nova aplicada, quatro contas/perfis e plano de 39 sessões/uma atividade preservados. 39 testes locais passaram, incluindo interface de acesso, RLS/onboarding, sessão expirada e a regressão de gestão. Build público com 23 arquivos, fontes privadas excluídas. Interface e grade de cadastro conferidas em 390/320 px sem rolagem horizontal.

Pendente para concluir: conta/remetente/SMTP no Brevo escolhido para o piloto, limite de senha do serviço alinhado a 8 caracteres, templates de e-mail e teste real de confirmação/recuperação em endereço externo. Guia de configuração em EMAILS-PILOTO.md. Não houve contratação ou desativação da confirmação de e-mail.
