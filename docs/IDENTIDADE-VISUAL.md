# Atlas Run — integração da identidade V1.0

Integração local autorizada pelo proprietário em 15/10/2026, após inventário e plano nesta conversa. A autorização inicial permitiu integrar símbolos, ícones e fundamentos. A prévia dos seis logotipos com Sora recebeu aceite explícito do proprietário em seguida; as versões finais em curvas e PNG estão integradas localmente. Não houve publicação, mudança de conta, dados, permissões ou migração de banco. A frente permanece independente de UX-06.

## Referências e integridade

- Pacote recebido: `Atlas_Run_Brand_Assets_V1.0.zip`.
- SHA-256 do ZIP: `cd73d945dfad64794fc52e3ec19025cc78623595e3705f0e0639c2fd93145d68`.
- Os 43 arquivos estão preservados em `assets/brand/v1.0/`, incluindo o README e `docs/ENTREGA_CODEX.md` originais. O README recebido não substitui o README do repositório.
- `assets/brand/v1.0/inventory.json` registra hash, tamanho e situação de cada arquivo original. Esse inventário é adicional ao pacote e não faz parte do build público.
- Os 12 SVGs reutilizam os mesmos dois atributos `d`. Nenhum caminho, proporção, preenchimento, `fill-rule`, `viewBox` ou transformação recebida foi alterado. Não executar otimização, normalização de escala ou vetorização automática desses ativos sem autorização.

| Material | Situação |
| --- | --- |
| 3 SVGs do símbolo | Oficial reconstruído e aprovado visualmente pelo proprietário |
| 9 PNGs do símbolo | Exportações recebidas, preservadas |
| 3 SVGs, 12 PNGs e 1 ICO de ícones | Ativos recebidos, preservados |
| 6 SVGs e 6 PNGs de logotipo recebidos | Originais de referência, preservados; substituídos na distribuição pelas versões homologadas em `release/` |
| 2 documentos e 1 prancha | Referências internas preservadas |

## Aplicação no produto

Os cabeçalhos do app, landing, acesso e ajuda, os rodapés com marca e a prévia ilustrativa da landing usam `release/svg/logotipo/atlas-run-horizontal-colorido.svg`, com a Sora aprovada convertida em caminhos. O arquivo mantém os dois paths, os preenchimentos e as transformações originais do símbolo. O link e os controles de cada cabeçalho permanecem nos mesmos lugares da estrutura de interação.

`brand.css` organiza o tamanho e o espaçamento. O logotipo horizontal conserva o viewBox 610:146 e usa altura automática; o símbolo isolado conserva 305:181 e os ícones têm formato 1:1. O logotipo tem `alt="Atlas Run"`, preservando a identificação acessível inclusive em links sem `aria-label`. A assinatura institucional é **Seu plano. Seu ritmo.**; a landing também apresenta **Movimento com propósito**. A organização posterior do app está registrada em [UI-ATLETA-01.md](UI-ATLETA-01.md).

Todas as páginas têm `theme-color` `#0B1117`, favicon SVG escuro, fallback ICO/PNG e o PNG recebido de 180 px como `apple-touch-icon`. O ICO recebido contém apenas 16 px; o PNG de 32 px complementa o uso no navegador.

Na integração inicial dos ativos não foram criados manifest ou service worker. O incremento posterior [UI-REGISTRO-02.md](UI-REGISTRO-02.md) acrescenta manifest de instalação e um service worker exclusivo para alertas, sem cache ou modo offline. Os ícones recebidos de 192/512 são reutilizados com `purpose: any`; não foram declarados `maskable`, pois há transparência e arredondamento nos arquivos. A apresentação na tela inicial em dispositivos reais ainda requer conferência.

## Fundamentos compartilhados

`tokens.css` define a paleta oficial e as funções de interface. Os nomes antigos continuam como aliases para preservar os componentes existentes:

| Token de marca | Valor | Alias principal |
| --- | --- | --- |
| `--color-brand-base` | `#0B1117` | `--bg` |
| `--color-brand-energy` | `#C9FF60` | `--lime` |
| `--color-brand-text` | `#F3F6F9` | `--text` |
| `--color-brand-support` | `#AFC2D1` | `--muted` |

Superfícies, bordas, seleção, aviso, erro e sucesso têm tokens próprios; são cores de interface documentadas, sem recolorir os SVGs recebidos. A variante branca do pacote conserva `#FFFFFF`. Texto sobre ação lime usa a base escura. Contornos dos campos usam `--color-border-control`; cores e símbolos de situação permanecem acompanhados de texto.

`typography.css` carrega Sora WOFF2 local, com Latin e Latin Extended, fallback e `font-display: swap`. A licença integral é publicada com a fonte; proveniência e hashes ficam em `assets/fonts/sora/sources.json`. Não há dependência de Google Fonts durante o uso do produto. A interface foi alinhada aos pesos 400, 500, 600 e 700. O peso 800 do wordmark foi homologado separadamente; a assinatura usa 400. Os arquivos finais em curvas não dependem de fonte instalada ou carregada.

Estados existentes foram mantidos: selecionado/ativo, erro, vazio, somente leitura e processamento. Foco de teclado foi estendido aos campos e acordeões; hover/pressionado têm diferenciação discreta. Desabilitado e processamento possuem cursores distintos e continuam usando os bloqueios nativos. Não foram alterados os handlers ou contratos de autenticação, salvamento e navegação.

Na integração inicial, as cinco seções ganharam rolagem própria em telas estreitas. A rodada seguinte, [UI-ATLETA-01.md](UI-ATLETA-01.md), substitui essa apresentação no app por cinco controles sempre visíveis, em duas linhas até 420 px. Os controles continuam acessíveis por teclado. Gestão, calendário, perfil e registro mantêm suas adaptações existentes; o limite de altura e a rolagem dos diálogos foram preservados.

## Homologação e exportação dos logotipos

O proprietário aprovou a prévia dos seis logotipos com Sora em 15/10/2026. Os originais recebidos continuam intactos. `release/` contém seis SVGs sem elementos `text` e seis PNGs transparentes de 1200 px, acompanhados de manifesto e medidas de referência.

A exportação usa o mesmo WOFF2 Latin já empregado na prévia aprovada, preservando pesos, coordenadas de cada caractere e espaçamento calculados pelo navegador. `tools/export-brand-logos.py` converte os glifos com fontTools; quando Python não dispõe de Brotli, utiliza o descompressor nativo de Node, sem instalação de dependências. Os PNGs são rasterizados dos SVGs finais. O símbolo não passa por redesenho ou otimização.

- Originais editáveis: `assets/brand/v1.0/svg/logotipo/`.
- Distribuição homologada: `assets/brand/v1.0/release/svg/logotipo/` e `release/png/logotipo/`.
- Aceite, proveniência e hashes: `release/manifest.json`.
- Medidas usadas na exportação: `release/typography-metrics.json`.

A página local `http://127.0.0.1:4174/tools/brand-preview.html#logotipos` compara a referência com Sora e a versão final em curvas e oferece os PNGs homologados. Executar `python -B -m http.server 4174 --bind 127.0.0.1` na raiz para servi-la. A página permanece fora do build público e não acessa contas ou dados reais. O aceite tipográfico não autoriza publicação por si só.

## Build e manutenção

`tools/build-site.js` mantém a lista explícita de arquivos públicos e copia subdiretórios dos ativos selecionados. Após o incremento de registro/alertas, a distribuição tem 72 arquivos: inclui `app.css`, cliente/CSS/worker de alertas, manifest de instalação, símbolos SVG, ícones, CSS, WOFF2/licença e os 12 arquivos de logotipo homologados em `release/`. Não inclui os logotipos editáveis recebidos, o inventário, manifestos de origem, documentação interna, prancha, ZIP, ferramentas, fixtures, funções de servidor ou SQL. Editar fontes no repositório e reconstruir `dist`; não editar `dist` diretamente.

Os componentes de calendário, registro, perfil e gestão foram reutilizados. A integração de ativos não alterou JavaScript de negócio, migrações, autenticação, vínculos ou permissões. A rodada posterior altera a apresentação em `app.js` e corrige o estado dos controles após troca de área, conforme [UI-ATLETA-01.md](UI-ATLETA-01.md). A experiência híbrida continua prevista: modalidade e situação devem permanecer conceitos separados. O cartão já omite quilômetros quando não informados; métricas específicas de musculação dependem de uma especificação posterior.

## Validação desta entrega

- Build local concluído com 67 arquivos, incluindo seis SVGs de logotipo em curvas e seis PNGs homologados.
- 79 testes existentes aprovados, abrangendo acesso, registro, perfil, calendário, gestão e permissões no banco local de testes.
- Comparação dos 43 arquivos com os hashes do pacote: íntegros. Os 12 SVGs preservam os caminhos originais.
- Recursos referenciados pelas quatro páginas conferidos no build; originais editáveis excluídos e distribuição em curvas integrada após aceite.
- Conferência em navegador local: landing, cadastro, recuperação e ajuda; app com fixtures e respostas simuladas para calendário, registro, perfil e troca para treinador. Não foram acessadas contas reais nem serviços publicados.
- Larguras conferidas: 320/390 px e pontos de 768/1280 px. Campos com foco de teclado e carregamento da Sora local verificados. Não é uma certificação completa de acessibilidade ou de dispositivos físicos.

Agrupamentos DS-00 a DS-05 mantidos: inventário, ativos e fundamentos entregues nesta integração; aplicação da marca no app e site realizada. A homologação dos logotipos foi concluída. A primeira organização do topo e do cartão Treino está registrada em [UI-ATLETA-01.md](UI-ATLETA-01.md), com 83 testes naquela rodada. O registrador dinâmico e a estrutura de alertas foram acrescentados em [UI-REGISTRO-02.md](UI-REGISTRO-02.md). Catálogo completo de componentes, reorganização de Evolução, métricas específicas de musculação e modo offline permanecem como próximos incrementos.
