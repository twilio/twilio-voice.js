// @ts-nocheck
import {
  InvalidArgumentError,
  MediaErrors,
  NotSupportedError,
  SignalingErrors,
} from '../errors';
import Log from '../log';
import * as util from '../util';
import RTCPC from './rtcpc';
import { setIceAggressiveNomination } from './sdp';

const ICE_GATHERING_TIMEOUT = 15000;
const ICE_GATHERING_FAIL_NONE = 'none';
const ICE_GATHERING_FAIL_TIMEOUT = 'timeout';
const INITIAL_ICE_CONNECTION_STATE = 'new';
const VOLUME_INTERVAL_MS = 50;

/**
 * @typedef {Object} PeerConnection
 * @param audioHelper
 * @param pstream
 * @param options
 * @return {PeerConnection}
 * @constructor
 */
function PeerConnection(audioHelper, pstream, options) {
  if (!audioHelper || !pstream) {
    throw new InvalidArgumentError('Audiohelper, and pstream are required arguments');
  }

  if (!(this instanceof PeerConnection)) {
    return new PeerConnection(audioHelper, pstream, options);
  }

  this._log = new Log('PeerConnection');

  function noop() {
    this._log.warn('Unexpected noop call in peerconnection');
  }
  this.onaudio = noop;
  this.onopen = noop;
  this.onerror = noop;
  this.onclose = noop;
  this.ondisconnected = noop;
  this.onfailed = noop;
  this.onconnected = noop;
  this.onreconnected = noop;
  this.onsignalingstatechange = noop;
  this.ondtlstransportstatechange = noop;
  this.onicegatheringfailure = noop;
  this.onicegatheringstatechange = noop;
  this.oniceconnectionstatechange = noop;
  this.onpcconnectionstatechange = noop;
  this.onicecandidate = noop;
  this.onselectedcandidatepairchange = noop;
  this.onvolume = noop;
  this.version = null;
  this.pstream = pstream;
  this.stream = null;
  this.sinkIds = new Set(['default']);
  this.outputs = new Map();
  this.status = 'connecting';
  this.callSid = null;
  this.isMuted = false;

  const AudioContext = typeof window !== 'undefined'
    && (window.AudioContext || window.webkitAudioContext);
  this._isSinkSupported = !!AudioContext &&
    typeof HTMLAudioElement !== 'undefined' && HTMLAudioElement.prototype.setSinkId;
  // NOTE(mmalavalli): Since each Connection creates its own AudioContext,
  // after 6 instances an exception is thrown. Refer https://www.w3.org/2011/audio/track/issues/3.
  // In order to get around it, we are re-using the Device's AudioContext.
  this._audioContext = AudioContext && audioHelper._audioContext;
  this._audioHelper = audioHelper;
  this._hasIceCandidates = false;
  this._hasIceGatheringFailures = false;
  this._iceGatheringTimeoutId = null;
  this._masterAudio = null;
  this._masterAudioDeviceId = null;
  this._mediaStreamSource = null;
  this._dtmfSender = null;
  this._dtmfSenderUnsupported = false;
  this._callEvents = [];
  this._nextTimeToPublish = Date.now();
  this._onAnswerOrRinging = noop;
  this._onHangup = noop;
  this._remoteStream = null;
  this._shouldManageStream = true;
  this._iceState = INITIAL_ICE_CONNECTION_STATE;
  this._isUnifiedPlan = options.isUnifiedPlan;

  this.options = options = options || {};
  this.navigator = options.navigator
    || (typeof navigator !== 'undefined' ? navigator : null);
  this.util = options.util || util;
  this.codecPreferences = options.codecPreferences;

  return this;
}

PeerConnection.prototype.uri = function() {
  return this._uri;
};

/**
 * Open the underlying RTCPeerConnection with a MediaStream obtained by
 *   passed constraints. The resulting MediaStream is created internally
 *   and will therefore be managed and destroyed internally.
 * @param {MediaStreamConstraints} constraints
 */
PeerConnection.prototype.openDefaultDeviceWithConstraints = function(constraints) {
  return this._audioHelper._openDefaultDeviceWithConstraints(constraints)
    .then(this._setInputTracksFromStream.bind(this, false));
};

/**
 * Replace the existing input audio tracks with the audio tracks from the
 *   passed input audio stream. We re-use the existing stream because
 *   the AnalyzerNode is bound to the stream.
 * @param {MediaStream} stream
 */
PeerConnection.prototype.setInputTracksFromStream = function(stream) {
  const self = this;
  return this._setInputTracksFromStream(true, stream).then(() => {
    self._shouldManageStream = false;
  });
};

PeerConnection.prototype._createAnalyser = (audioContext, options) => {
  options = Object.assign({
    fftSize: 32,
    smoothingTimeConstant: 0.3,
  }, options);

  const analyser = audioContext.createAnalyser();
  // tslint:disable-next-line
  for (const field in options) {
    analyser[field] = options[field];
  }

  return analyser;
};

PeerConnection.prototype._setVolumeHandler = function(handler) {
  this.onvolume = handler;
};
PeerConnection.prototype._startPollingVolume = function() {
  if (!this._audioContext || !this.stream || !this._remoteStream) {
    return;
  }

  const audioContext = this._audioContext;

  const inputAnalyser = this._inputAnalyser = this._createAnalyser(audioContext);
  const inputBufferLength = inputAnalyser.frequencyBinCount;
  const inputDataArray = new Uint8Array(inputBufferLength);
  this._inputAnalyser2 = this._createAnalyser(audioContext, {
    maxDecibels: 0,
    minDecibels: -127,
    smoothingTimeConstant: 0,
  });

  const outputAnalyser = this._outputAnalyser = this._createAnalyser(audioContext);
  const outputBufferLength = outputAnalyser.frequencyBinCount;
  const outputDataArray = new Uint8Array(outputBufferLength);
  this._outputAnalyser2 = this._createAnalyser(audioContext, {
    maxDecibels: 0,
    minDecibels: -127,
    smoothingTimeConstant: 0,
  });

  this._updateInputStreamSource(this.stream);
  this._updateOutputStreamSource(this._remoteStream);

  const self = this;
  setTimeout(function emitVolume() {
    if (!self._audioContext) {
      return;
    } else if (self.status === 'closed') {
      self._inputAnalyser.disconnect();
      self._outputAnalyser.disconnect();
      self._inputAnalyser2.disconnect();
      self._outputAnalyser2.disconnect();
      return;
    }

    self._inputAnalyser.getByteFrequencyData(inputDataArray);
    const inputVolume = self.util.average(inputDataArray);

    self._inputAnalyser2.getByteFrequencyData(inputDataArray);
    const inputVolume2 = self.util.average(inputDataArray);

    self._outputAnalyser.getByteFrequencyData(outputDataArray);
    const outputVolume = self.util.average(outputDataArray);

    self._outputAnalyser2.getByteFrequencyData(outputDataArray);
    const outputVolume2 = self.util.average(outputDataArray);
    self.onvolume(inputVolume / 255, outputVolume / 255, inputVolume2, outputVolume2);

    setTimeout(emitVolume, VOLUME_INTERVAL_MS);
  }, VOLUME_INTERVAL_MS);
};

PeerConnection.prototype._stopStream = function _stopStream() {
  // We shouldn't stop the tracks if they were not created inside
  //   this PeerConnection.
  if (!this._shouldManageStream) {
    return;
  }

  this._audioHelper._stopDefaultInputDeviceStream();
};

/**
 * Update the stream source with the new input audio stream.
 * @param {MediaStream} stream
 * @private
 */
PeerConnection.prototype._updateInputStreamSource = function(stream) {
  if (this._inputStreamSource) {
    this._inputStreamSource.disconnect();
  }

  try {
    this._inputStreamSource = this._audioContext.createMediaStreamSource(stream);
    this._inputStreamSource.connect(this._inputAnalyser);
    this._inputStreamSource.connect(this._inputAnalyser2);
  } catch (ex) {
    this._log.warn('Unable to update input MediaStreamSource', ex);
    this._inputStreamSource = null;
  }
};

/**
 * Update the stream source with the new ouput audio stream.
 * @param {MediaStream} stream
 * @private
 */
PeerConnection.prototype._updateOutputStreamSource = function(stream) {
  if (this._outputStreamSource) {
    this._outputStreamSource.disconnect();
  }

  try {
    this._outputStreamSource = this._audioContext.createMediaStreamSource(stream);
    this._outputStreamSource.connect(this._outputAnalyser);
    this._outputStreamSource.connect(this._outputAnalyser2);
  } catch (ex) {
    this._log.warn('Unable to update output MediaStreamSource', ex);
    this._outputStreamSource = null;
  }
};

/**
 * Replace the tracks of the current stream with new tracks. We do this rather than replacing the
 *   whole stream because AnalyzerNodes are bound to a stream.
 * @param {Boolean} shouldClone - Whether the stream should be cloned if it is the first
 *   stream, or set directly. As a rule of thumb, streams that are passed in externally may have
 *   their lifecycle managed externally, and should be cloned so that we do not tear it or its tracks
 *   down when the call ends. Streams that we create internally (inside PeerConnection) should be set
 *   directly so that when the call ends it is disposed of.
 * @param {MediaStream} newStream - The new stream to copy the tracks over from.
 * @private
 */
PeerConnection.prototype._setInputTracksFromStream = function(shouldClone, newStream) {
  return this._isUnifiedPlan
    ? this._setInputTracksForUnifiedPlan(shouldClone, newStream)
    : this._setInputTracksForPlanB(shouldClone, newStream);
};

/**
 * Replace the tracks of the current stream with new tracks using the 'plan-b' method.
 * @param {Boolean} shouldClone - Whether the stream should be cloned if it is the first
 *   stream, or set directly. As a rule of thumb, streams that are passed in externally may have
 *   their lifecycle managed externally, and should be cloned so that we do not tear it or its tracks
 *   down when the call ends. Streams that we create internally (inside PeerConnection) should be set
 *   directly so that when the call ends it is disposed of.
 * @param {MediaStream} newStream - The new stream to copy the tracks over from.
 * @private
 */
PeerConnection.prototype._setInputTracksForPlanB = function(shouldClone, newStream) {
  if (!newStream) {
    return Promise.reject(new InvalidArgumentError('Can not set input stream to null while in a call'));
  }

  if (!newStream.getAudioTracks().length) {
    return Promise.reject(new InvalidArgumentError('Supplied input stream has no audio tracks'));
  }

  const localStream = this.stream;

  if (!localStream) {
    // We can't use MediaStream.clone() here because it stopped copying over tracks
    //   as of Chrome 61. https://bugs.chromium.org/p/chromium/issues/detail?id=770908
    this.stream = shouldClone ? cloneStream(newStream) : newStream;
  } else {
    this._stopStream();

    removeStream(this.version.pc, localStream);
    localStream.getAudioTracks().forEach(localStream.removeTrack, localStream);
    newStream.getAudioTracks().forEach(localStream.addTrack, localStream);
    addStream(this.version.pc, newStream);

    this._updateInputStreamSource(this.stream);
  }

  // Apply mute settings to new input track
  this.mute(this.isMuted);

  if (!this.version) {
    return Promise.resolve(this.stream);
  }

  return new Promise((resolve, reject) => {
    this.version.createOffer(this.options.maxAverageBitrate, { audio: true }, () => {
      this.version.processAnswer(this.codecPreferences, this._answerSdp, () => {
        resolve(this.stream);
      }, reject);
    }, reject);
  });
};

/**
 * Replace the tracks of the current stream with new tracks using the 'unified-plan' method.
 * @param {Boolean} shouldClone - Whether the stream should be cloned if it is the first
 *   stream, or set directly. As a rule of thumb, streams that are passed in externally may have
 *   their lifecycle managed externally, and should be cloned so that we do not tear it or its tracks
 *   down when the call ends. Streams that we create internally (inside PeerConnection) should be set
 *   directly so that when the call ends it is disposed of.
 * @param {MediaStream} newStream - The new stream to copy the tracks over from.
 * @private
 */
PeerConnection.prototype._setInputTracksForUnifiedPlan = function(shouldClone, newStream) {
  if (!newStream) {
    return Promise.reject(new InvalidArgumentError('Can not set input stream to null while in a call'));
  }

  if (!newStream.getAudioTracks().length) {
    return Promise.reject(new InvalidArgumentError('Supplied input stream has no audio tracks'));
  }

  const localStream = this.stream;
  const getStreamPromise = () => {
    // Apply mute settings to new input track
    this.mute(this.isMuted);
    return Promise.resolve(this.stream);
  };

  if (!localStream) {
    // We can't use MediaStream.clone() here because it stopped copying over tracks
    //   as of Chrome 61. https://bugs.chromium.org/p/chromium/issues/detail?id=770908
    this.stream = shouldClone ? cloneStream(newStream, this.options.MediaStream) : newStream;
  } else {
    // If the call was started with gUM, and we are now replacing that track with an
    // external stream's tracks, we should stop the old managed track.
    if (this._shouldManageStream) {
      this._stopStream();
    }

    if (!this._sender) {
      this._sender = this.version.pc.getSenders()[0];
    }

    return this._sender.replaceTrack(newStream.getAudioTracks()[0]).then(() => {
      this._updateInputStreamSource(newStream);
      this.stream = shouldClone ? cloneStream(newStream, this.options.MediaStream) : newStream;
      return getStreamPromise();
    });
  }

  return getStreamPromise();
};

PeerConnection.prototype._onInputDevicesChanged = function() {
  if (!this.stream) { return; }

  // If all of our active tracks are ended, then our active input was lost
  const activeInputWasLost = this.stream.getAudioTracks().every(track => track.readyState === 'ended');

  // We only want to act if we manage the stream in PeerConnection (It was created
  // here, rather than passed in.)
  if (activeInputWasLost && this._shouldManageStream) {
    this.openDefaultDeviceWithConstraints({ audio: true });
  }
};

PeerConnection.prototype._onIceGatheringFailure = function(type) {
  this._hasIceGatheringFailures = true;
  this.onicegatheringfailure(type);
};

PeerConnection.prototype._onMediaConnectionStateChange = function(newState) {
  const previousState = this._iceState;

  if (previousState === newState
    || (newState !== 'connected'
    && newState !== 'disconnected'
    && newState !== 'failed')) {
    return;
  }
  this._iceState = newState;

  let message;
  switch (newState) {
    case 'connected':
      if (previousState === 'disconnected' || previousState === 'failed') {
        message = 'ICE liveliness check succeeded. Connection with Twilio restored';
        this._log.info(message);
        this.onreconnected(message);
      } else {
        message = 'Media connection established.';
        this._log.info(message);
        this.onconnected(message);
      }
      this._stopIceGatheringTimeout();
      this._hasIceGatheringFailures = false;
      break;
    case 'disconnected':
      message = 'ICE liveliness check failed. May be having trouble connecting to Twilio';
      this._log.warn(message);
      this.ondisconnected(message);
      break;
    case 'failed':
      message = 'Connection with Twilio was interrupted.';
      this._log.warn(message);
      this.onfailed(message);
      break;
  }
};

PeerConnection.prototype._setSinkIds = function(sinkIds) {
  if (!this._isSinkSupported) {
    return Promise.reject(new NotSupportedError('Audio output selection is not supported by this browser'));
  }

  this.sinkIds = new Set(sinkIds.forEach ? sinkIds : [sinkIds]);
  return this.version
    ? this._updateAudioOutputs()
    : Promise.resolve();
};

/**
 * Start timeout for ICE Gathering
 */
PeerConnection.prototype._startIceGatheringTimeout = function startIceGatheringTimeout() {
  this._stopIceGatheringTimeout();
  this._iceGatheringTimeoutId = setTimeout(() => {
    this._onIceGatheringFailure(ICE_GATHERING_FAIL_TIMEOUT);
  }, ICE_GATHERING_TIMEOUT);
};

/**
 * Stop timeout for ICE Gathering
 */
PeerConnection.prototype._stopIceGatheringTimeout = function stopIceGatheringTimeout() {
  clearInterval(this._iceGatheringTimeoutId);
};

PeerConnection.prototype._updateAudioOutputs = function updateAudioOutputs() {
  const addedOutputIds = Array.from(this.sinkIds).filter(function(id) {
    return !this.outputs.has(id);
  }, this);

  const removedOutputIds = Array.from(this.outputs.keys()).filter(function(id) {
    return !this.sinkIds.has(id);
  }, this);

  const self = this;
  const createOutputPromises = addedOutputIds.map(this._createAudioOutput, this);
  return Promise.all(createOutputPromises).then(() => Promise.all(removedOutputIds.map(self._removeAudioOutput, self)));
};

PeerConnection.prototype._createAudio = function createAudio(arr) {
  const audio = new Audio(arr);
  this.onaudio(audio);
  return audio;
};

PeerConnection.prototype._createAudioOutput = function createAudioOutput(id) {
  let dest = null;
  if (this._mediaStreamSource) {
    dest = this._audioContext.createMediaStreamDestination();
    this._mediaStreamSource.connect(dest);
  }

  const audio = this._createAudio();
  setAudioSource(audio, dest && dest.stream ? dest.stream : this.pcStream);

  const self = this;
  return audio.setSinkId(id).then(() => audio.play()).then(() => {
    self.outputs.set(id, {
      audio,
      dest,
    });
  });
};

PeerConnection.prototype._removeAudioOutputs = function removeAudioOutputs() {
  if (this._masterAudio && typeof this._masterAudioDeviceId !== 'undefined') {
    this._disableOutput(this, this._masterAudioDeviceId);
    this.outputs.delete(this._masterAudioDeviceId);
    this._masterAudioDeviceId = null;

    // Release the audio resources before deleting the audio
    if (!this._masterAudio.paused) {
      this._masterAudio.pause();
    }
    if (typeof this._masterAudio.srcObject !== 'undefined') {
      this._masterAudio.srcObject = null;
    } else {
      this._masterAudio.src = '';
    }
    this._masterAudio = null;
  }

  return Array.from(this.outputs.keys()).map(this._removeAudioOutput, this);
};

PeerConnection.prototype._disableOutput = function disableOutput(pc, id) {
  const output = pc.outputs.get(id);
  if (!output) { return; }

  if (output.audio) {
    output.audio.pause();
    output.audio.src = '';
  }

  if (output.dest) {
    output.dest.disconnect();
  }
};

/**
 * Disable a non-master output, and update the master output to assume its state. This
 *   is called when the device ID assigned to the master output has been removed from
 *   active devices. We can not simply remove the master audio output, so we must
 *   instead reassign it.
 * @private
 * @param {PeerConnection} pc
 * @param {string} masterId - The current device ID assigned to the master audio element.
 */
PeerConnection.prototype._reassignMasterOutput = function reassignMasterOutput(pc, masterId) {
  const masterOutput = pc.outputs.get(masterId);
  pc.outputs.delete(masterId);

  const self = this;
  const activeDeviceId = Array.from(pc.outputs.keys())[0];
  // The audio device key could also be '' on Chrome if no media device permissions are allowed
  const idToReplace = typeof activeDeviceId === 'string' ? activeDeviceId : 'default';

  return masterOutput.audio.setSinkId(idToReplace).then(() => {
    self._disableOutput(pc, idToReplace);

    pc.outputs.set(idToReplace, masterOutput);
    pc._masterAudioDeviceId = idToReplace;
  }).catch(function rollback() {
    pc.outputs.set(masterId, masterOutput);
    self._log.info('Could not reassign master output. Attempted to roll back.');
  });
};

PeerConnection.prototype._removeAudioOutput = function removeAudioOutput(id) {
  if (this._masterAudioDeviceId === id) {
    return this._reassignMasterOutput(this, id);
  }

  this._disableOutput(this, id);
  this.outputs.delete(id);

  return Promise.resolve();
};

/**
 * Use an AudioContext to potentially split our audio output stream to multiple
 *   audio devices. This is only available to browsers with AudioContext and
 *   HTMLAudioElement.setSinkId() available. We save the source stream in
 *   _masterAudio, and use it for one of the active audio devices. We keep
 *   track of its ID because we must replace it if we lose its initial device.
 */
PeerConnection.prototype._onAddTrack = function onAddTrack(pc, stream) {
  const audio = pc._masterAudio = this._createAudio();
  setAudioSource(audio, stream);
  audio.play();

  // Assign the initial master audio element to a random active output device
  const activeDeviceId = Array.from(pc.outputs.keys())[0];
  // The audio device key could also be '' on Chrome if no media device permissions are allowed
  const deviceId = typeof activeDeviceId === 'string' ? activeDeviceId : 'default';
  pc._masterAudioDeviceId = deviceId;
  pc.outputs.set(deviceId, { audio });

  try {
    pc._mediaStreamSource = pc._audioContext.createMediaStreamSource(stream);
  } catch (ex) {
    this._log.warn('Unable to create a MediaStreamSource from onAddTrack', ex);
    this._mediaStreamSource = null;
  }

  pc.pcStream = stream;
  pc._updateAudioOutputs();
};

/**
 * Use a single audio element to play the audio output stream. This does not
 *   support multiple output devices, and is a fallback for when AudioContext
 *   and/or HTMLAudioElement.setSinkId() is not available to the client.
 */
PeerConnection.prototype._fallbackOnAddTrack = function fallbackOnAddTrack(pc, stream) {
  const audio = document && document.createElement('audio');
  audio.autoplay = true;

  if (!setAudioSource(audio, stream)) {
    pc._log.info('Error attaching stream to element.');
  }

  pc.outputs.set('default', { audio });
};

PeerConnection.prototype._setEncodingParameters = function(enableDscp) {
  if (!enableDscp
      || !this._sender
      || typeof this._sender.getParameters !== 'function'
      || typeof this._sender.setParameters !== 'function') {
    return;
  }

  const params = this._sender.getParameters();
  if (!params.priority && !(params.encodings && params.encodings.length)) {
    return;
  }

  // This is how MDN's RTPSenderParameters defines priority
  params.priority = 'high';

  // And this is how it's currently implemented in Chrome M72+
  if (params.encodings && params.encodings.length) {
    params.encodings.forEach(encoding => {
      encoding.priority = 'high';
      encoding.networkPriority = 'high';
    });
  }

  this._sender.setParameters(params);
};

PeerConnection.prototype._setupPeerConnection = function(rtcConfiguration) {
  const self = this;
  const version = new (this.options.rtcpcFactory || RTCPC)({ RTCPeerConnection: this.options.RTCPeerConnection });
  version.create(rtcConfiguration);
  addStream(version.pc, this.stream);

  const supportedCodecs = RTCRtpReceiver.getCapabilities('audio').codecs;
  this._log.debug('sorting codecs', supportedCodecs, this.codecPreferences);
  const sortedCodecs = util.sortByMimeTypes(supportedCodecs, this.codecPreferences);
  const [transceiver] = version.pc.getTransceivers();
  this._log.debug('setting sorted codecs', sortedCodecs);
  transceiver.setCodecPreferences(sortedCodecs);

  const eventName = 'ontrack' in version.pc
    ? 'ontrack' : 'onaddstream';

  version.pc[eventName] = event => {
    const stream = self._remoteStream = event.stream || event.streams[0];

    if (typeof version.pc.getSenders === 'function') {
      this._sender = version.pc.getSenders()[0];
    }

    if (self._isSinkSupported) {
      self._onAddTrack(self, stream);
    } else {
      self._fallbackOnAddTrack(self, stream);
    }

    self._startPollingVolume();
  };
  return version;
};

PeerConnection.prototype._maybeSetIceAggressiveNomination = function(sdp) {
  return this.options.forceAggressiveIceNomination ? setIceAggressiveNomination(sdp) : sdp;
};

PeerConnection.prototype._setupChannel = function() {
  const pc = this.version.pc;

  // Chrome 25 supports onopen
  this.version.pc.onopen = () => {
    this.status = 'open';
    this.onopen();
  };

  // Chrome 26 doesn't support onopen so must detect state change
  this.version.pc.onstatechange = () => {
    if (this.version.pc && this.version.pc.readyState === 'stable') {
      this.status = 'open';
      this.onopen();
    }
  };

  // Chrome 27 changed onstatechange to onsignalingstatechange
  this.version.pc.onsignalingstatechange = () => {
    const state = pc.signalingState;
    this._log.info(`signalingState is "${state}"`);

    if (this.version.pc && this.version.pc.signalingState === 'stable') {
      this.status = 'open';
      this.onopen();
    }

    this.onsignalingstatechange(pc.signalingState);
  };

  // Chrome 72+
  pc.onconnectionstatechange = event => {
    let state = pc.connectionState;
    if (!state && event && event.target) {
      // VDI environment
      const targetPc = event.target;
      state = targetPc.connectionState || targetPc.connectionState_;
      this._log.info(`pc.connectionState not detected. Using target PC. State=${state}`);
    }
    if (!state) {
      this._log.warn(`onconnectionstatechange detected but state is "${state}"`);
    } else {
      this._log.info(`pc.connectionState is "${state}"`);
    }
    this.onpcconnectionstatechange(state);
    this._onMediaConnectionStateChange(state);
  };

  pc.onicecandidate =  event => {
    const { candidate } = event;
    if (candidate) {
      this._hasIceCandidates = true;
      this.onicecandidate(candidate);
      this._setupRTCIceTransportListener();
    }

    this._log.info(`ICE Candidate: ${JSON.stringify(candidate)}`);
  };

  pc.onicegatheringstatechange = () => {
    const state = pc.iceGatheringState;
    if (state === 'gathering') {
      this._startIceGatheringTimeout();

    } else if (state === 'complete') {
      this._stopIceGatheringTimeout();

      // Fail if no candidates found
      if (!this._hasIceCandidates) {
        this._onIceGatheringFailure(ICE_GATHERING_FAIL_NONE);
      }

      // There was a failure mid-gathering phase. We want to start our timer and issue
      // an ice restart if we don't get connected after our timeout
      if (this._hasIceCandidates && this._hasIceGatheringFailures) {
        this._startIceGatheringTimeout();
      }
    }

    this._log.info(`pc.iceGatheringState is "${pc.iceGatheringState}"`);
    this.onicegatheringstatechange(state);
  };

  pc.oniceconnectionstatechange = () => {
    this._log.info(`pc.iceConnectionState is "${pc.iceConnectionState}"`);
    this.oniceconnectionstatechange(pc.iceConnectionState);
    this._onMediaConnectionStateChange(pc.iceConnectionState);
  };
};
PeerConnection.prototype._initializeMediaStream = function(rtcConfiguration) {
  // if mediastream already open then do nothing
  if (this.status === 'open') {
    return false;
  }
  if (this.pstream.status === 'disconnected') {
    this.onerror({ info: {
      code: 31000,
      message: 'Cannot establish connection. Client is disconnected',
      twilioError: new SignalingErrors.ConnectionDisconnected(),
    } });
    this.close();
    return false;
  }
  this.version = this._setupPeerConnection(rtcConfiguration);
  this._setupChannel();
  return true;
};

/**
 * Remove reconnection-related listeners
 * @private
 */
PeerConnection.prototype._removeReconnectionListeners = function() {
  if (this.pstream) {
    this.pstream.removeListener('answer', this._onAnswerOrRinging);
    this.pstream.removeListener('hangup', this._onHangup);
  }
};

/**
 * Setup a listener for RTCDtlsTransport to capture state changes events
 * @private
 */
PeerConnection.prototype._setupRTCDtlsTransportListener = function() {
  const dtlsTransport = this.getRTCDtlsTransport();

  if (!dtlsTransport || dtlsTransport.onstatechange) {
    return;
  }

  const handler = () => {
    this._log.info(`dtlsTransportState is "${dtlsTransport.state}"`);
    this.ondtlstransportstatechange(dtlsTransport.state);
  };

  // Publish initial state
  handler();
  dtlsTransport.onstatechange = handler;
};

/**
 * Setup a listener for RTCIceTransport to capture selected candidate pair changes
 * @private
 */
PeerConnection.prototype._setupRTCIceTransportListener = function() {
  const iceTransport = this._getRTCIceTransport();

  if (!iceTransport || iceTransport.onselectedcandidatepairchange) {
    return;
  }

  iceTransport.onselectedcandidatepairchange = () =>
    this.onselectedcandidatepairchange(iceTransport.getSelectedCandidatePair());
};

/**
 * Restarts ICE for the current connection
 * ICE Restart failures are ignored. Retries are managed in Connection
 * @private
 */
PeerConnection.prototype.iceRestart = function() {
  this._log.info('Attempting to restart ICE...');
  this._hasIceCandidates = false;
  this.version.createOffer(this.options.maxAverageBitrate, { iceRestart: true }).then(() => {
    this._removeReconnectionListeners();

    this._onAnswerOrRinging = payload => {
      this._removeReconnectionListeners();

      if (!payload.sdp || this.version.pc.signalingState !== 'have-local-offer') {
        const message = 'Invalid state or param during ICE Restart:'
          + `hasSdp:${!!payload.sdp}, signalingState:${this.version.pc.signalingState}`;
        this._log.warn(message);
        return;
      }

      const sdp = this._maybeSetIceAggressiveNomination(payload.sdp);
      this._answerSdp = sdp;
      if (this.status !== 'closed') {
        this.version.processAnswer(this.codecPreferences, sdp, null, err => {
          const message = err && err.message ? err.message : err;
          this._log.error(`Failed to process answer during ICE Restart. Error: ${message}`);
        });
      }
    };

    this._onHangup = () => {
      this._log.info('Received hangup during ICE Restart');
      this._removeReconnectionListeners();
    };

    this.pstream.on('answer', this._onAnswerOrRinging);
    this.pstream.on('hangup', this._onHangup);
    this.pstream.reinvite(this.version.getSDP(), this.callSid);

  }).catch((err) => {
    const message = err && err.message ? err.message : err;
    this._log.error(`Failed to createOffer during ICE Restart. Error: ${message}`);
    // CreateOffer failures doesn't transition ice state to failed
    // We need trigger it so it can be picked up by retries
    this.onfailed(message);
  });
};

PeerConnection.prototype.makeOutgoingCall = function(params, signalingReconnectToken, callsid, rtcConfiguration, onMediaStarted) {
  if (!this._initializeMediaStream(rtcConfiguration)) {
    return;
  }

  const self = this;
  this.callSid = callsid;
  function onAnswerSuccess() {
    if (self.options) {
      self._setEncodingParameters(self.options.dscp);
    }
    onMediaStarted(self.version.pc);
  }
  function onAnswerError(err) {
    const errMsg = err.message || err;
    self.onerror({ info: {
      code: 31000,
      message: `Error processing answer: ${errMsg}`,
      twilioError: new MediaErrors.ClientRemoteDescFailed(),
    } });
  }
  this._onAnswerOrRinging = payload => {
    if (!payload.sdp) { return; }

    const sdp = this._maybeSetIceAggressiveNomination(payload.sdp);
    self._answerSdp = sdp;
    if (self.status !== 'closed') {
      self.version.processAnswer(this.codecPreferences, sdp, onAnswerSuccess, onAnswerError);
    }
    self.pstream.removeListener('answer', self._onAnswerOrRinging);
    self.pstream.removeListener('ringing', self._onAnswerOrRinging);
  };
  this.pstream.on('answer', this._onAnswerOrRinging);
  this.pstream.on('ringing', this._onAnswerOrRinging);

  function onOfferSuccess() {
    if (self.status !== 'closed') {
      if (signalingReconnectToken) {
        self.pstream.reconnect(self.version.getSDP(), self.callSid, signalingReconnectToken);
      } else {
        self.pstream.invite(self.version.getSDP(), self.callSid, params);
      }
      self._setupRTCDtlsTransportListener();
    }
  }

  function onOfferError(err) {
    const errMsg = err.message || err;
    self.onerror({ info: {
      code: 31000,
      message: `Error creating the offer: ${errMsg}`,
      twilioError: new MediaErrors.ClientLocalDescFailed(),
    } });
  }

  this.version.createOffer(this.options.maxAverageBitrate, { audio: true }, onOfferSuccess, onOfferError);
};
PeerConnection.prototype.answerIncomingCall = function(callSid, sdp, rtcConfiguration, onMediaStarted) {
  if (!this._initializeMediaStream(rtcConfiguration)) {
    return;
  }
  sdp = this._maybeSetIceAggressiveNomination(sdp);
  this._answerSdp = sdp.replace(/^a=setup:actpass$/gm, 'a=setup:passive');
  this.callSid = callSid;
  const self = this;
  function onAnswerSuccess() {
    if (self.status !== 'closed') {
      self.pstream.answer(self.version.getSDP(), callSid);
      if (self.options) {
        self._setEncodingParameters(self.options.dscp);
      }
      onMediaStarted(self.version.pc);
      self._setupRTCDtlsTransportListener();
    }
  }
  function onAnswerError(err) {
    const errMsg = err.message || err;
    self.onerror({ info: {
      code: 31000,
      message: `Error creating the answer: ${errMsg}`,
      twilioError: new MediaErrors.ClientRemoteDescFailed(),
    } });
  }
  this.version.processSDP(this.options.maxAverageBitrate, this.codecPreferences, sdp, { audio: true }, onAnswerSuccess, onAnswerError);
};
PeerConnection.prototype.close = function() {
  if (this.version && this.version.pc) {
    if (this.version.pc.signalingState !== 'closed') {
      this.version.pc.close();
    }

    this.version.pc = null;
  }
  if (this.stream) {
    this.mute(false);
    this._stopStream();
  }
  this.stream = null;
  this._removeReconnectionListeners();
  this._stopIceGatheringTimeout();

  Promise.all(this._removeAudioOutputs()).catch(() => {
    // We don't need to alert about failures here.
  });
  if (this._mediaStreamSource) {
    this._mediaStreamSource.disconnect();
  }
  if (this._inputAnalyser) {
    this._inputAnalyser.disconnect();
  }
  if (this._outputAnalyser) {
    this._outputAnalyser.disconnect();
  }
  if (this._inputAnalyser2) {
    this._inputAnalyser2.disconnect();
  }
  if (this._outputAnalyser2) {
    this._outputAnalyser2.disconnect();
  }
  this.status = 'closed';
  this.onclose();
};
PeerConnection.prototype.reject = function(callSid) {
  this.callSid = callSid;
};
PeerConnection.prototype.ignore = function(callSid) {
  this.callSid = callSid;
};
/**
 * Mute or unmute input audio. If the stream is not yet present, the setting
 *   is saved and applied to future streams/tracks.
 * @params {boolean} shouldMute - Whether the input audio should
 *   be muted or unmuted.
 */
PeerConnection.prototype.mute = function(shouldMute) {
  this.isMuted = shouldMute;
  if (!this.stream) { return; }

  if (this._sender && this._sender.track) {
    this._sender.track.enabled = !shouldMute;
  } else {
    const audioTracks = typeof this.stream.getAudioTracks === 'function'
      ? this.stream.getAudioTracks()
      : this.stream.audioTracks;

    audioTracks.forEach(track => {
      track.enabled = !shouldMute;
    });
  }
};
/**
 * Get or create an RTCDTMFSender for the first local audio MediaStreamTrack
 * we can get from the RTCPeerConnection. Return null if unsupported.
 * @instance
 * @returns ?RTCDTMFSender
 */
PeerConnection.prototype.getOrCreateDTMFSender = function getOrCreateDTMFSender() {
  if (this._dtmfSender || this._dtmfSenderUnsupported) {
    return this._dtmfSender || null;
  }

  const self = this;
  const pc = this.version.pc;
  if (!pc) {
    this._log.warn('No RTCPeerConnection available to call createDTMFSender on');
    return null;
  }

  if (typeof pc.getSenders === 'function' && (typeof RTCDTMFSender === 'function' || typeof RTCDtmfSender === 'function')) {
    const chosenSender = pc.getSenders().find(sender => sender.dtmf);
    if (chosenSender) {
      this._log.info('Using RTCRtpSender#dtmf');
      this._dtmfSender = chosenSender.dtmf;
      return this._dtmfSender;
    }
  }

  if (typeof pc.createDTMFSender === 'function' && typeof pc.getLocalStreams === 'function') {
    const track = pc.getLocalStreams().map(stream => {
      const tracks = self._getAudioTracks(stream);
      return tracks && tracks[0];
    })[0];

    if (!track) {
      this._log.warn('No local audio MediaStreamTrack available on the RTCPeerConnection to pass to createDTMFSender');
      return null;
    }

    this._log.info('Creating RTCDTMFSender');
    this._dtmfSender = pc.createDTMFSender(track);
    return this._dtmfSender;
  }

  this._log.info('RTCPeerConnection does not support RTCDTMFSender');
  this._dtmfSenderUnsupported = true;
  return null;
};

/**
 * Get the RTCDtlTransport object from the PeerConnection
 * @returns RTCDtlTransport
 */
PeerConnection.prototype.getRTCDtlsTransport = function getRTCDtlsTransport() {
  const sender = this.version && this.version.pc
    && typeof this.version.pc.getSenders === 'function'
    && this.version.pc.getSenders()[0];
  return sender && sender.transport || null;
};

PeerConnection.prototype._canStopMediaStreamTrack = () => typeof MediaStreamTrack.prototype.stop === 'function';

PeerConnection.prototype._getAudioTracks = stream => typeof stream.getAudioTracks === 'function' ?
  stream.getAudioTracks() : stream.audioTracks;

/**
 * Get the RTCIceTransport object from the PeerConnection
 * @returns RTCIceTransport
 */
PeerConnection.prototype._getRTCIceTransport = function _getRTCIceTransport() {
  const dtlsTransport = this.getRTCDtlsTransport();
  return dtlsTransport && dtlsTransport.iceTransport || null;
};

// Is PeerConnection.protocol used outside of our SDK? We should remove this if not.
PeerConnection.protocol = ((() => RTCPC.test() ? new RTCPC() : null))();

function addStream(pc, stream) {
  if (typeof pc.addTrack === 'function') {
    stream.getAudioTracks().forEach(track => {
      // The second parameters, stream, should not be necessary per the latest editor's
      //   draft, but FF requires it. https://bugzilla.mozilla.org/show_bug.cgi?id=1231414
      pc.addTrack(track, stream);
    });
  } else {
    pc.addStream(stream);
  }
}

function cloneStream(oldStream, _MediaStream) {
  let newStream;
  if (_MediaStream) {
    newStream = new _MediaStream();
  } else if (typeof MediaStream !== 'undefined') {
    newStream = new MediaStream();
  } else {
    newStream = new webkitMediaStream();
  }

  oldStream.getAudioTracks().forEach(newStream.addTrack, newStream);
  return newStream;
}

function removeStream(pc, stream) {
  if (typeof pc.removeTrack === 'function') {
    pc.getSenders().forEach(sender => { pc.removeTrack(sender); });
  } else {
    pc.removeStream(stream);
  }
}

/**
 * Set the source of an HTMLAudioElement to the specified MediaStream
 * @param {HTMLAudioElement} audio
 * @param {MediaStream} stream
 * @returns {boolean} Whether the audio source was set successfully
 */
function setAudioSource(audio, stream) {
  if (typeof audio.srcObject !== 'undefined') {
    audio.srcObject = stream;
  } else if (typeof audio.mozSrcObject !== 'undefined') {
    audio.mozSrcObject = stream;
  } else if (typeof audio.src !== 'undefined') {
    const _window = audio.options.window || window;
    audio.src = (_window.URL || _window.webkitURL).createObjectURL(stream);
  } else {
    return false;
  }

  return true;
}

PeerConnection.enabled = RTCPC.test();

export default PeerConnection;
