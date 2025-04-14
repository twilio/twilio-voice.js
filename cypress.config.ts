const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    supportFile: false,
    setupNodeEvents(on, config) {
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
      });
    },
  },
  reporter: 'junit',
  reporterOptions: {
    mochaFile: 'reports/junit-report.xml',
  },
});
