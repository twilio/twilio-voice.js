const puppeteer = require('puppeteer');
const EXTENSION_PATH = 'tests/extension/app';
const assert = require('assert');
const path = require('path');

// Tokens come from the vending Function, which can take seconds on a cold start.
const WAIT_TIMEOUT_MS = 10000;

/**
 * Wait for an element's text to match, failing with the actual text on timeout.
 */
async function waitForText(selector, expected) {
  try {
    await page.waitForFunction(
      (sel, text) => document.querySelector(sel).innerText.trim() === text,
      { timeout: WAIT_TIMEOUT_MS },
      selector,
      expected,
    );
  } catch (e) {
    const actual = await page.$eval(selector, (element) => element.innerText.trim());
    assert.equal(actual, expected);
  }
}

let browser;
let page;
let extensionId;

describe('Chrome extension tests', function () {
  this.timeout(30000);
  beforeEach(async () => {
    const pathToExtension = path.join(process.cwd(), EXTENSION_PATH);
    browser = await puppeteer.launch({
      pipe: true,
      dumpio: true,
      enableExtensions: true,
      headless: true,
      args: [
        `--use-fake-ui-for-media-stream`,
        '--use-fake-device-for-media-stream',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
      ],
    });
    extensionId = await browser.installExtension(pathToExtension);
    page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`, { waitUntil: 'load' });
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
    const initButton = await page.waitForSelector('#init', { visible: true });
    await initButton.click();
    await waitForText('#status', 'Status: idle');
    const textBox = await page.$('#recepient');
    await textBox.type('t');
    const callButton = await page.$('#call');
    await callButton.click();
    await waitForText('#test-incoming', 'Incoming call has occured');
  });

  it('should allow device to be destroyed', async () => {
    const initButton = await page.waitForSelector('#init', { visible: true });
    await initButton.click();
    await waitForText('#status', 'Status: idle');
    const destroyButton = await page.$('#destroy');
    await destroyButton.click();
    await waitForText('#status', 'Status: destroyed');
  });
});
