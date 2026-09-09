const fs = require('fs');
let code = fs.readFileSync('frontend/src/types/index.ts', 'utf8');
code = code.replace(
    /export type ArtifactType = 'RAIZ' \| 'NO' \| 'MAPA' \| 'DOCUMENTACAO';/,
    "export type ArtifactType = 'MAPA' | 'DOCUMENTACAO' | 'NAO_CLASSIFICADO';"
);
fs.writeFileSync('frontend/src/types/index.ts', code);
