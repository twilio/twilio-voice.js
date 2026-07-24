const { defineConfig } = require('cypress');

/**
 * Fetch a fresh GitHub Actions OIDC token for calling the e2e credential-vending
 * Function, or fall back to VENDOR_TOKEN for local development.
 * @returns {Promise<string>}
 */
async function mintVendorToken() {
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  if (!requestToken || !requestUrl) {
    return process.env.VENDOR_TOKEN;
  }
  const audience = encodeURIComponent(process.env.VENDOR_AUDIENCE);
  const response = await fetch(`${requestUrl}&audience=${audience}`, {
    headers: { Authorization: `bearer ${requestToken}` }
  });
  if (!response.ok) {
    throw new Error(`OIDC token request failed: ${response.status}`);
  }
  const body = await response.json();
  return body.value;
}

module.exports = defineConfig({
  env: {
    AUTH_TOKEN: process.env.AUTH_TOKEN,
    VENDOR_URL: process.env.VENDOR_URL,
    VENDOR_TOKEN: process.env.VENDOR_TOKEN,
    VENDOR_AUDIENCE: process.env.VENDOR_AUDIENCE,
  },
  e2e: {
    defaultCommandTimeout: 10000,
    supportFile: false,
    setupNodeEvents(on, config) {
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.family === 'firefox') {
          launchOptions.preferences['media.navigator.streams.fake'] = true;
          return launchOptions;
        }
      });
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
        mintVendorToken,
      });
    },
    specPattern: 'cypress/e2e/**/*.cy.ts',
  },
  reporter: 'cypress-multi-reporters',
  reporterOptions: {
    reporterEnabled: 'spec, mocha-junit-reporter',
    mochaJunitReporterReporterOptions: {
      mochaFile: 'reports/junit-report-[hash].xml',
    },
  },
});
