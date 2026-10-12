/**
 * Compila os compêndios de packs/_source/<nome>/*.json para LevelDB em packs/<nome>.
 * Uso:  npm install  &&  npm run build:packs
 * (Feche o mundo no Foundry antes: o banco do compêndio fica travado enquanto o mundo está aberto.)
 */
import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fontes = path.join(raiz, "packs", "_source");

for ( const entrada of await readdir(fontes, { withFileTypes: true }) ) {
  if ( !entrada.isDirectory() ) continue;
  const origem = path.join(fontes, entrada.name);
  const destino = path.join(raiz, "packs", entrada.name);
  console.log(`Compilando ${entrada.name}…`);
  await compilePack(origem, destino, { log: true, recursive: true });
}
console.log("Compêndios prontos.");
