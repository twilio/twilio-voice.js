'use strict';

const crypto = require('crypto');
const http = require('http');
const Vendor = require('./vend');

/**
 * Provides a local webserver interface to the credential vending Function.
 * Runs in the Cypress Node process and adds the authorization header, so tests
 * running in browser do not handle credentials.
 *
 * Tests POST to /vend with the vending request body and the per-run secret in
 * the X-Vendor-Proxy-Secret header. The status code and body of the vending
 * response are returned as-is.
*/
class VendorProxy {
  constructor() {
    this._server = null;
    this._secret = crypto.randomUUID();
    this._vendor = new Vendor();
  }

  /**
   * @returns {string} the per-run secret /vend requires, for injection into the
   *   Cypress test env
   */
  get secret() {
    return this._secret;
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Vendor-Proxy-Secret');

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

    if (req.headers['x-vendor-proxy-secret'] !== this._secret) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'forbidden' }));
      return;
    }

    try {
      const body = await readBody(req);
      const { status, text } = await this._vendor.vend(body);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(text);
    } catch (error) {
      // Cypress surfaces this process's stderr in the run output, which is the
      // only place the cause is visible; the response body stays generic.
      console.error('[vendorProxy] /vend failed', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal error' }));
    }
  }
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
