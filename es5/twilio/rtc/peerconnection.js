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
    var dest = null;
    if (this._mediaStreamSource) {
        dest = this._audioContext.createMediaStreamDestination();
        this._mediaStreamSource.connect(dest);
    }
    var audio = this._createAudio();
    setAudioSource(audio, dest && dest.stream ? dest.stream : this.pcStream);
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
    setAudioSource(audio, stream);
    audio.play();
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
    audio.autoplay = true;
    if (!setAudioSource(audio, stream)) {
        pc._log.info('Error attaching stream to element.');
    }
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
 * Set the source of an HTMLAudioElement to the specified MediaStream
 * @param {HTMLAudioElement} audio
 * @param {MediaStream} stream
 * @returns {boolean} Whether the audio source was set successfully
 */
function setAudioSource(audio, stream) {
    if (typeof audio.srcObject !== 'undefined') {
        audio.srcObject = stream;
    }
    else if (typeof audio.mozSrcObject !== 'undefined') {
        audio.mozSrcObject = stream;
    }
    else if (typeof audio.src !== 'undefined') {
        var _window = audio.options.window || window;
        audio.src = (_window.URL || _window.webkitURL).createObjectURL(stream);
    }
    else {
        return false;
    }
    return true;
}
PeerConnection.enabled = rtcpc.default.test();

exports.default = PeerConnection;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVlcmNvbm5lY3Rpb24uanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi90d2lsaW8vcnRjL3BlZXJjb25uZWN0aW9uLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbIkludmFsaWRBcmd1bWVudEVycm9yIiwiTG9nIiwiTm90U3VwcG9ydGVkRXJyb3IiLCJSVENQQyIsInV0aWwuc29ydEJ5TWltZVR5cGVzIiwic2RwIiwic2V0SWNlQWdncmVzc2l2ZU5vbWluYXRpb24iLCJTaWduYWxpbmdFcnJvcnMiLCJNZWRpYUVycm9ycyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFBQTtBQVlBLElBQU0scUJBQXFCLEdBQUcsS0FBSztBQUNuQyxJQUFNLHVCQUF1QixHQUFHLE1BQU07QUFDdEMsSUFBTSwwQkFBMEIsR0FBRyxTQUFTO0FBQzVDLElBQU0sNEJBQTRCLEdBQUcsS0FBSztBQUMxQyxJQUFNLGtCQUFrQixHQUFHLEVBQUU7QUFFN0I7Ozs7Ozs7QUFPRztBQUNILFNBQVMsY0FBYyxDQUFDLFdBQVcsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFBO0FBQ25ELElBQUEsSUFBSSxDQUFDLFdBQVcsSUFBSSxDQUFDLE9BQU8sRUFBRTtBQUM1QixRQUFBLE1BQU0sSUFBSUEsMEJBQW9CLENBQUMsaURBQWlELENBQUM7SUFDbkY7QUFFQSxJQUFBLElBQUksRUFBRSxJQUFJLFlBQVksY0FBYyxDQUFDLEVBQUU7UUFDckMsT0FBTyxJQUFJLGNBQWMsQ0FBQyxXQUFXLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQztJQUMxRDtJQUVBLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSUMsV0FBRyxDQUFDLGdCQUFnQixDQUFDO0FBRXJDLElBQUEsU0FBUyxJQUFJLEdBQUE7QUFDWCxRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHdDQUF3QyxDQUFDO0lBQzFEO0FBQ0EsSUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUk7QUFDbkIsSUFBQSxJ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
