const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/MapDetailModal.tsx', 'utf8');

code = code.replace(
    /const isNode = item\.artifact_type === 'NO';\n\s*const isRoot = item\.artifact_type === 'RAIZ';/g,
    ""
);
code = code.replace(
    /if \(isNode \|\| isRoot\) \{\n\s*artifactBadge = isNode \? 'NÓ' : 'RAIZ';\n\s*\}/g,
    ""
);

fs.writeFileSync('frontend/src/components/MapDetailModal.tsx', code);
