# Gestão de treinos no Atlas Run

A página inicial apresenta o Atlas. Use **Entrar** para acessar `/entrar` e **Criar conta** para informar nome completo, e-mail, senha, repetição e área inicial. Confirme o e-mail antes de entrar. O app fica em `/app`; login e cadastro têm telas próprias. **Esqueci minha senha** abre a solicitação de link; a nova senha é definida pela página validada de recuperação. O envio externo do piloto está ativo; a configuração e os limites estão no guia EMAILS-PILOTO.md.

Uma conta pode usar as áreas **Atleta** e **Treinador**, com o mesmo e-mail, senha e histórico pessoal. Use **Trocar área**, acima da navegação, ou os botões de áreas no Perfil. A área **Admin dono** aparece somente para contas autorizadas. Contas já existentes com e-mails diferentes continuam separadas. Ao mudar permissões, sincronize os dados.

## Para o dono

1. Abra **Usuários**, busque por nome/e-mail e clique em **Ativar treinador** na conta desejada. Ela pode ter planos e registros de atleta: o histórico permanece. O e-mail precisa estar confirmado. Contas sem perfil aparecem com **Regularizar perfil**; não é necessário criar outro login.
2. Abra **Atletas**, busque pelo nome e escolha **Abrir atleta**.
3. Em **Treinadores responsáveis**, vincule o treinador. Ele poderá gerenciar somente os atletas vinculados.
4. Revogue o vínculo para retirar acesso a um atleta específico. Use **Desativar gestão** em **Usuários** para retirar o acesso de treinador, preservando sua área de atleta e o histórico. Só o dono reativa um acesso desativado. Uma pessoa que também é treinador pode receber planos de outro treinador.

## Para ativar sua segunda área

No **Perfil**, abra **Áreas da conta** e selecione **Ativar área de treinador**. A conta confirmada ganha uma área de gestão sem atletas vinculados; o dono precisa conceder os vínculos. Volte para **Atleta** em Trocar área para consultar e registrar seus treinos pessoais. Ativar treinador não concede admin nem acesso automático a planos de terceiros. O app guarda a última área escolhida; uma área desativada deixa de ser opção após sincronizar.

## Para dono e treinador

**Criar pela interface:** abra o atleta → Criar plano → preencha nome, metas opcionais, sessões e guia → Salvar rascunho → Revisar publicação → confirme o destinatário e publique.

**Importar:** abra o atleta → Importar CSV → confira o atleta → carregue o CSV UTF-8 → revise a lista/calendário, sessões e guia → edite se necessário → Salvar rascunho → Revisar publicação → publique. Arquivos inválidos não criam planos parciais. Consulte IMPORTACAO.md e modelo-plano.csv.

**Revisar:** abra um plano publicado → Criar revisão → faça as mudanças → salve e publique. A versão anterior é arquivada; suas sessões e atividades continuam no histórico. As atividades anteriores não são copiadas para a nova versão.

**Duplicar:** abra plano ou rascunho → Duplicar → escolha um atleta autorizado → edite → salve e publique. A cópia é um novo plano independente, sem registros de execução.

**Arquivar:** abra plano publicado → Arquivar plano → confirme. Ele continua no histórico do atleta. Novas atividades nesta versão ficam bloqueadas; o atleta pode corrigir registros que já existiam.

Rascunhos são visíveis somente à gestão autorizada. Publicação sempre usa a revisão salva no banco. Se outra pessoa alterar o rascunho, o app informa conflito; sincronize e abra a versão atual antes de continuar. Salve o rascunho antes de sair. Sair da edição com alterações não salvas exige confirmação de descarte.

## Para o atleta

Entre com sua conta, sincronize e escolha seu plano. O plano publicado mais recente aparece primeiro, com versões arquivadas identificadas como histórico. Registre cada atividade na sessão correspondente. Perfil e relato de execução pertencem à sua conta; o treinador não edita esses registros.

## Registrar ou editar uma atividade

Na sessão do treino, use **Registrar atividade** ou **Editar registro**. Confira a data, a versão do plano e o treino previsto. Escolha **Feito** (conforme previsto), **Adaptado** (com mudanças) ou **Não feito** (não realizou). A situação é obrigatória; os outros campos são opcionais. A prescrição não preenche os resultados por você. Distância e tempo aceitam vírgula ou ponto, por exemplo 3,5 km e 25,5 min.

**Esforço percebido** descreve quanto esforço a atividade exigiu como um todo. **Dor** registra a maior dor sentida durante a atividade, diferente de cansaço. Os seletores oferecem **Não informei** e números inteiros de 0 a 10; 0 só entra no registro se você escolher esse valor. **Entenda a escala** abre a explicação e a referência de cada uma: [intensidade — CDC](https://www.cdc.gov/physical-activity-basics/measuring/) e [escala numérica — Cleveland Clinic, p. 7](https://my.clevelandclinic.org/-/scassets/files/org/prepare-for-surgery/pacc-brochure-15-pai-2380.ashx?la=en#page=7). A ajuda organiza seu relato; não altera o treino.

Em **Não feito**, pode salvar só a situação, com um motivo opcional. Trocar a situação não apaga campos já preenchidos; confira os valores ao corrigir um relato. **Não informei** limpa uma escala; apagar distância/tempo deixa o campo vazio. Vazio e zero continuam diferentes no calendário e no acompanhamento. A recuperação anterior permanece disponível, inclusive em registros mais antigos.

**Salvar atividade** mostra Salvando enquanto confirma a gravação. Aguarde a confirmação antes de fechar. Erro de conexão mantém todos os campos e permite tentar novamente. Se a resposta se perdeu depois da gravação, a nova tentativa confere o registro existente e não cria outra atividade. Se houver uma edição diferente de outra aba/dispositivo, o app recusa a substituição e mantém o formulário: preserve o texto que quiser aproveitar, feche, sincronize e confira a versão atual. Não há salvamento automático ou fila offline.

**Fechar**, o botão de fechar do topo e **Escape** pedem descarte quando houver alterações. **Continuar editando** mantém o preenchimento; **Descartar e fechar** descarta só o formulário. Enquanto salva, os controles ficam bloqueados. Mudança de plano/área, sincronização, saída e fechamento da página respeitam o registro em andamento. O relato permanece separado dos comentários; a equipe consulta e comenta, e somente o atleta edita a atividade.

## Calendário e agenda

Na área de atleta, abra **Calendário**. **Mês** mostra os dias de segunda a domingo; o contorno destaca hoje e o fundo destaca o dia selecionado. Toque em um dia para abrir todas as suas sessões. Use as setas para mudar de mês, **Hoje** para voltar à data atual ou **Ir para um treino** para encontrar a próxima sessão (ou a última, se o plano terminou). Ao abrir um plano fora do período atual, o calendário começa perto de uma sessão; um mês vazio continua acessível. **Agenda** mantém a lista completa de todas as datas da versão selecionada.

Os filtros valem para o plano inteiro: **Todas**, **Realizadas** (feito + adaptado), **Sem registro** (sem relato, seja em data passada, hoje ou futura) e **Não feitas** (marcadas explicitamente pelo atleta). Símbolos e textos acompanham as cores. Um dia pode ter várias sessões com situações diferentes; nenhuma substitui a outra. Salvar uma atividade atualiza a situação mantendo mês, dia e filtro; se ela sair do filtro atual, use **Todas** para reencontrá-la. A seleção de plano identifica a versão e o histórico; registros de versões diferentes permanecem separados.

Na gestão, abra **Atletas → Abrir atleta → Ver calendário** em um plano, ou **Planos → Ver calendário**. A consulta usa o mesmo calendário e os mesmos filtros. **Ver relato e comentários** abre o acompanhamento da sessão; o botão **Calendário** retorna à seleção anterior. A equipe pode comentar pelo fluxo existente e consulta o relato em leitura. O treinador vê somente planos de atletas vinculados, com sua área pessoal separada.

## Meu perfil — todas as áreas

Abra **Perfil** na área de atleta ou **Meu perfil** na gestão. Edite nome, data de nascimento opcional e dias disponíveis; depois use **Salvar perfil**. Uma data futura não é aceita. O nome e a foto são os mesmos ao trocar de área, mantendo o histórico. **Escolher foto** aceita JPG, PNG ou WebP de até 8 MB e ajusta a imagem para um quadrado. **Remover foto** volta às iniciais. Sua data de nascimento é consultada e editada somente por você. A leitura da foto acompanha o acesso autorizado ao seu perfil.

Em **Acesso à conta**, **Alterar e-mail** exige sua senha atual e envia uma confirmação ao endereço atual e ao novo. Conclua os dois links; até lá, seu e-mail de login permanece o anterior. Use **Conferir confirmação do e-mail** para atualizar o estado. **Alterar senha** pede a senha atual, a nova e a repetição, com no mínimo oito caracteres. Se não lembrar a atual, use **Esqueci minha senha**. Preencha senhas diretamente no site, sem compartilhá-las. Salve ou descarte alterações antes de trocar de área, sincronizar ou sair. Dados pessoais e credenciais não concedem acesso de admin nem reativam um treinador desativado pelo dono.

## Acompanhamento — dono e treinador

Abra **Acompanhamento**, escolha atleta/plano, período e situação e clique em **Aplicar filtros**. Também pode abrir pelo detalhe do atleta ou do plano. O resumo compara valores prescritos e realizados por semana; valores não informados permanecem vazios. **Sem registro em data passada** indica ausência de relato em uma sessão anterior a hoje. Pendências de hoje, futuras e atividades marcadas como **não feito** têm situações próprias.

Versões arquivadas ficam fora dos totais por padrão. Escolha um plano histórico ou marque **Incluir versões arquivadas nos totais** para consultá-las. Registros e comentários permanecem ligados à versão original.

Clique em **Ver relato e comentários** para consultar esforço, dor, recuperação e observações. O relato é somente leitura para a equipe. Escreva em **Adicionar comentário para o atleta** e envie. O atleta verá o comentário ao sincronizar; nome do autor, papel e data são registrados pelo banco. Comentários ficam no histórico; para corrigir uma mensagem, acrescente outra. Falha de rede mantém o texto e permite tentar novamente sem duplicar a mesma mensagem. Salve ou descarte o texto antes de sair/sincronizar.

O atleta vê comentários em **Treino**, **Calendário** e **Evolução**, inclusive quando a sessão ainda não tem relato, e pode exportá-los junto com seus dados. Seus registros só podem ser editados por ele; o admin dono e treinadores ativos vinculados podem consultá-los. O resumo organiza as informações relatadas, sem avaliar clinicamente ou mudar a prescrição.

UX-02 entregue em 14/10/2026: landing, acesso separado, escolha inicial de área e recuperação. SMTP Brevo próprio ativo, com modelos em português; e-mails reais de confirmação e recuperação entregues e links validados pelo dono, incluindo entrada de nova conta como treinador. O remetente do piloto usa domínio técnico `brevosend.com`. A área inicial de treinador abre sem atletas vinculados e não permite consultar planos/relatos de terceiros. A conta que já tem histórico mantém sua última área ao entrar novamente. A matriz completa entre contas e dispositivos permanece em UX-06.

## Ajuda e sessão entre abas

A página [Ajuda](/ajuda) reúne orientações de conta, recuperação, áreas, planos, calendário e registro. No piloto, procure o treinador ou o administrador responsável pelo acesso, informando tela, ação, horário aproximado e dispositivo. Não envie senhas, códigos ou links de acesso.

Ao sair ou trocar de conta em outra aba do mesmo navegador, as telas privadas anteriores são encerradas, incluindo formulários não salvos. Salve antes de sair. A renovação de acesso da mesma pessoa mantém o formulário em andamento. O encerramento entre abas não equivale a apagar imediatamente a tela de outro dispositivo.

Planos cujo nome começa com **PILOTO UX-06** contêm somente sessões fictícias de teste do app, sem prescrição de exercícios. Escolha o plano correto antes de registrar; planos e atividades reais continuam separados. UX-06 foi concluída para o piloto por aceite do dono em 15/10/2026. A demora na troca de área ficou registrada como melhoria posterior.
