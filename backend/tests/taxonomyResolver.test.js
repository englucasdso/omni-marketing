import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveArtifactTaxonomy } from '../../frontend/src/utils/taxonomyResolver.ts';
import fs from 'node:fs';
import path from 'node:path';

describe('Resolução de Taxonomia Estrutural da Árvore', () => {
  it('1. Árvore com produto, subproduto e mapa: Raiz → Créditos → Consignado → Mapa', () => {
    const root = { id: 'root', titulo: 'Home', artifact_type: 'RAIZ', depth: 0 };
    const creditos = { id: 'prod-creditos', titulo: 'Créditos', artifact_type: 'NO', depth: 1, parent_id: 'root' };
    const consignado = { id: 'sub-consignado', titulo: 'Consignado', artifact_type: 'NO', depth: 2, parent_id: 'prod-creditos' };
    const mapa = {
      id: 'map-1',
      titulo: 'Contratação Consignado',
      artifact_type: 'MAPA',
      depth: 3,
      parent_id: 'sub-consignado',
      ancestor_ids: ['root', 'prod-creditos', 'sub-consignado'],
      ancestor_titles: ['Home', 'Créditos', 'Consignado']
    };

    const artifactsById = new Map([
      ['root', root],
      ['prod-creditos', creditos],
      ['sub-consignado', consignado],
      ['map-1', mapa]
    ]);

    const res = resolveArtifactTaxonomy(mapa, artifactsById);

    assert.equal(res.product?.name, 'Créditos');
    assert.equal(res.product?.id, 'prod-creditos');
    assert.equal(res.subproduct?.name, 'Consignado');
    assert.equal(res.subproduct?.id, 'sub-consignado');
    assert.equal(res.displayPath, 'Consignado');
    assert.equal(res.descendantPath.length, 1);
    assert.equal(res.productKey, 'prod-creditos');
  });

  it('2. Mapa diretamente abaixo do produto: Raiz → Créditos → Mapa', () => {
    const root = { id: 'root', titulo: 'Home', artifact_type: 'RAIZ', depth: 0 };
    const creditos = { id: 'prod-creditos', titulo: 'Créditos', artifact_type: 'NO', depth: 1, parent_id: 'root' };
    const mapa = {
      id: 'map-direto',
      titulo: 'Visão Geral de Créditos',
      artifact_type: 'MAPA',
      depth: 2,
      parent_id: 'prod-creditos',
      ancestor_ids: ['root', 'prod-creditos'],
      ancestor_titles: ['Home', 'Créditos']
    };

    const artifactsById = new Map([
      ['root', root],
      ['prod-creditos', creditos],
      ['map-direto', mapa]
    ]);

    const res = resolveArtifactTaxonomy(mapa, artifactsById);

    assert.equal(res.product?.name, 'Créditos');
    assert.equal(res.product?.id, 'prod-creditos');
    assert.equal(res.subproduct, null);
    assert.equal(res.subproductKey, 'SEM_SUBPRODUTO');
    assert.equal(res.displayPath, '');
    assert.equal(res.descendantPath.length, 0);
    // Garantir que o título do próprio mapa não virou subproduto
    assert.notEqual(res.subproduct?.name, 'Visão Geral de Créditos');
  });

  it('3. Mapa diretamente abaixo da raiz: Raiz → Mapa', () => {
    const root = { id: 'root', titulo: 'Home', artifact_type: 'RAIZ', depth: 0 };
    const mapa = {
      id: 'map-raiz',
      titulo: 'Mapa Solto na Raiz',
      artifact_type: 'MAPA',
      depth: 1,
      parent_id: 'root',
      ancestor_ids: ['root'],
      ancestor_titles: ['Home']
    };

    const artifactsById = new Map([
      ['root', root],
      ['map-raiz', mapa]
    ]);

    const res = resolveArtifactTaxonomy(mapa, artifactsById);

    assert.equal(res.product, null);
    assert.equal(res.productKey, 'SEM_PRODUTO');
    assert.equal(res.subproduct, null);
    assert.equal(res.subproductKey, 'SEM_SUBPRODUTO');
    assert.equal(res.displayPath, '');
    // Garantir que o mapa não foi promovido a produto
    assert.notEqual(res.product?.name, 'Mapa Solto na Raiz');
  });

  it('4. Árvore profunda com múltiplos níveis: Raiz → Créditos → Consignado → Pós-venda → Contratação → Mapa', () => {
    const root = { id: 'root', titulo: 'Home', artifact_type: 'RAIZ', depth: 0 };
    const creditos = { id: 'prod-creditos', titulo: 'Créditos', artifact_type: 'NO', depth: 1 };
    const consignado = { id: 'sub-consignado', titulo: 'Consignado', artifact_type: 'NO', depth: 2 };
    const posVenda = { id: 'cat-posvenda', titulo: 'Pós-venda', artifact_type: 'NO', depth: 3 };
    const contratacao = { id: 'cat-contratacao', titulo: 'Contratação', artifact_type: 'NO', depth: 4 };
    const mapa = {
      id: 'map-profundo',
      titulo: 'Fluxo Final de Contratação',
      artifact_type: 'MAPA',
      depth: 5,
      ancestor_ids: ['root', 'prod-creditos', 'sub-consignado', 'cat-posvenda', 'cat-contratacao'],
      ancestor_titles: ['Home', 'Créditos', 'Consignado', 'Pós-venda', 'Contratação']
    };

    const artifactsById = new Map([
      ['root', root],
      ['prod-creditos', creditos],
      ['sub-consignado', consignado],
      ['cat-posvenda', posVenda],
      ['cat-contratacao', contratacao],
      ['map-profundo', mapa]
    ]);

    const res = resolveArtifactTaxonomy(mapa, artifactsById);

    assert.equal(res.product?.name, 'Créditos');
    assert.equal(res.subproduct?.name, 'Consignado');
    assert.equal(res.descendantPath.length, 3);
    assert.equal(res.descendantPath[0].name, 'Consignado');
    assert.equal(res.descendantPath[1].name, 'Pós-venda');
    assert.equal(res.descendantPath[2].name, 'Contratação');
    assert.equal(res.displayPath, 'Consignado › Pós-venda › Contratação');
  });

  it('5. Dois nós com o mesmo nome sob pais diferentes: Raiz → Produto A → Cadastro e Raiz → Produto B → Cadastro', () => {
    const root = { id: 'root', titulo: 'Home', artifact_type: 'RAIZ', depth: 0 };
    const prodA = { id: 'prod-a', titulo: 'Conta Corrente', artifact_type: 'NO', depth: 1 };
    const subA = { id: 'sub-cadastro-a', titulo: 'Cadastro', artifact_type: 'NO', depth: 2 };
    const mapaA = {
      id: 'map-a',
      titulo: 'Mapa Cadastro CC',
      artifact_type: 'MAPA',
      depth: 3,
      ancestor_ids: ['root', 'prod-a', 'sub-cadastro-a']
    };

    const prodB = { id: 'prod-b', titulo: 'Cartões', artifact_type: 'NO', depth: 1 };
    const subB = { id: 'sub-cadastro-b', titulo: 'Cadastro', artifact_type: 'NO', depth: 2 };
    const mapaB = {
      id: 'map-b',
      titulo: 'Mapa Cadastro Cartões',
      artifact_type: 'MAPA',
      depth: 3,
      ancestor_ids: ['root', 'prod-b', 'sub-cadastro-b']
    };

    const artifactsById = new Map([
      ['root', root],
      ['prod-a', prodA],
      ['sub-cadastro-a', subA],
      ['map-a', mapaA],
      ['prod-b', prodB],
      ['sub-cadastro-b', subB],
      ['map-b', mapaB]
    ]);

    const resA = resolveArtifactTaxonomy(mapaA, artifactsById);
    const resB = resolveArtifactTaxonomy(mapaB, artifactsById);

    assert.equal(resA.product?.name, 'Conta Corrente');
    assert.equal(resB.product?.name, 'Cartões');
    // Subprodutos têm o mesmo nome visual, mas IDs diferentes
    assert.equal(resA.subproduct?.name, 'Cadastro');
    assert.equal(resB.subproduct?.name, 'Cadastro');
    assert.notEqual(resA.subproductKey, resB.subproductKey);
    assert.equal(resA.subproductKey, 'sub-cadastro-a');
    assert.equal(resB.subproductKey, 'sub-cadastro-b');
  });

  it('6. Nó intermediário vazio: Raiz → Produto → Pasta Vazia → Subproduto → Mapa', () => {
    const root = { id: 'root', titulo: 'Home', artifact_type: 'RAIZ', depth: 0 };
    const prod = { id: 'prod-invest', titulo: 'Investimentos', artifact_type: 'NO', depth: 1 };
    const pastaVazia = { id: 'pasta-vazia', titulo: 'Renda Fixa', artifact_type: 'NO', depth: 2 };
    const sub = { id: 'sub-cdb', titulo: 'CDB', artifact_type: 'NO', depth: 3 };
    const mapa = {
      id: 'map-cdb',
      titulo: 'Aplicação CDB',
      artifact_type: 'MAPA',
      depth: 4,
      ancestor_ids: ['root', 'prod-invest', 'pasta-vazia', 'sub-cdb']
    };

    const artifactsById = new Map([
      ['root', root],
      ['prod-invest', prod],
      ['pasta-vazia', pastaVazia],
      ['sub-cdb', sub],
      ['map-cdb', mapa]
    ]);

    const res = resolveArtifactTaxonomy(mapa, artifactsById);

    assert.equal(res.product?.name, 'Investimentos');
    assert.equal(res.subproduct?.name, 'Renda Fixa');
    assert.equal(res.descendantPath.length, 2);
    assert.equal(res.displayPath, 'Renda Fixa › CDB');
  });

  it('7. Nó que é documentação ou mapa: nunca pode ser promovido a produto ou subproduto', () => {
    const root = { id: 'root', titulo: 'Home', artifact_type: 'RAIZ', depth: 0 };
    const docNode = { id: 'doc-intro', titulo: 'Guia de Estilo', artifact_type: 'DOCUMENTACAO', depth: 1 };
    const mapNode = { id: 'map-anterior', titulo: 'Mapa Legado', artifact_type: 'MAPA', depth: 2 };
    const prodReal = { id: 'prod-seguros', titulo: 'Seguros', artifact_type: 'NO', depth: 3 };
    const subReal = { id: 'sub-auto', titulo: 'Auto', artifact_type: 'NO', depth: 4 };
    const mapa = {
      id: 'map-seguro-auto',
      titulo: 'Contratação Seguro Auto',
      artifact_type: 'MAPA',
      depth: 5,
      ancestor_ids: ['root', 'doc-intro', 'map-anterior', 'prod-seguros', 'sub-auto']
    };

    const artifactsById = new Map([
      ['root', root],
      ['doc-intro', docNode],
      ['map-anterior', mapNode],
      ['prod-seguros', prodReal],
      ['sub-auto', subReal],
      ['map-seguro-auto', mapa]
    ]);

    const res = resolveArtifactTaxonomy(mapa, artifactsById);

    // Guia de Estilo e Mapa Legado não podem ser produto nem subproduto
    assert.equal(res.product?.name, 'Seguros');
    assert.equal(res.subproduct?.name, 'Auto');
  });

  it('8. Fallback para inventario.json atual: abre perfeitamente sem quebras', () => {
    const invPath = path.resolve(process.cwd(), 'backend/data/inventario.json');
    if (fs.existsSync(invPath)) {
      const data = JSON.parse(fs.readFileSync(invPath, 'utf8'));
      const items = Array.isArray(data) ? data : data.resultados || [];
      
      const artifactsById = new Map(items.map(a => [String(a.id), a]));
      let resolvedCount = 0;

      for (const item of items) {
        if (item.artifact_type === 'MAPA') {
          const res = resolveArtifactTaxonomy(item, artifactsById);
          assert.ok(res, 'Deve retornar resultado de taxonomia');
          assert.ok(typeof res.productKey === 'string');
          assert.ok(typeof res.subproductKey === 'string');
          assert.ok(Array.isArray(res.descendantPath));
          resolvedCount++;
        }
      }

      assert.ok(resolvedCount > 0, 'Deve resolver todos os mapas do inventario.json');
    }
  });
});
