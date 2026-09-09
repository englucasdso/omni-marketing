import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), "backend/data/inventario.json");
const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));

const updated = raw.map(item => {
  if (item.artifact_type === 'RAIZ' || item.depth === 0) {
    item.titulo = 'Mapa de Métricas - Salla';
  }
  return item;
});

fs.writeFileSync(DATA_FILE, JSON.stringify(updated, null, 2));
console.log("Updated root titles.");
