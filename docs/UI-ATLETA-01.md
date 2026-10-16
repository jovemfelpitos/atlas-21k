# Atlas Run — primeira rodada de organização da interface

Implementação local autorizada em 15/10/2026 após a proposta de compactar o topo, organizar o cartão Treino e melhorar a navegação no celular. A identidade e os logotipos aprovados foram reaproveitados. Não houve publicação nem alteração de banco, permissões, dados de usuários ou regras de acesso.

## Resultado

- Identidade e seletor de área compartilham uma faixa compacta. Plano e meta ficam agrupados; esse contexto não aparece no Perfil nem na gestão.
- A abertura apresenta o título da seção atual. Treino informa se exibe as sessões de hoje, a próxima ou a última sessão do plano, mantendo a seleção anterior. Um plano vazio apresenta uma mensagem sem lançar erro.
- As cinco seções permanecem visíveis: uma linha em larguras maiores e duas até 420 px. A seção ativa tem texto, contorno e `aria-current="page"`; os controles mantêm foco visível e altura mínima de 46 px.
- O cartão compartilhado por Treino e Calendário separa data, prescrição, execução orientada, intensidade, complemento, observações e registro. Comentários da equipe e ações de registrar/editar continuam disponíveis.
- Distância e duração só aparecem quando informadas; zero continua sendo um valor. Sessões com apenas duração funcionam com o esquema atual, sem inferir modalidade pelo nome nem acrescentar campos de musculação.
- Instruções mantêm quebras de linha e espaços. Conteúdo é escapado antes de entrar no HTML.
- A troca de área agora atualiza todos os controles ao terminar. Antes, `render()` podia deixá-los desabilitados por ainda ocorrer durante `busy=true`.

## Arquivos e limites

`app.html` organiza os mesmos IDs e controles em grupos. `app.css` fica restrito a `.app-page`, preservando estilos públicos; a regra de espaços está restrita ao cartão de treino. `app.js` altera a apresentação e a finalização do estado ocupado da troca de área. `tools/build-site.js` inclui a nova folha no build explícito, agora com 68 arquivos.

Calendário, Perfil, editor de atividade e gestão continuam usando seus componentes existentes. Permanecem as proteções contra perda de formulário, o vínculo exato entre registro e sessão, a distinção entre ausência e zero, o histórico de planos, a edição permitida em planos arquivados e a limpeza de dados após mudança de sessão entre abas.

Esta rodada não reorganiza Evolução ou gestão, não cria exercícios/séries/cargas e não implementa PWA. Uma futura experiência híbrida deve especificar esses campos e seus fluxos separadamente.

## Verificação

- `npm test`: **83/83 aprovados**, incluindo quatro novos testes de apresentação, navegação e seleção de sessões.
- `npm run build`: **68 arquivos**, sem ferramentas, fixtures ou documentação interna na distribuição.
- `git diff --check`: sem problemas.
- Navegador local com dados e respostas fictícios: 320, 390, 768 e 1280 px; sem rolagem horizontal da página nos cenários conferidos.
- Teclado: foco visível e mudança de seção por Tab/Enter. Troca atleta → treinador → atleta retorna os controles ao estado utilizável.
- Registro fictício de sessão de força com somente duração, edição de registro e reutilização dos cartões em Calendário/Agenda. Nenhuma conta real ou serviço publicado foi utilizado.

A prévia local usada na conferência fica em `http://127.0.0.1:4175/`, com identificação de dados fictícios. Seus arquivos auxiliares ficam em `.artifacts/`, fora do build e do controle de versão. Capturas: `.artifacts/app-ui-before-390.jpg`, `.artifacts/app-ui-after-390.jpg` e `.artifacts/app-ui-desktop-1280.jpg`.

Próximo incremento proposto: organizar a leitura de Evolução, usando os dados e componentes existentes. Publicação requer uma etapa própria.
