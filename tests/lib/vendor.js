'use strict';

/**
 * Call the credential vending Function through the local proxy started by
 * cypress.config.ts. See tests/lib/vendorProxy.js.
 * @param {string} action
 * @param {object} params
 * @returns {Promise<*>} the parsed JSON response body
 */
async function callVendor(action, params) {
  const proxyUrl = Cypress.env('VENDOR_PROXY_URL');

  if (!proxyUrl) {
    throw new Error('callVendor: VENDOR_PROXY_URL is not set');
  }

  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ action }, params)),
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
