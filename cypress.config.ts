const { defineConfig } = require('cypress');

module.exports = defineConfig({
  env: {
    ACCOUNT_SID: process.env.ACCOUNT_SID,
    AUTH_TOKEN: process.env.AUTH_TOKEN,
    API_KEY_SECRET: process.env.API_KEY_SECRET,
    API_KEY_SID: process.env.API_KEY_SID,
    APPLICATION_SID: process.env.APPLICATION_SID,
    APPLICATION_SID_STIR: process.env.APPLICATION_SID_STIR,
    CALLER_ID: process.env.CALLER_ID,
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
      });
    },
    specPattern: 'cypress/e2e/**/*.cy.ts',
  },
  reporter: 'junit',
  reporterOptions: {
    mochaFile: 'reports/junit-report-[hash].xml',
  },
});
