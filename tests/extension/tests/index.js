const puppeteer = require('puppeteer');
const EXTENSION_PATH = 'tests/extension/app';
const assert = require('assert');

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

let browser;
let page;

describe('Chrome extension tests', function () {
  this.timeout(10000);
  beforeEach(async () => {
    browser = await puppeteer.launch({
      dumpio: true,
      headless: true,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        `--use-fake-ui-for-media-stream`,
        '--use-fake-device-for-media-stream',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

    async function getBaseURL(browser) {
      const extensionTarget = await browser.waitForTarget(
        (target) => target.type() === 'service_worker'
      );

      const partialExtensionUrl = extensionTarget?.url() || '';
      const [, , extensionId] = partialExtensionUrl.split('/');

      return `chrome-extension://${extensionId}`;
    }

    async function getPage(browser) {
      const page = await browser.newPage();
      const baseURL = await getBaseURL(browser);
      await page.goto(`${baseURL}/popup/popup.html`, { waitUntil: 'load' });
      await page.bringToFront();
      await page.setViewport({
        width: 1200,
        height: 800,
      });
      return page;
    }

    async function setUpBrowser() {
      const page = await getPage(browser);
      // [e2e-testing]: Log errors to terminal
      page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));

      return { browser, page };
    }
    ({ page } = await setUpBrowser());
  });

  afterEach(async () => {
    await browser.close();
    browser = undefined;
  });

  it('should render popup title correctly', async () => {
    const title = await page.$('[data-testing-id=popup-title]');
    const titleText = await page.evaluate(
      (element) => element.innerText.trim(),
      title
    );
    const expectedTitleText = 'Twilio Dialer';
    assert.equal(titleText, expectedTitleText);
  });

  it('should allow worker.js to make outgoing call, and receive incoming call', async () => {
    const initButton = await page.$('#init');
    await initButton.click();
    const textBox = await page.$('#recepient');
    await textBox.type('t');
    const callButton = await page.$('#call');
    await callButton.click();
    await delay(3000); // allow time for call to occur
    const testIncoming = await page.$('#test-incoming');
    const testIncomingText = await page.evaluate(
      (element) => element.innerText.trim(),
      testIncoming
    );
    const expectedIncomingText = 'Incoming call has occured';
    assert.equal(testIncomingText, expectedIncomingText);
  });
});
