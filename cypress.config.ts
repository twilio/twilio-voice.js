const { defineConfig } = require('cypress');

module.exports = defineConfig({
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
