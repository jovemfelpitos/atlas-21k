# UX-06 — piloto e decisão de lançamento

**Status em 14/10/2026: em validação.** Correções e verificações técnicas implementadas; aceite final depende dos testes reais abaixo. O roteiro enviado ao dono ainda aguarda retorno. Não há liberação de lançamento geral ou de cobrança automática neste documento.

## Entrega técnica

- Saída e troca de conta em outra aba encerram a tela privada anterior, removem dados carregados, fotos em memória e formulários não salvos. Requisições pendentes são canceladas; respostas atrasadas não restauram a sessão anterior nem apagam uma sessão nova.
- Renovar a sessão da mesma pessoa em outra aba mantém o formulário em andamento. A tela de acesso explica quando a conta mudou.
- A gestão encerrada ignora importações de arquivo que terminem depois da saída, evitando reconstruir uma prescrição na tela anterior. A regressão reproduziu o problema antes da correção.
- Ajuda pública em `/ajuda`, acessível pela apresentação, acesso e app: primeiros passos, áreas da conta, recuperação, calendário, registro, conexão e orientação de suporte pelo treinador/administrador da operação.
- Nenhuma migração, serviço pago, nova dependência ou integração comercial.

## Evidências e limites

| Verificação | Resultado | Alcance |
|---|---|---|
| Suíte local completa | 74 testes | PostgreSQL local e interfaces com respostas controladas; não equivale a login real em dois dispositivos. |
| Banco remoto, `tests/pilot-remote.sql` | 7 verificações aprovadas; transação revertida | Contexto `authenticated` e IDs de contas existentes; não cria sessões Auth ou usuários. |
| Isolamento entre atletas | Aprovado no banco remoto | Atleta independente não lê/edita plano ou relato alheio; autopromoção a dono bloqueada. |
| Treinadores e dono | Aprovado no banco remoto | Treinador sem vínculo não lê/comenta terceiros; treinador vinculado consulta/comenta, sem editar relato; dono também não edita relato alheio. |
| Revogação/desativação | Aprovado no banco remoto | Retira gestão, preserva área/histórico pessoal do treinador; nenhuma alteração de acesso persistiu. |
| Publicação e versões | Aprovado no banco remoto | Destinatário e versão corretos, histórico anterior conservado e registros não reutilizados na revisão. |
| Duas abas no navegador local | Aprovado com dados fictícios | Renovação mantém texto; troca de conta e saída removem a tela privada com formulário aberto. Testes também cobrem respostas atrasadas de gravação/renovação/logout. |
| Ajuda responsiva | Conferida em 320/390/768 px e desktop | Sem rolagem horizontal; expansão de recuperação conferida. Não substitui um celular físico. |
| Cadastro externo, confirmação e recuperação | Validados pelo dono em UX-02 | Dono confirmou os dois links e a entrada como treinador. E-mails reais da nova troca de endereço seguem pendentes. |

O script remoto está coberto por `tests/pilot-database.test.js`, que executa o mesmo arquivo sobre o esquema local e verifica o rollback. O advisor remoto não apontou alerta novo; permanece a proteção contra senhas vazadas desativada, dependente de plano Pro. Não houve contratação. [Documentação do Supabase](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

A limpeza entre abas aplica-se ao mesmo navegador/origem. Sair não promete apagar imediatamente a tela de outro dispositivo: o serviço revoga sessões de renovação, enquanto tokens de acesso já emitidos podem continuar válidos até expirar. [Comportamento de saída do Supabase](https://supabase.com/docs/guides/auth/signout). O app não oferece fila offline ou salvamento automático de formulários.

## Conservação e preparação do teste real

Antes dos testes: cinco contas/perfis, quatro e-mails confirmados, um dono, dois treinadores ativos e nenhum vínculo ativo. O plano original estava publicado, com **39 sessões e dois registros**. O segundo registro já existia no início da UX-06; não foi criado por esta sprint.

O dono autorizou duas contas a receber planos fictícios. Foram criados pelos comandos existentes de salvar/publicar, sob o contexto autorizado do dono:

| Identificação | Plano | Sessões | Uso |
|---|---|---|---|
| Atleta A | `PILOTO UX-06 · Atleta A · teste` | 3 | Conta que já tem o plano original; selecionar explicitamente o plano do piloto. |
| Atleta B | `PILOTO UX-06 · Atleta B · teste` | 3 | Conta confirmada de treinador, que também usa a área Atleta. |

Cada plano tem duas sessões em 14/10 e uma em 15/10/2026. As descrições identificam o teste e não prescrevem exercícios. São planos independentes (`base_plan = null`): não arquivam nem revisam o plano original. A verificação após publicar confirmou o original ainda publicado com 39 sessões/dois registros, mais dois planos de teste com seis sessões e nenhum relato fictício criado pelo agente.

Nenhum vínculo de treinador foi criado. Vincular o treinador B ao atleta A daria acesso também ao histórico real de A, pois a autorização é por atleta, não por plano. Essa ampliação precisa de uma escolha explícita do dono; ela não está incluída na autorização para adicionar planos fictícios. O teste positivo com treinador vinculado passou na transação revertida, mas seu aceite com login real permanece aberto.

E-mails e identificadores das contas não são registrados neste documento. Não pedir senhas, códigos ou links de acesso para preencher a matriz.

## Roteiro real e critérios de encerramento

| Tarefa | Resultado esperado | Status |
|---|---|---|
| Atleta A no celular | Selecionar o plano do piloto; salvar primeira sessão como Feito com dor 0; segunda continua sem relato. Plano e registros originais permanecem. | Aguardando dono |
| Atleta B no computador | Área Atleta mostra plano B e não o A; salvar primeira sessão como Não feito, números vazios. | Aguardando dono |
| B troca Atleta → Treinador → Atleta | Mesmo login/perfil; gestão vazia sem vínculos; relato pessoal preservado ao voltar. | Aguardando dono |
| Dono abre os dois planos/relatos | Destinatários certos; consulta sem edição da execução alheia. | Aguardando dono |
| Mesma conta em celular e computador | Após sincronizar, o relato aparece no outro dispositivo; edição concorrente não substitui silenciosamente a versão mais recente. | Pendente |
| Sessão e conexão em uso real | Saída em outra aba pede novo acesso; conexão interrompida informa falha, mantém formulário na página e permite tentar novamente. | Pendente |
| Calendário, histórico e perfil | Duas sessões distintas no mesmo dia; navegar a mês vazio/Hoje; abrir original/histórico sem misturar registros; salvar dados pessoais/foto na conta de teste e conferir no outro dispositivo. | Pendente |
| Troca real de credenciais | Na conta de teste, alterar senha diretamente no site e testar novo acesso; alterar e-mail para outro endereço controlado, confirmar os dois e-mails e conferir manutenção da identidade/histórico. | Pendente; ação direta do dono |
| Treinador vinculado com login real | Publicar/revisar/comentar somente para atleta autorizado, conferir retorno como atleta e revogar acesso sem perda de histórico. | Pendente; escolher vínculo sem expor histórico real sem autorização |

Registrar dispositivo/navegador, tarefa, resultado e erro observado; não anexar credenciais ou relatos pessoais. Após o retorno, conferir somente os planos identificados do piloto no banco e atualizar esta matriz. Quando os testes terminarem, os planos podem ser arquivados pelo fluxo do app, preservando o histórico de teste; não apagar dados reais ou testados silenciosamente.

**Para encerrar UX-06:** obter evidências dos fluxos principais em celular/computador e resolver qualquer bloqueio de acesso, recuperação, conservação de histórico, autorização ou destinatário de publicação. As lacunas acima impedem declarar o piloto integralmente aprovado. Nenhum desses resultados será inferido a partir de testes locais.

## Recomendação para as antigas sprints 5, 6 e 7

| Sprint | Recomendação atual | Gatilho para executar |
|---|---|---|
| 5 — Biblioteca e produtividade | **Adiar.** Criar, importar, revisar e duplicar já atendem ao piloto. | Uso real mostrar repetição frequente; começar pelo modelo/duplicação que economize trabalho mensurável. |
| 6 — Vários usuários e equipes | **Reduzir ao piloto da operação atual.** SMTP, recuperação e testes de permissões foram antecipados. Manter vínculos administrados pelo dono e concluir a matriz/rotina de suporte. | Antes de atender assessorias independentes, executar isolamento por equipe, convites, limites, monitoramento e recuperação operacional com ensaio de restauração. Isso ainda não está entregue. |
| 7 — Planos comerciais e cobrança | **Adiar.** Não automatizar cobrança neste ciclo. | Definir quem paga, oferta, limites e regras de cancelamento; concluir validação de uso antes de integrar pagamentos. |

Esta é a recomendação técnica provisória. Rever após o retorno do piloto. Não há necessidade de implementar as três sprints antigas como um pacote obrigatório para testar a operação atual; expansão para negócios independentes e venda automatizada têm requisitos adicionais.

## Limites de operação e suporte

- Piloto de uma operação administrada pelo dono. Cadastro de treinador não cria equipe independente ou autoriza consultar outros usuários.
- Conta sem plano precisa de publicação pela gestão; treinador sem vínculo precisa da atuação do dono. Relatos pertencem ao atleta.
- Ajuda e triagem disponíveis em `/ajuda`. O responsável operacional é o dono, com apoio do treinador da pessoa. Canal público específico de suporte ainda não foi definido; nenhum endereço pessoal foi publicado como central.
- Exportação existente ajuda a preservar uma cópia do histórico do atleta. Uma rotina completa de backup/restauração do serviço e seu ensaio não foram implementados nem comprovados nesta sprint; são requisitos antes da expansão operacional.
- Remetente do piloto ainda usa domínio técnico do provedor; domínio próprio/comunicação comercial e modelo pagante não estão definidos.
- Falhas de credenciais devem ser resolvidas pelo fluxo de recuperação. Não desativar confirmação, fornecer credencial administrativa ao navegador ou ampliar vínculos para contornar um teste.
