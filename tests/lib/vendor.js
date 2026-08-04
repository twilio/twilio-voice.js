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
  const proxySecret = Cypress.env('VENDOR_PROXY_SECRET');

  if (!proxyUrl) {
    throw new Error('callVendor: VENDOR_PROXY_URL is not set');
  }

  if (!proxySecret) {
    throw new Error('callVendor: VENDOR_PROXY_SECRET is not set');
  }

  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Vendor-Proxy-Secret': proxySecret,
    },
    body: JSON.stringify(Object.assign({ action }, params)),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`callVendor: ${action} failed (${response.status}): ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`callVendor: non-JSON response from vendor: ${text}`);
  }
}

module.exports = callVendor;
