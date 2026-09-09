const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/MapDetailModal.tsx', 'utf8');

code = code.replace(
    /else if \(isNode\) artifactBadgeLabel = 'Nó';\n\s*else if \(isRoot\) artifactBadgeLabel = 'Raiz';/g,
    ""
);

fs.writeFileSync('frontend/src/components/MapDetailModal.tsx', code);
