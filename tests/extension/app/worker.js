import './twilio.js';

let incomingCall = null;

const offscreenPath = 'offscreen/offscreen.html';
const device1ClientIdentity = 'test-extension-identity';

// Consider using storage API
let sessionState = {
  status: 'pending', // pending, idle, incoming, inprogress
};

// Tracks whether the popup is open or not
let popupOpen = false;
chrome.runtime.onConnect.addListener((port) => {
  popupOpen = true;
  port.onDisconnect.addListener(() => {
    popupOpen = false;
  });
});

// Messages coming from different sources (popup and offscreen documents)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'init' && sender.url.includes('popup')) {
    init();
  } else if (request.type === 'call' && sender.url.includes('popup')) {
    // This is an outgoing call. Initialize the Voice SDK and call the recepient.
    launchOffscreen(device1ClientIdentity, request.recepient);
  } else if (request.type === 'reject' && sender.url.includes('popup')) {
    incomingCall.reject();
  } else if (request.type === 'accept' && sender.url.includes('popup')) {
    // Ignore the cancel event since we don't want to reset if we're the one who answered the call
    incomingCall.removeListener('cancel', reset);
    chrome.runtime.sendMessage({ type: 'connect-incoming' });
  } else if (request.type === 'getstate' && sender.url.includes('popup')) {
    sendResponse(sessionState);
  } else if (request.type === 'accept' && sender.url.includes('offscreen')) {
    setState({ status: 'inprogress' });
    incomingCall = null;
  } else if (
    (request.type === 'disconnect' ||
      request.type === 'cancel' ||
      request.type === 'reject') &&
    sender.url.includes('offscreen')
  ) {
    reset();
  }
});

async function init() {
  setState({ status: 'idle' });
  const response = await fetch(
    'http://127.0.0.1:3030/token?identity=' + device1ClientIdentity
  );
  const data = await response.json();
  const device = new Twilio.Device(data.token, { logLevel: 1 });
  await device.register();
  /**
   * NOTE(kchoy): This is the first device created in this extension. device1ClientIdentity
   * is registered to receive an incoming call from device2ClientIdentity in offscreen.js
   */

  device.on('incoming', (call) => {
    call.on('disconnect', reset);
    call.on('cancel', reset);
    call.on('reject', reset);
    incomingCall = call;
    setState({ status: 'incoming' });
  });
}

function reset() {
  setState({ status: 'idle' });
  closeOffscreenDocuments();
  incomingCall = null;
}

function setState(state) {
  const { status } = state;
  chrome.action.setIcon({
    path:
      status === 'incoming' || status === 'inprogress'
        ? '/icons/active.png'
        : '/icons/default.png',
  });
  sessionState = state;
  popupOpen &&
    chrome.runtime.sendMessage({ type: 'setstate', state: sessionState });
}

async function launchOffscreen(identity, recepient) {
  await closeOffscreenDocuments();
  await chrome.offscreen.createDocument({
    url: offscreenPath,
    reasons: ['AUDIO_PLAYBACK', 'USER_MEDIA', 'WEB_RTC'],
    justification: 'Make WebRTC Calls',
  });
  const connectToken = incomingCall ? incomingCall.connectToken : undefined;
  chrome.runtime.sendMessage({
    type: 'connect',
    identity,
    recepient,
    connectToken,
  });
}

// Only one offscreen document is allowed.
// Close any open ones before creating a new one.
function closeOffscreenDocuments() {
  return new Promise(async (resolve) => {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
    });
    if (existingContexts.length > 0) {
      chrome.offscreen.closeDocument(resolve);
    } else {
      resolve();
    }
  });
}
