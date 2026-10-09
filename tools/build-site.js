import { mkdir, copyFile, rm, lstat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

const files = ['index.html', 'style.css', 'management.css', 'app.js', 'management.js', 'plan-editor.js', 'config.js', 'importer.js', 'auth-callback.js', 'legacy-plan.js', 'legacy-guide.js', 'modelo-plano.csv', 'plano-anterior-referencia.csv', 'IMPORTACAO.md', 'GESTAO.md'];
const projectRoot = resolve('.');
const output = resolve(projectRoot, 'dist');
// Only recreate this generated directory; cached Netlify configuration can be present.
if (relative(projectRoot, output) !== 'dist') throw new Error('Invalid public build directory.');
const previous = await lstat(output).catch(error => {if (error.code !== 'ENOENT') throw error;});
if (previous?.isSymbolicLink()) throw new Error('Public build directory cannot be a symbolic link.');
await rm(output, {recursive: true, force: true});
await mkdir(output, { recursive: true });
await Promise.all(files.map(name => copyFile(resolve(name), resolve(output, name))));
console.log(`Built ${files.length} public files in dist.`);
