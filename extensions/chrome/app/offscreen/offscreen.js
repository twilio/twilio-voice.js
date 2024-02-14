
let device;
let call;

async function start() {
  const identity = getUrlParam('identity');
  const { token } = await getJson('http://127.0.0.1:3030/token?identity=' + identity);
  
  device = new Twilio.Device(token, { logLevel: 1 });
  setupDeviceHandlers(device);
  await device.register();

  chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.type === 'hangup' && sender.url.includes('popup')) {
      device.disconnectAll();
    } else if (request.type === 'accept' && sender.url.includes('popup')) {
      call.accept();
    } else if (request.type === 'reject' && sender.url.includes('popup')) {
      call.reject();
    }
  });
}

function setupDeviceHandlers(device) {
  device.on('incoming', currentCall => {
    call = currentCall;
    setupCallHandlers(call);
    chrome.runtime.sendMessage({ type: 'incoming', from: call.parameters.From });
  });

  device.on('registered', async () => {
    // The recipient parameter is provided to the offscreen document
    // when making an outgoing call. If it exists, we initiate the call
    // right away.
    const recipient = getUrlParam('recipient');
    if (recipient) {
      call = await device.connect({ params: { recipient } });
      setupCallHandlers(call);
    } else {
      // If there is no recipient, this means the offscreen document was launched
      // to accept an incoming call. We will notify the source that we're ready to receive
      // the incoming call by sending the registered event.
      chrome.runtime.sendMessage({ type: 'registered' });
    }
  });
}

function setupCallHandlers(call) {
  call.on('accept', () => chrome.runtime.sendMessage({ type: 'accept' }));
  call.on('disconnect', () => chrome.runtime.sendMessage({ type: 'disconnect' }));
  call.on('cancel', () => chrome.runtime.sendMessage({ type: 'cancel' }));
  call.on('reject', () => chrome.runtime.sendMessage({ type: 'reject' }));
}

function getUrlParam(param) {
  const params = window.location.search.substring(1);
  let result = '';
  params.split('&').some((part) => {
    const item = part.split('=');
    if (item[0] === param) {
      result = decodeURIComponent(item[1]);
      return true;
    }
  });
  return result;
}

function getJson(url) {
  return new Promise(resolve => {
    const xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        resolve(JSON.parse(this.responseText));
      }
    };
    xmlhttp.open('GET', url, true);
    xmlhttp.send();
  });
}

start();
