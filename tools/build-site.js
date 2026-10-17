import { mkdir, copyFile, rm, lstat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

const files = ['index.html', 'app.html', 'auth.html', 'ajuda.html', 'style.css', 'public.css', 'management.css', 'profile.css', 'calendar.css', 'activity.css', 'app.js', 'profile.js', 'calendar.js', 'activity.js', 'landing.js', 'auth-page.js', 'auth-client.js', 'account-areas.js', 'management.js', 'monitoring.js', 'plan-editor.js', 'config.js', 'importer.js', 'auth-callback.js', 'legacy-plan.js', 'legacy-guide.js', 'modelo-plano.csv', 'plano-anterior-referencia.csv', 'IMPORTACAO.md', 'GESTAO.md'];
// Only reviewed runtime assets are public. Typography drafts, package documentation,
// the inventory and the local brand preview deliberately stay out of dist.
const brandFiles = [
  'svg/simbolo/atlas-run-simbolo-colorido.svg',
  'svg/simbolo/atlas-run-simbolo-branco.svg',
  'svg/simbolo/atlas-run-simbolo-preto.svg',
  'icons/atlas-run-icon-escuro.svg',
  'icons/atlas-run-icon-claro.svg',
  'icons/atlas-run-icon-lima.svg',
  'icons/atlas-run-icon-escuro-192.png',
  'icons/atlas-run-icon-escuro-512.png',
  'icons/atlas-run-icon-claro-192.png',
  'icons/atlas-run-icon-claro-512.png',
  'icons/atlas-run-icon-lima-192.png',
  'icons/atlas-run-icon-lima-512.png',
  'icons/atlas-run-16x16.png',
  'icons/atlas-run-32x32.png',
  'icons/atlas-run-48x48.png',
  'icons/atlas-run-180x180.png',
  'icons/atlas-run-192x192.png',
  'icons/atlas-run-512x512.png',
  'icons/favicon.ico',
];
for (const layout of ['horizontal', 'vertical']) {
  for (const color of ['colorido', 'branco', 'preto']) {
    brandFiles.push(`release/svg/logotipo/atlas-run-${layout}-${color}.svg`,
      `release/png/logotipo/atlas-run-${layout}-${color}-1200.png`);
  }
}
files.push('tokens.css', 'typography.css', 'brand.css', 'app.css', 'progress.js', 'progress.css', 'notifications.js', 'notifications.css', 'notifications-sw.js', 'manifest.webmanifest',
  ...brandFiles.map(name => `assets/brand/v1.0/${name}`),
  'assets/fonts/sora/sora-latin-wght.woff2',
  'assets/fonts/sora/sora-latin-ext-wght.woff2',
  'assets/fonts/sora/OFL.txt');
const projectRoot = resolve('.');
const output = resolve(projectRoot, 'dist');
// Only recreate this generated directory; cached Netlify configuration can be present.
if (relative(projectRoot, output) !== 'dist') throw new Error('Invalid public build directory.');
const previous = await lstat(output).catch(error => {if (error.code !== 'ENOENT') throw error;});
if (previous?.isSymbolicLink()) throw new Error('Public build directory cannot be a symbolic link.');
await rm(output, {recursive: true, force: true});
await mkdir(output, { recursive: true });
await Promise.all(files.map(async name => {
  const target = resolve(output, name);
  if (relative(output, target).startsWith('..')) throw new Error('Invalid public asset path.');
  await mkdir(resolve(target, '..'), {recursive: true});
  await copyFile(resolve(name), target);
}));
console.log(`Built ${files.length} public files in dist.`);
