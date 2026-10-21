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
    this._openedInput = null;
    this._inputSwap = 0;
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
    var _this = this;
    return this._audioHelper._openDefaultDeviceWithConstraints(constraints).then(function (input) {
        // A late result: the call ended, or setInputDevice() gave it the selected stream meanwhile.
        // It was never adopted, so releasing it leaves the shared default stream alone.
        if (_this.status === 'closed' || !_this._shouldManageStream) {
            _this._log.info('Releasing a default input stream that opened after the call closed or switched input');
            _this._audioHelper._stopDefaultInputDeviceStream(input);
            return _this.stream;
        }
        // The local processor was added, removed or replaced while this stream was opening.
        if (input.processor !== _this._audioHelper._localProcessor) {
            _this._log.info('The local processor changed while opening the default input; reopening it');
            _this._audioHelper._stopDefaultInputDeviceStream(input);
            return _this.openDefaultDeviceWithConstraints(constraints);
        }
        var result = _this._setInputTracksFromStream(false, input.processed || input.raw);
        // The swap rejected this stream up front, before releasing the call's current input, which stays in use.
        if (_this._openedInput) {
            _this._audioHelper._stopDefaultInputDeviceStream(input);
            return result;
        }
        // Adopt once the swap's _stopStream has released the previous input, and before replaceTrack
        // settles, so a close() in between still releases this one.
        _this._audioHelper._adoptDefaultInputDeviceStream(input);
        _this._openedInput = input;
        return result;
    }, function (error) {
        // setInputDevice() gave the call the selected stream meanwhile, so it no longer needs this one.
        if (_this.status !== 'closed' && !_this._shouldManageStream && _this.stream) {
            _this._log.warn('Ignoring a default input failure after the call switched input', error);
            return _this.stream;
        }
        throw error;
    });
};
/**
 * Replace the existing input audio tracks with the audio tracks from the
 *   passed input audio stream. We re-use the existing stream because
 *   the AnalyzerNode is bound to the stream.
 * @param {MediaStream} stream
 */
PeerConnection.prototype.setInputTracksFromStream = function (stream) {
    var _this = this;
    // Stop managing the stream before the swap, so a default result that lands during it is released.
    var wasManaged = this._shouldManageStream;
    var swap = ++this._inputSwap;
    this._shouldManageStream = false;
    return this._setInputTracksFromStream(true, stream).then(function () { return undefined; }, function (error) {
        // A swap that started after this one owns the flag now.
        if (_this._inputSwap === swap) {
            _this._shouldManageStream = wasManaged;
        }
        throw error;
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
    if (!this._openedInput) {
        return;
    }
    this._audioHelper._stopDefaultInputDeviceStream(this._openedInput);
    this._openedInput = null;
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
    else if (!this._sender && !(this.version && this.version.pc)) {
        // No RTCPeerConnection yet, so there is no track to replace.
        this._stopStream();
        this.stream = shouldClone ? cloneStream(newStream, this.options.MediaStream) : newStream;
    }
    else {
        // If the call was started with gUM, stop the managed track it opened; this no-ops otherwise.
        this._stopStream();
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
    try {
        addStream(version.pc, this.stream);
        var supportedCodecs = RTCRtpReceiver.getCapabilities('audio').codecs;
        this._log.debug('sorting codecs', supportedCodecs, this.codecPreferences);
        var sortedCodecs = util.sortByMimeTypes(supportedCodecs, this.codecPreferences);
        var transceiver = version.pc.getTransceivers()[0];
        this._log.debug('setting sorted codecs', sortedCodecs);
        transceiver.setCodecPreferences(sortedCodecs);
    }
    catch (error) {
        // The caller never receives this version, so close its RTCPeerConnection here.
        version.pc.close();
        throw error;
    }
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
    try {
        this.version = this._setupPeerConnection(rtcConfiguration);
    }
    catch (error) {
        // E.g. the RTCPeerConnection constructor rejected rtcConfiguration.
        this.onerror({ disconnect: true, info: {
                code: 31000,
                message: "Unable to set up the RTCPeerConnection: ".concat(error.message),
                twilioError: new generated.GeneralErrors.UnknownError(error.message, error),
            } });
        return false;
    }
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
        if (self.status === 'closed') {
            self._log.info('Ignoring an answer error for a closed call', err);
            return;
        }
        var errMsg = err.message || err;
        self.onerror({ disconnect: true, info: {
                code: 31000,
                message: "Error creating the answer: ".concat(errMsg),
                twilioError: new generated.MediaErrors.ClientRemoteDescFailed(),
            } });
    }
    this.version.processSDP(this.options.maxAverageBitrate, this.codecPreferences, sdp, { audio: true }, onAnswerSuccess, onAnswerError);
};
PeerConnection.prototype.close = function () {
    // A repeat close has nothing left to release, and shared AudioHelper state, such as the
    // remote processed stream, may already belong to the next call.
    if (this.status === 'closed') {
        return;
    }
    if (this.version && this.version.pc) {
        if (this.version.pc.signalingState !== 'closed') {
            this.version.pc.close();
        }
        this.version.pc = null;
    }
    if (this.stream) {
        this.mute(false);
    }
    // Even without a stream: an opened input whose tracks were rejected was still adopted.
    this._stopStream();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVlcmNvbm5lY3Rpb24uanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi90d2lsaW8vcnRjL3BlZXJjb25uZWN0aW9uLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbIkludmFsaWRBcmd1bWVudEVycm9yIiwiTG9nIiwiTm90U3VwcG9ydGVkRXJyb3IiLCJSVENQQyIsInV0aWwuc29ydEJ5TWltZVR5cGVzIiwic2RwIiwic2V0SWNlQWdncmVzc2l2ZU5vbWluYXRpb24iLCJTaWduYWxpbmdFcnJvcnMiLCJHZW5lcmFsRXJyb3JzIiwiTWVkaWFFcnJvcnMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBQUE7QUFhQSxJQUFNLHFCQUFxQixHQUFHLEtBQUs7QUFDbkMsSUFBTSx1QkFBdUIsR0FBRyxNQUFNO0FBQ3RDLElBQU0sMEJBQTBCLEdBQUcsU0FBUztBQUM1QyxJQUFNLDRCQUE0QixHQUFHLEtBQUs7QUFDMUMsSUFBTSxrQkFBa0IsR0FBRyxFQUFFO0FBRTdCOzs7Ozs7O0FBT0c7QUFDSCxTQUFTLGNBQWMsQ0FBQyxXQUFXLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBQTtJQUFyRCxJQUFBLEtBQUEsR0FBQSxJQUFBO0FBQ0UsSUFBQSxJQUFJLENBQUMsV0FBVyxJQUFJLENBQUMsT0FBTyxFQUFFO0FBQzVCLFFBQUEsTUFBTSxJQUFJQSwwQkFBb0IsQ0FBQyxpREFBaUQsQ0FBQztJQUNuRjtBQUVBLElBQUEsSUFBSSxFQUFFLElBQUksWUFBWSxjQUFjLENBQUMsRUFBRTtRQUNyQyxPQUFPLElBQUksY0FBYyxDQUFDLFdBQVcsRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDO0lBQzFEO0lBRUEsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJQyxXQUFHLENBQUMsZ0JBQWdCLENBQUM7QUFFckMsSUFBQSxTQUFTLElBQUksR0FBQTtBQUNYLFFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsd0NBQXdDLENBQUM7SUFDMUQ7QUFDQSxJ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
