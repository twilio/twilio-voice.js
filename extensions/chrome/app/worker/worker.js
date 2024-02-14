
let ws;
let timeoutId;
const offscreenPath = 'offscreen/offscreen.html';
const clientIdentity = 'alice';

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
    // This is an outbound call. Initialize the Voice SDK and call the recipient.
    launchOffscreen(clientIdentity, request.recipient);
  } else if (request.type === 'getstate' && sender.url.includes('popup')) {
    sendResponse(sessionState);
  } else if (request.type === 'incoming' && sender.url.includes('offscreen')) {
    setState({ status: 'incoming'});
  } else if (request.type === 'accept' && sender.url.includes('offscreen')) {
    setState({ status: 'inprogress'});
  } else if (request.type === 'registered' && sender.url.includes('offscreen')) {
    // We receive this from the offscreen document notifying the worker that it's ready
    // to receive an incoming call. We then send this back to the websocket server
    // to notify that we're ready to receive the call.
    ws.send('registered');
  } else if ((request.type === 'disconnect' || request.type === 'cancel' || request.type === 'reject') &&
    sender.url.includes('offscreen')) {
    setState({ status: 'idle'});
    closeOffscreenDocuments();
  }
});

function init() {
  ws = new WebSocket('ws://127.0.0.1:3030');
  ws.onopen = () => {
    // Register this client to your websocket server for tracking
    ws.send('register:' + clientIdentity);

    keepAlive();
  };
  ws.onmessage = message => onWebSocketMessage(message);
  setState({ status: 'idle' });
}

function setState(state) {
  const { status } = state;
  chrome.action.setIcon({ path: status === 'incoming' || status === 'inprogress' ? '/icons/active.png' : '/icons/default.png' });
  sessionState = state;
  popupOpen && chrome.runtime.sendMessage({ type: 'setstate', state: sessionState });
}

async function launchOffscreen(identity, recipient) {
  let path = offscreenPath + '?identity=' + identity;
  if (recipient) {
    path += '&recipient=' + recipient;
  }
  await closeOffscreenDocuments();
  chrome.offscreen.createDocument({
    url: path,
    reasons: [
      'AUDIO_PLAYBACK',
      'USER_MEDIA',
      'WEB_RTC'
    ],
    justification: 'Make WebRTC Calls',
  });
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

function onWebSocketMessage({ data: message }) {
  const { type, identity } = JSON.parse(message);
  // The server has been notified that an incoming call is coming
  // Launch initialize the Voice SDK to start listening for it
  if (type === 'incoming') {
    launchOffscreen(identity);
  }
}

// Send heartbeat messages to prevent the service worker
// from getting terminated by the browser
function keepAlive() {
  if (ws && ws.readyState === 1) {
    ws.send('');
  }
  clearTimeout(timeoutId);
  timeoutId = setTimeout(keepAlive, 10000);
}
