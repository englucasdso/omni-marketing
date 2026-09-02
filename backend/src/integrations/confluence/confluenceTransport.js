export class ConfluenceTransport {
  constructor(baseUrl, cookieString) {
    this.baseUrl = baseUrl;
    this.cookieString = cookieString;
    this.isCancelled = false;
    this.metrics = {
      totalRequests: 0,
      total429s: 0,
      totalErrors: 0
    };
  }

  cancel() {
    this.isCancelled = true;
  }

  async fetchApi(endpoint, retries = 5, backoff = 1000) {
    if (this.isCancelled) throw new Error('Operação cancelada pelo usuário.');

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    this.metrics.totalRequests++;

    try {
      const response = await fetch(url, {
        headers: {
          'Cookie': this.cookieString,
          'Accept': 'application/json, text/html'
        }
      });

      if (!response.ok) {
        if (response.status === 429) {
          this.metrics.total429s++;
          if (retries > 0) {
            let waitTime = backoff;
            const retryAfter = response.headers.get('Retry-After');
            if (retryAfter) {
              const seconds = parseInt(retryAfter, 10);
              if (!isNaN(seconds)) waitTime = seconds * 1000;
            }
            
            // Limit max wait time to 30 seconds
            waitTime = Math.min(waitTime, 30000);
            
            console.log(`[Transport] HTTP 429: Too Many Requests. Retrying in ${waitTime}ms... (${retries} retries left)`);
            await new Promise(r => setTimeout(r, waitTime));
            
            return this.fetchApi(endpoint, retries - 1, backoff * 2);
          } else {
            throw new Error(`Excedido o número de tentativas (HTTP 429) para ${endpoint}`);
          }
        }
        throw new Error(`HTTP ${response.status} ao acessar ${endpoint}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      return await response.text();

    } catch (e) {
      if (!this.isCancelled) {
        this.metrics.totalErrors++;
        // If it's a 429 or other retryable network error
        if (e.message.includes('fetch failed') || e.cause?.code === 'ECONNRESET') {
            if (retries > 0) {
                console.log(`[Transport] Network error. Retrying in ${backoff}ms... (${retries} retries left)`);
                await new Promise(r => setTimeout(r, backoff));
                return this.fetchApi(endpoint, retries - 1, backoff * 2);
            }
        }
      }
      throw e;
    }
  }
}
