import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MapReader } from '../src/integrations/confluence/mapReader.js';
import { MeasurementClassifier } from '../src/services/classification/measurementClassifier.js';

describe('Extração e Normalização de Status de Telas do Confluence', () => {
  const dummyTransport = {
    fetchApi: async () => ''
  };
  const mapReader = new MapReader(dummyTransport);
  const classifier = new MeasurementClassifier();

  // 1. Tabela com status NOVO
  it('1. Deve ler corretamente tabela com status NOVO via data-macro-name="status"', () => {
    const html = `
      <table class="confluenceTable">
        <tbody>
          <tr>
            <th>Status</th>
            <td><span class="status-macro aui-lozenge" data-macro-name="status">NOVO</span></td>
          </tr>
          <tr>
            <th>Instrução</th>
            <td>Clique no botão Prosseguir para avançar</td>
          </tr>
          <tr>
            <th>Código de Disparo</th>
            <td><pre>dataLayer.push({ event: 'novo_fluxo' });</pre></td>
          </tr>
        </tbody>
      </table>
    `;
    const screens = mapReader.extrairTelas(html, 'map-novo', 'Omni Marketing', 'Fluxo 1');
    assert.strictEqual(screens.length, 1, 'Deve detectar exatamente 1 tela');
    assert.strictEqual(screens[0].status, 'NOVO');
    assert.strictEqual(screens[0].status_raw, 'NOVO');
  });

  // 2. Tabela com status VALIDADO
  it('2. Deve ler corretamente tabela com status VALIDADO e ignorar classes cosméticas como aui-lozenge-success', () => {
    const html = `
      <table class="confluenceTable">
        <tbody>
          <tr>
            <th>Status</th>
            <td><span class="status-macro aui-lozenge aui-lozenge-success" data-macro-name="status">VALIDADO</span></td>
          </tr>
          <tr>
            <th>Instrução</th>
            <td>Carregamento da tela inicial</td>
          </tr>
          <tr>
            <th>Código de Disparo</th>
            <td><pre>dataLayer.push({ event: 'screen_view' });</pre></td>
          </tr>
        </tbody>
      </table>
    `;
    const screens = mapReader.extrairTelas(html, 'map-val', 'Omni Marketing', 'Fluxo 1');
    assert.strictEqual(screens.length, 1);
    assert.strictEqual(screens[0].status, 'VALIDADO');
    assert.strictEqual(screens[0].status_raw, 'VALIDADO');
  });

  // 3. Status CORREÇÃO com acentuação e fallback sem tag de macro
  it('3. Deve normalizar status "CORREÇÃO" para "CORRECAO" e preservar status_raw', () => {
    const html = `
      <table class="confluenceTable">
        <tbody>
          <tr>
            <th>Status</th>
            <td><span data-macro-name="status">Correção</span></td>
          </tr>
          <tr>
            <th>Instrução</th>
            <td>Ajustar disparo duplicado</td>
          </tr>
          <tr>
            <th>Código de Disparo</th>
            <td><pre>dataLayer.push({ event: 'click_ajuste' });</pre></td>
          </tr>
        </tbody>
      </table>
    `;
    const screens = mapReader.extrairTelas(html, 'map-corr', 'Omni Marketing', 'Fluxo 1');
    assert.strictEqual(screens.length, 1);
    assert.strictEqual(screens[0].status, 'CORRECAO');
    assert.strictEqual(screens[0].status_raw, 'Correção');
  });

  // 4. Página sem header geral
  it('4. Deve extrair telas e status perfeitamente em página sem header geral', () => {
    const html = `
      <div>
        <p>Texto introdutório qualquer sem tabela de cabeçalho.</p>
        <table class="confluenceTable">
          <tbody>
            <tr>
              <th>Status</th>
              <td><span data-macro-name="status">VALIDADO</span></td>
            </tr>
            <tr>
              <th>Instrução</th>
              <td>Primeira tela</td>
            </tr>
            <tr>
              <th>Código de Disparo</th>
              <td><pre>dataLayer.push({ event: 'step_1' });</pre></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    const { header } = mapReader.extrairCabecalho(html);
    assert.deepStrictEqual(header, {}, 'Header deve estar vazio');

    const screens = mapReader.extrairTelas(html, 'map-no-header', 'Omni Marketing', 'Fluxo 1');
    assert.strictEqual(screens.length, 1);
    assert.strictEqual(screens[0].status, 'VALIDADO');
  });

  // 5. Página com várias telas
  it('5. Deve extrair múltiplas telas e calcular soma exata dos status', () => {
    const html = `
      <!-- Tela 1: VALIDADO -->
      <table class="confluenceTable">
        <tr><th>Status</th><td><span data-macro-name="status">VALIDADO</span></td></tr>
        <tr><th>Instrução</th><td>Tela 1</td></tr>
        <tr><th>Código de Disparo</th><td><pre>dataLayer.push({ event: 't1' });</pre></td></tr>
      </table>

      <!-- Tela 2: CORREÇÃO -->
      <table class="confluenceTable">
        <tr><th>Status</th><td><span data-macro-name="status">Correção</span></td></tr>
        <tr><th>Instrução</th><td>Tela 2</td></tr>
        <tr><th>Código de Disparo</th><td><pre>dataLayer.push({ event: 't2' });</pre></td></tr>
      </table>

      <!-- Tela 3: NOVO -->
      <table class="confluenceTable">
        <tr><th>Status</th><td><span data-macro-name="status">NOVO</span></td></tr>
        <tr><th>Instrução</th><td>Tela 3</td></tr>
        <tr><th>Código de Disparo</th><td><pre>dataLayer.push({ event: 't3' });</pre></td></tr>
      </table>

      <!-- Tela 4: EXCLUIR -->
      <table class="confluenceTable">
        <tr><th>Status</th><td><span data-macro-name="status">EXCLUIR</span></td></tr>
        <tr><th>Instrução</th><td>Tela 4</td></tr>
        <tr><th>Código de Disparo</th><td><pre>dataLayer.push({ event: 't4' });</pre></td></tr>
      </table>

      <!-- Tela 5: DESCONTINUAR -->
      <table class="confluenceTable">
        <tr><th>Status</th><td><span data-macro-name="status">DESCONTINUAR</span></td></tr>
        <tr><th>Instrução</th><td>Tela 5</td></tr>
        <tr><th>Código de Disparo</th><td><pre>dataLayer.push({ event: 't5' });</pre></td></tr>
      </table>
    `;
    const screens = mapReader.extrairTelas(html, 'map-multi', 'Omni Marketing', 'Fluxo 1');
    assert.strictEqual(screens.length, 5);

    const classification = classifier.classifyMap(screens, 'VALIDADO');
    const { status_summary, homologado } = classification;

    assert.strictEqual(status_summary.VALIDADO, 1);
    assert.strictEqual(status_summary.CORRECAO, 1);
    assert.strictEqual(status_summary.NOVO, 1);
    assert.strictEqual(status_summary.EXCLUIR, 1);
    assert.strictEqual(status_summary.DESCONTINUAR, 1);
    assert.strictEqual(status_summary.NAO_IDENTIFICADO, 0);

    const totalSum = status_summary.VALIDADO + 
      status_summary.CORRECAO + 
      status_summary.NOVO + 
      status_summary.EXCLUIR + 
      status_summary.DESCONTINUAR + 
      status_summary.NAO_IDENTIFICADO;

    assert.strictEqual(totalSum, screens.length, 'Total da distribuição deve corresponder exatamente ao número de telas');
    assert.strictEqual(homologado, false, 'Mapa com telas em correção/novo não pode ser considerado homologado');
  });

  // 6. Legenda de status que NÃO pode ser confundida com tela
  it('6. Não deve confundir tabela de legenda de status com uma tela', () => {
    const html = `
      <!-- Tabela de Legenda -->
      <table class="confluenceTable">
        <thead>
          <tr>
            <th>Cor</th>
            <th>Significado</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><span class="status-macro aui-lozenge-success" data-macro-name="status">VALIDADO</span></td>
            <td>Tag homologada em produção</td>
          </tr>
          <tr>
            <td><span class="status-macro aui-lozenge-current" data-macro-name="status">NOVO</span></td>
            <td>Tag criada recentemente</td>
          </tr>
        </tbody>
      </table>

      <!-- Tabela Real de Tela -->
      <table class="confluenceTable">
        <tbody>
          <tr>
            <th>Status</th>
            <td><span data-macro-name="status">VALIDADO</span></td>
          </tr>
          <tr>
            <th>Instrução</th>
            <td>Tela de Sucesso</td>
          </tr>
          <tr>
            <th>Código de Disparo</th>
            <td><pre>dataLayer.push({ event: 'sucesso' });</pre></td>
          </tr>
        </tbody>
      </table>
    `;
    const screens = mapReader.extrairTelas(html, 'map-legend', 'Omni Marketing', 'Fluxo 1');
    assert.strictEqual(screens.length, 1, 'Apenas a tabela de tela deve ser extraída; a tabela de legenda deve ser ignorada');
    assert.strictEqual(screens[0].status, 'VALIDADO');
  });

  // 7. Tela sem status
  it('7. Deve classificar tela sem linha de status como NAO_IDENTIFICADO', () => {
    const html = `
      <table class="confluenceTable">
        <tbody>
          <tr>
            <th>Instrução</th>
            <td>Tela sem linha de status</td>
          </tr>
          <tr>
            <th>Código de Disparo</th>
            <td><pre>dataLayer.push({ event: 'no_status' });</pre></td>
          </tr>
        </tbody>
      </table>
    `;
    const screens = mapReader.extrairTelas(html, 'map-no-status', 'Omni Marketing', 'Fluxo 1');
    assert.strictEqual(screens.length, 1);
    assert.strictEqual(screens[0].status, 'NAO_IDENTIFICADO');
    assert.strictEqual(screens[0].status_raw, '');

    const classification = classifier.classifyMap(screens, null);
    assert.strictEqual(classification.status_summary.NAO_IDENTIFICADO, 1);
    assert.strictEqual(classification.homologado, false);
  });

  // 8. Homologação total: mapa com todas as telas VALIDADO
  it('8. Deve marcar homologado = true apenas quando todas as telas forem VALIDADO', () => {
    const screensAllVal = [
      { status: 'VALIDADO', status_raw: 'VALIDADO', snippets: [] },
      { status: 'VALIDADO', status_raw: 'VALIDADO', snippets: [] }
    ];
    const classVal = classifier.classifyMap(screensAllVal, null);
    assert.strictEqual(classVal.homologado, true, 'Todas as telas validadas deve resultar em homologado=true');

    // Documentação ou mapa sem telas: homologado deve ser false
    const classEmpty = classifier.classifyMap([], null);
    assert.strictEqual(classEmpty.homologado, false, 'Mapa sem telas deve ter homologado=false');
  });
});
