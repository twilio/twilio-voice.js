'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var index = require('../errors/index.js');
var log = require('../log.js');
var util = require('../util.js');
var rtcpc = require('./rtcpc.js');
var sdp = require('./sdp.js');
var generated = require('../errors/generated.js');

// @ts-nocheck
var ICE_GATHERING_TIMEOUT = 15000;
var ICE_GATHERING_FAIL_NONE = 'none';
var ICE_GATHERING_FAIL_TIMEOUT = 'timeout';
var INITIAL_ICE_CONNECTION_STATE = 'new';
var VOLUME_INTERVAL_MS = 50;
/**
 * @typedef {Object} PeerConnection
 * @param audioHelper
 * @param pstream
 * @param options
 * @return {PeerConnection}
 * @constructor
 */
function PeerConnection(audioHelper, pstream, options) {
    var _this = this;
    if (!audioHelper || !pstream) {
        throw new index.InvalidArgumentError('Audiohelper, and pstream are required arguments');
    }
    if (!(this instanceof PeerConnection)) {
        return new PeerConnection(audioHelper, pstream, options);
    }
    this._log = new log.default('PeerConnection');
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
    var AudioContext = typeof window !== 'undefined'
        && (window.AudioContext || window.webkitAudioContext);
    this._isSinkSupported = !!AudioContext &&
        typeof HTMLAudioElement !== 'undefined' && HTMLAudioElement.prototype.setSinkId;
    // NOTE(mmalavalli): Since each Connection creates its own AudioContext,
    // after 6 instances an exception is thrown. Refer https://www.w3.org/2011/audio/track/issues/3.
    // In order to get around it, we are re-using the Device's AudioContext.
    this._audioContext = AudioContext && audioHelper._audioContext;
    this._audioHelper = audioHelper;
    this._audioProcessorEventObserver = audioHelper._getAudioProcessorEventObserver();
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
    this.options = options = options || {};
    this.navigator = options.navigator
        || (typeof navigator !== 'undefined' ? navigator : null);
    this.util = options.util || util;
    this.codecPreferences = options.codecPreferences;
    this._onAudioProcessorAdded = function (isRemote) {
        _this._handleAudioProcessorEvent(isRemote, true);
    };
    this._onAudioProcessorRemoved = function (isRemote) {
        _this._handleAudioProcessorEvent(isRemote, false);
    };
    this._audioProcessorEventObserver.on('add', this._onAudioProcessorAdded);
    this._audioProcessorEventObserver.on('remove', this._onAudioProcessorRemoved);
    return this;
}
PeerConnection.prototype.uri = function () {
    return this._uri;
};
/**
 * Open the underlying RTCPeerConnection with a MediaStream obtained by
 *   passed constraints. The resulting MediaStream is created internally
 *   and will therefore be managed and destroyed internally.
 * @param {MediaStreamConstraints} constraints
 */
PeerConnection.prototype.openDefaultDeviceWithConstraints = function (constraints) {
    return this._audioHelper._openDefaultDeviceWithConstraints(constraints)
        .then(this._setInputTracksFromStream.bind(this, false));
};
/**
 * Replace the existing input audio tracks with the audio tracks from the
 *   passed input audio stream. We re-use the existing stream because
 *   the AnalyzerNode is bound to the stream.
 * @param {MediaStream} stream
 */
PeerConnection.prototype.setInputTracksFromStream = function (stream) {
    var self = this;
    return this._setInputTracksFromStream(true, stream).then(function () {
        self._shouldManageStream = false;
    });
};
PeerConnection.prototype._createAnalyser = function (audioContext, options) {
    options = Object.assign({
        fftSize: 32,
        smoothingTimeConstant: 0.3,
    }, options);
    var analyser = audioContext.createAnalyser();
    // tslint:disable-next-line
    for (var field in options) {
        analyser[field] = options[field];
    }
    return analyser;
};
PeerConnection.prototype._setVolumeHandler = function (handler) {
    this.onvolume = handler;
};
PeerConnection.prototype._startPollingVolume = function () {
    if (!this._audioContext || !this.stream || !this._remoteStream) {
        return;
    }
    var audioContext = this._audioContext;
    var inputAnalyser = this._inputAnalyser = this._createAnalyser(audioContext);
    var inputBufferLength = inputAnalyser.frequencyBinCount;
    var inputDataArray = new Uint8Array(inputBufferLength);
    this._inputAnalyser2 = this._createAnalyser(audioContext, {
        maxDecibels: 0,
        minDecibels: -127,
        smoothingTimeConstant: 0,
    });
    var outputAnalyser = this._outputAnalyser = this._createAnalyser(audioContext);
    var outputBufferLength = outputAnalyser.frequencyBinCount;
    var outputDataArray = new Uint8Array(outputBufferLength);
    this._outputAnalyser2 = this._createAnalyser(audioContext, {
        maxDecibels: 0,
        minDecibels: -127,
        smoothingTimeConstant: 0,
    });
    this._updateInputStreamSource(this.stream);
    this._updateOutputStreamSource(this._remoteStream);
    var self = this;
    setTimeout(function emitVolume() {
        if (!self._audioContext) {
            return;
        }
        else if (self.status === 'closed') {
            self._inputAnalyser.disconnect();
            self._outputAnalyser.disconnect();
            self._inputAnalyser2.disconnect();
            self._outputAnalyser2.disconnect();
            return;
        }
        self._inputAnalyser.getByteFrequencyData(inputDataArray);
        var inputVolume = self.util.average(inputDataArray);
        self._inputAnalyser2.getByteFrequencyData(inputDataArray);
        var inputVolume2 = self.util.average(inputDataArray);
        self._outputAnalyser.getByteFrequencyData(outputDataArray);
        var outputVolume = self.util.average(outputDataArray);
        self._outputAnalyser2.getByteFrequencyData(outputDataArray);
        var outputVolume2 = self.util.average(outputDataArray);
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
PeerConnection.prototype._updateInputStreamSource = function (stream) {
    if (this._inputStreamSource) {
        this._inputStreamSource.disconnect();
    }
    try {
        this._inputStreamSource = this._audioContext.createMediaStreamSource(stream);
        this._inputStreamSource.connect(this._inputAnalyser);
        this._inputStreamSource.connect(this._inputAnalyser2);
    }
    catch (ex) {
        this._log.warn('Unable to update input MediaStreamSource', ex);
        this._inputStreamSource = null;
    }
};
/**
 * Update the stream source with the new ouput audio stream.
 * @param {MediaStream} stream
 * @private
 */
PeerConnection.prototype._updateOutputStreamSource = function (stream) {
    if (this._outputStreamSource) {
        this._outputStreamSource.disconnect();
    }
    try {
        this._outputStreamSource = this._audioContext.createMediaStreamSource(stream);
        this._outputStreamSource.connect(this._outputAnalyser);
        this._outputStreamSource.connect(this._outputAnalyser2);
    }
    catch (ex) {
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
PeerConnection.prototype._setInputTracksFromStream = function (shouldClone, newStream) {
    var _this = this;
    if (!newStream) {
        return Promise.reject(new index.InvalidArgumentError('Can not set input stream to null while in a call'));
    }
    if (!newStream.getAudioTracks().length) {
        return Promise.reject(new index.InvalidArgumentError('Supplied input stream has no audio tracks'));
    }
    var localStream = this.stream;
    var getStreamPromise = function () {
        // Apply mute settings to new input track
        _this.mute(_this.isMuted);
        return Promise.resolve(_this.stream);
    };
    if (!localStream) {
        // We can't use MediaStream.clone() here because it stopped copying over tracks
        //   as of Chrome 61. https://bugs.chromium.org/p/chromium/issues/detail?id=770908
        this.stream = shouldClone ? cloneStream(newStream, this.options.MediaStream) : newStream;
    }
    else {
        // If the call was started with gUM, and we are now replacing that track with an
        // external stream's tracks, we should stop the old managed track.
        if (this._shouldManageStream) {
            this._stopStream();
        }
        if (!this._sender) {
            this._sender = this.version.pc.getSenders()[0];
        }
        return this._sender.replaceTrack(newStream.getAudioTracks()[0]).then(function () {
            _this._updateInputStreamSource(newStream);
            _this.stream = shouldClone ? cloneStream(newStream, _this.options.MediaStream) : newStream;
            return getStreamPromise();
        });
    }
    return getStreamPromise();
};
PeerConnection.prototype._onInputDevicesChanged = function () {
    if (!this.stream) {
        return;
    }
    // If all of our active tracks are ended, then our active input was lost
    var activeInputWasLost = this.stream.getAudioTracks().every(function (track) { return track.readyState === 'ended'; });
    // We only want to act if we manage the stream in PeerConnection (It was created
    // here, rather than passed in.)
    if (activeInputWasLost && this._shouldManageStream) {
        this.openDefaultDeviceWithConstraints({ audio: true });
    }
};
PeerConnection.prototype._onIceGatheringFailure = function (type) {
    this._hasIceGatheringFailures = true;
    this.onicegatheringfailure(type);
};
PeerConnection.prototype._onMediaConnectionStateChange = function (newState) {
    var previousState = this._iceState;
    if (previousState === newState
        || (newState !== 'connected'
            && newState !== 'disconnected'
            && newState !== 'failed')) {
        return;
    }
    this._iceState = newState;
    var message;
    switch (newState) {
        case 'connected':
            if (previousState === 'disconnected' || previousState === 'failed') {
                message = 'ICE liveliness check succeeded. Connection with Twilio restored';
                this._log.info(message);
                this.onreconnected(message);
            }
            else {
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
PeerConnection.prototype._setSinkIds = function (sinkIds) {
    if (!this._isSinkSupported) {
        return Promise.reject(new index.NotSupportedError('Audio output selection is not supported by this browser'));
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
    var _this = this;
    this._stopIceGatheringTimeout();
    this._iceGatheringTimeoutId = setTimeout(function () {
        _this._onIceGatheringFailure(ICE_GATHERING_FAIL_TIMEOUT);
    }, ICE_GATHERING_TIMEOUT);
};
/**
 * Stop timeout for ICE Gathering
 */
PeerConnection.prototype._stopIceGatheringTimeout = function stopIceGatheringTimeout() {
    clearInterval(this._iceGatheringTimeoutId);
};
PeerConnection.prototype._updateAudioOutputs = function updateAudioOutputs() {
    var addedOutputIds = Array.from(this.sinkIds).filter(function (id) {
        return !this.outputs.has(id);
    }, this);
    var removedOutputIds = Array.from(this.outputs.keys()).filter(function (id) {
        return !this.sinkIds.has(id);
    }, this);
    var self = this;
    var createOutputPromises = addedOutputIds.map(this._createAudioOutput, this);
    return Promise.all(createOutputPromises).then(function () { return Promise.all(removedOutputIds.map(self._removeAudioOutput, self)); });
};
PeerConnection.prototype._createAudio = function createAudio(arr) {
    var audio = new Audio(arr);
    this.onaudio(audio);
    return audio;
};
PeerConnection.prototype._createAudioOutput = function createAudioOutput(id) {
    var _this = this;
    var dest = null;
    if (this._mediaStreamSource) {
        dest = this._audioContext.createMediaStreamDestination();
        this._mediaStreamSource.connect(dest);
    }
    var audio = this._createAudio();
    setAudioSource(audio, dest && dest.stream ? dest.stream : this.pcStream, this._audioHelper)
        .catch(function () { return _this._log.error('Error attaching stream to element (_createAudioOutput).'); });
    var self = this;
    return audio.setSinkId(id).then(function () { return audio.play(); }).then(function () {
        self.outputs.set(id, {
            audio: audio,
            dest: dest,
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
        }
        else {
            this._masterAudio.src = '';
        }
        this._masterAudio = null;
    }
    return Array.from(this.outputs.keys()).map(this._removeAudioOutput, this);
};
PeerConnection.prototype._disableOutput = function disableOutput(pc, id) {
    var output = pc.outputs.get(id);
    if (!output) {
        return;
    }
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
    var masterOutput = pc.outputs.get(masterId);
    pc.outputs.delete(masterId);
    var self = this;
    var activeDeviceId = Array.from(pc.outputs.keys())[0];
    // The audio device key could also be '' on Chrome if no media device permissions are allowed
    var idToReplace = typeof activeDeviceId === 'string' ? activeDeviceId : 'default';
    return masterOutput.audio.setSinkId(idToReplace).then(function () {
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
    var audio = pc._masterAudio = this._createAudio();
    setAudioSource(audio, stream, this._audioHelper)
        .then(function () { return audio.play(); })
        .catch(function () { return pc._log.error('Error attaching stream to element (_onAddTrack).'); });
    // Assign the initial master audio element to a random active output device
    var activeDeviceId = Array.from(pc.outputs.keys())[0];
    // The audio device key could also be '' on Chrome if no media device permissions are allowed
    var deviceId = typeof activeDeviceId === 'string' ? activeDeviceId : 'default';
    pc._masterAudioDeviceId = deviceId;
    pc.outputs.set(deviceId, { audio: audio });
    try {
        pc._mediaStreamSource = pc._audioContext.createMediaStreamSource(stream);
    }
    catch (ex) {
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
    var audio = document && document.createElement('audio');
    setAudioSource(audio, stream, this._audioHelper)
        .then(function () { return audio.play(); })
        .catch(function () { return pc._log.error('Error attaching stream to element (_fallbackOnAddTrack).'); });
    pc.outputs.set('default', { audio: audio });
};
PeerConnection.prototype._setEncodingParameters = function (enableDscp) {
    if (!enableDscp
        || !this._sender
        || typeof this._sender.getParameters !== 'function'
        || typeof this._sender.setParameters !== 'function') {
        return;
    }
    var params = this._sender.getParameters();
    if (!params.priority && !(params.encodings && params.encodings.length)) {
        return;
    }
    // This is how MDN's RTPSenderParameters defines priority
    params.priority = 'high';
    // And this is how it's currently implemented in Chrome M72+
    if (params.encodings && params.encodings.length) {
        params.encodings.forEach(function (encoding) {
            encoding.priority = 'high';
            encoding.networkPriority = 'high';
        });
    }
    this._sender.setParameters(params);
};
PeerConnection.prototype._setupPeerConnection = function (rtcConfiguration) {
    var _this = this;
    var self = this;
    var version = new (this.options.rtcpcFactory || rtcpc.default)({ RTCPeerConnection: this.options.RTCPeerConnection });
    version.create(rtcConfiguration);
    addStream(version.pc, this.stream);
    var supportedCodecs = RTCRtpReceiver.getCapabilities('audio').codecs;
    this._log.debug('sorting codecs', supportedCodecs, this.codecPreferences);
    var sortedCodecs = util.sortByMimeTypes(supportedCodecs, this.codecPreferences);
    var transceiver = version.pc.getTransceivers()[0];
    this._log.debug('setting sorted codecs', sortedCodecs);
    transceiver.setCodecPreferences(sortedCodecs);
    var eventName = 'ontrack' in version.pc
        ? 'ontrack' : 'onaddstream';
    version.pc[eventName] = function (event) {
        var stream = self._remoteStream = event.stream || event.streams[0];
        if (typeof version.pc.getSenders === 'function') {
            _this._sender = version.pc.getSenders()[0];
        }
        if (self._isSinkSupported) {
            self._onAddTrack(self, stream);
        }
        else {
            self._fallbackOnAddTrack(self, stream);
        }
        self._startPollingVolume();
    };
    return version;
};
PeerConnection.prototype._maybeSetIceAggressiveNomination = function (sdp$1) {
    return this.options.forceAggressiveIceNomination ? sdp.setIceAggressiveNomination(sdp$1) : sdp$1;
};
PeerConnection.prototype._setupChannel = function () {
    var _this = this;
    var pc = this.version.pc;
    // Chrome 25 supports onopen
    this.version.pc.onopen = function () {
        _this.status = 'open';
        _this.onopen();
    };
    // Chrome 26 doesn't support onopen so must detect state change
    this.version.pc.onstatechange = function () {
        if (_this.version.pc && _this.version.pc.readyState === 'stable') {
            _this.status = 'open';
            _this.onopen();
        }
    };
    // Chrome 27 changed onstatechange to onsignalingstatechange
    this.version.pc.onsignalingstatechange = function () {
        var state = pc.signalingState;
        _this._log.info("signalingState is \"".concat(state, "\""));
        if (_this.version.pc && _this.version.pc.signalingState === 'stable') {
            _this.status = 'open';
            _this.onopen();
        }
        _this.onsignalingstatechange(pc.signalingState);
    };
    // Chrome 72+
    pc.onconnectionstatechange = function (event) {
        var state = pc.connectionState;
        if (!state && event && event.target) {
            // VDI environment
            var targetPc = event.target;
            state = targetPc.connectionState || targetPc.connectionState_;
            _this._log.info("pc.connectionState not detected. Using target PC. State=".concat(state));
        }
        if (!state) {
            _this._log.warn("onconnectionstatechange detected but state is \"".concat(state, "\""));
        }
        else {
            _this._log.info("pc.connectionState is \"".concat(state, "\""));
        }
        _this.onpcconnectionstatechange(state);
        _this._onMediaConnectionStateChange(state);
    };
    pc.onicecandidate = function (event) {
        var candidate = event.candidate;
        if (candidate) {
            _this._hasIceCandidates = true;
            _this.onicecandidate(candidate);
            _this._setupRTCIceTransportListener();
        }
        _this._log.info("ICE Candidate: ".concat(JSON.stringify(candidate)));
    };
    pc.onicegatheringstatechange = function () {
        var state = pc.iceGatheringState;
        if (state === 'gathering') {
            _this._startIceGatheringTimeout();
        }
        else if (state === 'complete') {
            _this._stopIceGatheringTimeout();
            // Fail if no candidates found
            if (!_this._hasIceCandidates) {
                _this._onIceGatheringFailure(ICE_GATHERING_FAIL_NONE);
            }
            // There was a failure mid-gathering phase. We want to start our timer and issue
            // an ice restart if we don't get connected after our timeout
            if (_this._hasIceCandidates && _this._hasIceGatheringFailures) {
                _this._startIceGatheringTimeout();
            }
        }
        _this._log.info("pc.iceGatheringState is \"".concat(pc.iceGatheringState, "\""));
        _this.onicegatheringstatechange(state);
    };
    pc.oniceconnectionstatechange = function () {
        _this._log.info("pc.iceConnectionState is \"".concat(pc.iceConnectionState, "\""));
        _this.oniceconnectionstatechange(pc.iceConnectionState);
        _this._onMediaConnectionStateChange(pc.iceConnectionState);
    };
};
PeerConnection.prototype._initializeMediaStream = function (rtcConfiguration) {
    // if mediastream already open then do nothing
    if (this.status === 'open') {
        return false;
    }
    if (this.pstream.status === 'disconnected') {
        this.onerror({ info: {
                code: 31000,
                message: 'Cannot establish connection. Client is disconnected',
                twilioError: new generated.SignalingErrors.ConnectionDisconnected(),
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
PeerConnection.prototype._removeReconnectionListeners = function () {
    if (this.pstream) {
        this.pstream.removeListener('answer', this._onAnswerOrRinging);
        this.pstream.removeListener('hangup', this._onHangup);
    }
};
/**
 * Setup a listener for RTCDtlsTransport to capture state changes events
 * @private
 */
PeerConnection.prototype._setupRTCDtlsTransportListener = function () {
    var _this = this;
    var dtlsTransport = this.getRTCDtlsTransport();
    if (!dtlsTransport || dtlsTransport.onstatechange) {
        return;
    }
    var handler = function () {
        _this._log.info("dtlsTransportState is \"".concat(dtlsTransport.state, "\""));
        _this.ondtlstransportstatechange(dtlsTransport.state);
    };
    // Publish initial state
    handler();
    dtlsTransport.onstatechange = handler;
};
/**
 * Setup a listener for RTCIceTransport to capture selected candidate pair changes
 * @private
 */
PeerConnection.prototype._setupRTCIceTransportListener = function () {
    var _this = this;
    var iceTransport = this._getRTCIceTransport();
    if (!iceTransport || iceTransport.onselectedcandidatepairchange) {
        return;
    }
    iceTransport.onselectedcandidatepairchange = function () {
        return _this.onselectedcandidatepairchange(iceTransport.getSelectedCandidatePair());
    };
};
/**
 * Restarts ICE for the current connection
 * ICE Restart failures are ignored. Retries are managed in Connection
 * @private
 */
PeerConnection.prototype.iceRestart = function () {
    var _this = this;
    this._log.info('Attempting to restart ICE...');
    this._hasIceCandidates = false;
    this.version.createOffer(this.options.maxAverageBitrate, { iceRestart: true }).then(function () {
        _this._removeReconnectionListeners();
        _this._onAnswerOrRinging = function (payload) {
            _this._removeReconnectionListeners();
            if (!payload.sdp || _this.version.pc.signalingState !== 'have-local-offer') {
                var message = 'Invalid state or param during ICE Restart:'
                    + "hasSdp:".concat(!!payload.sdp, ", signalingState:").concat(_this.version.pc.signalingState);
                _this._log.warn(message);
                return;
            }
            var sdp = _this._maybeSetIceAggressiveNomination(payload.sdp);
            _this._answerSdp = sdp;
            if (_this.status !== 'closed') {
                _this.version.processAnswer(_this.codecPreferences, sdp, null, function (err) {
                    var message = err && err.message ? err.message : err;
                    _this._log.error("Failed to process answer during ICE Restart. Error: ".concat(message));
                });
            }
        };
        _this._onHangup = function () {
            _this._log.info('Received hangup during ICE Restart');
            _this._removeReconnectionListeners();
        };
        _this.pstream.on('answer', _this._onAnswerOrRinging);
        _this.pstream.on('hangup', _this._onHangup);
        _this.pstream.reinvite(_this.version.getSDP(), _this.callSid);
    }).catch(function (err) {
        var message = err && err.message ? err.message : err;
        _this._log.error("Failed to createOffer during ICE Restart. Error: ".concat(message));
        // CreateOffer failures doesn't transition ice state to failed
        // We need trigger it so it can be picked up by retries
        _this.onfailed(message);
    });
};
PeerConnection.prototype.makeOutgoingCall = function (params, signalingReconnectToken, callsid, rtcConfiguration, onMediaStarted) {
    var _this = this;
    if (!this._initializeMediaStream(rtcConfiguration)) {
        return;
    }
    var self = this;
    this.callSid = callsid;
    function onAnswerSuccess() {
        if (self.options) {
            self._setEncodingParameters(self.options.dscp);
        }
        onMediaStarted(self.version.pc);
    }
    function onAnswerError(err) {
        var errMsg = err.message || err;
        self.onerror({ info: {
                code: 31000,
                message: "Error processing answer: ".concat(errMsg),
                twilioError: new generated.MediaErrors.ClientRemoteDescFailed(),
            } });
    }
    this._onAnswerOrRinging = function (payload) {
        if (!payload.sdp) {
            return;
        }
        var sdp = _this._maybeSetIceAggressiveNomination(payload.sdp);
        self._answerSdp = sdp;
        if (self.status !== 'closed') {
            self.version.processAnswer(_this.codecPreferences, sdp, onAnswerSuccess, onAnswerError);
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
            }
            else {
                self.pstream.invite(self.version.getSDP(), self.callSid, params);
            }
            self._setupRTCDtlsTransportListener();
        }
    }
    function onOfferError(err) {
        var errMsg = err.message || err;
        self.onerror({ info: {
                code: 31000,
                message: "Error creating the offer: ".concat(errMsg),
                twilioError: new generated.MediaErrors.ClientLocalDescFailed(),
            } });
    }
    this.version.createOffer(this.options.maxAverageBitrate, { audio: true }, onOfferSuccess, onOfferError);
};
PeerConnection.prototype.answerIncomingCall = function (callSid, sdp, rtcConfiguration, onMediaStarted) {
    if (!this._initializeMediaStream(rtcConfiguration)) {
        return;
    }
    sdp = this._maybeSetIceAggressiveNomination(sdp);
    this._answerSdp = sdp.replace(/^a=setup:actpass$/gm, 'a=setup:passive');
    this.callSid = callSid;
    var self = this;
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
        var errMsg = err.message || err;
        self.onerror({ info: {
                code: 31000,
                message: "Error creating the answer: ".concat(errMsg),
                twilioError: new generated.MediaErrors.ClientRemoteDescFailed(),
            } });
    }
    this.version.processSDP(this.options.maxAverageBitrate, this.codecPreferences, sdp, { audio: true }, onAnswerSuccess, onAnswerError);
};
PeerConnection.prototype.close = function () {
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
    this._audioHelper._destroyRemoteProcessedStream();
    this._audioProcessorEventObserver.removeListener('add', this._onAudioProcessorAdded);
    this._audioProcessorEventObserver.removeListener('remove', this._onAudioProcessorRemoved);
    Promise.all(this._removeAudioOutputs()).catch(function () {
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
PeerConnection.prototype.reject = function (callSid) {
    this.callSid = callSid;
};
PeerConnection.prototype.ignore = function (callSid) {
    this.callSid = callSid;
};
/**
 * Mute or unmute input audio. If the stream is not yet present, the setting
 *   is saved and applied to future streams/tracks.
 * @params {boolean} shouldMute - Whether the input audio should
 *   be muted or unmuted.
 */
PeerConnection.prototype.mute = function (shouldMute) {
    this.isMuted = shouldMute;
    if (!this.stream) {
        return;
    }
    if (this._sender && this._sender.track) {
        this._sender.track.enabled = !shouldMute;
    }
    else {
        var audioTracks = typeof this.stream.getAudioTracks === 'function'
            ? this.stream.getAudioTracks()
            : this.stream.audioTracks;
        audioTracks.forEach(function (track) {
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
    var self = this;
    var pc = this.version.pc;
    if (!pc) {
        this._log.warn('No RTCPeerConnection available to call createDTMFSender on');
        return null;
    }
    if (typeof pc.getSenders === 'function' && (typeof RTCDTMFSender === 'function' || typeof RTCDtmfSender === 'function')) {
        var chosenSender = pc.getSenders().find(function (sender) { return sender.dtmf; });
        if (chosenSender) {
            this._log.info('Using RTCRtpSender#dtmf');
            this._dtmfSender = chosenSender.dtmf;
            return this._dtmfSender;
        }
    }
    if (typeof pc.createDTMFSender === 'function' && typeof pc.getLocalStreams === 'function') {
        var track = pc.getLocalStreams().map(function (stream) {
            var tracks = self._getAudioTracks(stream);
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
    var sender = this.version && this.version.pc
        && typeof this.version.pc.getSenders === 'function'
        && this.version.pc.getSenders()[0];
    return sender && sender.transport || null;
};
PeerConnection.prototype._canStopMediaStreamTrack = function () { return typeof MediaStreamTrack.prototype.stop === 'function'; };
PeerConnection.prototype._getAudioTracks = function (stream) { return typeof stream.getAudioTracks === 'function' ?
    stream.getAudioTracks() : stream.audioTracks; };
/**
 * Get the RTCIceTransport object from the PeerConnection
 * @returns RTCIceTransport
 */
PeerConnection.prototype._getRTCIceTransport = function _getRTCIceTransport() {
    var dtlsTransport = this.getRTCDtlsTransport();
    return dtlsTransport && dtlsTransport.iceTransport || null;
};
// Is PeerConnection.protocol used outside of our SDK? We should remove this if not.
PeerConnection.protocol = ((function () { return rtcpc.default.test() ? new rtcpc.default() : null; }))();
PeerConnection.prototype._handleAudioProcessorEvent = function (isRemote, isAddProcessor) {
    var _this = this;
    if (!isRemote || !this._remoteStream) {
        return;
    }
    var audio = null;
    if (this._masterAudio) {
        this._log.info('Setting audio source for master audio.');
        audio = this._masterAudio;
    }
    else {
        this._log.info('No master audio. Setting audio source for default audio output.');
        audio = this.outputs.get('default').audio;
    }
    setAudioSource(audio, this._remoteStream, this._audioHelper)
        .then(function () {
        var successLog = isAddProcessor
            ? 'Successfully updated audio source with processed stream'
            : 'Successfully reverted audio source to original stream';
        _this._log.info(successLog);
        // If the audio was paused, resume playback
        if (audio.paused) {
            _this._log.info('Resuming audio playback');
            audio.play();
        }
    })
        .catch(function () {
        var errorLog = isAddProcessor
            ? 'Failed to update audio source'
            : 'Failed to revert audio source';
        _this._log.error(errorLog);
    });
};
function addStream(pc, stream) {
    if (typeof pc.addTrack === 'function') {
        stream.getAudioTracks().forEach(function (track) {
            // The second parameters, stream, should not be necessary per the latest editor's
            //   draft, but FF requires it. https://bugzilla.mozilla.org/show_bug.cgi?id=1231414
            pc.addTrack(track, stream);
        });
    }
    else {
        pc.addStream(stream);
    }
}
function cloneStream(oldStream, _MediaStream) {
    var newStream;
    if (_MediaStream) {
        newStream = new _MediaStream();
    }
    else if (typeof MediaStream !== 'undefined') {
        newStream = new MediaStream();
    }
    else {
        newStream = new webkitMediaStream();
    }
    oldStream.getAudioTracks().forEach(newStream.addTrack, newStream);
    return newStream;
}
/**
 * Sets the source of an HTMLAudioElement to the specified MediaStream and
 * applies a remote audio processor if available
 * @param {HTMLAudioElement} audio
 * @param {MediaStream} stream
 * @returns {Promise} Fulfilled if the audio source was set successfully
 */
function setAudioSource(audio, stream, audioHelper) {
    return audioHelper._maybeCreateRemoteProcessedStream(stream).then(function (maybeProcessedStream) {
        if (typeof audio.srcObject !== 'undefined') {
            audio.srcObject = maybeProcessedStream;
        }
        else if (typeof audio.mozSrcObject !== 'undefined') {
            audio.mozSrcObject = maybeProcessedStream;
        }
        else if (typeof audio.src !== 'undefined') {
            var _window = audio.options.window || window;
            audio.src = (_window.URL || _window.webkitURL).createObjectURL(maybeProcessedStream);
        }
        else {
            return Promise.reject();
        }
        return Promise.resolve();
    });
}
PeerConnection.enabled = rtcpc.default.test();

exports.default = PeerConnection;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVlcmNvbm5lY3Rpb24uanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi90d2lsaW8vcnRjL3BlZXJjb25uZWN0aW9uLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbIkludmFsaWRBcmd1bWVudEVycm9yIiwiTG9nIiwiTm90U3VwcG9ydGVkRXJyb3IiLCJSVENQQyIsInV0aWwuc29ydEJ5TWltZVR5cGVzIiwic2RwIiwic2V0SWNlQWdncmVzc2l2ZU5vbWluYXRpb24iLCJTaWduYWxpbmdFcnJvcnMiLCJNZWRpYUVycm9ycyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFBQTtBQVlBLElBQU0scUJBQXFCLEdBQUcsS0FBSztBQUNuQyxJQUFNLHVCQUF1QixHQUFHLE1BQU07QUFDdEMsSUFBTSwwQkFBMEIsR0FBRyxTQUFTO0FBQzVDLElBQU0sNEJBQTRCLEdBQUcsS0FBSztBQUMxQyxJQUFNLGtCQUFrQixHQUFHLEVBQUU7QUFFN0I7Ozs7Ozs7QUFPRztBQUNILFNBQVMsY0FBYyxDQUFDLFdBQVcsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFBO0lBQXJELElBQUEsS0FBQSxHQUFBLElBQUE7QUFDRSxJQUFBLElBQUksQ0FBQyxXQUFXLElBQUksQ0FBQyxPQUFPLEVBQUU7QUFDNUIsUUFBQSxNQUFNLElBQUlBLDBCQUFvQixDQUFDLGlEQUFpRCxDQUFDO0lBQ25GO0FBRUEsSUFBQSxJQUFJLEVBQUUsSUFBSSxZQUFZLGNBQWMsQ0FBQyxFQUFFO1FBQ3JDLE9BQU8sSUFBSSxjQUFjLENBQUMsV0FBVyxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUM7SUFDMUQ7SUFFQSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUlDLFdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQztBQUVyQyxJQUFBLFNBQVMsSUFBSSxHQUFBO0FBQ1gsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyx3Q0FBd0MsQ0FBQztJQUMxRDtBQUNBLElBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJO0FBQ25CLElBQUEsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJO0FBQ2xCLElBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJO0FBQ25CLElBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJO0FBQ25CLElBQUEsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJO0FBQzFCLElBQUEsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJO0FBQ3BCLElBQUEsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJO0FBQ3ZCLElBQUEsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJO0FBQ3pCLElBQUEsSUFBSSxDQUFDLHNCQUFzQixHQUFHLElBQUk7QUFDbEMsSUFBQSxJQUFJLENBQUMsMEJBQTBCLEdBQUcsSUFBSTtBQUN0QyxJQUFBLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxJQUFJO0FBQ2pDLElBQUEsSUFBSSxDQUFDLHlCQUF5QixHQUFHLElBQUk7QUFDckMsSUFBQSxJQUFJLENBQUMsMEJBQTBCLEdBQUcsSUFBSTtBQUN0QyxJQUFBLElBQUksQ0FBQyx5QkFBeUIsR0FBRyxJQUFJO0FBQ3JDLElBQUEsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJO0FBQzFCLElBQUEsSUFBSSxDQUFDLDZCQUE2QixHQUFHLElBQUk7QUFDekMsSUFBQSxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUk7QUFDcEIsSUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUk7QUFDbkIsSUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU87QUFDdEIsSUFBQSxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUk7SUFDbEIsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ25DLElBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUN4QixJQUFBLElBQUksQ0FBQyxNQUFNLEdBQUcsWUFBWTtBQUMxQixJQUFBLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSTtBQUNuQixJQUFBLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSztBQUVwQixJQUFBLElBQU0sWUFBWSxHQUFHLE9BQU8sTUFBTSxLQUFLO1lBQ2pDLE1BQU0sQ0FBQyxZQUFZLElBQUksTUFBTSxDQUFDLGtCQUFrQixDQUFDO0FBQ3ZELElBQUEsSUFBSSxDQUFDLGdCQUFnQixHQUFHLENBQUMsQ0FBQyxZQUFZO1FBQ3BDLE9BQU8sZ0JBQWdCLEtBQUssV0FBVyxJQUFJLGdCQUFnQixDQUFDLFNBQVMsQ0FBQyxTQUFTOzs7O0lBSWpGLElBQUksQ0FBQyxhQUFhLEdBQUcsWUFBWSxJQUFJLFdBQVcsQ0FBQyxhQUFhO0FBQzlELElBQUEsSUFBSSxDQUFDLFlBQVksR0FBRyxXQUFXO0FBQy9CLElBQUEsSUFBSSxDQUFDLDRCQUE0QixHQUFHLFdBQVcsQ0FBQywrQkFBK0IsRUFBRTtBQUNqRixJQUFBLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxLQUFLO0FBQzlCLElBQUEsSUFBSSxDQUFDLHdCQUF3QixHQUFHLEtBQUs7QUFDckMsSUFBQSxJQUFJLENBQUMsc0JBQXNCLEdBQUcsSUFBSTtBQUNsQyxJQUFBLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSTtBQUN4QixJQUFBLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxJQUFJO0FBQ2hDLElBQUEsSUFBSSxDQUFDLGtCQUFrQixHQUFHLElBQUk7QUFDOUIsSUFBQSxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUk7QUFDdkIsSUFBQSxJQUFJLENBQUMsc0JBQXNCLEdBQUcsS0FBSztBQUNuQyxJQUFBLElBQUksQ0FBQyxXQUFXLEdBQUcsRUFBRTtBQUNyQixJQUFBLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFO0FBQ3BDLElBQUEsSUFBSSxDQUFDLGtCQUFrQixHQUFHLElBQUk7QUFDOUIsSUFBQSxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUk7QUFDckIsSUFBQSxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUk7QUFDekIsSUFBQSxJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSTtBQUMvQixJQUFBLElBQUksQ0FBQyxTQUFTLEdBQUcsNEJBQTRCO0lBRTdDLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxHQUFHLE9BQU8sSUFBSSxFQUFFO0FBQ3RDLElBQUEsSUFBSSxDQUFDLFNBQVMsR0FBRyxPQUFPLENBQUM7QUFDcEIsWUFBQyxPQUFPLFNBQVMsS0FBSyxXQUFXLEdBQUcsU0FBUyxHQUFHLElBQUksQ0FBQztJQUMxRCxJQUFJLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxJQUFJLElBQUksSUFBSTtBQUNoQyxJQUFBLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxPQUFPLENBQUMsZ0JBQWdCO0FBRWhELElBQUEsSUFBSSxDQUFDLHNCQUFzQixHQUFHLFVBQUMsUUFBUSxFQUFBO0FBQ3JDLFFBQUEsS0FBSSxDQUFDLDBCQUEwQixDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUM7QUFDakQsSUFBQSxDQUFDO0FBQ0QsSUFBQSxJQUFJLENBQUMsd0JBQXdCLEdBQUcsVUFBQyxRQUFRLEVBQUE7QUFDdkMsUUFBQSxLQUFJLENBQUMsMEJBQTBCLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQztBQUNsRCxJQUFBLENBQUM7SUFDRCxJQUFJLENBQUMsNEJBQTRCLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsc0JBQXNCLENBQUM7SUFDeEUsSUFBSSxDQUFDLDRCQUE0QixDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLHdCQUF3QixDQUFDO0FBRTdFLElBQUEsT0FBTyxJQUFJO0FBQ2I7QUFFQSxjQUFjLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxZQUFBO0lBQzdCLE9BQU8sSUFBSSxDQUFDLElBQUk7QUFDbEIsQ0FBQztBQUVEOzs7OztBQUtHO0FBQ0gsY0FBYyxDQUFDLFNBQVMsQ0FBQyxnQ0FBZ0MsR0FBRyxVQUFTLFdBQVcsRUFBQTtBQUM5RSxJQUFBLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxpQ0FBaUMsQ0FBQyxXQUFXO0FBQ25FLFNBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQzNELENBQUM7QUFFRDs7Ozs7QUFLRztBQUNILGNBQWMsQ0FBQyxTQUFTLENBQUMsd0JBQXdCLEdBQUcsVUFBUyxNQUFNLEVBQUE7SUFDakUsSUFBTSxJQUFJLEdBQUcsSUFBSTtJQUNqQixPQUFPLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQUE7QUFDdkQsUUFBQSxJQUFJLENBQUMsbUJBQW1CLEdBQUcsS0FBSztBQUNsQyxJQUFBLENBQUMsQ0FBQztBQUNKLENBQUM7QUFFRCxjQUFjLENBQUMsU0FBUyxDQUFDLGVBQWUsR0FBRyxVQUFDLFlBQVksRUFBRSxPQUFPLEVBQUE7QUFDL0QsSUFBQSxPQUFPLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztBQUN0QixRQUFBLE9BQU8sRUFBRSxFQUFFO0FBQ1gsUUFBQSxxQkFBcUIsRUFBRSxHQUFHO0tBQzNCLEVBQUUsT0FBTyxDQUFDO0FBRVgsSUFBQSxJQUFNLFFBQVEsR0FBRyxZQUFZLENBQUMsY0FBYyxFQUFFOztBQUU5QyxJQUFBLEtBQUssSUFBTSxLQUFLLElBQUksT0FBTyxFQUFFO1FBQzNCLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDO0lBQ2xDO0FBRUEsSUFBQSxPQUFPLFFBQVE7QUFDakIsQ0FBQztBQUVELGNBQWMsQ0FBQyxTQUFTLENBQUMsaUJBQWlCLEdBQUcsVUFBUyxPQUFPLEVBQUE7QUFDM0QsSUFBQSxJQUFJLENBQUMsUUFBUSxHQUFHLE9BQU87QUFDekIsQ0FBQztBQUNELGNBQWMsQ0FBQyxTQUFTLENBQUMsbUJBQW1CLEdBQUcsWUFBQTtBQUM3QyxJQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUU7UUFDOUQ7SUFDRjtBQUVBLElBQUEsSUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLGFBQWE7QUFFdkMsSUFBQSxJQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDO0FBQzlFLElBQUEsSUFBTSxpQkFBaUIsR0FBRyxhQUFhLENBQUMsaUJBQWlCO0FBQ3pELElBQUEsSUFBTSxjQUFjLEdBQUcsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUM7SUFDeEQsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRTtBQUN4RCxRQUFBLFdBQVcsRUFBRSxDQUFDO1FBQ2QsV0FBVyxFQUFFLElBQUk7QUFDakIsUUFBQSxxQkFBcUIsRUFBRSxDQUFDO0FBQ3pCLEtBQUEsQ0FBQztBQUVGLElBQUEsSUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLFlBQVksQ0FBQztBQUNoRixJQUFBLElBQU0sa0JBQWtCLEdBQUcsY0FBYyxDQUFDLGlCQUFpQjtBQUMzRCxJQUFBLElBQU0sZUFBZSxHQUFHLElBQUksVUFBVSxDQUFDLGtCQUFrQixDQUFDO0lBQzFELElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRTtBQUN6RCxRQUFBLFdBQVcsRUFBRSxDQUFDO1FBQ2QsV0FBVyxFQUFFLElBQUk7QUFDakIsUUFBQSxxQkFBcUIsRUFBRSxDQUFDO0FBQ3pCLEtBQUEsQ0FBQztBQUVGLElBQUEsSUFBSSxDQUFDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7QUFDMUMsSUFBQSxJQUFJLENBQUMseUJBQXlCLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQztJQUVsRCxJQUFNLElBQUksR0FBRyxJQUFJO0lBQ2pCLFVBQVUsQ0FBQyxTQUFTLFVBQVUsR0FBQTtBQUM1QixRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFO1lBQ3ZCO1FBQ0Y7QUFBTyxhQUFBLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxRQUFRLEVBQUU7QUFDbkMsWUFBQSxJQUFJLENBQUMsY0FBYyxDQUFDLFVBQVUsRUFBRTtBQUNoQyxZQUFBLElBQUksQ0FBQyxlQUFlLENBQUMsVUFBVSxFQUFFO0FBQ2pDLFlBQUEsSUFBSSxDQUFDLGVBQWUsQ0FBQyxVQUFVLEVBQUU7QUFDakMsWUFBQSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxFQUFFO1lBQ2xDO1FBQ0Y7QUFFQSxRQUFBLElBQUksQ0FBQyxjQUFjLENBQUMsb0JBQW9CLENBQUMsY0FBYyxDQUFDO1FBQ3hELElBQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQztBQUVyRCxRQUFBLElBQUksQ0FBQyxlQUFlLENBQUMsb0JBQW9CLENBQUMsY0FBYyxDQUFDO1FBQ3pELElBQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQztBQUV0RCxRQUFBLElBQUksQ0FBQyxlQUFlLENBQUMsb0JBQW9CLENBQUMsZUFBZSxDQUFDO1FBQzFELElBQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQztBQUV2RCxRQUFBLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxvQkFBb0IsQ0FBQyxlQUFlLENBQUM7UUFDM0QsSUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDO0FBQ3hELFFBQUEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLEdBQUcsR0FBRyxFQUFFLFlBQVksR0FBRyxHQUFHLEVBQUUsWUFBWSxFQUFFLGFBQWEsQ0FBQztBQUVqRixRQUFBLFVBQVUsQ0FBQyxVQUFVLEVBQUUsa0JBQWtCLENBQUM7SUFDNUMsQ0FBQyxFQUFFLGtCQUFrQixDQUFDO0FBQ3hCLENBQUM7QUFFRCxjQUFjLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBRyxTQUFTLFdBQVcsR0FBQTs7O0FBR3pELElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsRUFBRTtRQUM3QjtJQUNGO0FBRUEsSUFBQSxJQUFJLENBQUMsWUFBWSxDQUFDLDZCQUE2QixFQUFFO0FBQ25ELENBQUM7QUFFRDs7OztBQUlHO0FBQ0gsY0FBYyxDQUFDLFNBQVMsQ0FBQyx3QkFBd0IsR0FBRyxVQUFTLE1BQU0sRUFBQTtBQUNqRSxJQUFBLElBQUksSUFBSSxDQUFDLGtCQUFrQixFQUFFO0FBQzNCLFFBQUEsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFVBQVUsRUFBRTtJQUN0QztBQUVBLElBQUEsSUFBSTtRQUNGLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLHVCQUF1QixDQUFDLE1BQU0sQ0FBQztRQUM1RSxJQUFJLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUM7UUFDcEQsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDO0lBQ3ZEO0lBQUUsT0FBTyxFQUFFLEVBQUU7UUFDWCxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQywwQ0FBMEMsRUFBRSxFQUFFLENBQUM7QUFDOUQsUUFBQSxJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSTtJQUNoQztBQUNGLENBQUM7QUFFRDs7OztBQUlHO0FBQ0gsY0FBYyxDQUFDLFNBQVMsQ0FBQyx5QkFBeUIsR0FBRyxVQUFTLE1BQU0sRUFBQTtBQUNsRSxJQUFBLElBQUksSUFBSSxDQUFDLG1CQUFtQixFQUFFO0FBQzVCLFFBQUEsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFVBQVUsRUFBRTtJQUN2QztBQUVBLElBQUEsSUFBSTtRQUNGLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLHVCQUF1QixDQUFDLE1BQU0sQ0FBQztRQUM3RSxJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUM7UUFDdEQsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUM7SUFDekQ7SUFBRSxPQUFPLEVBQUUsRUFBRTtRQUNYLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLDJDQUEyQyxFQUFFLEVBQUUsQ0FBQztBQUMvRCxRQUFBLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxJQUFJO0lBQ2pDO0FBQ0YsQ0FBQztBQUVEOzs7Ozs7Ozs7O0FBVUc7QUFDSCxjQUFjLENBQUMsU0FBUyxDQUFDLHlCQUF5QixHQUFHLFVBQVMsV0FBVyxFQUFFLFNBQVMsRUFBQTtJQUEvQixJQUFBLEtBQUEsR0FBQSxJQUFBO0lBQ25ELElBQUksQ0FBQyxTQUFTLEVBQUU7UUFDZCxPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSUQsMEJBQW9CLENBQUMsa0RBQWtELENBQUMsQ0FBQztJQUNyRztJQUVBLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxFQUFFLENBQUMsTUFBTSxFQUFFO1FBQ3RDLE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJQSwwQkFBb0IsQ0FBQywyQ0FBMkMsQ0FBQyxDQUFDO0lBQzlGO0FBRUEsSUFBQSxJQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsTUFBTTtBQUMvQixJQUFBLElBQU0sZ0JBQWdCLEdBQUcsWUFBQTs7QUFFdkIsUUFBQSxLQUFJLENBQUMsSUFBSSxDQUFDLEtBQUksQ0FBQyxPQUFPLENBQUM7UUFDdkIsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLEtBQUksQ0FBQyxNQUFNLENBQUM7QUFDckMsSUFBQSxDQUFDO0lBRUQsSUFBSSxDQUFDLFdBQVcsRUFBRTs7O1FBR2hCLElBQUksQ0FBQyxNQUFNLEdBQUcsV0FBVyxHQUFHLFdBQVcsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsR0FBRyxTQUFTO0lBQzFGO1NBQU87OztBQUdMLFFBQUEsSUFBSSxJQUFJLENBQUMsbUJBQW1CLEVBQUU7WUFDNUIsSUFBSSxDQUFDLFdBQVcsRUFBRTtRQUNwQjtBQUVBLFFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUU7QUFDakIsWUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNoRDtBQUVBLFFBQUEsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBQTtBQUNuRSxZQUFBLEtBQUksQ0FBQyx3QkFBd0IsQ0FBQyxTQUFTLENBQUM7WUFDeEMsS0FBSSxDQUFDLE1BQU0sR0FBRyxXQUFXLEdBQUcsV0FBVyxDQUFDLFNBQVMsRUFBRSxLQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxHQUFHLFNBQVM7WUFDeEYsT0FBTyxnQkFBZ0IsRUFBRTtBQUMzQixRQUFBLENBQUMsQ0FBQztJQUNKO0lBRUEsT0FBTyxnQkFBZ0IsRUFBRTtBQUMzQixDQUFDO0FBRUQsY0FBYyxDQUFDLFNBQVMsQ0FBQyxzQkFBc0IsR0FBRyxZQUFBO0FBQ2hELElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUU7UUFBRTtJQUFROztJQUc1QixJQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsY0FBYyxFQUFFLENBQUMsS0FBSyxDQUFDLFVBQUEsS0FBSyxFQUFBLEVBQUksT0FBQSxLQUFLLENBQUMsVUFBVSxLQUFLLE9BQU8sQ0FBQSxDQUE1QixDQUE0QixDQUFDOzs7QUFJcEcsSUFBQSxJQUFJLGtCQUFrQixJQUFJLElBQUksQ0FBQyxtQkFBbUIsRUFBRTtRQUNsRCxJQUFJLENBQUMsZ0NBQWdDLENBQUMsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLENBQUM7SUFDeEQ7QUFDRixDQUFDO0FBRUQsY0FBYyxDQUFDLFNBQVMsQ0FBQyxzQkFBc0IsR0FBRyxVQUFTLElBQUksRUFBQTtBQUM3RCxJQUFBLElBQUksQ0FBQyx3QkFBd0IsR0FBRyxJQUFJO0FBQ3BDLElBQUEsSUFBSSxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQztBQUNsQyxDQUFDO0FBRUQsY0FBYyxDQUFDLFNBQVMsQ0FBQyw2QkFBNkIsR0FBRyxVQUFTLFFBQVEsRUFBQTtBQUN4RSxJQUFBLElBQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxTQUFTO0lBRXBDLElBQUksYUFBYSxLQUFLO1lBQ2hCLFFBQVEsS0FBSztBQUNkLGVBQUEsUUFBUSxLQUFLO0FBQ2IsZUFBQSxRQUFRLEtBQUssUUFBUSxDQUFDLEVBQUU7UUFDM0I7SUFDRjtBQUNBLElBQUEsSUFBSSxDQUFDLFNBQVMsR0FBRyxRQUFRO0FBRXpCLElBQUEsSUFBSSxPQUFPO0lBQ1gsUUFBUSxRQUFRO0FBQ2QsUUFBQSxLQUFLLFdBQVc7WUFDZCxJQUFJLGFBQWEsS0FBSyxjQUFjLElBQUksYUFBYSxLQUFLLFFBQVEsRUFBRTtnQkFDbEUsT0FBTyxHQUFHLGlFQUFpRTtBQUMzRSxnQkFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUM7QUFDdkIsZ0JBQUEsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUM7WUFDN0I7aUJBQU87Z0JBQ0wsT0FBTyxHQUFHLCtCQUErQjtBQUN6QyxnQkFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUM7QUFDdkIsZ0JBQUEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUM7WUFDM0I7WUFDQSxJQUFJLENBQUMsd0JBQXdCLEVBQUU7QUFDL0IsWUFBQSxJQUFJLENBQUMsd0JBQXdCLEdBQUcsS0FBSztZQUNyQztBQUNGLFFBQUEsS0FBSyxjQUFjO1lBQ2pCLE9BQU8sR0FBRyx5RUFBeUU7QUFDbkYsWUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUM7QUFDdkIsWUFBQSxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQztZQUM1QjtBQUNGLFFBQUEsS0FBSyxRQUFRO1lBQ1gsT0FBTyxHQUFHLHlDQUF5QztBQUNuRCxZQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQztBQUN2QixZQUFBLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDO1lBQ3RCOztBQUVOLENBQUM7QUFFRCxjQUFjLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBRyxVQUFTLE9BQU8sRUFBQTtBQUNyRCxJQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUU7UUFDMUIsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUlFLHVCQUFpQixDQUFDLHlEQUF5RCxDQUFDLENBQUM7SUFDekc7SUFFQSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEdBQUcsT0FBTyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDN0QsT0FBTyxJQUFJLENBQUM7QUFDVixVQUFFLElBQUksQ0FBQyxtQkFBbUI7QUFDMUIsVUFBRSxPQUFPLENBQUMsT0FBTyxFQUFFO0FBQ3ZCLENBQUM7QUFFRDs7QUFFRztBQUNILGNBQWMsQ0FBQyxTQUFTLENBQUMseUJBQXlCLEdBQUcsU0FBUyx3QkFBd0IsR0FBQTtJQUFqQyxJQUFBLEtBQUEsR0FBQSxJQUFBO0lBQ25ELElBQUksQ0FBQyx3QkFBd0IsRUFBRTtBQUMvQixJQUFBLElBQUksQ0FBQyxzQkFBc0IsR0FBRyxVQUFVLENBQUMsWUFBQTtBQUN2QyxRQUFBLEtBQUksQ0FBQyxzQkFBc0IsQ0FBQywwQkFBMEIsQ0FBQztJQUN6RCxDQUFDLEVBQUUscUJBQXFCLENBQUM7QUFDM0IsQ0FBQztBQUVEOztBQUVHO0FBQ0gsY0FBYyxDQUFDLFNBQVMsQ0FBQyx3QkFBd0IsR0FBRyxTQUFTLHVCQUF1QixHQUFBO0FBQ2xGLElBQUEsYUFBYSxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQztBQUM1QyxDQUFDO0FBRUQsY0FBYyxDQUFDLFNBQVMsQ0FBQyxtQkFBbUIsR0FBRyxTQUFTLGtCQUFrQixHQUFBO0FBQ3hFLElBQUEsSUFBTSxjQUFjLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDLFVBQVMsRUFBRSxFQUFBO1FBQ2hFLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7SUFDOUIsQ0FBQyxFQUFFLElBQUksQ0FBQztBQUVSLElBQUEsSUFBTSxnQkFBZ0IsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsVUFBUyxFQUFFLEVBQUE7UUFDekUsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztJQUM5QixDQUFDLEVBQUUsSUFBSSxDQUFDO0lBRVIsSUFBTSxJQUFJLEdBQUcsSUFBSTtBQUNqQixJQUFBLElBQU0sb0JBQW9CLEdBQUcsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsSUFBSSxDQUFDO0FBQzlFLElBQUEsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLG9CQUFvQixDQUFDLENBQUMsSUFBSSxDQUFDLFlBQUEsRUFBTSxPQUFBLE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFBLENBQWhFLENBQWdFLENBQUM7QUFDdkgsQ0FBQztBQUVELGNBQWMsQ0FBQyxTQUFTLENBQUMsWUFBWSxHQUFHLFNBQVMsV0FBVyxDQUFDLEdBQUcsRUFBQTtBQUM5RCxJQUFBLElBQU0sS0FBSyxHQUFHLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQztBQUM1QixJQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO0FBQ25CLElBQUEsT0FBTyxLQUFLO0FBQ2QsQ0FBQztBQUVELGNBQWMsQ0FBQyxTQUFTLENBQUMsa0JBQWtCLEdBQUcsU0FBUyxpQkFBaUIsQ0FBQyxFQUFFLEVBQUE7SUFBN0IsSUFBQSxLQUFBLEdBQUEsSUFBQTtJQUM1QyxJQUFJLElBQUksR0FBRyxJQUFJO0FBQ2YsSUFBQSxJQUFJLElBQUksQ0FBQyxrQkFBa0IsRUFBRTtBQUMzQixRQUFBLElBQUksR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLDRCQUE0QixFQUFFO0FBQ3hELFFBQUEsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7SUFDdkM7QUFFQSxJQUFBLElBQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxZQUFZLEVBQUU7SUFDakMsY0FBYyxDQUFDLEtBQUssRUFBRSxJQUFJLElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLFlBQVk7QUFDdkYsU0FBQSxLQUFLLENBQUMsWUFBQSxFQUFNLE9BQUEsS0FBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMseURBQXlELENBQUMsQ0FBQSxDQUExRSxDQUEwRSxDQUFDO0lBRTFGLElBQU0sSUFBSSxHQUFHLElBQUk7SUFDakIsT0FBTyxLQUFLLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFBLEVBQU0sT0FBQSxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUEsQ0FBWixDQUFZLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBQTtBQUN2RCxRQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRTtBQUNuQixZQUFBLEtBQUssRUFBQSxLQUFBO0FBQ0wsWUFBQSxJQUFJLEVBQUEsSUFBQTtBQUNMLFNBQUEsQ0FBQztBQUNKLElBQUEsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQUVELGNBQWMsQ0FBQyxTQUFTLENBQUMsbUJBQW1CLEdBQUcsU0FBUyxrQkFBa0IsR0FBQTtJQUN4RSxJQUFJLElBQUksQ0FBQyxZQUFZLElBQUksT0FBTyxJQUFJLENBQUMsb0JBQW9CLEtBQUssV0FBVyxFQUFFO1FBQ3pFLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxvQkFBb0IsQ0FBQztRQUNwRCxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUM7QUFDOUMsUUFBQSxJQUFJLENBQUMsb0JBQW9CLEdBQUcsSUFBSTs7QUFHaEMsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUU7QUFDN0IsWUFBQSxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBRTtRQUMzQjtRQUNBLElBQUksT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsS0FBSyxXQUFXLEVBQUU7QUFDdEQsWUFBQSxJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsR0FBRyxJQUFJO1FBQ3BDO2FBQU87QUFDTCxZQUFBLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxHQUFHLEVBQUU7UUFDNUI7QUFDQSxRQUFBLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSTtJQUMxQjtJQUVBLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxJQUFJLENBQUM7QUFDM0UsQ0FBQztBQUVELGNBQWMsQ0FBQyxTQUFTLENBQUMsY0FBYyxHQUFHLFNBQVMsYUFBYSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUE7SUFDckUsSUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO0lBQ2pDLElBQUksQ0FBQyxNQUFNLEVBQUU7UUFBRTtJQUFRO0FBRXZCLElBQUEsSUFBSSxNQUFNLENBQUMsS0FBSyxFQUFFO0FBQ2hCLFFBQUEsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUU7QUFDcEIsUUFBQSxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxFQUFFO0lBQ3ZCO0FBRUEsSUFBQSxJQUFJLE1BQU0sQ0FBQyxJQUFJLEVBQUU7QUFDZixRQUFBLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFO0lBQzFCO0FBQ0YsQ0FBQztBQUVEOzs7Ozs7OztBQVFHO0FBQ0gsY0FBYyxDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsR0FBRyxTQUFTLG9CQUFvQixDQUFDLEVBQUUsRUFBRSxRQUFRLEVBQUE7SUFDekYsSUFBTSxZQUFZLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDO0FBQzdDLElBQUEsRUFBRSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDO0lBRTNCLElBQU0sSUFBSSxHQUFHLElBQUk7QUFDakIsSUFBQSxJQUFNLGNBQWMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBRXZELElBQUEsSUFBTSxXQUFXLEdBQUcsT0FBTyxjQUFjLEtBQUssUUFBUSxHQUFHLGNBQWMsR0FBRyxTQUFTO0lBRW5GLE9BQU8sWUFBWSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQUE7QUFDcEQsUUFBQSxJQUFJLENBQUMsY0FBYyxDQUFDLEVBQUUsRUFBRSxXQUFXLENBQUM7UUFFcEMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLFlBQVksQ0FBQztBQUN6QyxRQUFBLEVBQUUsQ0FBQyxvQkFBb0IsR0FBRyxXQUFXO0FBQ3ZDLElBQUEsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFNBQVMsUUFBUSxHQUFBO1FBQ3hCLEVBQUUsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxZQUFZLENBQUM7QUFDdEMsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQywyREFBMkQsQ0FBQztBQUM3RSxJQUFBLENBQUMsQ0FBQztBQUNKLENBQUM7QUFFRCxjQUFjLENBQUMsU0FBUyxDQUFDLGtCQUFrQixHQUFHLFNBQVMsaUJBQWlCLENBQUMsRUFBRSxFQUFBO0FBQ3pFLElBQUEsSUFBSSxJQUFJLENBQUMsb0JBQW9CLEtBQUssRUFBRSxFQUFFO1FBQ3BDLE9BQU8sSUFBSSxDQUFDLHFCQUFxQixDQUFDLElBQUksRUFBRSxFQUFFLENBQUM7SUFDN0M7QUFFQSxJQUFBLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQztBQUM3QixJQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztBQUV2QixJQUFBLE9BQU8sT0FBTyxDQUFDLE9BQU8sRUFBRTtBQUMxQixDQUFDO0FBRUQ7Ozs7OztBQU1HO0FBQ0gsY0FBYyxDQUFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsU0FBUyxVQUFVLENBQUMsRUFBRSxFQUFFLE1BQU0sRUFBQTtJQUNuRSxJQUFNLEtBQUssR0FBRyxFQUFFLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxZQUFZLEVBQUU7SUFDbkQsY0FBYyxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLFlBQVk7U0FDNUMsSUFBSSxDQUFDLGNBQU0sT0FBQSxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUEsQ0FBWixDQUFZO0FBQ3ZCLFNBQUEsS0FBSyxDQUFDLFlBQUEsRUFBTSxPQUFBLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGtEQUFrRCxDQUFDLENBQUEsQ0FBakUsQ0FBaUUsQ0FBQzs7QUFHakYsSUFBQSxJQUFNLGNBQWMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBRXZELElBQUEsSUFBTSxRQUFRLEdBQUcsT0FBTyxjQUFjLEtBQUssUUFBUSxHQUFHLGNBQWMsR0FBRyxTQUFTO0FBQ2hGLElBQUEsRUFBRSxDQUFDLG9CQUFvQixHQUFHLFFBQVE7QUFDbEMsSUFBQSxFQUFFLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsRUFBRSxLQUFLLEVBQUEsS0FBQSxFQUFFLENBQUM7QUFFbkMsSUFBQSxJQUFJO1FBQ0YsRUFBRSxDQUFDLGtCQUFrQixHQUFHLEVBQUUsQ0FBQyxhQUFhLENBQUMsdUJBQXVCLENBQUMsTUFBTSxDQUFDO0lBQzFFO0lBQUUsT0FBTyxFQUFFLEVBQUU7UUFDWCxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxzREFBc0QsRUFBRSxFQUFFLENBQUM7QUFDMUUsUUFBQSxJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSTtJQUNoQztBQUVBLElBQUEsRUFBRSxDQUFDLFFBQVEsR0FBRyxNQUFNO0lBQ3BCLEVBQUUsQ0FBQyxtQkFBbUIsRUFBRTtBQUMxQixDQUFDO0FBRUQ7Ozs7QUFJRztBQUNILGNBQWMsQ0FBQyxTQUFTLENBQUMsbUJBQW1CLEdBQUcsU0FBUyxrQkFBa0IsQ0FBQyxFQUFFLEVBQUUsTUFBTSxFQUFBO0lBQ25GLElBQU0sS0FBSyxHQUFHLFFBQVEsSUFBSSxRQUFRLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQztJQUN6RCxjQUFjLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsWUFBWTtTQUM1QyxJQUFJLENBQUMsY0FBTSxPQUFBLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQSxDQUFaLENBQVk7QUFDdkIsU0FBQSxLQUFLLENBQUMsWUFBQSxFQUFNLE9BQUEsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsMERBQTBELENBQUMsQ0FBQSxDQUF6RSxDQUF5RSxDQUFDO0FBRXpGLElBQUEsRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLEVBQUUsS0FBSyxFQUFBLEtBQUEsRUFBRSxDQUFDO0FBQ3RDLENBQUM7QUFFRCxjQUFjLENBQUMsU0FBUyxDQUFDLHNCQUFzQixHQUFHLFVBQVMsVUFBVSxFQUFBO0FBQ25FLElBQUEsSUFBSSxDQUFDO1dBQ0UsQ0FBQyxJQUFJLENBQUM7QUFDTixXQUFBLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLEtBQUs7V0FDdEMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsS0FBSyxVQUFVLEVBQUU7UUFDdkQ7SUFDRjtJQUVBLElBQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFO0FBQzNDLElBQUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLElBQUksRUFBRSxNQUFNLENBQUMsU0FBUyxJQUFJLE1BQU0sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEVBQUU7UUFDdEU7SUFDRjs7QUFHQSxJQUFBLE1BQU0sQ0FBQyxRQUFRLEdBQUcsTUFBTTs7SUFHeEIsSUFBSSxNQUFNLENBQUMsU0FBUyxJQUFJLE1BQU0sQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFO0FBQy9DLFFBQUEsTUFBTSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsVUFBQSxRQUFRLEVBQUE7QUFDL0IsWUFBQSxRQUFRLENBQUMsUUFBUSxHQUFHLE1BQU07QUFDMUIsWUFBQSxRQUFRLENBQUMsZUFBZSxHQUFHLE1BQU07QUFDbkMsUUFBQSxDQUFDLENBQUM7SUFDSjtBQUVBLElBQUEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDO0FBQ3BDLENBQUM7QUFFRCxjQUFjLENBQUMsU0FBUyxDQUFDLG9CQUFvQixHQUFHLFVBQVMsZ0JBQWdCLEVBQUE7SUFBekIsSUFBQSxLQUFBLEdBQUEsSUFBQTtJQUM5QyxJQUFNLElBQUksR0FBRyxJQUFJO0lBQ2pCLElBQU0sT0FBTyxHQUFHLEtBQUssSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLElBQUlDLGFBQUssRUFBRSxFQUFFLGlCQUFpQixFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztBQUMvRyxJQUFBLE9BQU8sQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUM7SUFDaEMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUVsQyxJQUFNLGVBQWUsR0FBRyxjQUFjLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU07QUFDdEUsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsRUFBRSxlQUFlLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDO0FBQ3pFLElBQUEsSUFBTSxZQUFZLEdBQUdDLG9CQUFvQixDQUFDLGVBQWUsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUM7SUFDMUUsSUFBQSxXQUFXLEdBQUksT0FBTyxDQUFDLEVBQUUsQ0FBQyxlQUFlLEVBQUUsQ0FBQSxDQUFBLENBQWhDO0lBQ2xCLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLHVCQUF1QixFQUFFLFlBQVksQ0FBQztBQUN0RCxJQUFBLFdBQVcsQ0FBQyxtQkFBbUIsQ0FBQyxZQUFZLENBQUM7QUFFN0MsSUFBQSxJQUFNLFNBQVMsR0FBRyxTQUFTLElBQUksT0FBTyxDQUFDO0FBQ3JDLFVBQUUsU0FBUyxHQUFHLGFBQWE7QUFFN0IsSUFBQSxPQUFPLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxHQUFHLFVBQUEsS0FBSyxFQUFBO0FBQzNCLFFBQUEsSUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLGFBQWEsR0FBRyxLQUFLLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBRXBFLElBQUksT0FBTyxPQUFPLENBQUMsRUFBRSxDQUFDLFVBQVUsS0FBSyxVQUFVLEVBQUU7QUFDL0MsWUFBQSxLQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQyxFQUFFLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzNDO0FBRUEsUUFBQSxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtBQUN6QixZQUFBLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQztRQUNoQzthQUFPO0FBQ0wsWUFBQSxJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQztRQUN4QztRQUVBLElBQUksQ0FBQyxtQkFBbUIsRUFBRTtBQUM1QixJQUFBLENBQUM7QUFDRCxJQUFBLE9BQU8sT0FBTztBQUNoQixDQUFDO0FBRUQsY0FBYyxDQUFDLFNBQVMsQ0FBQyxnQ0FBZ0MsR0FBRyxVQUFTQyxLQUFHLEVBQUE7QUFDdEUsSUFBQSxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsNEJBQTRCLEdBQUdDLDhCQUEwQixDQUFDRCxLQUFHLENBQUMsR0FBR0EsS0FBRztBQUMxRixDQUFDO0FBRUQsY0FBYyxDQUFDLFNBQVMsQ0FBQyxhQUFhLEdBQUcsWUFBQTtJQUFBLElBQUEsS0FBQSxHQUFBLElBQUE7QUFDdkMsSUFBQSxJQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUU7O0FBRzFCLElBQUEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsTUFBTSxHQUFHLFlBQUE7QUFDdkIsUUFBQSxLQUFJLENBQUMsTUFBTSxHQUFHLE1BQU07UUFDcEIsS0FBSSxDQUFDLE1BQU0sRUFBRTtBQUNmLElBQUEsQ0FBQzs7QUFHRCxJQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLGFBQWEsR0FBRyxZQUFBO0FBQzlCLFFBQUEsSUFBSSxLQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsSUFBSSxLQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxVQUFVLEtBQUssUUFBUSxFQUFFO0FBQzlELFlBQUEsS0FBSSxDQUFDLE1BQU0sR0FBRyxNQUFNO1lBQ3BCLEtBQUksQ0FBQyxNQUFNLEVBQUU7UUFDZjtBQUNGLElBQUEsQ0FBQzs7QUFHRCxJQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLHNCQUFzQixHQUFHLFlBQUE7QUFDdkMsUUFBQSxJQUFNLEtBQUssR0FBRyxFQUFFLENBQUMsY0FBYztRQUMvQixLQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxzQkFBQSxDQUFBLE1BQUEsQ0FBc0IsS0FBSyxFQUFBLElBQUEsQ0FBRyxDQUFDO0FBRTlDLFFBQUEsSUFBSSxLQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsSUFBSSxLQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxjQUFjLEtBQUssUUFBUSxFQUFFO0FBQ2xFLFlBQUEsS0FBSSxDQUFDLE1BQU0sR0FBRyxNQUFNO1lBQ3BCLEtBQUksQ0FBQyxNQUFNLEVBQUU7UUFDZjtBQUVBLFFBQUEsS0FBSSxDQUFDLHNCQUFzQixDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUM7QUFDaEQsSUFBQSxDQUFDOztBQUdELElBQUEsRUFBRSxDQUFDLHVCQUF1QixHQUFHLFVBQUEsS0FBSyxFQUFBO0FBQ2hDLFFBQUEsSUFBSSxLQUFLLEdBQUcsRUFBRSxDQUFDLGVBQWU7UUFDOUIsSUFBSSxDQUFDLEtBQUssSUFBSSxLQUFLLElBQUksS0FBSyxDQUFDLE1BQU0sRUFBRTs7QUFFbkMsWUFBQSxJQUFNLFFBQVEsR0FBRyxLQUFLLENBQUMsTUFBTTtZQUM3QixLQUFLLEdBQUcsUUFBUSxDQUFDLGVBQWUsSUFBSSxRQUFRLENBQUMsZ0JBQWdCO1lBQzdELEtBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLDBEQUFBLENBQUEsTUFBQSxDQUEyRCxLQUFLLENBQUUsQ0FBQztRQUNwRjtRQUNBLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDVixLQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxrREFBQSxDQUFBLE1BQUEsQ0FBa0QsS0FBSyxFQUFBLElBQUEsQ0FBRyxDQUFDO1FBQzVFO2FBQU87WUFDTCxLQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQywwQkFBQSxDQUFBLE1BQUEsQ0FBMEIsS0FBSyxFQUFBLElBQUEsQ0FBRyxDQUFDO1FBQ3BEO0FBQ0EsUUFBQSxLQUFJLENBQUMseUJBQXlCLENBQUMsS0FBSyxDQUFDO0FBQ3JDLFFBQUEsS0FBSSxDQUFDLDZCQUE2QixDQUFDLEtBQUssQ0FBQztBQUMzQyxJQUFBLENBQUM7QUFFRCxJQUFBLEVBQUUsQ0FBQyxjQUFjLEdBQUksVUFBQSxLQUFLLEVBQUE7QUFDaEIsUUFBQSxJQUFBLFNBQVMsR0FBSyxLQUFLLENBQUEsU0FBVjtRQUNqQixJQUFJLFNBQVMsRUFBRTtBQUNiLFlBQUEsS0FBSSxDQUFDLGlCQUFpQixHQUFHLElBQUk7QUFDN0IsWUFBQSxLQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQztZQUM5QixLQUFJLENBQUMsNkJBQTZCLEVBQUU7UUFDdEM7QUFFQSxRQUFBLEtBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGlCQUFBLENBQUEsTUFBQSxDQUFrQixJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFFLENBQUM7QUFDL0QsSUFBQSxDQUFDO0lBRUQsRUFBRSxDQUFDLHlCQUF5QixHQUFHLFlBQUE7QUFDN0IsUUFBQSxJQUFNLEtBQUssR0FBRyxFQUFFLENBQUMsaUJBQWlCO0FBQ2xDLFFBQUEsSUFBSSxLQUFLLEtBQUssV0FBVyxFQUFFO1lBQ3pCLEtBQUksQ0FBQyx5QkFBeUIsRUFBRTtRQUVsQztBQUFPLGFBQUEsSUFBSSxLQUFLLEtBQUssVUFBVSxFQUFFO1lBQy9CLEtBQUksQ0FBQyx3QkFBd0IsRUFBRTs7QUFHL0IsWUFBQSxJQUFJLENBQUMsS0FBSSxDQUFDLGlCQUFpQixFQUFFO0FBQzNCLGdCQUFBLEtBQUksQ0FBQyxzQkFBc0IsQ0FBQyx1QkFBdUIsQ0FBQztZQUN0RDs7O1lBSUEsSUFBSSxLQUFJLENBQUMsaUJBQWlCLElBQUksS0FBSSxDQUFDLHdCQUF3QixFQUFFO2dCQUMzRCxLQUFJLENBQUMseUJBQXlCLEVBQUU7WUFDbEM7UUFDRjtRQUVBLEtBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLDRCQUFBLENBQUEsTUFBQSxDQUE0QixFQUFFLENBQUMsaUJBQWlCLEVBQUEsSUFBQSxDQUFHLENBQUM7QUFDbkUsUUFBQSxLQUFJLENBQUMseUJBQXlCLENBQUMsS0FBSyxDQUFDO0FBQ3ZDLElBQUEsQ0FBQztJQUVELEVBQUUsQ0FBQywwQkFBMEIsR0FBRyxZQUFBO1FBQzlCLEtBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLDZCQUFBLENBQUEsTUFBQSxDQUE2QixFQUFFLENBQUMsa0JBQWtCLEVBQUEsSUFBQSxDQUFHLENBQUM7QUFDckUsUUFBQSxLQUFJLENBQUMsMEJBQTBCLENBQUMsRUFBRSxDQUFDLGtCQUFrQixDQUFDO0FBQ3RELFFBQUEsS0FBSSxDQUFDLDZCQUE2QixDQUFDLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQztBQUMzRCxJQUFBLENBQUM7QUFDSCxDQUFDO0FBQ0QsY0FBYyxDQUFDLFNBQVMsQ0FBQyxzQkFBc0IsR0FBRyxVQUFTLGdCQUFnQixFQUFBOztBQUV6RSxJQUFBLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxNQUFNLEVBQUU7QUFDMUIsUUFBQSxPQUFPLEtBQUs7SUFDZDtJQUNBLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEtBQUssY0FBYyxFQUFFO0FBQzFDLFFBQUEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLElBQUksRUFBRTtBQUNuQixnQkFBQSxJQUFJLEVBQUUsS0FBSztBQUNYLGdCQUFBLE9BQU8sRUFBRSxxREFBcUQ7QUFDOUQsZ0JBQUEsV0FBVyxFQUFFLElBQUlFLHlCQUFlLENBQUMsc0JBQXNCLEVBQUU7QUFDMUQsYUFBQSxFQUFFLENBQUM7UUFDSixJQUFJLENBQUMsS0FBSyxFQUFFO0FBQ1osUUFBQSxPQUFPLEtBQUs7SUFDZDtJQUNBLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLGdCQUFnQixDQUFDO0lBQzFELElBQUksQ0FBQyxhQUFhLEVBQUU7QUFDcEIsSUFBQSxPQUFPLElBQUk7QUFDYixDQUFDO0FBRUQ7OztBQUdHO0FBQ0gsY0FBYyxDQUFDLFNBQVMsQ0FBQyw0QkFBNEIsR0FBRyxZQUFBO0FBQ3RELElBQUEsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO1FBQ2hCLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUM7UUFDOUQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7SUFDdkQ7QUFDRixDQUFDO0FBRUQ7OztBQUdHO0FBQ0gsY0FBYyxDQUFDLFNBQVMsQ0FBQyw4QkFBOEIsR0FBRyxZQUFBO0lBQUEsSUFBQSxLQUFBLEdBQUEsSUFBQTtBQUN4RCxJQUFBLElBQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxtQkFBbUIsRUFBRTtBQUVoRCxJQUFBLElBQUksQ0FBQyxhQUFhLElBQUksYUFBYSxDQUFDLGFBQWEsRUFBRTtRQUNqRDtJQUNGO0FBRUEsSUFBQSxJQUFNLE9BQU8sR0FBRyxZQUFBO1FBQ2QsS0FBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsMEJBQUEsQ0FBQSxNQUFBLENBQTBCLGFBQWEsQ0FBQyxLQUFLLEVBQUEsSUFBQSxDQUFHLENBQUM7QUFDaEUsUUFBQSxLQUFJLENBQUMsMEJBQTBCLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQztBQUN0RCxJQUFBLENBQUM7O0FBR0QsSUFBQSxPQUFPLEVBQUU7QUFDVCxJQUFBLGFBQWEsQ0FBQyxhQUFhLEdBQUcsT0FBTztBQUN2QyxDQUFDO0FBRUQ7OztBQUdHO0FBQ0gsY0FBYyxDQUFDLFNBQVMsQ0FBQyw2QkFBNkIsR0FBRyxZQUFBO0lBQUEsSUFBQSxLQUFBLEdBQUEsSUFBQTtBQUN2RCxJQUFBLElBQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxtQkFBbUIsRUFBRTtBQUUvQyxJQUFBLElBQUksQ0FBQyxZQUFZLElBQUksWUFBWSxDQUFDLDZCQUE2QixFQUFFO1FBQy9EO0lBQ0Y7SUFFQSxZQUFZLENBQUMsNkJBQTZCLEdBQUcsWUFBQTtRQUMzQyxPQUFBLEtBQUksQ0FBQyw2QkFBNkIsQ0FBQyxZQUFZLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztBQUEzRSxJQUFBLENBQTJFO0FBQy9FLENBQUM7QUFFRDs7OztBQUlHO0FBQ0gsY0FBYyxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsWUFBQTtJQUFBLElBQUEsS0FBQSxHQUFBLElBQUE7QUFDcEMsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyw4QkFBOEIsQ0FBQztBQUM5QyxJQUFBLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxLQUFLO0FBQzlCLElBQUEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsRUFBRSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFBO1FBQ2xGLEtBQUksQ0FBQyw0QkFBNEIsRUFBRTtBQUVuQyxRQUFBLEtBQUksQ0FBQyxrQkFBa0IsR0FBRyxVQUFBLE9BQU8sRUFBQTtZQUMvQixLQUFJLENBQUMsNEJBQTRCLEVBQUU7QUFFbkMsWUFBQSxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsSUFBSSxLQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxjQUFjLEtBQUssa0JBQWtCLEVBQUU7Z0JBQ3pFLElBQU0sT0FBTyxHQUFHO0FBQ1osc0JBQUEsU0FBQSxDQUFBLE1BQUEsQ0FBVSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBQSxtQkFBQSxDQUFBLENBQUEsTUFBQSxDQUFvQixLQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUU7QUFDL0UsZ0JBQUEsS0FBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDO2dCQUN2QjtZQUNGO1lBRUEsSUFBTSxHQUFHLEdBQUcsS0FBSSxDQUFDLGdDQUFnQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUM7QUFDOUQsWUFBQSxLQUFJLENBQUMsVUFBVSxHQUFHLEdBQUc7QUFDckIsWUFBQSxJQUFJLEtBQUksQ0FBQyxNQUFNLEtBQUssUUFBUSxFQUFFO0FBQzVCLGdCQUFBLEtBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLEtBQUksQ0FBQyxnQkFBZ0IsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLFVBQUEsR0FBRyxFQUFBO0FBQzlELG9CQUFBLElBQU0sT0FBTyxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsT0FBTyxHQUFHLEdBQUcsQ0FBQyxPQUFPLEdBQUcsR0FBRztvQkFDdEQsS0FBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsc0RBQUEsQ0FBQSxNQUFBLENBQXVELE9BQU8sQ0FBRSxDQUFDO0FBQ25GLGdCQUFBLENBQUMsQ0FBQztZQUNKO0FBQ0YsUUFBQSxDQUFDO1FBRUQsS0FBSSxDQUFDLFNBQVMsR0FBRyxZQUFBO0FBQ2YsWUFBQSxLQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxvQ0FBb0MsQ0FBQztZQUNwRCxLQUFJLENBQUMsNEJBQTRCLEVBQUU7QUFDckMsUUFBQSxDQUFDO1FBRUQsS0FBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsUUFBUSxFQUFFLEtBQUksQ0FBQyxrQkFBa0IsQ0FBQztRQUNsRCxLQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsS0FBSSxDQUFDLFNBQVMsQ0FBQztBQUN6QyxRQUFBLEtBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLEVBQUUsS0FBSSxDQUFDLE9BQU8sQ0FBQztBQUU1RCxJQUFBLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFDLEdBQUcsRUFBQTtBQUNYLFFBQUEsSUFBTSxPQUFPLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxPQUFPLEdBQUcsR0FBRyxDQUFDLE9BQU8sR0FBRyxHQUFHO1FBQ3RELEtBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLG1EQUFBLENBQUEsTUFBQSxDQUFvRCxPQUFPLENBQUUsQ0FBQzs7O0FBRzlFLFFBQUEsS0FBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUM7QUFDeEIsSUFBQSxDQUFDLENBQUM7QUFDSixDQUFDO0FBRUQsY0FBYyxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsR0FBRyxVQUFTLE1BQU0sRUFBRSx1QkFBdUIsRUFBRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsY0FBYyxFQUFBO0lBQW5GLElBQUEsS0FBQSxHQUFBLElBQUE7SUFDMUMsSUFBSSxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFO1FBQ2xEO0lBQ0Y7SUFFQSxJQUFNLElBQUksR0FBRyxJQUFJO0FBQ2pCLElBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPO0FBQ3RCLElBQUEsU0FBUyxlQUFlLEdBQUE7QUFDdEIsUUFBQSxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7WUFDaEIsSUFBSSxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO1FBQ2hEO0FBQ0EsUUFBQSxjQUFjLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7SUFDakM7SUFDQSxTQUFTLGFBQWEsQ0FBQyxHQUFHLEVBQUE7QUFDeEIsUUFBQSxJQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsT0FBTyxJQUFJLEdBQUc7QUFDakMsUUFBQSxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsSUFBSSxFQUFFO0FBQ25CLGdCQUFBLElBQUksRUFBRSxLQUFLO2dCQUNYLE9BQU8sRUFBRSwyQkFBQSxDQUFBLE1BQUEsQ0FBNEIsTUFBTSxDQUFFO0FBQzdDLGdCQUFBLFdBQVcsRUFBRSxJQUFJQyxxQkFBVyxDQUFDLHNCQUFzQixFQUFFO0FBQ3RELGFBQUEsRUFBRSxDQUFDO0lBQ047QUFDQSxJQUFBLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxVQUFBLE9BQU8sRUFBQTtBQUMvQixRQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFO1lBQUU7UUFBUTtRQUU1QixJQUFNLEdBQUcsR0FBRyxLQUFJLENBQUMsZ0NBQWdDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQztBQUM5RCxRQUFBLElBQUksQ0FBQyxVQUFVLEdBQUcsR0FBRztBQUNyQixRQUFBLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxRQUFRLEVBQUU7QUFDNUIsWUFBQSxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxLQUFJLENBQUMsZ0JBQWdCLEVBQUUsR0FBRyxFQUFFLGVBQWUsRUFBRSxhQUFhLENBQUM7UUFDeEY7UUFDQSxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDO1FBQzlELElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUM7QUFDakUsSUFBQSxDQUFDO0lBQ0QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQztJQUNsRCxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDO0FBRW5ELElBQUEsU0FBUyxjQUFjLEdBQUE7QUFDckIsUUFBQSxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssUUFBUSxFQUFFO1lBQzVCLElBQUksdUJBQXVCLEVBQUU7QUFDM0IsZ0JBQUEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsRUFBRSxJQUFJLENBQUMsT0FBTyxFQUFFLHVCQUF1QixDQUFDO1lBQ3RGO2lCQUFPO0FBQ0wsZ0JBQUEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsRUFBRSxJQUFJLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQztZQUNsRTtZQUNBLElBQUksQ0FBQyw4QkFBOEIsRUFBRTtRQUN2QztJQUNGO0lBRUEsU0FBUyxZQUFZLENBQUMsR0FBRyxFQUFBO0FBQ3ZCLFFBQUEsSUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLE9BQU8sSUFBSSxHQUFHO0FBQ2pDLFFBQUEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLElBQUksRUFBRTtBQUNuQixnQkFBQSxJQUFJLEVBQUUsS0FBSztnQkFDWCxPQUFPLEVBQUUsNEJBQUEsQ0FBQSxNQUFBLENBQTZCLE1BQU0sQ0FBRTtBQUM5QyxnQkFBQSxXQUFXLEVBQUUsSUFBSUEscUJBQVcsQ0FBQyxxQkFBcUIsRUFBRTtBQUNyRCxhQUFBLEVBQUUsQ0FBQztJQUNOO0lBRUEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRSxjQUFjLEVBQUUsWUFBWSxDQUFDO0FBQ3pHLENBQUM7QUFDRCxjQUFjLENBQUMsU0FBUyxDQUFDLGtCQUFrQixHQUFHLFVBQVMsT0FBTyxFQUFFLEdBQUcsRUFBRSxnQkFBZ0IsRUFBRSxjQUFjLEVBQUE7SUFDbkcsSUFBSSxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFO1FBQ2xEO0lBQ0Y7QUFDQSxJQUFBLEdBQUcsR0FBRyxJQUFJLENBQUMsZ0NBQWdDLENBQUMsR0FBRyxDQUFDO0lBQ2hELElBQUksQ0FBQyxVQUFVLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsRUFBRSxpQkFBaUIsQ0FBQztBQUN2RSxJQUFBLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTztJQUN0QixJQUFNLElBQUksR0FBRyxJQUFJO0FBQ2pCLElBQUEsU0FBUyxlQUFlLEdBQUE7QUFDdEIsUUFBQSxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssUUFBUSxFQUFFO0FBQzVCLFlBQUEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsRUFBRSxPQUFPLENBQUM7QUFDbkQsWUFBQSxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7Z0JBQ2hCLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztZQUNoRDtBQUNBLFlBQUEsY0FBYyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQy9CLElBQUksQ0FBQyw4QkFBOEIsRUFBRTtRQUN2QztJQUNGO0lBQ0EsU0FBUyxhQUFhLENBQUMsR0FBRyxFQUFBO0FBQ3hCLFFBQUEsSUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLE9BQU8sSUFBSSxHQUFHO0FBQ2pDLFFBQUEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLElBQUksRUFBRTtBQUNuQixnQkFBQSxJQUFJLEVBQUUsS0FBSztnQkFDWCxPQUFPLEVBQUUsNkJBQUEsQ0FBQSxNQUFBLENBQThCLE1BQU0sQ0FBRTtBQUMvQyxnQkFBQSxXQUFXLEVBQUUsSUFBSUEscUJBQVcsQ0FBQyxzQkFBc0IsRUFBRTtBQUN0RCxhQUFBLEVBQUUsQ0FBQztJQUNOO0lBQ0EsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsR0FBRyxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxFQUFFLGVBQWUsRUFBRSxhQUFhLENBQUM7QUFDdEksQ0FBQztBQUNELGNBQWMsQ0FBQyxTQUFTLENBQUMsS0FBSyxHQUFHLFlBQUE7SUFDL0IsSUFBSSxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFO1FBQ25DLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsY0FBYyxLQUFLLFFBQVEsRUFBRTtBQUMvQyxZQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRTtRQUN6QjtBQUVBLFFBQUEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEdBQUcsSUFBSTtJQUN4QjtBQUNBLElBQUEsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO0FBQ2YsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztRQUNoQixJQUFJLENBQUMsV0FBVyxFQUFFO0lBQ3BCO0FBQ0EsSUFBQSxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUk7SUFDbEIsSUFBSSxDQUFDLDRCQUE0QixFQUFFO0lBQ25DLElBQUksQ0FBQyx3QkFBd0IsRUFBRTtBQUMvQixJQUFBLElBQUksQ0FBQyxZQUFZLENBQUMsNkJBQTZCLEVBQUU7SUFDakQsSUFBSSxDQUFDLDRCQUE0QixDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLHNCQUFzQixDQUFDO0lBQ3BGLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxjQUFjLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyx3QkFBd0IsQ0FBQztJQUV6RixPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLFlBQUE7O0FBRTlDLElBQUEsQ0FBQyxDQUFDO0FBQ0YsSUFBQSxJQUFJLElBQUksQ0FBQyxrQkFBa0IsRUFBRTtBQUMzQixRQUFBLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxVQUFVLEVBQUU7SUFDdEM7QUFDQSxJQUFBLElBQUksSUFBSSxDQUFDLGNBQWMsRUFBRTtBQUN2QixRQUFBLElBQUksQ0FBQyxjQUFjLENBQUMsVUFBVSxFQUFFO0lBQ2xDO0FBQ0EsSUFBQSxJQUFJLElBQUksQ0FBQyxlQUFlLEVBQUU7QUFDeEIsUUFBQSxJQUFJLENBQUMsZUFBZSxDQUFDLFVBQVUsRUFBRTtJQUNuQztBQUNBLElBQUEsSUFBSSxJQUFJLENBQUMsZUFBZSxFQUFFO0FBQ3hCLFFBQUEsSUFBSSxDQUFDLGVBQWUsQ0FBQyxVQUFVLEVBQUU7SUFDbkM7QUFDQSxJQUFBLElBQUksSUFBSSxDQUFDLGdCQUFnQixFQUFFO0FBQ3pCLFFBQUEsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsRUFBRTtJQUNwQztBQUNBLElBQUEsSUFBSSxDQUFDLE1BQU0sR0FBRyxRQUFRO0lBQ3RCLElBQUksQ0FBQyxPQUFPLEVBQUU7QUFDaEIsQ0FBQztBQUNELGNBQWMsQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLFVBQVMsT0FBTyxFQUFBO0FBQ2hELElBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPO0FBQ3hCLENBQUM7QUFDRCxjQUFjLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRyxVQUFTLE9BQU8sRUFBQTtBQUNoRCxJQUFBLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTztBQUN4QixDQUFDO0FBQ0Q7Ozs7O0FBS0c7QUFDSCxjQUFjLENBQUMsU0FBUyxDQUFDLElBQUksR0FBRyxVQUFTLFVBQVUsRUFBQTtBQUNqRCxJQUFBLElBQUksQ0FBQyxPQUFPLEdBQUcsVUFBVTtBQUN6QixJQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFO1FBQUU7SUFBUTtJQUU1QixJQUFJLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUU7UUFDdEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLENBQUMsVUFBVTtJQUMxQztTQUFPO1FBQ0wsSUFBTSxXQUFXLEdBQUcsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLGNBQWMsS0FBSztBQUN4RCxjQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsY0FBYztBQUM1QixjQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVztBQUUzQixRQUFBLFdBQVcsQ0FBQyxPQUFPLENBQUMsVUFBQSxLQUFLLEVBQUE7QUFDdkIsWUFBQSxLQUFLLENBQUMsT0FBTyxHQUFHLENBQUMsVUFBVTtBQUM3QixRQUFBLENBQUMsQ0FBQztJQUNKO0FBQ0YsQ0FBQztBQUNEOzs7OztBQUtHO0FBQ0gsY0FBYyxDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsR0FBRyxTQUFTLHFCQUFxQixHQUFBO0lBQzdFLElBQUksSUFBSSxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsc0JBQXNCLEVBQUU7QUFDbkQsUUFBQSxPQUFPLElBQUksQ0FBQyxXQUFXLElBQUksSUFBSTtJQUNqQztJQUVBLElBQU0sSUFBSSxHQUFHLElBQUk7QUFDakIsSUFBQSxJQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUU7SUFDMUIsSUFBSSxDQUFDLEVBQUUsRUFBRTtBQUNQLFFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsNERBQTRELENBQUM7QUFDNUUsUUFBQSxPQUFPLElBQUk7SUFDYjtBQUVBLElBQUEsSUFBSSxPQUFPLEVBQUUsQ0FBQyxVQUFVLEtBQUssVUFBVSxLQUFLLE9BQU8sYUFBYSxLQUFLLFVBQVUsSUFBSSxPQUFPLGFBQWEsS0FBSyxVQUFVLENBQUMsRUFBRTtBQUN2SCxRQUFBLElBQU0sWUFBWSxHQUFHLEVBQUUsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBQSxNQUFNLEVBQUEsRUFBSSxPQUFBLE1BQU0sQ0FBQyxJQUFJLENBQUEsQ0FBWCxDQUFXLENBQUM7UUFDaEUsSUFBSSxZQUFZLEVBQUU7QUFDaEIsWUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQztBQUN6QyxZQUFBLElBQUksQ0FBQyxXQUFXLEdBQUcsWUFBWSxDQUFDLElBQUk7WUFDcEMsT0FBTyxJQUFJLENBQUMsV0FBVztRQUN6QjtJQUNGO0FBRUEsSUFBQSxJQUFJLE9BQU8sRUFBRSxDQUFDLGdCQUFnQixLQUFLLFVBQVUsSUFBSSxPQUFPLEVBQUUsQ0FBQyxlQUFlLEtBQUssVUFBVSxFQUFFO1FBQ3pGLElBQU0sS0FBSyxHQUFHLEVBQUUsQ0FBQyxlQUFlLEVBQUUsQ0FBQyxHQUFHLENBQUMsVUFBQSxNQUFNLEVBQUE7WUFDM0MsSUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUM7QUFDM0MsWUFBQSxPQUFPLE1BQU0sSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQzVCLFFBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRUwsSUFBSSxDQUFDLEtBQUssRUFBRTtBQUNWLFlBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsZ0dBQWdHLENBQUM7QUFDaEgsWUFBQSxPQUFPLElBQUk7UUFDYjtBQUVBLFFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsd0JBQXdCLENBQUM7UUFDeEMsSUFBSSxDQUFDLFdBQVcsR0FBRyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDO1FBQzdDLE9BQU8sSUFBSSxDQUFDLFdBQVc7SUFDekI7QUFFQSxJQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGtEQUFrRCxDQUFDO0FBQ2xFLElBQUEsSUFBSSxDQUFDLHNCQUFzQixHQUFHLElBQUk7QUFDbEMsSUFBQSxPQUFPLElBQUk7QUFDYixDQUFDO0FBRUQ7OztBQUdHO0FBQ0gsY0FBYyxDQUFDLFNBQVMsQ0FBQyxtQkFBbUIsR0FBRyxTQUFTLG1CQUFtQixHQUFBO0lBQ3pFLElBQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQztXQUN2QyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLFVBQVUsS0FBSztXQUN0QyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDcEMsSUFBQSxPQUFPLE1BQU0sSUFBSSxNQUFNLENBQUMsU0FBUyxJQUFJLElBQUk7QUFDM0MsQ0FBQztBQUVELGNBQWMsQ0FBQyxTQUFTLENBQUMsd0JBQXdCLEdBQUcsY0FBTSxPQUFBLE9BQU8sZ0JBQWdCLENBQUMsU0FBUyxDQUFDLElBQUksS0FBSyxVQUFVLENBQUEsQ0FBckQsQ0FBcUQ7QUFFL0csY0FBYyxDQUFDLFNBQVMsQ0FBQyxlQUFlLEdBQUcsVUFBQSxNQUFNLEVBQUEsRUFBSSxPQUFBLE9BQU8sTUFBTSxDQUFDLGNBQWMsS0FBSyxVQUFVO0lBQzlGLE1BQU0sQ0FBQyxjQUFjLEVBQUUsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFBLENBRE8sQ0FDUDtBQUU5Qzs7O0FBR0c7QUFDSCxjQUFjLENBQUMsU0FBUyxDQUFDLG1CQUFtQixHQUFHLFNBQVMsbUJBQW1CLEdBQUE7QUFDekUsSUFBQSxJQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsbUJBQW1CLEVBQUU7QUFDaEQsSUFBQSxPQUFPLGFBQWEsSUFBSSxhQUFhLENBQUMsWUFBWSxJQUFJLElBQUk7QUFDNUQsQ0FBQztBQUVEO0FBQ0EsY0FBYyxDQUFDLFFBQVEsR0FBRyxFQUFFLFlBQUEsRUFBTSxPQUFBTCxhQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsSUFBSUEsYUFBSyxFQUFFLEdBQUcsSUFBSSxDQUFBLENBQWpDLENBQWlDLElBQUk7QUFFdkUsY0FBYyxDQUFDLFNBQVMsQ0FBQywwQkFBMEIsR0FBRyxVQUFTLFFBQVEsRUFBRSxjQUFjLEVBQUE7SUFBakMsSUFBQSxLQUFBLEdBQUEsSUFBQTtJQUNwRCxJQUFJLENBQUMsUUFBUSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRTtRQUNwQztJQUNGO0lBRUEsSUFBSSxLQUFLLEdBQUcsSUFBSTtBQUNoQixJQUFBLElBQUksSUFBSSxDQUFDLFlBQVksRUFBRTtBQUNyQixRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHdDQUF3QyxDQUFDO0FBQ3hELFFBQUEsS0FBSyxHQUFHLElBQUksQ0FBQyxZQUFZO0lBQzNCO1NBQU87QUFDTCxRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGlFQUFpRSxDQUFDO1FBQ2pGLEtBQUssR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxLQUFLO0lBQzNDO0lBRUEsY0FBYyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxZQUFZO0FBQ3hELFNBQUEsSUFBSSxDQUFDLFlBQUE7UUFDRixJQUFNLFVBQVUsR0FBRztBQUNqQixjQUFFO2NBQ0EsdURBQXVEO0FBQzNELFFBQUEsS0FBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDOztBQUUxQixRQUFBLElBQUksS0FBSyxDQUFDLE1BQU0sRUFBRTtBQUNoQixZQUFBLEtBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDO1lBQ3pDLEtBQUssQ0FBQyxJQUFJLEVBQUU7UUFDZDtBQUNGLElBQUEsQ0FBQztBQUNGLFNBQUEsS0FBSyxDQUFDLFlBQUE7UUFDSCxJQUFNLFFBQVEsR0FBRztBQUNmLGNBQUU7Y0FDQSwrQkFBK0I7QUFDbkMsUUFBQSxLQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUM7QUFDM0IsSUFBQSxDQUFDLENBQUM7QUFDUixDQUFDO0FBRUQsU0FBUyxTQUFTLENBQUMsRUFBRSxFQUFFLE1BQU0sRUFBQTtBQUMzQixJQUFBLElBQUksT0FBTyxFQUFFLENBQUMsUUFBUSxLQUFLLFVBQVUsRUFBRTtBQUNyQyxRQUFBLE1BQU0sQ0FBQyxjQUFjLEVBQUUsQ0FBQyxPQUFPLENBQUMsVUFBQSxLQUFLLEVBQUE7OztBQUduQyxZQUFBLEVBQUUsQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQztBQUM1QixRQUFBLENBQUMsQ0FBQztJQUNKO1NBQU87QUFDTCxRQUFBLEVBQUUsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO0lBQ3RCO0FBQ0Y7QUFFQSxTQUFTLFdBQVcsQ0FBQyxTQUFTLEVBQUUsWUFBWSxFQUFBO0FBQzFDLElBQUEsSUFBSSxTQUFTO0lBQ2IsSUFBSSxZQUFZLEVBQUU7QUFDaEIsUUFBQSxTQUFTLEdBQUcsSUFBSSxZQUFZLEVBQUU7SUFDaEM7QUFBTyxTQUFBLElBQUksT0FBTyxXQUFXLEtBQUssV0FBVyxFQUFFO0FBQzdDLFFBQUEsU0FBUyxHQUFHLElBQUksV0FBVyxFQUFFO0lBQy9CO1NBQU87QUFDTCxRQUFBLFNBQVMsR0FBRyxJQUFJLGlCQUFpQixFQUFFO0lBQ3JDO0FBRUEsSUFBQSxTQUFTLENBQUMsY0FBYyxFQUFFLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDO0FBQ2pFLElBQUEsT0FBTyxTQUFTO0FBQ2xCO0FBVUE7Ozs7OztBQU1HO0FBQ0gsU0FBUyxjQUFjLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUE7SUFDaEQsT0FBTyxXQUFXLENBQUMsaUNBQWlDLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQUEsb0JBQW9CLEVBQUE7QUFDcEYsUUFBQSxJQUFJLE9BQU8sS0FBSyxDQUFDLFNBQVMsS0FBSyxXQUFXLEVBQUU7QUFDMUMsWUFBQSxLQUFLLENBQUMsU0FBUyxHQUFHLG9CQUFvQjtRQUN4QztBQUFPLGFBQUEsSUFBSSxPQUFPLEtBQUssQ0FBQyxZQUFZLEtBQUssV0FBVyxFQUFFO0FBQ3BELFlBQUEsS0FBSyxDQUFDLFlBQVksR0FBRyxvQkFBb0I7UUFDM0M7QUFBTyxhQUFBLElBQUksT0FBTyxLQUFLLENBQUMsR0FBRyxLQUFLLFdBQVcsRUFBRTtZQUMzQyxJQUFNLE9BQU8sR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sSUFBSSxNQUFNO0FBQzlDLFlBQUEsS0FBSyxDQUFDLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLElBQUksT0FBTyxDQUFDLFNBQVMsRUFBRSxlQUFlLENBQUMsb0JBQW9CLENBQUM7UUFDdEY7YUFBTztBQUNMLFlBQUEsT0FBTyxPQUFPLENBQUMsTUFBTSxFQUFFO1FBQ3pCO0FBRUEsUUFBQSxPQUFPLE9BQU8sQ0FBQyxPQUFPLEVBQUU7QUFDMUIsSUFBQSxDQUFDLENBQUM7QUFDSjtBQUVBLGNBQWMsQ0FBQyxPQUFPLEdBQUdBLGFBQUssQ0FBQyxJQUFJLEVBQUU7Ozs7In0=
