const fs = require('fs');
let code = fs.readFileSync('backend/src/integrations/confluence/treeCrawler.js', 'utf8');
code = code.replace(
    /\/\/ Regra Arquitetural Obrigatória: Título canônico para a raiz\n\s*const rootTitle = 'Mapa de Métricas - Salla';/,
    "const rootTitle = String((rootPageData && rootPageData.title) || options.rootTitle || 'Raiz').trim();"
);
fs.writeFileSync('backend/src/integrations/confluence/treeCrawler.js', code);
