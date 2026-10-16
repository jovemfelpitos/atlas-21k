const root = '/assets/brand/v1.0';
const variants = [
  ['horizontal', 'colorido', 'Horizontal · colorido'],
  ['horizontal', 'branco', 'Horizontal · branco'],
  ['horizontal', 'preto', 'Horizontal · preto'],
  ['vertical', 'colorido', 'Vertical · colorido'],
  ['vertical', 'branco', 'Vertical · branco'],
  ['vertical', 'preto', 'Vertical · preto'],
];

async function preview() {
  const loaded = await Promise.all([400, 500, 600, 700, 800].map(weight =>
    document.fonts.load(`${weight} 24px Sora`, 'ATLAS RUN · Seu plano. Seu ritmo.')));
  if (loaded.some(fonts => !fonts.length || fonts.some(font => font.status !== 'loaded'))) {
    throw Error('Não foi possível comprovar o carregamento da fonte Sora local.');
  }
  document.querySelector('#fontStatus').textContent = 'Sora local carregada · pesos 400, 500, 600, 700 e 800 disponíveis.';
  for (const [layout, color, label] of variants) {
    const basename = `atlas-run-${layout}-${color}`;
    const response = await fetch(`${root}/svg/logotipo/${basename}.svg`);
    if (!response.ok) throw Error(`Não foi possível carregar ${basename}.`);
    const parsed = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
    if (parsed.querySelector('parsererror') || parsed.documentElement.localName !== 'svg') {
      throw Error(`SVG inválido: ${basename}.`);
    }
    const card = document.createElement('article');
    card.className = 'card';
    const title = document.createElement('h3');
    title.textContent = label;
    const status = document.createElement('p');
    status.className = 'status';
    status.textContent = 'Tipografia aprovada · referência editável com Sora';
    const stage = document.createElement('div');
    stage.className = `brand-stage${color === 'preto' ? ' light' : ''}`;
    stage.append(document.importNode(parsed.documentElement, true));
    const distribution = document.createElement('div');
    distribution.className = stage.className;
    const logo = document.createElement('img');
    logo.src = `${root}/release/svg/logotipo/${basename}.svg`;
    logo.alt = `${label} · versão final em curvas`;
    distribution.append(logo);
    const distributionLabel = document.createElement('p');
    distributionLabel.className = 'muted';
    distributionLabel.textContent = 'Distribuição final · texto em curvas, sem dependência de fonte';
    const received = document.createElement('a');
    received.className = 'review-link';
    received.href = `${root}/release/png/logotipo/${basename}-1200.png`;
    received.textContent = 'Baixar PNG homologado · 1200 px';
    card.append(title, status, stage, distributionLabel, distribution, received);
    document.querySelector('#lockupGrid').append(card);
  }
  // Keep the browser's actual shaping positions for deterministic text-to-path export.
  // This local-only preview is never part of the public build.
  const measurements = [...document.querySelectorAll('#lockupGrid article')].map((card, index) => ({
    file: `atlas-run-${variants[index][0]}-${variants[index][1]}.svg`,
    texts: [...card.querySelectorAll('svg text')].map(text => ({
      text: text.textContent,
      size: parseFloat(getComputedStyle(text).fontSize),
      weight: Number(getComputedStyle(text).fontWeight),
      fill: text.getAttribute('fill'),
      positions: [...text.textContent].map((character, index) => {
        const point = text.getStartPositionOfChar(index);
        return {character, x: point.x, y: point.y};
      }),
    })),
  }));
  const metrics = document.createElement('pre');
  metrics.id = 'brandGlyphMeasurements';
  metrics.hidden = true;
  metrics.textContent = JSON.stringify(measurements);
  document.body.append(metrics);
}

preview().catch(error => {
  document.querySelector('#lockupError').textContent = error.message;
  document.querySelector('#fontStatus').textContent = 'Conferência tipográfica incompleta.';
});
