// Copia las fotos de cultivos del bot (app/imagenes/cultivos) a public/img/cultivos antes de compilar.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const origen = join(raiz, "app", "imagenes", "cultivos");
const destino = join(raiz, "frontend", "public", "img", "cultivos");
if (existsSync(origen)) {
  mkdirSync(destino, { recursive: true });
  cpSync(origen, destino, { recursive: true, filter: (f) => !f.endsWith(".md") });
  console.log("Fotos de cultivos copiadas a public/img/cultivos");
}
