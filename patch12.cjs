const fs = require('fs');
let code = fs.readFileSync('backend/src/integrations/confluence/confluenceOrchestrator.js', 'utf8');

code = code.replace(
    /\/\/ 4\. Salva de forma segura usando o repositório diretamente no inventario\.json\n\s*this\.repository\.saveSafely\(allRows\);/,
    `// 4. Salva de forma segura usando o repositório diretamente no inventario.json
      if (allRows.length === 0) {
        console.error('[Orchestrator] ERRO: Coleta retornou 0 registros. Gravação bloqueada para proteger o inventário atual.');
        throw new Error('A coleta retornou 0 registros. Sincronização abortada para proteger a base.');
      }
      this.repository.saveSafely(allRows);`
);

fs.writeFileSync('backend/src/integrations/confluence/confluenceOrchestrator.js', code);
