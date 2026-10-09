# Atlas Run — sprints 0 a 3

Decisão de produto, 09/10/2026: três perfis exclusivos por conta — atleta, treinador e admin dono. A conta de treino do dono continua atleta; a administração usa uma conta separada.

## Sprint 0: contrato e fluxos

- Atleta consulta planos publicados e históricos, registra somente sua execução e edita seu perfil.
- Treinador ativo consulta perfis e planos somente dos atletas vinculados, cria/importa rascunhos, revisa, publica, duplica e arquiva planos desses atletas. Registros pessoais de execução ficam para a sprint 4.
- Admin dono gerencia todos os atletas, treinadores e vínculos, além dos planos. O acesso inicial de dono é provisionado exclusivamente no banco, nunca por autoinscrição.
- Navegação de gestão: Visão geral → Atletas → Planos → Meu perfil; dono também tem Equipe.
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
| Ler relato pessoal de atividade | próprio | sprint 4 | sprint 4 |
| Conceder papel dono | não | não | provisionamento no banco |

## Aceite e revisão

Testes de PostgreSQL cobrem separação entre treinadores, vínculo revogado, autoelevação negada, rascunhos invisíveis, importação atômica, concorrência, versões e preservação de registros. Testes de interface cobrem importação, edição, confirmação de publicação, erros e navegação por perfil. O upgrade do banco foi aplicado e a conta separada de dono informada pelo usuário foi confirmada e ativada. A interface segue o fluxo de publicação por Git/Netlify depois da revisão. Testes locais cobrem a matriz; a leitura sob o papel real do dono foi verificada no banco remoto. A suíte completa de fixtures remotas não foi concluída pelo conector; a tentativa não deixou fixtures persistidas.

Fora deste ciclo: acompanhamento/relatos pelo treinador, biblioteca de modelos, múltiplas equipes, convites por e-mail, assinatura e cobrança. Plano comercial e plano de treino continuam conceitos separados.
