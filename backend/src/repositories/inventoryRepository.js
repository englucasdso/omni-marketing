import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.resolve('backend/data');
const INVENTORY_PATH = path.resolve(DATA_DIR, 'inventario.json');
const DETAILS_PATH = path.resolve(DATA_DIR, 'inventory-details.json');

export class InventoryRepository {
  async loadExistingInventory() {
    try {
      const data = await fs.readFile(INVENTORY_PATH, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }

  async loadExistingDetails() {
    try {
      const data = await fs.readFile(DETAILS_PATH, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }

  async saveSafely(inventoryData, detailsData) {
    await fs.mkdir(DATA_DIR, { recursive: true });

    const tempInv = `${INVENTORY_PATH}.tmp`;
    const tempDet = `${DETAILS_PATH}.tmp`;

    // Save inventory
    await fs.writeFile(tempInv, JSON.stringify(inventoryData, null, 2), 'utf8');
    await fs.rename(tempInv, INVENTORY_PATH);

    // Save details
    if (detailsData) {
      await fs.writeFile(tempDet, JSON.stringify(detailsData, null, 2), 'utf8');
      await fs.rename(tempDet, DETAILS_PATH);
    }
  }
}
