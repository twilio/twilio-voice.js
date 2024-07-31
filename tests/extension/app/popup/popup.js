let initBtn;
let callBtn;
let hangupBtn;
let acceptBtn;
let rejectBtn;
let recepientEl;
let statusEl;
let incomingCallTestEl;

function start() {
  recepientEl = document.querySelector('#recepient');
  statusEl = document.querySelector('#status');
  initBtn = document.querySelector('#init');
  callBtn = document.querySelector('#call');
  hangupBtn = document.querySelector('#hangup');
  acceptBtn = document.querySelector('#accept');
  rejectBtn = document.querySelector('#reject');
  incomingCallTestEl = document.querySelector('#test-incoming')

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
  /**
    * NOTE(kchoy): To verify an incoming call has occured, for 
    * e2e testing, manually set innerHTML.
    */ 
    incomingCallTestEl.innerHTML = "Incoming call has occured"
    showButtons('accept', 'reject');
  } else if (status === 'inprogress') {
    showButtons('hangup');
  }
  recepientEl.style.display = status === 'idle' ? 'block' : 'none';
  statusEl.innerHTML = `Status: ${status}`;
}

function setupButtonHandlers() {
  initBtn.onclick = () => chrome.runtime.sendMessage({ type: 'init' });
  callBtn.onclick = () => recepientEl.value && chrome.runtime.sendMessage({ type: 'call', recepient: recepientEl.value });
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
