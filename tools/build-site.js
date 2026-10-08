import { mkdir, copyFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const files = ['index.html', 'style.css', 'app.js', 'config.js', 'importer.js', 'auth-callback.js', 'legacy-plan.js', 'legacy-guide.js', 'modelo-plano.csv', 'plano-anterior-referencia.csv', 'IMPORTACAO.md'];
const output = resolve('dist');
await mkdir(output, { recursive: true });
const unexpected = (await readdir(output)).filter(name => !files.includes(name));
if (unexpected.length) throw new Error(`Unexpected files in public build: ${unexpected.join(', ')}`);
await Promise.all(files.map(name => copyFile(resolve(name), resolve(output, name))));
console.log(`Built ${files.length} public files in dist.`);
