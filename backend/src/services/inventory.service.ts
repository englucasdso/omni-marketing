import fs from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "backend/data/inventario.json");

export function getInventoryData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch (e) {
    return [];
  }
}

export function calculateInsights(inventory: any[]) {
  return {
    total: inventory.length,
    recent: inventory.length > 0 ? 1 : 0
  };
}

export function searchArtifacts(query: string) {
  const inventory = getInventoryData();
  if (!query) return inventory;
  const lowerQuery = query.toLowerCase();
  return inventory.filter((item: any) => 
    (item.titulo && item.titulo.toLowerCase().includes(lowerQuery)) ||
    (item.responsavel && item.responsavel.toLowerCase().includes(lowerQuery))
  );
}
