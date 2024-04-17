
let device;
let call;
let incomingCallConnectToken;
let incomingSound;

async function start() {
  console.log('Starting offscreen');
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
  const { token } = await getJson('http://127.0.0.1:3030/token?identity=' + identity);
  
  device = new Twilio.Device(token, { logLevel: 1 });

  // The recepient parameter is provided to the offscreen document
  // when making an outgoing call. If it exists, we initiate the call right away.
  if (recepient) {
    call = await device.connect({ params: { recepient } });
    setupCallHandlers(call);
  } else if(connectToken) {
    incomingCallConnectToken = connectToken;
    playIncomingSound();
  }
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
