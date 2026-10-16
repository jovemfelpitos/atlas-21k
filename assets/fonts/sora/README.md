# Sora — fonte local do Atlas Run

Distribuição oficial do Google Fonts, obtida em 15/10/2026. Os dois arquivos WOFF2 recebidos são variáveis e cobrem Latin e Latin Extended. A interface utiliza Regular 400, Medium 500, Semibold 600 e Bold 700. O peso 800 fica disponível para a conferência dos logotipos preliminares recebidos; isso não equivale à aprovação do wordmark.

Os binários não foram convertidos nem modificados. Origem e SHA-256 estão em `sources.json`; a licença integral acompanha a distribuição em `OFL.txt`, inclusive no build público.

- CSS de origem: https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap
- Projeto: https://github.com/google/fonts/tree/main/ofl/sora
- Licença: https://raw.githubusercontent.com/google/fonts/main/ofl/sora/OFL.txt

`typography.css` carrega os arquivos do próprio site com `font-display: swap` e fallback de sistema. Não há solicitação a Google Fonts durante o uso do produto. O subset Latin é pré-carregado; Latin Extended fica disponível por unicode-range.
