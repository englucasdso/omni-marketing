export class ParameterParser {
  extractDataLayer(scriptText) {
    // Tenta encontrar um objeto push.
    // Isso é um extrator simples, para uma abstração segura.
    // Pode não ser um parser AST completo, mas cobrirá os blocos principais
    const results = [];
    
    // Procura por dataLayer.push({ ... }) 
    const dlPushRegex = /dataLayer\.push\s*\(\s*({[\s\S]*?})\s*\)/g;
    
    let match;
    while ((match = dlPushRegex.exec(scriptText)) !== null) {
      results.push(this.parseObjectLiteral(match[1]));
    }
    
    return results;
  }

  parseObjectLiteral(objStr) {
    const params = [];
    
    // Simplification for extracting keys and values. 
    // We want to extract paths like 'ga_event.location': 'val'
    
    // Regex para pegar linha a linha chave e valor: 
    // chave: 'valor' ou chave: variável
    const lineRegex = /['"]?([a-zA-Z0-9_.]+)['"]?\s*:\s*(['"`]?)(.*?)\2(?:,|$)/g;
    
    let m;
    while ((m = lineRegex.exec(objStr)) !== null) {
      const key = m[1].trim();
      const rawValue = m[3].trim();
      const quote = m[2];
      
      let source = 'unknown';
      let normalized = rawValue;
      
      if (quote) {
        source = 'hardcoded';
      } else if (rawValue === 'null' || rawValue === 'undefined' || rawValue === '') {
        source = 'empty';
      } else if (rawValue.includes('{{') && rawValue.includes('}}')) {
        source = 'gtm_variable';
      } else {
        source = 'javascript_variable';
      }
      
      params.push({
        parameter_path: key,
        raw_value: rawValue,
        normalized_value: normalized,
        value_source: source
      });
    }
    
    return params;
  }
}
