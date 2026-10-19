# UX-10 — treinador no celular

Execução autorizada em 19/10/2026, uma sprint por vez. Escopo: simplificar atletas, sessões, comentários, revisão e publicação nos componentes existentes, preservando vínculos e versões.

## Entrega

- Navegação da gestão visível no mobile, em duas colunas, com indicação da seção ativa também no detalhe do atleta, plano, importação e editor. Usuários permanece exclusivo do dono. Cabeçalho/área de conta e componentes comuns permanecem existentes.
- Busca de atletas atualiza apenas resultados/contagem, preservando o campo e a navegação. Atalho Acompanhar abre a seleção daquele atleta, sem uma etapa intermediária.
- Acompanhamento mostra seleção aplicada, resumo compacto e sessões primeiro. Filtros e resumo semanal completo podem ser expandidos. Não remove campos de filtro, cálculos ou histórico.
- Sessões aparecem em páginas locais de 12 itens. Todas as linhas já lidas e autorizadas continuam no cálculo; isto não substitui a paginação de 500 do servidor nem corta totais. Voltar de um relato mantém a página; aplicar/limpar filtros ou abrir outro atleta/plano reinicia a página. Abertura e comentário continuam usando a identidade completa atleta/plano/sessão.
- Relato continua somente leitura para a equipe. Atalho Comentar nesta sessão leva ao formulário existente. Confirmação de envio e erros recebem foco, preservando rascunho e identificação do comentário nas tentativas de reenvio.
- Editor permite ir direto à sessão e abre/foca uma sessão recém-adicionada. Identificação de importação continua disponível em uma seção expansível; seus valores são mantidos. Campos não salvos são capturados antes de alternar sessão/prévia ou adicionar/remover itens.
- Prévia completa é expansível e recebe os campos atuais ao abrir; Lista e Calendário continuam disponíveis. Salvar e Revisar publicação ficam acessíveis durante edição/prévia, em uma barra compacta com espaço para área segura do aparelho.
- Revisão final mantém destinatário, sessões e guia completos, com diálogo identificado e confirmação acessível. Publicação continua exigindo rascunho salvo, revisão esperada e confirmação explícita; conflitos mantêm o diálogo recuperável. Fechar uma confirmação não fecha um novo diálogo aberto por sua ação.

## Conservação

Mudanças de execução limitadas a `management.js` e `management.css`. Nenhuma dependência, rota, RPC, consulta, migration, política, credencial ou configuração de alertas adicionada/alterada. Dados reais não foram modificados na validação.

Mantidos filtros de atletas vinculados, separação da área pessoal do treinador, leitura paginada completa, contas/usuários exclusivos do dono, importação CSV, rascunhos, publicação por revisão esperada, arquivamento e versões anteriores. A equipe não recebe controles para editar atividades do atleta. Proteção de rascunhos/comentários, reenvio idempotente, encerramento da área e recusa de respostas após destroy continuam ativos.

Símbolo, logotipos, fontes, cores oficiais, landing e Evolução do atleta preservados. O campo Musculação existente permanece; exercícios/séries/cargas serão tratados na UX-11.

## Validação

- **147/147 testes aprovados**, incluindo quatro novos de interação da gestão. Build de **74 arquivos públicos**, sem arquivos internos/fixtures. `node --check management.js` e `git diff --check` aprovados.
- Busca sem substituir campo/navegação, atalho por atleta, seção ativa/foco, páginas com 25 sessões e totais completos, comentário da sessão exata da última página, retorno à página e reinício após filtro.
- Troca de sessão, adição/remoção e prévia com campos não salvos; IDs preservados, zero distinto de vazio, conteúdo autoral escapado e plano publicado preservado durante edição do rascunho.
- Diálogo identificado, revisão de todo o conteúdo, ausência de publicação antecipada e recuperação de conflito com controles reabilitados. Suítes existentes de banco/RLS, alertas, atleta, calendário, importação e histórico continuam aprovadas.
- Navegador local com dados fictícios: Visão geral, Atletas, Acompanhamento e editor em 320/390/768/1280 px, sem rolagem horizontal nos cenários conferidos; todas as abas dentro da largura, com toque de pelo menos 46 px. Campos mobile em 16 px. Salvar/revisar acessíveis no editor/prévia; confirmação visível na revisão de 15 sessões em 390 px.
- Fluxo fictício conferido: atleta → acompanhamento → segunda página → comentário; editar rascunho → trocar sessão → conferir prévia → salvar → revisar → publicar. Navegação de seis seções do dono também conferida em 390 px. Nenhuma publicação/comentário de teste foi enviado ao banco real.

Evidências locais ignoradas: `.artifacts/ux10-tests.tap`, `.artifacts/ux10-layouts.json`, `.artifacts/ux10-treinador-mobile.png`. A prévia usa mocks locais; não substitui uso autenticado ou teclado/instalação/push em Android/iPhone físicos. O aceite físico dos alertas da UX-07 continua pendente.

## Publicação

Implementação pronta para preview pela integração Git existente. Registrar PR, commit/deploy e conferência pública após publicação. Próxima sprint: **UX-11 — corrida + musculação**.
