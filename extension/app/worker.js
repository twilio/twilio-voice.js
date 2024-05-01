import './twilio.js';

let incomingCall = null;

const offscreenPath = 'offscreen/offscreen.html';
const clientIdentity = 'test-identity';

// Consider using storage API
let sessionState = {
  status: 'pending', // pending, idle, incoming, inprogress
};

// Tracks whether the popup is open or not
let popupOpen = false;
chrome.runtime.onConnect.addListener(port => {
  popupOpen = true;
  port.onDisconnect.addListener(()=>{
    popupOpen = false;
  });
});

// Open welcome page and ask for user media permissions
// after installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason.search(/install/g) === -1) {
    return;
  }
  chrome.tabs.create({
    url: 'welcome/welcome.html',
    active: true
  });
});

// Messages coming from different sources (popup and offscreen documents)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'init' && sender.url.includes('popup')) {
    init();
  } else if (request.type === 'call' && sender.url.includes('popup')) {
    // This is an outgoing call. Initialize the Voice SDK and call the recepient.
    launchOffscreen(clientIdentity, request.recepient);
  } else if (request.type === 'reject' && sender.url.includes('popup')) {
    incomingCall.reject();
  } else if (request.type === 'accept' && sender.url.includes('popup')) {
    // Ignore the cancel event since we don't want to reset if we're the one who answered the call
    incomingCall.removeListener('cancel', reset);
    chrome.runtime.sendMessage({ type: 'connect-incoming' });
  } else if (request.type === 'getstate' && sender.url.includes('popup')) {
    sendResponse(sessionState);
  } else if (request.type === 'accept' && sender.url.includes('offscreen')) {
    setState({ status: 'inprogress'});
    incomingCall = null;
  } else if ((request.type === 'disconnect' || request.type === 'cancel' || request.type === 'reject') &&
    sender.url.includes('offscreen')) {
    reset();
  }
});

async function init() {
  setState({ status: 'idle' });
  const response = await fetch('http://127.0.0.1:3030/token?identity=' + clientIdentity);
  const data = await response.json();
  const device = new Twilio.Device(data.token, { logLevel: 1 });
  await device.register();

  device.on('incoming', (call) => {
    call.on('disconnect', reset);
    call.on('cancel', reset);
    call.on('reject', reset);
    incomingCall = call;
    setState({ status: 'incoming'});
    launchOffscreen(clientIdentity);
  });
}

function reset() {
  setState({ status: 'idle'});
  closeOffscreenDocuments();
  incomingCall = null;
}

function setState(state) {
  const { status } = state;
  chrome.action.setIcon({ path: status === 'incoming' || status === 'inprogress' ? '/icons/active.png' : '/icons/default.png' });
  sessionState = state;
  popupOpen && chrome.runtime.sendMessage({ type: 'setstate', state: sessionState });
}

async function launchOffscreen(identity, recepient) {
  await closeOffscreenDocuments();
  await chrome.offscreen.createDocument({
    url: offscreenPath,
    reasons: [
      'AUDIO_PLAYBACK',
      'USER_MEDIA',
      'WEB_RTC'
    ],
    justification: 'Make WebRTC Calls',
  });
  const connectToken = incomingCall ? incomingCall.connectToken : undefined;
  chrome.runtime.sendMessage({ type: 'connect', identity, recepient, connectToken });
}

// Only one offscreen document is allowed.
// Close any open ones before creating a new one.
function closeOffscreenDocuments() {
  return new Promise(async resolve => {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    if (existingContexts.length > 0) {
      chrome.offscreen.closeDocument(resolve);
    } else {
      resolve();
    }
  });
}
