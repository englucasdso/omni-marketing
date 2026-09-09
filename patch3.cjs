const fs = require('fs');
let code = fs.readFileSync('backend/src/integrations/confluence/confluenceOrchestrator.js', 'utf8');
code = code.replace(
    /const tempEstrutura = this\.extrairProdutoSubprodutoDaTrilha\(ancestorTitles, node\.depth !== undefined \? node\.depth : depth, node\.title \|\| ''\);/g,
    'const tempEstrutura = this.extrairProdutoSubprodutoDaTrilha(ancestorTitles);'
);
code = code.replace(
    /const resolvedStructure = this\.extrairProdutoSubprodutoDaTrilha\(ancestorTitles, node\.depth !== undefined \? node\.depth : depth, node\.title \|\| '', cabecalho\.produto_servico\);/g,
    'const resolvedStructure = this.extrairProdutoSubprodutoDaTrilha(ancestorTitles, cabecalho.produto_servico);'
);
code = code.replace(
    /extrairProdutoSubprodutoDaTrilha\(ancestorTitles = \[\], depth = 0, nodeTitle = '', cabecalhoProduto = ''\) \{[\s\S]*?return \{ \n      produto: produtoFinal, \n      subproduto: subprodutoFinal \n    \};\n  \}/,
    `extrairProdutoSubprodutoDaTrilha(ancestorTitles = [], cabecalhoProduto = '') {
    let estruturalProduto = '';
    let estruturalSubproduto = '';

    if (ancestorTitles.length >= 2) {
      estruturalProduto = ancestorTitles[1];
    }
    if (ancestorTitles.length >= 3) {
      estruturalSubproduto = ancestorTitles[2];
    }

    const produtoFinal = estruturalProduto || cabecalhoProduto || (ancestorTitles[0] || '');
    const subprodutoFinal = estruturalSubproduto || '';

    return { 
      produto: produtoFinal, 
      subproduto: subprodutoFinal 
    };
  }`
);
fs.writeFileSync('backend/src/integrations/confluence/confluenceOrchestrator.js', code);
