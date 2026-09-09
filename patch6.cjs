const fs = require('fs');
let code = fs.readFileSync('backend/src/integrations/confluence/mapReader.js', 'utf8');

code = code.replace(
    /const has_content = this\.verificarConteudoUtil\(html\);\n\s*const signals = \{\n\s*has_gtm_ids: gtm_ids\.length > 0,\n\s*has_tracking_screens: telas\.length > 0,\n\s*has_content: has_content,\n\s*has_documentation_signals: has_content && telas\.length === 0 && !gtm_ids\.length\n\s*\};/m,
    `const signals = {
      has_gtm_ids: gtm_ids.length > 0,
      has_tracking_screens: telas.length > 0,
      has_documentation_signals: telas.length === 0 && !gtm_ids.length && (macros_found.includes('code') || macros_found.includes('panel') || textLength > 50)
    };`
);

code = code.replace(
    /\/\*\*[\s\n\*]*\* Verifica se o HTML possui conteúdo útil[\s\S]*?\}  \/\*\*/m,
    `/**`
);

fs.writeFileSync('backend/src/integrations/confluence/mapReader.js', code);
