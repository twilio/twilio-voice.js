// The network suite reuses the e2e setup but runs its own specs.
//
// defaultCommandTimeout is what caps a mocha runnable in Cypress: a `describe`
// level this.timeout() is ignored, so without this every hook and test dies at
// 10s reporting "Cypress test was stopped while running this command". This
// suite waits out real reconnect backoff, so it needs the room. The spec's own
// waitFor timeouts still fire first and give a better message.
//
// The support file forwards the browser console to stdout on failure; the
// base config has no support file.
//
// Retries are off because a failed attempt can leave the container detached
// from the network, so the retry starts from a broken state rather than a
// clean one.
const base = require('./cypress.config');

module.exports = {
  ...base,
  e2e: {
    ...base.e2e,
    defaultCommandTimeout: 180000,
    retries: { runMode: 0, openMode: 0 },
    specPattern: 'cypress/network/**/*.cy.ts',
    supportFile: 'cypress/support/networkConsole.ts',
  },
};
