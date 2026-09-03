import { ConfluenceSession } from './confluenceSession.js';
import { ConfluenceTransport } from './confluenceTransport.js';
import { TreeCrawler } from './treeCrawler.js';
import { MapReader } from './mapReader.js';
import { MeasurementClassifier } from '../../services/classification/measurementClassifier.js';
import { InventoryRepository } from '../../repositories/inventoryRepository.js';

const CONFLUENCE_BASE_URL = 'https://confluence.bradesco.com.br:8443';

export class ConfluenceOrchestrator {
  constructor() {
    this.isCollecting = false;
    this.session = null;
    this.transport = null;
    this.repository = new InventoryRepository();
    this.classifier = new MeasurementClassifier();
  }

  async abort() {
    if (this.isCollecting) {
      console.log('[Orchestrator] Cancelamento solicitado pelo usuário.');
      if (this.transport) this.transport.cancel();
      if (this.session) {
        await this.session.close();
      }
      this.isCollecting = false;
      console.log('[Orchestrator] Mapeamento cancelado com sucesso.');
    }
  }

  ehMapaValidoPorTitulo(title) {
    return title && String(title).startsWith('MT -');
  }

  extrairProdutoSubprodutoDaTrilha(trilhaAtual, nivelAtual) {
    const ancestrais = trilhaAtual.filter(x => Number(x.nivel) < Number(nivelAtual));
    
    const p = ancestrais.find(x => Number(x.nivel) === 1);
    const sp = ancestrais.find(x => Number(x.nivel) === 2);
    
    return {
      produto: p ? String(p.titulo || '').trim() : '',
      subproduto: sp ? String(sp.titulo || '').trim() : ''
    };
  }

  async run(rootPageId, maxRows, username, password) {
    if (this.isCollecting) {
      throw new Error('A sincronização já está em andamento. Aguarde...');
    }

    this.isCollecting = true;
    console.time('Coleta Confluence Refatorada');
    
    const allRows = [];
    
    let stats = {
      reused: 0,
      new: 0,
      altered: 0,
      total: 0
    };

    try {
      // 1. Carrega o cache (sincronização incremental diretamente do inventario.json)
      const existingInventory = this.repository.getInventory();
      const invMap = new Map();
      for (const item of existingInventory) {
        invMap.set(String(item.id), item);
      }

      // 2. Inicia Sessão obrigatória no navegador
      this.session = new ConfluenceSession(CONFLUENCE_BASE_URL);
      const page = await this.session.authenticate(rootPageId, username, password);
      
      this.transport = new ConfluenceTransport(page);

      // Validação inicial obrigatória no contexto do navegador
      console.log('[BrowserTransport] Contexto: browser');
      const hostInfo = await page.evaluate(() => window.location.host);
      console.log(`[BrowserTransport] Host autenticado: ${hostInfo}`);

      const rootData = await this.transport.checkRoot(rootPageId);
      console.log('[BrowserTransport] Página raiz: HTTP 200');
      const childrenFound = (rootData && rootData.results) ? rootData.results.length : 0;
      console.log(`[BrowserTransport] Filhos encontrados: ${childrenFound}`);

      const crawler = new TreeCrawler(this.transport, 4); // Max 4 reqs simultâneas na árvore
      const mapReader = new MapReader(this.transport);

      // 3. Processa cada página da árvore
      await crawler.crawl(rootPageId, async (page, ehFolha, nivel, parentTitulo, trilhaAtual) => {
        const idStr = String(page.id);
        const estrutura = this.extrairProdutoSubprodutoDaTrilha(trilhaAtual, nivel);
        
        let cabecalho = {};
        let headerObj = {};
        let tipo_mapa = '';
        let telasDoMapa = [];
        let artifact_type = 'DOCUMENTACAO';
        let measurement_class = 'NAO_CLASSIFICADO';
        let statusSummary = {};
        let declaredStatus = null;
        let calculatedStatus = 'NAO_IDENTIFICADO';
        let statusDivergent = false;
        let parameterSummary = [];
        let patternSummary = [];

        if (ehFolha) {
          const currentVersion = (page.version && page.version.number) || '';
          const currentUpdated = (page.history && page.history.lastUpdated && page.history.lastUpdated.when) || '';
          
          const cached = invMap.get(idStr);
          
          // Reutiliza se existe e versão não mudou
          if (cached && cached.versao === currentVersion && cached.ultima_atualizacao === currentUpdated) {
            cabecalho = {
              produto_servico: cached.produto_servico,
              numero_task: cached.numero_da_task,
              figma_xd: cached.figma_xd,
              ga4_stream_id: cached.propriedade_ga4_stream_id,
              firebase: cached.firebase,
              gtm_id: cached.gtm_id,
              dominio: cached.dominio_exclusivo_web,
              status_homologacao: cached.declared_status
            };
            headerObj = cached.header || {};
            telasDoMapa = cached.screens || [];
            artifact_type = cached.artifact_type || (telasDoMapa.length > 0 ? 'MAPA' : 'DOCUMENTACAO');
            measurement_class = cached.measurement_class || 'NAO_CLASSIFICADO';
            tipo_mapa = cached.tipo_mapa || (artifact_type === 'DOCUMENTACAO' ? 'Doc' : measurement_class);
            statusSummary = cached.status_summary || {};
            declaredStatus = cached.declared_status || null;
            calculatedStatus = cached.calculated_status || 'NAO_IDENTIFICADO';
            statusDivergent = Boolean(cached.status_divergent);
            parameterSummary = cached.parameter_summary || [];
            patternSummary = cached.pattern_summary || [];
            stats.reused++;
          } else {
            const isValido = this.ehMapaValidoPorTitulo(page.title);
            
            if (isValido) {
              const details = await mapReader.readMapDetails(idStr, estrutura.produto, estrutura.subproduto);
              cabecalho = details.cabecalho || {};
              headerObj = details.header || {};
              telasDoMapa = details.telas || [];
              parameterSummary = details.parameter_summary || [];
              patternSummary = details.pattern_summary || [];

              const classification = this.classifier.classifyMap(telasDoMapa, cabecalho.status_homologacao);
              artifact_type = classification.artifact_type;
              measurement_class = classification.measurement_class;
              statusSummary = classification.status_summary;
              declaredStatus = classification.declared_status;
              calculatedStatus = classification.calculated_status;
              statusDivergent = classification.status_divergent;
              tipo_mapa = artifact_type === 'DOCUMENTACAO' ? 'Doc' : measurement_class;
              
              if (cached) stats.altered++;
              else stats.new++;
            } else {
              // Documentação solta
              artifact_type = 'DOCUMENTACAO';
              measurement_class = 'NAO_CLASSIFICADO';
              tipo_mapa = 'Doc';
            }
          }
        }

        const row = {
          id: idStr || '',
          titulo: String(page.title || '').trim(),
          link: CONFLUENCE_BASE_URL + '/pages/viewpage.action?pageId=' + page.id,
          ultima_atualizacao: (page.history && page.history.lastUpdated && page.history.lastUpdated.when) || '',
          responsavel: (page.version && page.version.by && page.version.by.displayName) || '',
          versao: (page.version && page.version.number) || '',
          nivel: nivel,
          taxonomy_depth: nivel,
          pai: parentTitulo || '',
          produto: estrutura.produto,
          subproduto: estrutura.subproduto,
          artifact_type,
          measurement_class,
          header: headerObj,
          screens: telasDoMapa,
          status_summary: statusSummary,
          declared_status: declaredStatus,
          calculated_status: calculatedStatus,
          status_divergent: statusDivergent,
          parameter_summary: parameterSummary,
          pattern_summary: patternSummary,
          // Campos planos para retrocompatibilidade
          produto_servico: cabecalho.produto_servico || '',
          numero_da_task: cabecalho.numero_task || cabecalho.n_da_task || cabecalho.numero_da_task || '',
          figma_xd: cabecalho.figma_xd || cabecalho.figma || '',
          propriedade_ga4_stream_id: cabecalho.ga4_stream_id || cabecalho.propriedade_ga4_stream_id || '',
          firebase: cabecalho.firebase || '',
          gtm_id: cabecalho.gtm_id || '',
          dominio_exclusivo_web: cabecalho.dominio || cabecalho.dominio_exclusivo_web || '',
          tipo_mapa: tipo_mapa || 'Doc'
        };

        allRows.push(row);
        
        stats.total++;
        if (stats.total % 50 === 0) {
          console.log(`Processados: ${stats.total}`);
        }
      }, maxRows);

      // 4. Salva de forma segura usando o repositório diretamente no inventario.json
      this.repository.saveSafely(allRows);
      
      console.log('--- Resumo da Coleta ---');
      console.log(`Duração: Concluída.`);
      console.log(`Total encontrado: ${stats.total}`);
      console.log(`Requisições HTTP: ${this.transport.metrics.totalRequests}`);
      console.log(`Reutilizados do cache: ${stats.reused}`);
      console.log(`Novos: ${stats.new}`);
      console.log(`Alterados: ${stats.altered}`);
      console.log(`Respostas 429: ${this.transport.metrics.total429s}`);
      console.log(`Erros HTTP: ${this.transport.metrics.totalErrors}`);
      console.log('------------------------');

      return allRows;
    } finally {
      if (this.session) {
        await this.session.close();
      }
      this.isCollecting = false;
      console.timeEnd('Coleta Confluence Refatorada');
    }
  }
}
