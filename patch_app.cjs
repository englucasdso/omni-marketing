const fs = require('fs');
let code = fs.readFileSync('frontend/src/app/App.tsx', 'utf8');

// 1. Update filteredAndSortedCards
code = code.replace(
    /let list = \[\.\.\.cardSource\];/,
    `let list = [...cardSource].filter(i => i.artifact_type !== 'RAIZ');`
);

// 2. Update filteredInventory
code = code.replace(
    /let base = \[\.\.\.results\];/,
    `let base = [...results].filter(i => i.artifact_type !== 'RAIZ');`
);

// 3. Update the mapping inside the map loop for paginatedCards
code = code.replace(
    /let artifactLabel = 'Não classificado';\s*if \(isDoc\) artifactLabel = 'Documento';\s*else if \(isMap\) artifactLabel = 'Mapa';/g,
    `let artifactLabel = 'Não classificado';
                if (isDoc) artifactLabel = 'Documento';
                else if (isMap) artifactLabel = 'Mapa';
                else if (item.artifact_type === 'NO') artifactLabel = 'Nó';`
);

fs.writeFileSync('frontend/src/app/App.tsx', code);
