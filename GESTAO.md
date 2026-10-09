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

O acompanhamento dos relatos pelo treinador e os convites para novos usuários serão adicionados em etapas posteriores.
