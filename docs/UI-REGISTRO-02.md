# Atlas Run — registro dinâmico e acabamento mobile

Implementado inicialmente de forma local em 16/10/2026 após aprovação da proposta interativa. A identidade aprovada e seus arquivos oficiais foram preservados. A publicação e a configuração remota autorizadas posteriormente são registradas em [UX07-PUBLICACAO.md](UX07-PUBLICACAO.md); as evidências abaixo correspondem à preparação local.

## Registro de atividade

- Situação com três botões: Feito, Adaptado e Não feito. Registros novos começam sem resposta selecionada.
- Distância com edição decimal, ajustes exatos de 100 m e ação de limpar. Vírgula/ponto, distância opcional e zero explícito continuam válidos.
- Duração com horas/minutos/segundos. Depois de escolher uma parte, as demais ficam em zero; limpar remove a duração inteira. O campo persistido continua sendo `minutes`.
- Pace médio calculado durante o preenchimento, em min/km, somente quando distância e duração são válidas e positivas. Não é salvo como campo duplicado nem calculado para Não feito.
- Não feito recolhe métricas/sensações e oferece revisão, sem apagar valores. Sessões só com duração funcionam sem quilômetros obrigatórios.
- Prescrição, escalas e informações de consulta ficam recolhidas. Os erros aparecem junto ao campo e recebem foco apropriado.
- No celular, o diálogo ocupa a tela, com cabeçalho e ações separados do conteúdo rolável. `visualViewport` adapta a altura ao teclado; listeners são removidos ao fechar. O fundo não rola durante o registro.

Abrir e salvar um relato antigo sem editar sua duração conserva a precisão original, inclusive minutos fracionários e representação científica. A apresentação trata a passagem de segundos/minutos sem produzir uma opção inexistente “60”. O arredondamento visual não reescreve o valor armazenado.

`persistActivity`, validação, identidade da sessão, concorrência, confirmação após resposta perdida e recuperação de campos após falha foram mantidos. O rascunho continua protegido contra navegação, Escape, sincronização, troca de plano/área e saída da conta.

## Acabamento do aplicativo

O seletor de área só aparece quando existem áreas alternativas. O título do Calendário e o título de Evolução deixam de se repetir. A explicação sobre consulta de registros fica no Perfil e no apoio contextual do editor, sem repetição no fim de cada seção.

Calendário, Perfil e gestão reutilizam os componentes existentes. O novo parâmetro `showHeading` do calendário só remove o título interno no app atleta, onde já há um h1; os demais usos mantêm seu título.

## Alertas opcionais

O Perfil reúne ativação da conta, categorias, horário/fuso e adesão de cada aparelho. Inclui lembrete do treino, novo plano, comentário do treinador e resumo diário para treinador. O código contém configuração pública mínima, service worker sem cache de dados privados, migration aditiva e envio real por Web Push com fila e revalidação de autorização.

O envio permanece desligado até a configuração das chaves, aplicação da migration e publicação. A interface reconhece essa indisponibilidade e recolhe os controles. Instalação e entrega física em Android/iPhone fazem parte da ativação, não foram simuladas como entrega real. Veja [ALERTAS.md](ALERTAS.md) para contrato, variáveis, regras e limites.

Notificações recebidas não substituem o conteúdo nem navegam uma aba com formulário aberto. Oferecem uma ação explícita que passa pelos mesmos bloqueios de rascunho. O resumo de treinador conduz ao Acompanhamento, com checagem atual da área permitida.

## Verificação

- `npm test`: 118/118 testes locais de interface, atividade, cliente/service worker, banco e transporte de alertas aprovados.
- Build explícito: 72 arquivos públicos. Servidor, migration, testes e documentação ficam fora de `dist`.
- Conferência em navegador com respostas e dados fictícios, sem permissão real ou chamada aos serviços de push: 320, 390, 768 e 1280 px; sem rolagem horizontal nos cenários conferidos.
- Registro de corrida com pace (5 km / 30 min = 6:00; 30 min 15 s = 6:03), sessão de força só com duração, salvamento/edição e preferências de alertas com permissão simulada.
- Testes de precisão antiga, zero/ausência, limpeza, foco, teclado simulado, falhas de rede, formulário pendente e troca de conta. Aparelhos físicos e entrega efetiva permanecem pendentes da ativação.

Prévia local: `http://127.0.0.1:4175/`. Seus arquivos ficam em `.artifacts/activity-preview/`, ignorados e fora da distribuição. O mock de notificações substitui as APIs de permissão e envio; não pede permissão ao navegador nem envia mensagens. Capturas: `.artifacts/registro-mobile-390.jpg`, `.artifacts/registro-mobile-320.jpg` e `.artifacts/registro-desktop.jpg`.
