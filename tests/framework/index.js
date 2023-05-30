'use strict';

const getOptions = require('./options');
const { generateCapabilityToken } = require('../lib/token');
const { spawn } = require('child_process');
const waitForServer = require('./waitforserver');
const webdriver = require('./webdriver');

/**
 * Run a Framework Test. Selenium will be used to navigate to the Test
 * Application and ensure twiliojs can be used.
 * @param {FrameworkTestOptions} options
 * @returns {void}
 * @throws {Error}
 */
function runFrameworkTest(options) {
  options = getOptions(options);
  const name = options.name;
  const host = options.host;
  const port = options.port;
  const path = options.path;
  const start = options.start;
  const timeout = options.timeout;

  describe(name, function() {
    this.timeout(timeout);

    let server;
    let driver;
    let token;

    before(() => {
      server = spawn(start.command, start.args, {
        cwd: path,
        detached: true,
        env: Object.assign({}, start.env, process.env),
        stdio: 'inherit'
      });

      // NOTE(mroberts): Always test with Chrome until we can fix Firefox.
      // driver = process.env.BROWSER === 'firefox'
      //   ? webdriver.buildWebDriverForFirefox()
      //   : webdriver.buildWebDriverForChrome();
      driver = webdriver.buildWebDriverForChrome();

      return waitForServer(host, port, timeout);
    });

    after(() => {
      process.kill(-server.pid);
      return driver.quit();
    });

    beforeEach(() => {
      token = generateCapabilityToken();
      return driver.get(`http://${host}:${port}?token=${token}`);
    });

    it('Successfully returns from .setup()', () => {
      return waitUntilDisconnectedOrSetup(driver);
    });
  });
}

/**
 * Wait until the Test Application calls Device.ready()
 * @param {WebDriver} driver
 * @returns {Promise<void>}
 */
function waitUntilSetup(driver) {
  return webdriver.waitUntilElementLocatedAndTextMatches(driver, 'p',
    /^Setup successful$/);
}

/**
 * Wait until the Test Application errors.
 * @param {WebDriver} driver
 * @returns {Promise<void>}
 */
function waitUntilError(driver) {
  return webdriver.waitUntilElementLocatedAndTextMatches(driver, 'code',
    /Error/);
}

/**
 * Wait until the Test Application connects to and disconnects from a
 * {@link Room}, or errors. Successfully connecting to and disconnecting from a
 * {@link Room} resolves the Promise; an error rejects the Promise.
 * @param {WebDriver} driver
 * @returns {Promise<void>}
 */
function waitUntilDisconnectedOrSetup(driver) {
  return Promise.race([
    waitUntilSetup(driver),
    waitUntilError(driver).then(() => { throw new Error('Test Application errored'); })
  ]);
}

module.exports = runFrameworkTest;
