'use strict';

// GitHub Actions OIDC tokens are valid for ~5 minutes; a 4-min ceiling leaves a
// 1-min margin so a multi-minute spec file never signs with a stale token.
const TOKEN_MAX_AGE_MS = 4 * 60 * 1000;

// Cypress re-evaluates this module per spec file, so these always start unset.
let cachedToken = null;
let cachedTokenMintedAt = 0;
let cachedTokenPromise = null;

/**
 * @returns {Promise<string>} a vendor OIDC token no older than TOKEN_MAX_AGE_MS
 */
function getVendorToken() {
  if (cachedTokenPromise) {
    return cachedTokenPromise;
  }
  if (cachedToken && Date.now() - cachedTokenMintedAt <= TOKEN_MAX_AGE_MS) {
    return Promise.resolve(cachedToken);
  }
  // Cache the in-flight promise so concurrent callers (e.g. minting two tokens
  // via Promise.all) share one mint instead of racing to mint their own.
  cachedTokenPromise = cy.task('mintVendorToken').then(token => {
    cachedToken = token;
    cachedTokenMintedAt = Date.now();
    cachedTokenPromise = null;
    return token;
  }, error => {
    cachedTokenPromise = null;
    throw error;
  });
  return cachedTokenPromise;
}

/**
 * Call the e2e credential-vending Function.
 * @param {string} action
 * @param {object} params
 * @returns {Promise<*>} the parsed JSON response body
 */
async function callVendor(action, params) {
  const vendorUrl = Cypress.env('VENDOR_URL');

  if (!vendorUrl) {
    throw new Error('callVendor: VENDOR_URL is not set');
  }

  const vendorToken = await getVendorToken();

  const body = JSON.stringify(Object.assign({ action }, params));

  const response = await fetch(vendorUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${vendorToken}`
    },
    body
  });

  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`callVendor: non-JSON response from vendor: ${text}`);
  }

  if (!response.ok) {
    throw new Error(`callVendor: ${action} failed (${response.status}): ${parsed.error || JSON.stringify(parsed)}`);
  }
  return parsed;
}

module.exports = callVendor;
