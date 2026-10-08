'use strict';

const Twilio = require('twilio');

// GitHub Actions OIDC tokens are valid for ~5 minutes; a 4-min ceiling leaves a
// 1-min margin so a long-running spec file never signs with a stale token.
const TOKEN_MAX_AGE_MS = 4 * 60 * 1000;

/**
 * Vends credentials for the test suites. With VENDOR_URL set, requests go to the
 * credential vending Function, authorized by a GitHub Actions OIDC token (or
 * VENDOR_TOKEN locally). With VENDOR_URL unset, the token is minted here from
 * the credentials in .env instead, so contributors without access to the
 * Function can run the suites.
 */
class Vendor {
  constructor() {
    this._cachedToken = null;
    this._cachedTokenMintedAt = 0;
    this._cachedTokenPromise = null;
  }

  /**
   * @param {string} body the raw vending request body
   * @returns {Promise<{ status: number, text: string }>} the vending response
   */
  vend(body) {
    return process.env.VENDOR_URL
      ? this._forward(body)
      : Promise.resolve(vendLocally(body));
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
 * Mint the voice access token the vending Function would have returned, using
 * the credentials in .env. Runs in a Node process, so a contributor's keys
 * never reach the browser.
 *
 * Configuration problems are returned as a status and body rather than thrown,
 * so the message survives a caller's generic 500 and reaches the test.
 * @param {string} body the raw vending request body
 * @returns {{ status: number, text: string }}
 */
function vendLocally(body) {
  let request;
  try {
    request = JSON.parse(body);
  } catch (e) {
    return errorResponse(400, 'vend: request body is not JSON');
  }

  if (request.action !== 'mint-voice-token') {
    return errorResponse(400, `vend: action "${request.action}" is not ` +
      'supported by local minting; set VENDOR_URL to use the credential vending Function');
  }

  if (request.variant !== undefined && request.variant !== 'stir' && request.variant !== 'extension') {
    return errorResponse(400, `vend: unknown variant "${request.variant}"`);
  }

  // Variant credentials are only checked when asked for, so a contributor
  // without the STIR/SHAKEN or extension TwiML app can still run the rest.
  const required = ['ACCOUNT_SID', 'API_KEY_SID', 'API_KEY_SECRET', 'APPLICATION_SID'];
  if (request.variant === 'stir') {
    required.push('APPLICATION_SID_STIR', 'CALLER_ID');
  } else if (request.variant === 'extension') {
    required.push('APPLICATION_SID_EXTENSION');
  }

  const missing = required.filter(name => !process.env[name]);
  if (missing.length) {
    return errorResponse(500, 'vend: cannot mint a voice token locally; set ' +
      `${missing.join(', ')} in .env, or set VENDOR_URL to vend credentials remotely`);
  }

  const { identity, ttl, outgoingApplicationSid, variant } = request;
  const applicationSid = outgoingApplicationSid || {
    extension: process.env.APPLICATION_SID_EXTENSION,
    stir: process.env.APPLICATION_SID_STIR,
  }[variant] || process.env.APPLICATION_SID;

  const token = new Twilio.jwt.AccessToken(
    process.env.ACCOUNT_SID,
    process.env.API_KEY_SID,
    process.env.API_KEY_SECRET,
    { identity, ttl: ttl || 300 },
  );

  // Specs place calls between two devices, so both ends need incoming allowed.
  // The STIR/SHAKEN app's TwiML reads {{CallerId}}, and the spec connects
  // without params, so the number has to ride along on the grant.
  token.addGrant(new Twilio.jwt.AccessToken.VoiceGrant({
    outgoingApplicationSid: applicationSid,
    outgoingApplicationParams: variant === 'stir'
      ? { CallerId: process.env.CALLER_ID }
      : undefined,
    incomingAllow: !!identity,
  }));

  return { status: 200, text: JSON.stringify({ token: token.toJwt() }) };
}

function errorResponse(status, message) {
  return { status, text: JSON.stringify({ error: message }) };
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

module.exports = Vendor;
