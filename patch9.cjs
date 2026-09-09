const fs = require('fs');
let code = fs.readFileSync('frontend/src/app/App.tsx', 'utf8');

code = code.replace(
    /const isNode = item\.artifact_type === 'NO';\n\s*const isRoot = item\.artifact_type === 'RAIZ';/g,
    ""
);
code = code.replace(
    /else if \(isNode\) artifactLabel = 'Nó';\n\s*else if \(isRoot\) artifactLabel = 'Raiz';/g,
    ""
);

fs.writeFileSync('frontend/src/app/App.tsx', code);
