import { ConfluenceOrchestrator } from './confluence/confluenceOrchestrator.js';

let orchestratorInstance = null;

async function abortCollection() {
  if (orchestratorInstance) {
    await orchestratorInstance.abort();
  }
}

async function runCollection(rootPageId, maxRows, username, password) {
  if (orchestratorInstance && orchestratorInstance.isCollecting) {
    throw new Error('A sincronização já está em andamento. Aguarde...');
  }
  
  orchestratorInstance = new ConfluenceOrchestrator();
  return await orchestratorInstance.run(rootPageId, maxRows, username, password);
}

export {
  runCollection,
  abortCollection
};
