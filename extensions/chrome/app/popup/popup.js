let initBtn;
let callBtn;
let hangupBtn;
let acceptBtn;
let rejectBtn;
let recipientEl;

function start() {
  recipientEl = document.querySelector('#recipient');
  initBtn = document.querySelector('#init');
  callBtn = document.querySelector('#call');
  hangupBtn = document.querySelector('#hangup');
  acceptBtn = document.querySelector('#accept');
  rejectBtn = document.querySelector('#reject');

  setupButtonHandlers();
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'setstate') {
      setStatus(request.state.status);
    }
  });
  chrome.runtime.sendMessage({ type: 'getstate' }, ({ status }) => {
    setStatus(status);
  });

  // Connect to the service worker. This allows the service worker
  // to detect whether the popup is open or not.
  chrome.runtime.connect();
}

function setStatus(status) {
  if (status === 'pending') {
    showButtons('init');
  } else if (status === 'idle') {
    showButtons('call');
  } else if (status === 'incoming') {
    showButtons('accept', 'reject');
  } else if (status === 'inprogress') {
    showButtons('hangup');
  }
  recipientEl.style.display = status === 'idle' ? 'block' : 'none';
}

function setupButtonHandlers() {
  initBtn.onclick = () => chrome.runtime.sendMessage({ type: 'init' });
  callBtn.onclick = () => recipientEl.value && chrome.runtime.sendMessage({ type: 'call', recipient: recipientEl.value });
  hangupBtn.onclick = () => chrome.runtime.sendMessage({ type: 'hangup' });
  acceptBtn.onclick = () => chrome.runtime.sendMessage({ type: 'accept' });
  rejectBtn.onclick = () => chrome.runtime.sendMessage({ type: 'reject' });
}

function showButtons(...buttonsToShow) {
  document.querySelectorAll('button').forEach(el => {
    if (buttonsToShow.includes(el.id)) {
      el.style.display = 'inline-block';
    } else {
      el.style.display = 'none';
    }
  });
}

function log(msg) {
  document.querySelector('#log').innerHTML += msg + '\n';
}

start();
