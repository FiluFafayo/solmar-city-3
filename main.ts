// Solmar City — entry program (Node 22, standard library only).
// Copies the game and its screenshots to /output, then writes
// /output/dossier.json with buildDossier from vendor/makefun-game.ts.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const root = fileURLToPath(new URL('.', import.meta.url));

mkdirSync(join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
cpSync(join(root, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(root, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

// Small summary so a local run shows what was produced.
const gameFiles = readdirSync(join(outDir, 'game'));
const shots = readdirSync(join(outDir, 'screenshots'));
console.log(`dossier.json: ${statSync(join(outDir, 'dossier.json')).size} bytes, ` +
  `${gameFiles.length} game files, ${shots.length} screenshots -> ${outDir}`);
