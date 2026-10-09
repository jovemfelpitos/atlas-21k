# Gestão de treinos no Atlas Run

Atleta, treinador e admin dono usam contas separadas. A área correta aparece automaticamente depois de entrar. Ao mudar permissões, sincronize os dados ou entre novamente.

## Para o dono

1. Abra **Equipe** para conceder acesso de treinador a uma conta já cadastrada. A conta deve ter entrado uma vez no app e não pode ter planos de atleta.
2. Abra **Atletas**, busque pelo nome e escolha **Abrir atleta**.
3. Em **Treinadores responsáveis**, vincule o treinador. Ele poderá gerenciar somente os atletas vinculados.
4. Revogue o vínculo para retirar acesso a um atleta específico. Desative o treinador em **Equipe** para retirar todo o acesso de gestão, preservando o histórico.

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

Convites e SMTP para novos usuários ficam no ciclo de expansão.
