/**
 * Rapatrie les binaires WebAssembly d'onnxruntime dans public/ort/.
 *
 * Par defaut, onnxruntime-web telecharge ces fichiers depuis un CDN au premier
 * usage. Sur une application concue pour fonctionner sans reseau, c'est un
 * contresens : le detecteur cesserait de fonctionner des que la connexion
 * disparait - c'est-a-dire au champ, la ou l'outil doit servir.
 *
 * ON NE COPIE QUE CE QUI SERT.
 * La distribution complete pese 88 Mo : elle contient les variantes
 * multithread, WebGPU et entrainement, dont aucune n'est utilisee ici.
 *   - multithread  : desactive (numThreads = 1), les telephones vises
 *                    n'exposent pas SharedArrayBuffer sans en-tetes COOP/COEP ;
 *   - jsep / WebGPU : non utilise, le detecteur tourne sur processeur ;
 *   - training      : sans objet, l'entrainement se fait en Python.
 *
 * Reste la seule variante SIMD, environ 10 Mo, comprise par tout telephone
 * sorti depuis 2017.
 */

import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(racine, '..', 'node_modules', 'onnxruntime-web', 'dist');
const cible = path.resolve(racine, '..', 'public', 'ort');

const RETENUS = ['ort-wasm-simd.wasm', 'ort-wasm-simd.mjs'];

if (!existsSync(source)) {
  console.log('onnxruntime-web absent — copie ignoree (lancez npm install).');
  process.exit(0);
}

// Repartir a zero : une ancienne copie complete pesait 88 Mo et se serait
// retrouvee dans le precache du service worker.
await rm(cible, { recursive: true, force: true });
await mkdir(cible, { recursive: true });

const disponibles = new Set(await readdir(source));
let total = 0;

for (const fichier of RETENUS) {
  if (!disponibles.has(fichier)) continue;
  await copyFile(path.join(source, fichier), path.join(cible, fichier));
  const { size } = await import('node:fs').then((fs) =>
    fs.promises.stat(path.join(cible, fichier)),
  );
  total += size;
}

console.log(
  `onnxruntime : ${RETENUS.length} fichier(s) copie(s), ${(total / 1024 ** 2).toFixed(1)} Mo`,
);
