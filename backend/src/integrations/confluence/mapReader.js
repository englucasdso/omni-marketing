import crypto from 'crypto';
import { ParameterParser } from './parameterParser.js';

export class MapReader {
  constructor(transport) {
    this.transport = transport;
    this.parameterParser = new ParameterParser();
  }

  limpar(txt) {
    return String(txt || '').replace(/<[^>]+>/g, ' ') // remove tags HTML simples
                            .replace(/&nbsp;/g, ' ')
                            .replace(/\s+/g, ' ').trim();
  }

  normalizarChave(txt) {
    return this.limpar(txt)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[|/()\-]+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '_');
  }

  extrairValorDeCelula(cellHtml) {
    if (!cellHtml) return '';
    
    // extrai href se for link
    const hrefMatch = cellHtml.match(/<a[^>]+href=["']([^"']+)["']/i);
    if (hrefMatch) {
      return hrefMatch[1].trim();
    }
    
    // verifica se tem panelContent
    const panelMatch = cellHtml.match(/<div[^>]+class=["'][^"']*panelContent[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    if (panelMatch) {
      return this.limpar(panelMatch[1]);
    }
    
    return this.limpar(cellHtml);
  }

  extrairCabecalho(html) {
    const campos = {};
    const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
    if (!tableMatch) return campos;

    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch;
    while ((trMatch = trRegex.exec(tableMatch[1])) !== null) {
      const tdRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
      const cells = [];
      let tdMatch;
      while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
        cells.push(tdMatch[1]);
      }
      
      if (cells.length >= 2) {
        const label = this.limpar(cells[0]);
        const valor = this.extrairValorDeCelula(cells[1]);
        if (label) {
          campos[this.normalizarChave(label)] = valor;
        }
      }
    }
    return campos;
  }

  extrairTelas(html, mapId, produto, fluxo) {
    const screens = [];
    
    // Busca blocos de código
    // Geralmente num <pre>, <code> ou macro do confluence
    const codeRegex = /<script[^>]*>([\s\S]*?)<\/script>|<pre[^>]*>([\s\S]*?)<\/pre>|<code[^>]*>([\s\S]*?)<\/code>/gi;
    
    let match;
    let index = 0;
    while ((match = codeRegex.exec(html)) !== null) {
      const codeBlock = match[1] || match[2] || match[3];
      if (!codeBlock) continue;
      
      const unescapedCode = codeBlock.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      
      // Se tiver dataLayer.push extrai parâmetros
      if (unescapedCode.includes('dataLayer.push') || unescapedCode.includes('dataLayer')) {
        const paramSets = this.parameterParser.extractDataLayer(unescapedCode);
        
        for (const params of paramSets) {
          const hash = crypto.createHash('sha256').update(`${mapId}-${produto}-${fluxo}-${index}`).digest('hex');
          
          screens.push({
            screen_id: hash,
            screen_index: index,
            raw_code: unescapedCode,
            parameters: params.map(p => ({
              ...p,
              map_id: mapId,
              screen_id: hash,
              screen_index: index,
              product: produto,
              flow: fluxo
            }))
          });
          index++;
        }
      }
    }
    
    return screens;
  }

  async readMapDetails(pageId, produto, fluxo) {
    const html = await this.transport.fetchApi(`/pages/viewpage.action?pageId=${pageId}`);
    const cabecalho = this.extrairCabecalho(html);
    const telas = this.extrairTelas(html, pageId, produto, fluxo);
    
    return {
      cabecalho,
      telas
    };
  }
}
