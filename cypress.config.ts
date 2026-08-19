const { defineConfig } = require('cypress');
const { jwt } = require('twilio');
const VendorProxy = require('./tests/lib/vendorProxy');

// Mint a Voice access token from local .env credentials. Runs in the Cypress
// Node process so the API key secret stays out of the browser bundle, matching
// how the vendor proxy keeps vending credentials server-side.
function mintLocalAccessToken() {
  const token = new jwt.AccessToken(
    process.env.ACCOUNT_SID,
    process.env.API_KEY_SID,
    process.env.API_KEY_SECRET,
    // One token covers the whole run, so the TTL has to outlast it. The
    // identity only labels insights events; SIP auth uses the digest
    // credentials instead.
    { identity: 'sip-local', ttl: 3600 },
  );
  token.addGrant(new jwt.AccessToken.VoiceGrant({
    incomingAllow: true,
    outgoingApplicationSid: process.env.APPLICATION_SID,
  }));
  return token.toJwt();
}

module.exports = defineConfig({
  env: {
    AUTH_TOKEN: process.env.AUTH_TOKEN,
    SIP_SERVER: process.env.SIP_SERVER,
    SIP_URI: process.env.SIP_URI,
    SIP_USERNAME: process.env.SIP_USERNAME,
    SIP_PASSWORD: process.env.SIP_PASSWORD,
    SIP_REGION: process.env.SIP_REGION,
  },
  e2e: {
    defaultCommandTimeout: 10000,
    // Retry failing tests in CI only; fail fast when debugging locally.
    retries: { runMode: 3, openMode: 0 },
    supportFile: false,
    async setupNodeEvents(on, config) {
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
      });

      // Only set when running off a local .env. In CI the vendor proxy
      // supplies tokens, so this stays undefined.
      if (process.env.API_KEY_SID && process.env.API_KEY_SECRET) {
        config.env.LOCAL_ACCESS_TOKEN = mintLocalAccessToken();
      }

      const vendorProxy = new VendorProxy();
      config.env.VENDOR_PROXY_URL = await vendorProxy.start();
      config.env.VENDOR_PROXY_SECRET = vendorProxy.secret;
      on('after:run', () => vendorProxy.stop());

      return config;
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
