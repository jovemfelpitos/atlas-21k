# Gestão de treinos no Atlas Run

A página inicial apresenta o Atlas. Use **Entrar** para acessar `/entrar` e **Criar conta** para informar nome completo, e-mail, senha, repetição e área inicial. Confirme o e-mail antes de entrar. O app fica em `/app`; login e cadastro têm telas próprias. **Esqueci minha senha** abre a solicitação de link; a nova senha é definida pela página validada de recuperação. A configuração de envio externo está no guia EMAILS-PILOTO.md e precisa ser concluída para esses e-mails funcionarem para todos os destinatários.

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

## Acompanhamento — dono e treinador

Abra **Acompanhamento**, escolha atleta/plano, período e situação e clique em **Aplicar filtros**. Também pode abrir pelo detalhe do atleta ou do plano. O resumo compara valores prescritos e realizados por semana; valores não informados permanecem vazios. **Sem registro em data passada** indica ausência de relato em uma sessão anterior a hoje. Pendências de hoje, futuras e atividades marcadas como **não feito** têm situações próprias.

Versões arquivadas ficam fora dos totais por padrão. Escolha um plano histórico ou marque **Incluir versões arquivadas nos totais** para consultá-las. Registros e comentários permanecem ligados à versão original.

Clique em **Ver relato e comentários** para consultar esforço, dor, recuperação e observações. O relato é somente leitura para a equipe. Escreva em **Adicionar comentário para o atleta** e envie. O atleta verá o comentário ao sincronizar; nome do autor, papel e data são registrados pelo banco. Comentários ficam no histórico; para corrigir uma mensagem, acrescente outra. Falha de rede mantém o texto e permite tentar novamente sem duplicar a mesma mensagem. Salve ou descarte o texto antes de sair/sincronizar.

O atleta vê comentários em **Treino**, **Calendário** e **Evolução**, inclusive quando a sessão ainda não tem relato, e pode exportá-los junto com seus dados. Seus registros só podem ser editados por ele; o admin dono e treinadores ativos vinculados podem consultá-los. O resumo organiza as informações relatadas, sem avaliar clinicamente ou mudar a prescrição.

Landing, acesso separado, escolha inicial de área e recuperação foram implementados em UX-02. O SMTP padrão atual continua limitado aos endereços autorizados da organização; SMTP próprio e a validação de entrega estão pendentes. A área inicial de treinador abre sem atletas vinculados. A conta que já tem histórico mantém sua última área ao entrar novamente.
