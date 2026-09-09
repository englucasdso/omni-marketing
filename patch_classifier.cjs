const fs = require('fs');
let code = fs.readFileSync('backend/src/integrations/confluence/confluenceOrchestrator.js', 'utf8');

code = code.replace(
    /this\.repository\.saveSafely\(allRows\);/,
    `const finalRows = classifyTree(allRows, rootPageId);\n      this.repository.saveSafely(finalRows);`
);

fs.writeFileSync('backend/src/integrations/confluence/confluenceOrchestrator.js', code);
