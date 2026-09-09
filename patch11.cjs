const fs = require('fs');
let code = fs.readFileSync('frontend/src/app/App.tsx', 'utf8');

code = code.replace(
    /\/\/ Filtra RAIZ\n\s*list = list\.filter\(i => i\.artifact_type !== 'RAIZ'\);/g,
    ""
);
code = code.replace(
    /\/\/ Filtra RAIZ\n\s*base = base\.filter\(i => i\.artifact_type !== 'RAIZ'\);/g,
    ""
);
code = code.replace(
    /\{ v: 'NO', l: `Nós \(\$\{typeCounts\.get\('NO'\) \|\| 0\}\)` \}/g,
    ""
);
// fix trailing commas if there were any
code = code.replace(/,\s*,/g, ",");
code = code.replace(/,\s*\]/g, "]");

fs.writeFileSync('frontend/src/app/App.tsx', code);
