export class TreeCrawler {
  constructor(transport, maxConcurrency = 4) {
    this.transport = transport;
    this.maxConcurrency = maxConcurrency;
    this.childrenCache = new Map();
  }

  async getDirectChildren(pageId) {
    if (this.childrenCache.has(pageId)) {
      return this.childrenCache.get(pageId);
    }

    const pageSize = 100;
    let start = 0;
    let pages = [];
    let keepGoing = true;

    while (keepGoing) {
      if (this.transport.isCancelled) throw new Error('Cancelado.');
      
      const endpoint = `/rest/api/content/${pageId}/child/page?limit=${pageSize}&start=${start}&expand=version,history.lastUpdated`;
      const data = await this.transport.fetchApi(endpoint);
      
      const batch = data.results || [];
      pages = pages.concat(batch);
      
      if (batch.length < pageSize) {
        keepGoing = false;
      } else {
        start += pageSize;
      }
    }

    this.childrenCache.set(pageId, pages);
    return pages;
  }

  // Promise pool logic for Node compatibility without external libraries
  async promisePool(items, limit, asyncFn) {
    const results = [];
    let i = 0;
    
    const execWorker = async () => {
      while (i < items.length) {
        if (this.transport.isCancelled) return;
        const index = i++;
        results[index] = await asyncFn(items[index]);
      }
    };

    const workers = [];
    for (let w = 0; w < limit && w < items.length; w++) {
      workers.push(execWorker());
    }

    await Promise.all(workers);
    return results;
  }

  async crawl(rootId, processPageFn, maxRows = null) {
    let processCount = 0;
    
    const traverse = async (pageId, nivel, parentTitulo, trilha) => {
      if (this.transport.isCancelled) return;
      if (maxRows !== null && processCount >= maxRows) return;

      const children = await this.getDirectChildren(pageId);
      
      await this.promisePool(children, this.maxConcurrency, async (page) => {
        if (this.transport.isCancelled) return;
        if (maxRows !== null && processCount >= maxRows) return;
        
        // Cache next level so we know if it's leaf without extra calls
        const netas = await this.getDirectChildren(page.id);
        const ehFolha = netas.length === 0;

        const trilhaAtual = [
          ...trilha,
          {
            id: page.id,
            titulo: String(page.title || '').trim(),
            nivel: nivel
          }
        ];

        // Process this page
        await processPageFn(page, ehFolha, nivel, parentTitulo, trilhaAtual);
        processCount++;

        // Recurse
        if (netas.length > 0) {
          await traverse(page.id, nivel + 1, page.title, trilhaAtual);
        }
      });
    };

    // The root page is processed by its caller, we just start crawling its children
    await traverse(rootId, 1, 'Mapas de Métricas - Salla', []);
  }
}
