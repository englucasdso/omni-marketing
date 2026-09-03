import { chromium } from 'playwright';
import path from 'path';

export class ConfluenceSession {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.context = null;
    this.userDataDir = path.resolve('backend/data/playwright_session');
  }

  async authenticate(rootPageId, username, password) {
    console.log(`[ConfluenceSession] Initiating Playwright session at: ${this.userDataDir}`);
    
    this.context = await chromium.launchPersistentContext(this.userDataDir, {
      headless: true,
      channel: 'chrome',
      ignoreHTTPSErrors: true,
      viewport: null,
      args: [
        '--start-maximized',
        '--ignore-certificate-errors',
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-web-security'
      ]
    });

    const page = this.context.pages().length > 0 ? this.context.pages()[0] : await this.context.newPage();
    const targetUrl = `${this.baseUrl}/pages/viewpage.action?pageId=${rootPageId}`;

    console.log(`[ConfluenceSession] Navigating to ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    let currentUrl = page.url();
    if (currentUrl.includes('login.action') || currentUrl.includes('dologin.action') || currentUrl.includes('login')) {
      console.log('--- AUTENTICAÇÃO NECESSÁRIA ---');
      if (!username || !password) {
        throw new Error('Credenciais não fornecidas. Digite seu usuário e senha no frontend.');
      }
      
      console.log('[ConfluenceSession] Preenchendo formulário de login...');
      await page.fill('#os_username', username);
      await page.fill('#os_password', password);
      
      console.log('[ConfluenceSession] Clicando em Login...');
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}),
        page.click('#loginButton')
      ]);

      currentUrl = page.url();
      if (currentUrl.includes('login.action') || currentUrl.includes('dologin.action') || currentUrl.includes('login')) {
        const hasErrorAlert = await page.evaluate(() => {
          return document.body.innerText.includes('Authentication failed') ||
                 document.body.innerText.includes('Senha Incorreta') ||
                 document.body.innerText.includes('Invalid credentials');
        });
        if (hasErrorAlert) {
          throw new Error('Falha na autenticação: usuário ou senha incorretos.');
        } else {
          throw new Error('Falha ao logar no Confluence. A URL continuou na página de login.');
        }
      }

      if (!currentUrl.includes(rootPageId)) {
        console.log(`[ConfluenceSession] Navegando novamente para a página base após login...`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      }
    }

    console.log(`[ConfluenceSession] Autenticado com sucesso.`);
    
    this.page = page;
    return page;
  }

  getPage() {
    return this.page;
  }

  async close() {
    if (this.context) {
      try {
        await this.context.close();
      } catch (e) {
        // Ignored
      }
      this.context = null;
      this.page = null;
    }
  }
}
