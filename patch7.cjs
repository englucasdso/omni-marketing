const fs = require('fs');
let code = fs.readFileSync('backend/src/integrations/confluence/mapReader.js', 'utf8');
code = code.replace(
    /has_documentation_signals: telas\.length === 0 && !gtm_ids\.length && \(macros_found\.includes\('code'\) \|\| macros_found\.includes\('panel'\) \|\| textLength > 50\)/,
    "has_documentation_signals: telas.length === 0 && !gtm_ids.length && html.length > 500"
);
fs.writeFileSync('backend/src/integrations/confluence/mapReader.js', code);
