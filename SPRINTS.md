# Atlas Run — sprints 0 a 4

## Ciclo aprovado em 16/10/2026

UX-10 publicada e conferida em produção em 19/10/2026: treinador no celular, com navegação/atalhos, acompanhamento paginado e editor/revisão compactos, preservando vínculos e versões. 147 testes aprovados; escopo e evidências em [docs/UX10-TREINADOR-MOBILE.md](docs/UX10-TREINADOR-MOBILE.md). Próxima: UX-11, corrida + musculação.

UX-09 publicada e conferida em produção em 17/10/2026: seleção semanal, comparações previstas/realizadas, pace com pares válidos, histórico compacto e exportação existente. 143 testes aprovados, sem alteração de banco/permissões; critérios e limites em [docs/UX09-EVOLUCAO.md](docs/UX09-EVOLUCAO.md). Próxima: UX-10, treinador no celular.

UX-08 publicada em 16/10/2026 e conferida em produção em 17/10/2026: requisições independentes paralelas, perfil retornado pela regularização sem leitura duplicada, preferência confirmada junto aos dados, avatar em memória e feedback mobile. 135 testes aprovados; acesso/rascunhos e configuração dos alertas preservados; publicação, medição local e limites em [docs/UX08-MOBILE.md](docs/UX08-MOBILE.md). Próxima sprint: UX-09. Aceite físico dos alertas da UX-07 continua pendente.

Execução uma sprint por vez: UX-07 publicação/alertas publicada e verificada tecnicamente, seguida de UX-08 fluidez mobile, UX-09 evolução, UX-10 treinador no celular e UX-11 corrida + musculação. A identidade e o registrador mobile previamente aprovados estão publicados. Migração de alertas aplicada com dados preservados; 124 testes aprovados; configuração/dispatcher verificados em produção sem envio. Aceite em aparelhos Android/iPhone físicos permanece pendente. Escopo, evidências, dependências e critérios em [docs/UX07-PUBLICACAO.md](docs/UX07-PUBLICACAO.md).

## Próximo ciclo: revisão de experiência

Planejamento de 12/10/2026 em [PLANEJAMENTO-UX.md](PLANEJAMENTO-UX.md): conta única com áreas atleta/treinador, gestão de usuários, landing, acesso e recuperação, perfil, calendário e registro. UX-01 foi implementada em 13/10/2026; UX-02 e UX-03 entregues em 14/10/2026. SMTP, confirmação/recuperação e perfil comum estão disponíveis. UX-04 e UX-05 também foram entregues em 14/10/2026. UX-06 foi concluída para o piloto em 15/10 por aceite do dono, com passos A/B/dono e troca de senha no computador/celular aprovados. Demora ao trocar de área e testes complementares não realizados ficaram no backlog. Evidências e priorização para as antigas sprints 5 (adiar biblioteca), 6 (reduzir ao piloto atual; isolamento obrigatório antes de assessorias independentes) e 7 (adiar cobrança) em [PILOTO-UX06.md](PILOTO-UX06.md).

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

## UX-02 — apresentação, acesso e recuperação · entregue

Landing e formulários separados, nome/e-mail/senha/repetição/área no cadastro, mostrar/ocultar senha, confirmação/reenvio, recuperação neutra e redefinição com link validado; retornos externos ao app recusados. Credenciais de recuperação ficam somente em memória. Retornos antigos para a raiz continuam funcionando. Onboarding concede no máximo a capacidade pessoal de treinador e mantém bloqueios do dono, sem vínculos automáticos ou admin. Contas anteriores preservam nome, área e histórico. Migração nova aplicada, quatro contas/perfis e plano de 39 sessões/uma atividade preservados. 39 testes locais passaram, incluindo interface de acesso, RLS/onboarding, sessão expirada e a regressão de gestão. Build público com 23 arquivos, fontes privadas excluídas. Interface e grade de cadastro conferidas em 390/320 px sem rolagem horizontal.

SMTP Brevo ativo com chave criada/inserida pelo dono, remetente verificado e mínimo de senha do Supabase salvo em 8 caracteres. Modelos de confirmação e recuperação aplicados e conferidos após reabrir. Recuperação solicitada no site publicado: sucesso no app/Auth e Enviado/Entregue/Clicado no Brevo, que também registrou confirmação de cadastro entregue e clicada. O dono confirmou os dois links e a entrada como treinador. A nova conta tem e-mail confirmado/onboarding concluído, áreas atleta/treinador e preferência treinador, sem admin nem vínculos. Sob seu papel real, RLS retornou apenas seu próprio perfil e zero planos/relatos. Cinco contas/perfis e dois treinadores ativos ao final; um plano, 39 sessões e uma atividade preservados. O piloto usa domínio técnico de remetente `brevosend.com`. Não houve alteração de senha pelo agente, contratação ou desativação da confirmação de e-mail. Guia e limites de validação em EMAILS-PILOTO.md; a matriz completa entre contas/dispositivos permanece em UX-06.

## UX-03 — perfil completo e troca de área · entregue

Perfil comum a atleta, treinador e dono: nome, foto, nascimento opcional, dias disponíveis, e-mail, senha e áreas. Nome/foto refletem no cabeçalho e ao trocar de área. Fotos originais JPG/PNG/WebP de até 8 MiB são decodificadas e reprocessadas em JPEG quadrado de até 640 px/512 KiB; bucket privado, caminho novo por upload e sem upsert. Foto anterior só é desassociada após sucesso; falha de rede mantém o formulário. O vínculo da foto exige arquivo próprio existente. Leitura de terceiros segue RLS do perfil, somente para dono/equipe autorizada; equipe não altera/remove arquivos. Remoção volta às iniciais. Limpeza de objetos antigos é feita pela API Storage após salvar a referência; falha de limpeza não desfaz o perfil e deixa o objeto privado ao titular.

Nascimento futuro/inválido é recusado no navegador e no banco; vazio é permitido. E-mail pede senha atual verificada no Auth, mantém o endereço atual até confirmar nos dois endereços e trata o retorno da primeira confirmação. Senha pede atual/nova/repetição; `Require current password when updating` ativado e conferido após recarregar no Supabase, preservando a recuperação por link. Modelo de alteração de e-mail em português aplicado. Credenciais digitadas não entram em armazenamento do navegador ou nas tabelas do app. Perfil não modifica papéis, vínculos, sessões de treino ou registros. Troca de área e saída/sincronização respeitam alterações não salvas.

Aceite técnico: 50 testes locais passaram, incluindo RLS de fotos/nascimento, arquivos inválidos, remoção/iniciais, preferência compartilhada e falhas de identidade/envio. A transação remota revertida sob a conta nova de treinador confirmou nascimento próprio, bloqueio de data futura, zero perfis alheios e impossibilidade de editar o indicador admin. Bucket privado de 512 KiB/JPEG e três políticas confirmados; cinco perfis, um plano, 39 sessões e uma atividade preservados. Sem alerta de segurança novo. Conversão real de PNG e layout em 320/390 px conferidos localmente. Trocas efetivas de senha/e-mail em contas reais não foram realizadas pelo agente; seguem na matriz de piloto UX-06. Próxima: UX-04, calendário mensal e agenda.

## UX-04 — calendário mensal e agenda · entregue em 14/10/2026

Mês e Agenda compartilham os registros do plano selecionado. Grade de segunda a domingo, navegação por mês, Hoje, seleção de dia e atalho à próxima/última sessão. Ao abrir um plano cujo período inclui hoje, começa em hoje; fora do período, começa na próxima/última sessão. Agenda mantém o plano inteiro em ordem cronológica. Todas as sessões de uma data aparecem separadamente. Filtros Todas, Realizadas (feito + adaptado), Sem registro e Não feitas, com contagens do plano inteiro e resumo do mês exibido. Texto e símbolos complementam cores; datas passadas sem relato não são convertidas em Não feito. Dia/mês/filtro ficam em memória por versão; salvamento atualiza estados sem perder a seleção. Histórico não recebe registros de outra versão, mesmo com IDs de sessão iguais.

Dono/treinador acessam Ver calendário no plano ou no histórico do atleta autorizado. Podem consultar relatos e abrir os comentários existentes; retorno mantém a seleção do calendário. Nenhuma edição de atividades pela equipe. A área de gestão continua excluindo planos pessoais do treinador e atletas sem vínculo. Seletor de plano identifica a versão; seletor de área volta a ficar disponível após salvar atividade. Nenhuma mudança de banco, permissão, data prescrita ou registro real foi necessária.

Aceite técnico: 56 testes locais passaram, incluindo bissexto/fevereiro, transição de meses/anos, várias sessões no mesmo dia, ausência de plano no período, filtros por relato, salvamento, histórico separado, retorno de comentários, foco após navegação e regressão completa de RLS. Fluxo local com dados fictícios conferido em 320/390 px sem rolagem lateral. Build de 27 arquivos públicos; fontes SQL, testes e fixtures excluídos. A matriz em contas/dispositivos reais segue em UX-06. Próxima: UX-05 — registro de atividade compreensível. As sprints originais 5/6/7 continuam para decisão após o piloto.

## UX-05 — registro de atividade compreensível · entregue em 14/10/2026

Formulário em módulo próprio, contexto de sessão/plano/versão e prescrição em leitura. Feito/Adaptado/Não feito exige escolha explícita; distância, tempo, esforço, dor, recuperação e observações são opcionais. Vírgula/ponto nos resultados; limites já existentes no banco validados antes da escrita. Escalas com Não informei e 0–10 inteiros, ajuda curta, detalhes e referências verificadas do CDC/Cleveland Clinic. Nenhum número zero por padrão. Não feito dispensa resultados e aceita motivo. Alterar a situação preserva campos; edição mantém valores anteriores e recuperação legada. Referências previstas e comentários nunca são convertidos em resultados do atleta.

Estado de salvamento com controles bloqueados, confirmação da linha persistida e erro que mantém o formulário. Contexto de usuário/plano/sessão capturado ao abrir, sem confiar no campo oculto para a identidade. Leitura prévia e PATCH com updated_at esperado evitam substituir uma edição concorrente; retorno do banco alimenta o calendário e a evolução. Após resposta perdida, nova tentativa confere a linha por identidade e valores; não duplica nem sobrescreve outro relato. Pendência fica só em memória, sem fila offline. Fechar/Escape pede descarte, navegação/áreas/sincronização/saída preservam campos e beforeunload protege a página.

Aceite técnico: 66 testes locais passaram, incluindo vazio/zero no PostgreSQL, validação das escalas, Não feito sem números, recuperação antiga, falha e resposta perdida, comparação entre versões de dispositivo simuladas, salvamento condicional e guarda de alterações. Navegador local em 320/390/768 px e desktop sem rolagem horizontal; entrada com vírgula, edição com dor zero e resposta perdida após gravação conferidas com fixtures fictícias. Build de 29 arquivos públicos. Leitura remota confirmou cinco perfis, um plano, 39 sessões, uma atividade e restrições numéricas; nenhuma escrita/migração real. Próxima: UX-06, matriz do piloto em contas/dispositivos reais e decisão sobre as antigas sprints 5/6/7. Essas validações reais ainda não estão concluídas.

## UX-06 — piloto, qualidade e decisão de lançamento · concluída para o piloto em 15/10/2026

Correção de saída/troca de usuário entre abas: limpa dados e formulários privados, cancela requisições, ignora respostas atrasadas e preserva a nova sessão que possa ter sido aberta. Renovação da mesma conta mantém o preenchimento. A gestão encerrada não reconstrói uma importação de arquivo concluída depois da saída. Ajuda pública em `/ajuda`, acessível pela landing, telas de acesso e app.

74 testes locais aprovados e sete verificações sob os papéis reais no banco remoto, com todos os dados transientes revertidos. Navegador local confirmou renovação, troca e saída entre abas; ajuda responsiva em 320/390/768 px e desktop. Build de 30 arquivos públicos, sem testes/SQL/relatório privado.

O dono autorizou os planos fictícios Atleta A/B: dois planos independentes, três sessões cada, publicados pelos comandos existentes. Original mantido publicado com 39 sessões e os dois registros já existentes no início da UX-06. Nenhum relato fictício foi escrito pelo agente e nenhum vínculo foi ampliado. A conta B já é treinador e usa a área Atleta com o mesmo acesso.

**Retorno real de 15/10:** dono aprovou passos A/B, troca de área e consulta do dono no celular/computador. Banco confirmou um relato por plano do piloto: A como Adaptado e B como Feito, ambos com números vazios; isso não comprova os casos específicos dor zero/Não feito. Original segue publicado com 39 sessões e agora três relatos; consultas somente leitura, sem alteração pelo agente. **Encerramento por aceite do dono em 15/10:** alteração de senha também aprovada no computador e no celular. Demora ao trocar Atleta/Treinador aceita como melhoria posterior; o fluxo salva a preferência e recarrega dados, mas não há medição que atribua a causa ao servidor. Sincronização, falhas de sessão/rede, perfil/calendário/histórico adicionais, e-mail, treinador vinculado e casos numéricos não executados seguem no backlog. Sprint concluída para o piloto da operação atual; nenhum teste não realizado foi marcado como aprovado. Consulte [PILOTO-UX06.md](PILOTO-UX06.md) para matriz, aceite, backlog, limites de operação/suporte e priorização de 5/6/7. Biblioteca e cobrança adiadas; equipes reduzidas à operação atual até validar a expansão.

### Correção do Perfil após o aceite — 15/10/2026

O dono relatou bloqueio indevido de navegação/saída com aviso de salvar ou descartar mesmo sem editar. Reproduzido no código anterior: campos de senha/e-mail presentes em formulários fechados e preenchidos automaticamente tornavam o perfil pendente. A comparação dos dados pessoais também foi substituída por uma referência dos valores efetivamente exibidos no editor.

Perfil agora abre em consulta. Cada ação monta somente seu formulário, com Salvar e Cancelar edição próprios; voltar de uma edição alterada oferece continuar ou descartar. Só a senha atual preenchida, ou o e-mail atual repetido, não criam pendência. Uma nova senha, novo e-mail ou alteração pessoal continuam protegidos. A correção é compartilhada entre atleta, treinador e dono. Mesmos comandos de persistência e verificação de identidade; nenhuma alteração de permissões ou banco.

79 testes locais aprovados, incluindo regressões de preenchimento automático, cancelamento, retorno à referência original, gravação/falha e navegação/sincronização/saída nas três áreas. Conferência no navegador com fixtures em 320/390/768 px/desktop: troca sem edição, guarda com alteração real, cancelamento, nova troca e salvamento com retorno à consulta. Os testes reais adicionais relatados pelo dono estão em PILOTO-UX06.md; treinador vinculado continua inconclusivo.

## UX-11 — corrida + musculação · 19/10/2026

Plano híbrido com sessões separadas, exercícios/séries prescritos e relato de repetições/carga por série escolhido pelo usuário. Reutilizados editor, revisão, calendário, acompanhamento e evolução; pace da corrida separado da duração da musculação. Texto antigo e dados históricos preservados. Migração aditiva aplicada, 155 testes locais e validação remota transacional revertida aprovados. Implementação integrada à main e preview conferido. **Produção bloqueada por esgotamento de créditos Netlify**; site principal permanece na UX-10. Contrato, limites, evidências e retomada da publicação em [docs/UX11-HIBRIDO.md](docs/UX11-HIBRIDO.md). Este é o último item do ciclo UX-07 a UX-11; publicação e testes físicos Android/iPhone/alertas continuam pendentes.
