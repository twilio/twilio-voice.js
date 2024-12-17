
let device;
let call;
let incomingCallConnectToken;
let incomingSound;
const device2ClientIdentity = "test-extension-identity2"

async function start() {
  chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.type === 'hangup' && sender.url.includes('popup')) {
      device.disconnectAll();
    } else if (request.type === 'connect') {
      setupDevice(request.identity, request.recepient, request.connectToken);
    } else if (request.type === 'connect-incoming') {
      stopIncomingSound();
      call = await device.connect({ connectToken: incomingCallConnectToken });
      setupCallHandlers(call);
    }
  });
}

async function setupDevice(identity, recepient, connectToken) {
  const { token } = await getJson('http://127.0.0.1:3030/token?identity=' + device2ClientIdentity);
  
  device = new Twilio.Device(token, { logLevel: 1 });
  /**
   * NOTE(kchoy): This is the second device created in this extension. device2ClientIdentity
   * calls device1ClientIdentity in worker.js
   */

  // The recepient parameter is provided to the offscreen document
  // when making an outgoing call. If it exists, we initiate the call right away.
  if (recepient) {
    call = await device.connect({ params: { recepient } });
    // [e2e-testing]: trigger fail
    call.on('error', (error) => {
      throw new Error(`offscreen.js error: ${JSON.stringify(error)}`);
    });
  };
}

function setupCallHandlers(call) {
  call.on('accept', () => chrome.runtime.sendMessage({ type: 'accept' }));
  call.on('disconnect', () => chrome.runtime.sendMessage({ type: 'disconnect' }));
  call.on('cancel', () => chrome.runtime.sendMessage({ type: 'cancel' }));
  call.on('reject', () => chrome.runtime.sendMessage({ type: 'reject' }));
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

async function playIncomingSound() {
  if (!incomingSound) {
    incomingSound = await new Promise(resolve => {
      const audio = new Audio('incoming.mp3');
      audio.loop = true;
      audio.addEventListener('canplaythrough', () => resolve(audio));
    });
  }
  incomingSound.play();
}

async function stopIncomingSound() {
  if (incomingSound) {
    incomingSound.pause();
    incomingSound.currentTime = 0;
  }
}

addEventListener('load', start);
