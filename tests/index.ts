import * as WebSocket from 'ws';

const EventTarget = require('./eventtarget');

const root = global as any;
let handlers = {};

root.resetEvents = () => { handlers = {}; };
root.WebSocket = WebSocket;
root.window = {
  addEventListener: (name: string, func: Function) => { (handlers as any)[name] = func; },
  dispatchEvent: (name: string) => {
    (handlers as any)[name]();
  },
  navigator: { userAgent: '' },
  removeEventListener: (name: string) => { delete (handlers as any)[name]; },
};

root.XMLHttpRequest = () => { };
root.XMLHttpRequest.prototype.addEventListener = (name: string, cb: Function) => {
  if (name === 'load') {
    cb({ target: { response: 'foo' } });
  }
};
root.XMLHttpRequest.prototype.open = (method: string, url: string, async: boolean) => { };
root.XMLHttpRequest.prototype.send = () => { };
root.XMLHttpRequest.prototype.setRequestHeader = () => { };

root.Audio = () => { };
root.Audio.prototype.addEventListener = (eventName: string, handler: Function) => {
  if (eventName === 'canplaythrough') {
    setTimeout(handler);
  }
};
root.Audio.prototype.play = () => Promise.resolve();

root.HTMLAudioElement = () => { };
root.HTMLAudioElement.prototype.setSinkId = () => Promise.resolve();
root.HTMLAudioElement.prototype.play = () => Promise.resolve();

root.AudioContext = () => { };
root.AudioContext.prototype.createAnalyser = () => ({});
root.AudioContext.prototype.createBufferSource = () => ({
  addEventListener() { },
  dispatchEvent() { },
  connect() { },
  disconnect() { },
  start() { },
  stop() { },
});
root.AudioContext.prototype.createGain = () => ({
  connect() { },
  disconnect() { },
  gain: { value: 1 },
});
root.AudioContext.prototype.createMediaStreamSource = () => ({
  connect() { },
  disconnect() { },
});
root.AudioContext.prototype.decodeAudioData = () => ({
  stream: 'foo',
});

root.MediaStreamTrack = () => { };
root.MediaStreamTrack.prototype.stop = () => { };

root.requestAnimationFrame = () => { };

root.MediaStream = () => { };

// This only applies to Node v21 and earlier, as v22 already includes globalThis.navigator.
root.navigator ??= {
  mediaDevices: {
    getUserMedia() { return Promise.resolve() },
    enumerateDevices() { return Promise.resolve([]) },
  },
  platform: 'platform',
  userAgent: 'userAgent',
  permissions: {
    query: function() {
      return Promise.resolve(new EventTarget());
    }
  }
};

root.RTCPeerConnection = root.window.RTCPeerConnection = function() { };
root.RTCRtpReceiver = root.window.RTCRtpReceiver = {
  getCapabilities: () => ({
    codecs: []
  }),
};

require('./audiohelper');
require('./outputdevicecollection');
require('./eventpublisher');
require('./peerconnection');
require('./util');
require('./stats');
require('./mos');
require('./getusermedia');
require('./pstream');
require('./sound');
require('./sdp');

require('./unit/audioplayer');
require('./unit/audioprocessoreventobserver');
require('./unit/asyncQueue');
require('./unit/backoff');
require('./unit/icecandidate');
require('./unit/call');
require('./unit/device');
require('./unit/deferred');
require('./unit/preflight');
require('./unit/wstransport');
require('./unit/statsMonitor');
require('./unit/error');
require('./unit/log');
require('./unit/regions');
require('./unit/sid');
require('./unit/cdn/viewerrequest/test');
require('./unit/cdn/viewerresponse/test');
require('./unit/rtcpc');
