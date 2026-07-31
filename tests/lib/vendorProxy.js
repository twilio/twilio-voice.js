'use strict';

const http = require('http');

// GitHub Actions OIDC tokens are valid for ~5 minutes; a 4-min ceiling leaves a
// 1-min margin so a long-running spec file never signs with a stale token.
const TOKEN_MAX_AGE_MS = 4 * 60 * 1000;

/**
 * Provides a local webserver interface to the credential vending Function.
 * Runs in the Cypress Node process and adds the authorization header, so tests
 * running in browser do not handle credentials.
 *
 * Tests POST to /vend with the vending request body. The status code and body
 * of the vending response are returned as-is.
*/
class VendorProxy {
  constructor() {
    this._server = null;
    this._cachedToken = null;
    this._cachedTokenMintedAt = 0;
    this._cachedTokenPromise = null;
  }

  /**
   * Start listening on an OS-assigned port on the loopback interface.
   * @returns {Promise<string>} the URL specs should POST to
   */
  start() {
    this._server = http.createServer((req, res) => this._handleRequest(req, res));
    return new Promise((resolve, reject) => {
      this._server.once('error', reject);
      this._server.listen(0, '127.0.0.1', () => {
        resolve(`http://127.0.0.1:${this._server.address().port}/vend`);
      });
    });
  }

  /**
   * Stop listening. Safe to call when not started.
   */
  stop() {
    if (this._server) {
      this._server.close();
      this._server = null;
    }
  }

  async _handleRequest(req, res) {
    // This port is a different origin than the page Cypress serves.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== 'POST' || req.url !== '/vend') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
      return;
    }

    try {
      const body = await readBody(req);
      const { status, text } = await this._forward(body);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(text);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  async _forward(body) {
    const vendorUrl = process.env.VENDOR_URL;
    if (!vendorUrl) {
      throw new Error('VENDOR_URL is not set');
    }

    const token = await this._getToken();
    const response = await fetch(vendorUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body,
    });

    return { status: response.status, text: await response.text() };
  }

  _getToken() {
    if (this._cachedTokenPromise) {
      return this._cachedTokenPromise;
    }
    if (this._cachedToken && Date.now() - this._cachedTokenMintedAt <= TOKEN_MAX_AGE_MS) {
      return Promise.resolve(this._cachedToken);
    }
    // Cache the in-flight promise so concurrent requests (e.g. a spec minting
    // two access tokens via Promise.all) share one mint instead of racing.
    this._cachedTokenPromise = mintToken().then(token => {
      this._cachedToken = token;
      this._cachedTokenMintedAt = Date.now();
      this._cachedTokenPromise = null;
      return token;
    }, error => {
      this._cachedTokenPromise = null;
      throw error;
    });
    return this._cachedTokenPromise;
  }
}

/**
 * Mint a GitHub Actions OIDC token, or use VENDOR_TOKEN for local runs.
 * @returns {Promise<string>}
 */
async function mintToken() {
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;

  if (!requestToken || !requestUrl) {
    if (!process.env.VENDOR_TOKEN) {
      throw new Error('Set VENDOR_TOKEN to run outside of GitHub Actions');
    }
    return process.env.VENDOR_TOKEN;
  }

  const audience = process.env.VENDOR_AUDIENCE;
  if (!audience) {
    throw new Error('VENDOR_AUDIENCE is not set');
  }

  const response = await fetch(`${requestUrl}&audience=${encodeURIComponent(audience)}`, {
    headers: { Authorization: `bearer ${requestToken}` },
  });
  if (!response.ok) {
    throw new Error(`OIDC token request failed: ${response.status}`);
  }

  const body = await response.json();
  return body.value;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

module.exports = VendorProxy;
