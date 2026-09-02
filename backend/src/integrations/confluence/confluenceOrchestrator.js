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
    
    // Allow taxonomy extraction without strict max limits
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
    const allScreens = [];
    
    let stats = {
      reused: 0,
      new: 0,
      altered: 0,
      total: 0
    };

    try {
      // 1. Carrega o cache (sincronização incremental)
      const existingInventory = await this.repository.loadExistingInventory();
      const existingDetails = await this.repository.loadExistingDetails();
      
      const invMap = new Map();
      for (const item of existingInventory) {
        invMap.set(String(item.id), item);
      }
      const detMap = new Map();
      for (const det of existingDetails) {
        if (!detMap.has(String(det.map_id))) {
          detMap.set(String(det.map_id), []);
        }
        detMap.get(String(det.map_id)).push(det);
      }

      // 2. Inicia Sessão
      this.session = new ConfluenceSession(CONFLUENCE_BASE_URL);
      const cookieString = await this.session.authenticate(rootPageId, username, password);
      
      this.transport = new ConfluenceTransport(CONFLUENCE_BASE_URL, cookieString);
      const crawler = new TreeCrawler(this.transport, 4); // Max 4 reqs simultâneas na árvore
      const mapReader = new MapReader(this.transport);

      // 3. Processa cada página da árvore
      await crawler.crawl(rootPageId, async (page, ehFolha, nivel, parentTitulo, trilhaAtual) => {
        const idStr = String(page.id);
        const estrutura = this.extrairProdutoSubprodutoDaTrilha(trilhaAtual, nivel);
        
        let cabecalho = {};
        let tipo_mapa = '';
        let telasDoMapa = [];

        if (ehFolha) {
          const currentVersion = (page.version && page.version.number) || '';
          const currentUpdated = (page.history && page.history.lastUpdated && page.history.lastUpdated.when) || '';
          
          const cached = invMap.get(idStr);
          
          // Reutiliza se existe e versão não mudou
          if (cached && cached.versao === currentVersion && cached.ultima_atualizacao === currentUpdated) {
            cabecalho = {
              produto_servico: cached.produto_servico,
              n_da_task: cached.numero_da_task,
              figma_xd: cached.figma_xd,
              propriedade_ga4_stream_id: cached.propriedade_ga4_stream_id,
              firebase: cached.firebase,
              gtm_id: cached.gtm_id,
              dominio_exclusivo_web: cached.dominio_exclusivo_web
            };
            tipo_mapa = cached.tipo_mapa;
            if (detMap.has(idStr)) {
              telasDoMapa = detMap.get(idStr);
            }
            stats.reused++;
          } else {
            // Se for folha, verifica se é um mapa ou doc antes de baixar o HTML detalhado
            // Se não for um mapa válido pelo título (Ex: não começa com 'MT -'), ainda podemos extrair
            // mas vamos focar nos válidos. O requisito diz para preservar docs.
            
            const isValido = this.ehMapaValidoPorTitulo(page.title);
            
            // Para não baixar todas as folhas irrelevantes
            if (isValido) {
              const details = await mapReader.readMapDetails(idStr, estrutura.produto, estrutura.subproduto);
              cabecalho = details.cabecalho;
              telasDoMapa = details.telas;
              tipo_mapa = this.classifier.classify(telasDoMapa);
              
              if (cached) stats.altered++;
              else stats.new++;
            } else {
              // Documentação solta
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
          pai: parentTitulo || '',
          produto: estrutura.produto,
          subproduto: estrutura.subproduto,
          produto_servico: cabecalho.produto_servico || cabecalho.produto_servico_ || '',
          numero_da_task: cabecalho.n_da_task || cabecalho.numero_da_task || '',
          figma_xd: cabecalho.figma_xd || cabecalho.figma || '',
          propriedade_ga4_stream_id: cabecalho.propriedade_ga4_stream_id || cabecalho.ga4_id || '',
          firebase: cabecalho.firebase || '',
          gtm_id: cabecalho.gtm_id || '',
          dominio_exclusivo_web: cabecalho.dominio_exclusivo_web || cabecalho.dominio_exclusivo_web_ || '',
          tipo_mapa: tipo_mapa
        };

        allRows.push(row);
        if (telasDoMapa.length > 0) {
          allScreens.push(...telasDoMapa);
        }
        
        stats.total++;
        if (stats.total % 50 === 0) {
          console.log(`Processados: ${stats.total}`);
        }
      }, maxRows);

      // 4. Salva de forma segura usando o repositório
      await this.repository.saveSafely(allRows, allScreens);
      
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
    } catch (e) {
      console.error(`[Orchestrator] Erro na coleta: ${e.message}`);
      throw e;
    } finally {
      this.isCollecting = false;
      if (this.session) {
        await this.session.close();
      }
      console.timeEnd('Coleta Confluence Refatorada');
    }
  }
}
