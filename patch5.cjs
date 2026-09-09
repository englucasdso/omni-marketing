const fs = require('fs');
let code = fs.readFileSync('backend/src/services/classification/measurementClassifier.js', 'utf8');
code = code.replace(
    /\/\/ Classificação Canônica dos Tipos de Artefato[\s\S]*?\} else \{/m,
    `// Classificação Canônica dos Tipos de Artefato
    let artifact_type = 'NAO_CLASSIFICADO';
    if (screens.length > 0 || totalSnippets > 0 || context.hasTrackingScreens) {
      artifact_type = 'MAPA';
    } else {`
);
fs.writeFileSync('backend/src/services/classification/measurementClassifier.js', code);
