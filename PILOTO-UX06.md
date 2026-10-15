# UX-06 — piloto e decisão de lançamento

**Status em 15/10/2026: concluída para o piloto, por aceite do dono.** Além dos passos A/B/dono e troca de área já aprovados, o dono confirmou alteração de senha com sucesso no computador e no celular e solicitou encerrar a sprint. A demora na troca de área foi aceita como melhoria posterior. Os testes complementares não realizados foram transferidos ao backlog, sem serem marcados como aprovados. O encerramento se aplica à operação atual do piloto; não representa validação de equipes independentes ou cobrança automática.

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

Nenhum vínculo de treinador foi criado. Vincular o treinador B ao atleta A daria acesso também ao histórico real de A, pois a autorização é por atleta, não por plano. Essa ampliação precisa de uma escolha explícita do dono; ela não está incluída na autorização para adicionar planos fictícios. O teste positivo com treinador vinculado passou na transação revertida, e seu teste com login real foi transferido ao backlog no encerramento.

E-mails e identificadores das contas não são registrados neste documento. Não pedir senhas, códigos ou links de acesso para preencher a matriz.

## Retorno real em 15/10/2026

No primeiro retorno, o dono informou: “Tudo funcionou nos passos A, B e dono; não testei os extras”. Isso confirmou o uso básico, isolamento visual entre as contas, troca de área e consulta do dono. Depois, confirmou alteração de senha com sucesso no computador e no celular e pediu o encerramento da sprint. Não relatou testes de alteração de e-mail, sincronização da mesma conta em dois dispositivos, conflito concorrente, falha de conexão ou fluxo de treinador vinculado.

Consulta somente leitura confirmou os dois planos publicados com três sessões e um relato cada. Atleta A: `ux06-registro-1`, Adaptado, campos numéricos vazios. Atleta B: `ux06-futuro` (sessão de 15/10, agora no dia corrente), Feito, campos numéricos vazios. A segunda sessão de 14/10 segue sem relato nos dois planos. Portanto, registrar dor zero e Não feito continuam sem evidência de uso real nesta rodada, embora cobertos pelas verificações técnicas anteriores.

O plano original continua publicado com 39 sessões; a contagem atual é de três relatos, em comparação aos dois do início da UX-06. Nenhum relato foi criado, editado ou apagado pelo agente nesta conferência. A consulta não permite atribuir a finalidade desse terceiro relato; ele foi preservado. Os dois relatos do piloto ficam em seus próprios planos e não foram somados ao histórico original. Nenhum vínculo ativo, arquivamento ou mudança de permissão foi feito nesta rodada.

## Matriz final de validação

| Tarefa | Resultado esperado | Status |
|---|---|---|
| Atleta A no celular | Abrir seu plano e salvar relato; caso específico de Feito com dor 0 previsto no roteiro. | Uso básico aprovado pelo dono em 15/10. Banco: primeira sessão como Adaptado, números vazios, segunda sem relato. Feito com dor 0 não foi comprovado nesta rodada; complemento no backlog. |
| Atleta B no computador | Área Atleta mostra plano B e não o A; caso específico de Não feito previsto no roteiro. | Uso básico/isolamento aprovados pelo dono em 15/10. Banco: sessão de 15/10 como Feito, números vazios. Não feito não foi comprovado nesta rodada; complemento no backlog. |
| B troca Atleta → Treinador → Atleta | Mesmo login/perfil; gestão vazia sem vínculos; relato pessoal preservado ao voltar. | Aprovado pelo dono em 15/10; banco sem vínculos ativos na consulta anterior. Demora nos dois sentidos relatada e aceita para melhoria posterior. |
| Dono abre os dois planos/relatos | Destinatários certos; consulta sem edição da execução alheia. | Aprovado pelo dono em 15/10; dois relatos persistidos, um em cada plano. |
| Mesma conta em celular e computador | Após sincronizar, o relato aparece no outro dispositivo; edição concorrente não substitui silenciosamente a versão mais recente. | Não realizado em uso real; transferido ao backlog por aceite do dono. |
| Sessão e conexão em uso real | Saída em outra aba pede novo acesso; conexão interrompida informa falha, mantém formulário na página e permite tentar novamente. | Não realizado em uso real; transferido ao backlog por aceite do dono. |
| Calendário, histórico e perfil | Duas sessões distintas no mesmo dia; navegar a mês vazio/Hoje; abrir original/histórico sem misturar registros; salvar dados pessoais/foto na conta de teste e conferir no outro dispositivo. | Não realizado em uso real; transferido ao backlog por aceite do dono. |
| Troca real de senha | Alterar senha diretamente no site e confirmar funcionamento no computador e celular. | Aprovado pelo dono em 15/10; informou sucesso nos dois dispositivos. Sem acesso do agente às senhas. |
| Troca real de e-mail | Outro endereço controlado, confirmação dos dois e-mails e manutenção da identidade/histórico. | Não relatado; transferido ao backlog. Não inferir aprovação a partir da troca de senha. |
| Treinador vinculado com login real | Publicar/revisar/comentar somente para atleta autorizado, conferir retorno como atleta e revogar acesso sem perda de histórico. | Não realizado com login real; backlog. Escolher vínculo sem expor histórico real sem autorização. |

Registrar dispositivo/navegador, tarefa, resultado e erro observado; não anexar credenciais ou relatos pessoais. Retorno básico conferido em 15/10, seguido do aceite de encerramento. Em novas rodadas, consultar somente os campos necessários dos planos identificados e atualizar as evidências. Quando os testes terminarem, os planos podem ser arquivados pelo fluxo do app, preservando o histórico de teste; não apagar dados reais ou testados silenciosamente.

## Encerramento e melhorias posteriores

**Aceite em 15/10/2026:** o dono solicitou concluir a sprint após validar os fluxos básicos e a alteração de senha no computador/celular. Os critérios adicionais de teste manual foram retirados do bloqueio de encerramento por essa decisão explícita e mantidos no backlog. A sprint está concluída para o piloto da operação atual; a matriz distingue o que passou em uso real, o que foi validado tecnicamente e o que não foi executado.

**Demora ao trocar Atleta ↔ Treinador:** observada pelo dono nos dois sentidos, sem duração medida. A leitura de `app.js` confirma que o app salva a preferência e recarrega contexto de acesso, perfil e dados da área; `management.js` também consulta as coleções da gestão. Esse trabalho pode contribuir para a demora. Não foram medidos tempos de rede/consulta e não há evidência para atribuir a causa ao servidor, ao plano contratado ou à região.

Backlog após o encerramento:

- Medir a troca de área no celular/computador, separar tempo de rede, consultas e renderização e otimizar as etapas necessárias. Preservar a atualização de permissões e melhorar a indicação de carregamento se a medição apontar necessidade. Não foi feita alteração de desempenho nesta rodada.
- Complementar os testes reais de sincronização/conflito, falha de sessão/rede, perfil/calendário/histórico e alteração de e-mail. Cobrir também os casos específicos de dor zero e Não feito.
- Validar publicação/revisão/comentário e revogação com treinador vinculado em contas autorizadas; a cobertura técnica anterior permanece registrada, sem substituir esse teste manual.

Os planos fictícios foram preservados; encerramento da sprint não autoriza apagar registros, conceder vínculos ou alterar contas. Nenhum teste pendente é apresentado como executado.

## Priorização das antigas sprints 5, 6 e 7 no encerramento

| Sprint | Recomendação atual | Gatilho para executar |
|---|---|---|
| 5 — Biblioteca e produtividade | **Adiar.** Criar, importar, revisar e duplicar já atendem ao piloto. | Uso real mostrar repetição frequente; começar pelo modelo/duplicação que economize trabalho mensurável. |
| 6 — Vários usuários e equipes | **Reduzir ao piloto da operação atual.** SMTP, recuperação e testes de permissões foram antecipados. Manter vínculos administrados pelo dono, suporte do piloto e backlog de validação documentado. | Antes de atender assessorias independentes, executar isolamento por equipe, convites, limites, monitoramento e recuperação operacional com ensaio de restauração. Isso ainda não está entregue. |
| 7 — Planos comerciais e cobrança | **Adiar.** Não automatizar cobrança neste ciclo. | Definir quem paga, oferta, limites e regras de cancelamento; concluir validação de uso antes de integrar pagamentos. |

Direção mantida no encerramento de 15/10: adiar biblioteca e cobrança, reduzir equipes à operação atual e rever a prioridade conforme o uso do piloto. A demora da troca de área entra como melhoria anterior à expansão. Não há necessidade de implementar as três sprints antigas como um pacote obrigatório para testar a operação atual; expansão para negócios independentes e venda automatizada têm requisitos adicionais.

## Limites de operação e suporte

- Piloto de uma operação administrada pelo dono. Cadastro de treinador não cria equipe independente ou autoriza consultar outros usuários.
- Conta sem plano precisa de publicação pela gestão; treinador sem vínculo precisa da atuação do dono. Relatos pertencem ao atleta.
- Ajuda e triagem disponíveis em `/ajuda`. O responsável operacional é o dono, com apoio do treinador da pessoa. Canal público específico de suporte ainda não foi definido; nenhum endereço pessoal foi publicado como central.
- Exportação existente ajuda a preservar uma cópia do histórico do atleta. Uma rotina completa de backup/restauração do serviço e seu ensaio não foram implementados nem comprovados nesta sprint; são requisitos antes da expansão operacional.
- Remetente do piloto ainda usa domínio técnico do provedor; domínio próprio/comunicação comercial e modelo pagante não estão definidos.
- Falhas de credenciais devem ser resolvidas pelo fluxo de recuperação. Não desativar confirmação, fornecer credencial administrativa ao navegador ou ampliar vínculos para contornar um teste.
