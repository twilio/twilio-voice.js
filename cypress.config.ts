const { defineConfig } = require('cypress');
const VendorProxy = require('./tests/lib/vendorProxy');

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
