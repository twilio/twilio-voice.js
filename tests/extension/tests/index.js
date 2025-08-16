const puppeteer = require('puppeteer');
const EXTENSION_PATH = 'tests/extension/app';
const assert = require('assert');
const path = require('path');

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

let browser;
let page;
let extensionId;

describe('Chrome extension tests', function () {
  this.timeout(10000);
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

  it('should allow device to be destroyed', async () => {
    const initButton = await page.waitForSelector('#init', { visible: true });
    await initButton.click();
    await delay(2000) // allow time for device to initialize
    const destroyButton = await page.$('#destroy');
    await destroyButton.click();
    await page.waitForSelector('#init', { visible: true });
    const status = await page.waitForSelector('#status');
    const statusText = await page.evaluate(
      (element) => element.innerText.trim(),
      status
    );
    const expectedStatusText = 'Status: destroyed';
    assert.equal(statusText, expectedStatusText);
  });
});
