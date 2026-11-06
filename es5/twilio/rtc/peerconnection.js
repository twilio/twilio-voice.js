'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var index = require('../errors/index.js');
var deferred = require('../deferred.js');
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
    // Resolved by close(), so work waiting on the RTCPeerConnection can settle once it's gone.
    this._closed = new deferred.default();
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
        // close() can run while the track is being replaced. The browser may then resolve, reject, or never
        // settle (Firefox), so the swap also settles on close. Either way there is no call left to swap on.
        return Promise.race([
            this._sender.replaceTrack(newStream.getAudioTracks()[0]),
            this._closed.promise,
        ]).catch(function (error) {
            if (_this.status !== 'closed') {
                throw error;
            }
            _this._log.info('Ignoring a replaceTrack failure after the call closed', error);
        }).then(function () {
            if (_this.status === 'closed') {
                return _this.stream;
            }
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
    this._closed.resolve();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVlcmNvbm5lY3Rpb24uanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi90d2lsaW8vcnRjL3BlZXJjb25uZWN0aW9uLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbIkludmFsaWRBcmd1bWVudEVycm9yIiwiTG9nIiwiRGVmZXJyZWQiLCJOb3RTdXBwb3J0ZWRFcnJvciIsIlJUQ1BDIiwidXRpbC5zb3J0QnlNaW1lVHlwZXMiLCJzZHAiLCJzZXRJY2VBZ2dyZXNzaXZlTm9taW5hdGlvbiIsIlNpZ25hbGluZ0Vycm9ycyIsIkdlbmVyYWxFcnJvcnMiLCJNZWRpYUVycm9ycyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUE7QUFjQSxJQUFNLHFCQUFxQixHQUFHLEtBQUs7QUFDbkMsSUFBTSx1QkFBdUIsR0FBRyxNQUFNO0FBQ3RDLElBQU0sMEJBQTBCLEdBQUcsU0FBUztBQUM1QyxJQUFNLDRCQUE0QixHQUFHLEtBQUs7QUFDMUMsSUFBTSxrQkFBa0IsR0FBRyxFQUFFO0FBRTdCOzs7Ozs7O0FBT0c7QUFDSCxTQUFTLGNBQWMsQ0FBQyxXQUFXLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBQTtJQUFyRCxJQUFBLEtBQUEsR0FBQSxJQUFBO0FBQ0UsSUFBQSxJQUFJLENBQUMsV0FBVyxJQUFJLENBQUMsT0FBTyxFQUFFO0FBQzVCLFFBQUEsTUFBTSxJQUFJQSwwQkFBb0IsQ0FBQyxpREFBaUQsQ0FBQztJQUNuRjtBQUVBLElBQUEsSUFBSSxFQUFFLElBQUksWUFBWSxjQUFjLENBQUMsRUFBRTtRQUNyQyxPQUFPLElBQUksY0FBYyxDQUFDLFdBQVcsRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDO0lBQzFEO0lBRUEsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJQyxXQUFHLENBQUMsZ0JBQWdCLENBQUM7QUFFckMsSUFBQSxTQUFTLElBQUksR0FBQTtBQUNYLFFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsd0NBQXdDLENBQUM7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
