const fs = require('fs');
let code = fs.readFileSync('backend/src/integrations/confluence/confluenceOrchestrator.js', 'utf8');
code = code.replace(
    /\/\/ Captura completa do conteúdo da página[^\n]*\n\s*try \{/,
    `if (isLeaf || (node.title && node.title.startsWith('MT -'))) {
          try {`
);
code = code.replace(
    /tipo_mapa = 'Não classificado';\n\s*}\n\s*}\n\n\s*const resolvedStructure = this\.extrairProdutoSubprodutoDaTrilha/,
    `tipo_mapa = 'Não classificado';
          }
        }
        } // end isLeaf check

        const resolvedStructure = this.extrairProdutoSubprodutoDaTrilha`
);
fs.writeFileSync('backend/src/integrations/confluence/confluenceOrchestrator.js', code);
