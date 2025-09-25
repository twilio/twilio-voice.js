import { InvalidArgumentError, NotSupportedError } from '../errors/index.js';
import Log from '../log.js';
import * as util from '../util.js';
import { sortByMimeTypes } from '../util.js';
import RTCPC from './rtcpc.js';
import { setIceAggressiveNomination } from './sdp.js';
import { SignalingErrors, MediaErrors } from '../errors/generated.js';

// @ts-nocheck
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
PeerConnection.prototype._setVolumeHandler = function (handler) {
    this.onvolume = handler;
};
PeerConnection.prototype._startPollingVolume = function () {
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
        }
        else if (self.status === 'closed') {
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
        return this._sender.replaceTrack(newStream.getAudioTracks()[0]).then(() => {
            this._updateInputStreamSource(newStream);
            this.stream = shouldClone ? cloneStream(newStream, this.options.MediaStream) : newStream;
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
    const activeInputWasLost = this.stream.getAudioTracks().every(track => track.readyState === 'ended');
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
    const addedOutputIds = Array.from(this.sinkIds).filter(function (id) {
        return !this.outputs.has(id);
    }, this);
    const removedOutputIds = Array.from(this.outputs.keys()).filter(function (id) {
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
        }
        else {
            this._masterAudio.src = '';
        }
        this._masterAudio = null;
    }
    return Array.from(this.outputs.keys()).map(this._removeAudioOutput, this);
};
PeerConnection.prototype._disableOutput = function disableOutput(pc, id) {
    const output = pc.outputs.get(id);
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
    const audio = document && document.createElement('audio');
    audio.autoplay = true;
    if (!setAudioSource(audio, stream)) {
        pc._log.info('Error attaching stream to element.');
    }
    pc.outputs.set('default', { audio });
};
PeerConnection.prototype._setEncodingParameters = function (enableDscp) {
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
PeerConnection.prototype._setupPeerConnection = function (rtcConfiguration) {
    const self = this;
    const version = new (this.options.rtcpcFactory || RTCPC)({ RTCPeerConnection: this.options.RTCPeerConnection });
    version.create(rtcConfiguration);
    addStream(version.pc, this.stream);
    const supportedCodecs = RTCRtpReceiver.getCapabilities('audio').codecs;
    this._log.debug('sorting codecs', supportedCodecs, this.codecPreferences);
    const sortedCodecs = sortByMimeTypes(supportedCodecs, this.codecPreferences);
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
        }
        else {
            self._fallbackOnAddTrack(self, stream);
        }
        self._startPollingVolume();
    };
    return version;
};
PeerConnection.prototype._maybeSetIceAggressiveNomination = function (sdp) {
    return this.options.forceAggressiveIceNomination ? setIceAggressiveNomination(sdp) : sdp;
};
PeerConnection.prototype._setupChannel = function () {
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
        }
        else {
            this._log.info(`pc.connectionState is "${state}"`);
        }
        this.onpcconnectionstatechange(state);
        this._onMediaConnectionStateChange(state);
    };
    pc.onicecandidate = event => {
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
        }
        else if (state === 'complete') {
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
PeerConnection.prototype._initializeMediaStream = function (rtcConfiguration) {
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
PeerConnection.prototype._setupRTCIceTransportListener = function () {
    const iceTransport = this._getRTCIceTransport();
    if (!iceTransport || iceTransport.onselectedcandidatepairchange) {
        return;
    }
    iceTransport.onselectedcandidatepairchange = () => this.onselectedcandidatepairchange(iceTransport.getSelectedCandidatePair());
};
/**
 * Restarts ICE for the current connection
 * ICE Restart failures are ignored. Retries are managed in Connection
 * @private
 */
PeerConnection.prototype.iceRestart = function () {
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
PeerConnection.prototype.makeOutgoingCall = function (params, signalingReconnectToken, callsid, rtcConfiguration, onMediaStarted) {
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
        if (!payload.sdp) {
            return;
        }
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
            }
            else {
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
PeerConnection.prototype.answerIncomingCall = function (callSid, sdp, rtcConfiguration, onMediaStarted) {
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
    }
    else {
        pc.addStream(stream);
    }
}
function cloneStream(oldStream, _MediaStream) {
    let newStream;
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
        const _window = audio.options.window || window;
        audio.src = (_window.URL || _window.webkitURL).createObjectURL(stream);
    }
    else {
        return false;
    }
    return true;
}
PeerConnection.enabled = RTCPC.test();

export { PeerConnection as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVlcmNvbm5lY3Rpb24uanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi90d2lsaW8vcnRjL3BlZXJjb25uZWN0aW9uLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbInV0aWwuc29ydEJ5TWltZVR5cGVzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFBO0FBWUEsTUFBTSxxQkFBcUIsR0FBRyxLQUFLO0FBQ25DLE1BQU0sdUJBQXVCLEdBQUcsTUFBTTtBQUN0QyxNQUFNLDBCQUEwQixHQUFHLFNBQVM7QUFDNUMsTUFBTSw0QkFBNEIsR0FBRyxLQUFLO0FBQzFDLE1BQU0sa0JBQWtCLEdBQUcsRUFBRTtBQUU3Qjs7Ozs7OztBQU9HO0FBQ0gsU0FBUyxjQUFjLENBQUMsV0FBVyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUE7QUFDbkQsSUFBQSxJQUFJLENBQUMsV0FBVyxJQUFJLENBQUMsT0FBTyxFQUFFO0FBQzVCLFFBQUEsTUFBTSxJQUFJLG9CQUFvQixDQUFDLGlEQUFpRCxDQUFDO0lBQ25GO0FBRUEsSUFBQSxJQUFJLEVBQUUsSUFBSSxZQUFZLGNBQWMsQ0FBQyxFQUFFO1FBQ3JDLE9BQU8sSUFBSSxjQUFjLENBQUMsV0FBVyxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUM7SUFDMUQ7SUFFQSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDO0FBRXJDLElBQUEsU0FBUyxJQUFJLEdBQUE7QUFDWCxRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHdDQUF3QyxDQUFDO0lBQzFEO0FBQ0EsSUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUk7QUFDbkIsSUFBQSxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUk7QUFDbEIsSUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUk7QUFDbkIsSUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUk7QUFDbkIsSUFBQSxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUk7QUFDMUIsSUFBQSxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUk7QUFDcEIsSUFBQSxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUk7QUFDdkIsSUFBQSxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUk7QUFDekIsSUFBQSxJQUFJLENBQUMsc0JBQXNCLEdBQUcsSUFBSTtBQUNsQyxJQUFBLElBQUksQ0FBQywwQkFBMEIsR0FBRyxJQUFJO0FBQ3RDLElBQUEsSUFBSSxDQUFDLHFCQUFxQixHQUFHLElBQUk7QUFDakMsSUFBQSxJQUFJLENBQUMseUJBQXlCLEdBQUcsSUFBSTtBQUNyQyxJQUFBLElBQUksQ0FBQywwQkFBMEIsR0FBRyxJQUFJO0FBQ3RDLElBQUEsSUFBSSxDQUFDLHlCQUF5QixHQUFHLElBQUk7QUFDckMsSUFBQSxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUk7QUFDMUIsSUFBQSxJQUFJLENBQUMsNkJBQTZCLEdBQUcsSUFBSTtBQUN6QyxJQUFBLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSTtBQUNwQixJQUFBLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSTtBQUNuQixJQUFBLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTztBQUN0QixJQUFBLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSTtJQUNsQixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksR0FBRyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDbkMsSUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQ3hCLElBQUEsSUFBSSxDQUFDLE1BQU0sR0FBRyxZQUFZO0FBQzFCLElBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJO0FBQ25CLElBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFLO0FBRXBCLElBQUEsTUFBTSxZQUFZLEdBQUcsT0FBTyxNQUFNLEtBQUs7WUFDakMsTUFBTSxDQUFDLFlBQVksSUFBSSxNQUFNLENBQUMsa0JBQWtCLENBQUM7QUFDdkQsSUFBQSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDLFlBQVk7UUFDcEMsT0FBTyxnQkFBZ0IsS0FBSyxXQUFXLElBQUksZ0JBQWdCLENBQUMsU0FBUyxDQUFDLFNBQVM7Ozs7SUFJakYsSUFBSSxDQUFDLGFBQWEsR0FBRyxZQUFZLElBQUksV0FBVyxDQUFDLGFBQWE7QUFDOUQsSUFBQSxJQUFJLENBQUMsWUFBWSxHQUFHLFdBQVc7QUFDL0IsSUFBQSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsS0FBSztBQUM5QixJQUFBLElBQUksQ0FBQyx3QkFBd0IsR0FBRyxLQUFLO0FBQ3JDLElBQUEsSUFBSSxDQUFDLHNCQUFzQixHQUFHLElBQUk7QUFDbEMsSUFBQSxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUk7QUFDeEIsSUFBQSxJQUFJLENBQUMsb0JBQW9CLEdBQUcsSUFBSTtBQUNoQyxJQUFBLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJO0FBQzlCLElBQUEsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJO0FBQ3ZCLElBQUEsSUFBSSxDQUFDLHNCQUFzQixHQUFHLEtBQUs7QUFDbkMsSUFBQSxJQUFJLENBQUMsV0FBVyxHQUFHLEVBQUU7QUFDckIsSUFBQSxJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRTtBQUNwQyxJQUFBLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJO0FBQzlCLElBQUEsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJO0FBQ3JCLElBQUEsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJO0FBQ3pCLElBQUEsSUFBSSxDQUFDLG1CQUFtQixHQUFHLElBQUk7QUFDL0IsSUFBQSxJQUFJLENBQUMsU0FBUyxHQUFHLDRCQUE0QjtJQUU3QyxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sR0FBRyxPQUFPLElBQUksRUFBRTtBQUN0QyxJQUFBLElBQUksQ0FBQyxTQUFTLEdBQUcsT0FBTyxDQUFDO0FBQ3BCLFlBQUMsT0FBTyxTQUFTLEtBQUssV0FBVyxHQUFHLFNBQVMsR0FBRyxJQUFJLENBQUM7SUFDMUQsSUFBSSxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsSUFBSSxJQUFJLElBQUk7QUFDaEMsSUFBQSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsT0FBTyxDQUFDLGdCQUFnQjtBQUVoRCxJQUFBLE9BQU8sSUFBSTtBQUNiO0FBRUEsY0FBYyxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsWUFBQTtJQUM3QixPQUFPLElBQUksQ0FBQyxJQUFJO0FBQ2xCLENBQUM7QUFFRDs7Ozs7QUFLRztBQUNILGNBQWMsQ0FBQyxTQUFTLENBQUMsZ0NBQWdDLEdBQUcsVUFBUyxXQUFXLEVBQUE7QUFDOUUsSUFBQSxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsaUNBQWlDLENBQUMsV0FBVztBQUNuRSxTQUFBLElBQUksQ0FBQyxJQUFJLENBQUMseUJBQXlCLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztBQUMzRCxDQUFDO0FBRUQ7Ozs7O0FBS0c7QUFDSCxjQUFjLENBQUMsU0FBUyxDQUFDLHdCQUF3QixHQUFHLFVBQVMsTUFBTSxFQUFBO0lBQ2pFLE1BQU0sSUFBSSxHQUFHLElBQUk7QUFDakIsSUFBQSxPQUFPLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQUs7QUFDNUQsUUFBQSxJQUFJLENBQUMsbUJBQW1CLEdBQUcsS0FBSztBQUNsQyxJQUFBLENBQUMsQ0FBQztBQUNKLENBQUM7QUFFRCxjQUFjLENBQUMsU0FBUyxDQUFDLGVBQWUsR0FBRyxDQUFDLFlBQVksRUFBRSxPQUFPLEtBQUk7QUFDbkUsSUFBQSxPQUFPLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztBQUN0QixRQUFBLE9BQU8sRUFBRSxFQUFFO0FBQ1gsUUFBQSxxQkFBcUIsRUFBRSxHQUFHO0tBQzNCLEVBQUUsT0FBTyxDQUFDO0FBRVgsSUFBQSxNQUFNLFFBQVEsR0FBRyxZQUFZLENBQUMsY0FBYyxFQUFFOztBQUU5QyxJQUFBLEtBQUssTUFBTSxLQUFLLElBQUksT0FBTyxFQUFFO1FBQzNCLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDO0lBQ2xDO0FBRUEsSUFBQSxPQUFPLFFBQVE7QUFDakIsQ0FBQztBQUVELGNBQWMsQ0FBQyxTQUFTLENBQUMsaUJBQWlCLEdBQUcsVUFBUyxPQUFPLEVBQUE7QUFDM0QsSUFBQSxJQUFJLENBQUMsUUFBUSxHQUFHLE9BQU87QUFDekIsQ0FBQztBQUNELGNBQWMsQ0FBQyxTQUFTLENBQUMsbUJBQW1CLEdBQUcsWUFBQTtBQUM3QyxJQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUU7UUFDOUQ7SUFDRjtBQUVBLElBQUEsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLGFBQWE7QUFFdkMsSUFBQSxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDO0FBQzlFLElBQUEsTUFBTSxpQkFBaUIsR0FBRyxhQUFhLENBQUMsaUJBQWlCO0FBQ3pELElBQUEsTUFBTSxjQUFjLEdBQUcsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUM7SUFDeEQsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRTtBQUN4RCxRQUFBLFdBQVcsRUFBRSxDQUFDO1FBQ2QsV0FBVyxFQUFFLElBQUk7QUFDakIsUUFBQSxxQkFBcUIsRUFBRSxDQUFDO0FBQ3pCLEtBQUEsQ0FBQztBQUVGLElBQUEsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLFlBQVksQ0FBQztBQUNoRixJQUFBLE1BQU0sa0JBQWtCLEdBQUcsY0FBYyxDQUFDLGlCQUFpQjtBQUMzRCxJQUFBLE1BQU0sZUFBZSxHQUFHLElBQUksVUFBVSxDQUFDLGtCQUFrQixDQUFDO0lBQzFELElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRTtBQUN6RCxRQUFBLFdBQVcsRUFBRSxDQUFDO1FBQ2QsV0FBVyxFQUFFLElBQUk7QUFDakIsUUFBQSxxQkFBcUIsRUFBRSxDQUFDO0FBQ3pCLEtBQUEsQ0FBQztBQUVGLElBQUEsSUFBSSxDQUFDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7QUFDMUMsSUFBQSxJQUFJLENBQUMseUJBQXlCLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQztJQUVsRCxNQUFNLElBQUksR0FBRyxJQUFJO0lBQ2pCLFVBQVUsQ0FBQyxTQUFTLFVBQVUsR0FBQTtBQUM1QixRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFO1lBQ3ZCO1FBQ0Y7QUFBTyxhQUFBLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxRQUFRLEVBQUU7QUFDbkMsWUFBQSxJQUFJLENBQUMsY0FBYyxDQUFDLFVBQVUsRUFBRTtBQUNoQyxZQUFBLElBQUksQ0FBQyxlQUFlLENBQUMsVUFBVSxFQUFFO0FBQ2pDLFlBQUEsSUFBSSxDQUFDLGVBQWUsQ0FBQyxVQUFVLEVBQUU7QUFDakMsWUFBQSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxFQUFFO1lBQ2xDO1FBQ0Y7QUFFQSxRQUFBLElBQUksQ0FBQyxjQUFjLENBQUMsb0JBQW9CLENBQUMsY0FBYyxDQUFDO1FBQ3hELE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQztBQUVyRCxRQUFBLElBQUksQ0FBQyxlQUFlLENBQUMsb0JBQW9CLENBQUMsY0FBYyxDQUFDO1FBQ3pELE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQztBQUV0RCxRQUFBLElBQUksQ0FBQyxlQUFlLENBQUMsb0JBQW9CLENBQUMsZUFBZSxDQUFDO1FBQzFELE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQztBQUV2RCxRQUFBLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxvQkFBb0IsQ0FBQyxlQUFlLENBQUM7UUFDM0QsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDO0FBQ3hELFFBQUEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLEdBQUcsR0FBRyxFQUFFLFlBQVksR0FBRyxHQUFHLEVBQUUsWUFBWSxFQUFFLGFBQWEsQ0FBQztBQUVqRixRQUFBLFVBQVUsQ0FBQyxVQUFVLEVBQUUsa0JBQWtCLENBQUM7SUFDNUMsQ0FBQyxFQUFFLGtCQUFrQixDQUFDO0FBQ3hCLENBQUM7QUFFRCxjQUFjLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBRyxTQUFTLFdBQVcsR0FBQTs7O0FBR3pELElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsRUFBRTtRQUM3QjtJQUNGO0FBRUEsSUFBQSxJQUFJLENBQUMsWUFBWSxDQUFDLDZCQUE2QixFQUFFO0FBQ25ELENBQUM7QUFFRDs7OztBQUlHO0FBQ0gsY0FBYyxDQUFDLFNBQVMsQ0FBQyx3QkFBd0IsR0FBRyxVQUFTLE1BQU0sRUFBQTtBQUNqRSxJQUFBLElBQUksSUFBSSxDQUFDLGtCQUFrQixFQUFFO0FBQzNCLFFBQUEsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFVBQVUsRUFBRTtJQUN0QztBQUVBLElBQUEsSUFBSTtRQUNGLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLHVCQUF1QixDQUFDLE1BQU0sQ0FBQztRQUM1RSxJQUFJLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUM7UUFDcEQsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDO0lBQ3ZEO0lBQUUsT0FBTyxFQUFFLEVBQUU7UUFDWCxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQywwQ0FBMEMsRUFBRSxFQUFFLENBQUM7QUFDOUQsUUFBQSxJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSTtJQUNoQztBQUNGLENBQUM7QUFFRDs7OztBQUlHO0FBQ0gsY0FBYyxDQUFDLFNBQVMsQ0FBQyx5QkFBeUIsR0FBRyxVQUFTLE1BQU0sRUFBQTtBQUNsRSxJQUFBLElBQUksSUFBSSxDQUFDLG1CQUFtQixFQUFFO0FBQzVCLFFBQUEsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFVBQVUsRUFBRTtJQUN2QztBQUVBLElBQUEsSUFBSTtRQUNGLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLHVCQUF1QixDQUFDLE1BQU0sQ0FBQztRQUM3RSxJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUM7UUFDdEQsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUM7SUFDekQ7SUFBRSxPQUFPLEVBQUUsRUFBRTtRQUNYLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLDJDQUEyQyxFQUFFLEVBQUUsQ0FBQztBQUMvRCxRQUFBLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxJQUFJO0lBQ2pDO0FBQ0YsQ0FBQztBQUVEOzs7Ozs7Ozs7O0FBVUc7QUFDSCxjQUFjLENBQUMsU0FBUyxDQUFDLHlCQUF5QixHQUFHLFVBQVMsV0FBVyxFQUFFLFNBQVMsRUFBQTtJQUNsRixJQUFJLENBQUMsU0FBUyxFQUFFO1FBQ2QsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksb0JBQW9CLENBQUMsa0RBQWtELENBQUMsQ0FBQztJQUNyRztJQUVBLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxFQUFFLENBQUMsTUFBTSxFQUFFO1FBQ3RDLE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLG9CQUFvQixDQUFDLDJDQUEyQyxDQUFDLENBQUM7SUFDOUY7QUFFQSxJQUFBLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxNQUFNO0lBQy9CLE1BQU0sZ0JBQWdCLEdBQUcsTUFBSzs7QUFFNUIsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUM7UUFDdkIsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7QUFDckMsSUFBQSxDQUFDO0lBRUQsSUFBSSxDQUFDLFdBQVcsRUFBRTs7O1FBR2hCLElBQUksQ0FBQyxNQUFNLEdBQUcsV0FBVyxHQUFHLFdBQVcsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsR0FBRyxTQUFTO0lBQzFGO1NBQU87OztBQUdMLFFBQUEsSUFBSSxJQUFJLENBQUMsbUJBQW1CLEVBQUU7WUFDNUIsSUFBSSxDQUFDLFdBQVcsRUFBRTtRQUNwQjtBQUVBLFFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUU7QUFDakIsWUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNoRDtBQUVBLFFBQUEsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBSztBQUN4RSxZQUFBLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxTQUFTLENBQUM7WUFDeEMsSUFBSSxDQUFDLE1BQU0sR0FBRyxXQUFXLEdBQUcsV0FBVyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxHQUFHLFNBQVM7WUFDeEYsT0FBTyxnQkFBZ0IsRUFBRTtBQUMzQixRQUFBLENBQUMsQ0FBQztJQUNKO0lBRUEsT0FBTyxnQkFBZ0IsRUFBRTtBQUMzQixDQUFDO0FBRUQsY0FBYyxDQUFDLFNBQVMsQ0FBQyxzQkFBc0IsR0FBRyxZQUFBO0FBQ2hELElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUU7UUFBRTtJQUFROztJQUc1QixNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsY0FBYyxFQUFFLENBQUMsS0FBSyxDQUFDLEtBQUssSUFBSSxLQUFLLENBQUMsVUFBVSxLQUFLLE9BQU8sQ0FBQzs7O0FBSXBHLElBQUEsSUFBSSxrQkFBa0IsSUFBSSxJQUFJLENBQUMsbUJBQW1CLEVBQUU7UUFDbEQsSUFBSSxDQUFDLGdDQUFnQyxDQUFDLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDO0lBQ3hEO0FBQ0YsQ0FBQztBQUVELGNBQWMsQ0FBQyxTQUFTLENBQUMsc0JBQXNCLEdBQUcsVUFBUyxJQUFJLEVBQUE7QUFDN0QsSUFBQSxJQUFJLENBQUMsd0JBQXdCLEdBQUcsSUFBSTtBQUNwQyxJQUFBLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUM7QUFDbEMsQ0FBQztBQUVELGNBQWMsQ0FBQyxTQUFTLENBQUMsNkJBQTZCLEdBQUcsVUFBUyxRQUFRLEVBQUE7QUFDeEUsSUFBQSxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsU0FBUztJQUVwQyxJQUFJLGFBQWEsS0FBSztZQUNoQixRQUFRLEtBQUs7QUFDZCxlQUFBLFFBQVEsS0FBSztBQUNiLGVBQUEsUUFBUSxLQUFLLFFBQVEsQ0FBQyxFQUFFO1FBQzNCO0lBQ0Y7QUFDQSxJQUFBLElBQUksQ0FBQyxTQUFTLEdBQUcsUUFBUTtBQUV6QixJQUFBLElBQUksT0FBTztJQUNYLFFBQVEsUUFBUTtBQUNkLFFBQUEsS0FBSyxXQUFXO1lBQ2QsSUFBSSxhQUFhLEtBQUssY0FBYyxJQUFJLGFBQWEsS0FBSyxRQUFRLEVBQUU7Z0JBQ2xFLE9BQU8sR0FBRyxpRUFBaUU7QUFDM0UsZ0JBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDO0FBQ3ZCLGdCQUFBLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDO1lBQzdCO2lCQUFPO2dCQUNMLE9BQU8sR0FBRywrQkFBK0I7QUFDekMsZ0JBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDO0FBQ3ZCLGdCQUFBLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDO1lBQzNCO1lBQ0EsSUFBSSxDQUFDLHdCQUF3QixFQUFFO0FBQy9CLFlBQUEsSUFBSSxDQUFDLHdCQUF3QixHQUFHLEtBQUs7WUFDckM7QUFDRixRQUFBLEtBQUssY0FBYztZQUNqQixPQUFPLEdBQUcseUVBQXlFO0FBQ25GLFlBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDO0FBQ3ZCLFlBQUEsSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUM7WUFDNUI7QUFDRixRQUFBLEtBQUssUUFBUTtZQUNYLE9BQU8sR0FBRyx5Q0FBeUM7QUFDbkQsWUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUM7QUFDdkIsWUFBQSxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQztZQUN0Qjs7QUFFTixDQUFDO0FBRUQsY0FBYyxDQUFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsVUFBUyxPQUFPLEVBQUE7QUFDckQsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFO1FBQzFCLE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLGlCQUFpQixDQUFDLHlEQUF5RCxDQUFDLENBQUM7SUFDekc7SUFFQSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEdBQUcsT0FBTyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDN0QsT0FBTyxJQUFJLENBQUM7QUFDVixVQUFFLElBQUksQ0FBQyxtQkFBbUI7QUFDMUIsVUFBRSxPQUFPLENBQUMsT0FBTyxFQUFFO0FBQ3ZCLENBQUM7QUFFRDs7QUFFRztBQUNILGNBQWMsQ0FBQyxTQUFTLENBQUMseUJBQXlCLEdBQUcsU0FBUyx3QkFBd0IsR0FBQTtJQUNwRixJQUFJLENBQUMsd0JBQXdCLEVBQUU7QUFDL0IsSUFBQSxJQUFJLENBQUMsc0JBQXNCLEdBQUcsVUFBVSxDQUFDLE1BQUs7QUFDNUMsUUFBQSxJQUFJLENBQUMsc0JBQXNCLENBQUMsMEJBQTBCLENBQUM7SUFDekQsQ0FBQyxFQUFFLHFCQUFxQixDQUFDO0FBQzNCLENBQUM7QUFFRDs7QUFFRztBQUNILGNBQWMsQ0FBQyxTQUFTLENBQUMsd0JBQXdCLEdBQUcsU0FBUyx1QkFBdUIsR0FBQTtBQUNsRixJQUFBLGFBQWEsQ0FBQyxJQUFJLENBQUMsc0JBQXNCLENBQUM7QUFDNUMsQ0FBQztBQUVELGNBQWMsQ0FBQyxTQUFTLENBQUMsbUJBQW1CLEdBQUcsU0FBUyxrQkFBa0IsR0FBQTtBQUN4RSxJQUFBLE1BQU0sY0FBYyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxVQUFTLEVBQUUsRUFBQTtRQUNoRSxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO0lBQzlCLENBQUMsRUFBRSxJQUFJLENBQUM7QUFFUixJQUFBLE1BQU0sZ0JBQWdCLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLFVBQVMsRUFBRSxFQUFBO1FBQ3pFLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7SUFDOUIsQ0FBQyxFQUFFLElBQUksQ0FBQztJQUVSLE1BQU0sSUFBSSxHQUFHLElBQUk7QUFDakIsSUFBQSxNQUFNLG9CQUFvQixHQUFHLGNBQWMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLGtCQUFrQixFQUFFLElBQUksQ0FBQztBQUM5RSxJQUFBLE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ3ZILENBQUM7QUFFRCxjQUFjLENBQUMsU0FBUyxDQUFDLFlBQVksR0FBRyxTQUFTLFdBQVcsQ0FBQyxHQUFHLEVBQUE7QUFDOUQsSUFBQSxNQUFNLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUM7QUFDNUIsSUFBQSxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztBQUNuQixJQUFBLE9BQU8sS0FBSztBQUNkLENBQUM7QUFFRCxjQUFjLENBQUMsU0FBUyxDQUFDLGtCQUFrQixHQUFHLFNBQVMsaUJBQWlCLENBQUMsRUFBRSxFQUFBO0lBQ3pFLElBQUksSUFBSSxHQUFHLElBQUk7QUFDZixJQUFBLElBQUksSUFBSSxDQUFDLGtCQUFrQixFQUFFO0FBQzNCLFFBQUEsSUFBSSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsNEJBQTRCLEVBQUU7QUFDeEQsUUFBQSxJQUFJLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztJQUN2QztBQUVBLElBQUEsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFlBQVksRUFBRTtJQUNqQyxjQUFjLENBQUMsS0FBSyxFQUFFLElBQUksSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztJQUV4RSxNQUFNLElBQUksR0FBRyxJQUFJO0lBQ2pCLE9BQU8sS0FBSyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBSztBQUM1RCxRQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRTtZQUNuQixLQUFLO1lBQ0wsSUFBSTtBQUNMLFNBQUEsQ0FBQztBQUNKLElBQUEsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQUVELGNBQWMsQ0FBQyxTQUFTLENBQUMsbUJBQW1CLEdBQUcsU0FBUyxrQkFBa0IsR0FBQTtJQUN4RSxJQUFJLElBQUksQ0FBQyxZQUFZLElBQUksT0FBTyxJQUFJLENBQUMsb0JBQW9CLEtBQUssV0FBVyxFQUFFO1FBQ3pFLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxvQkFBb0IsQ0FBQztRQUNwRCxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUM7QUFDOUMsUUFBQSxJQUFJLENBQUMsb0JBQW9CLEdBQUcsSUFBSTs7QUFHaEMsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUU7QUFDN0IsWUFBQSxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBRTtRQUMzQjtRQUNBLElBQUksT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsS0FBSyxXQUFXLEVBQUU7QUFDdEQsWUFBQSxJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsR0FBRyxJQUFJO1FBQ3BDO2FBQU87QUFDTCxZQUFBLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxHQUFHLEVBQUU7UUFDNUI7QUFDQSxRQUFBLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSTtJQUMxQjtJQUVBLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxJQUFJLENBQUM7QUFDM0UsQ0FBQztBQUVELGNBQWMsQ0FBQyxTQUFTLENBQUMsY0FBYyxHQUFHLFNBQVMsYUFBYSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUE7SUFDckUsTUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO0lBQ2pDLElBQUksQ0FBQyxNQUFNLEVBQUU7UUFBRTtJQUFRO0FBRXZCLElBQUEsSUFBSSxNQUFNLENBQUMsS0FBSyxFQUFFO0FBQ2hCLFFBQUEsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUU7QUFDcEIsUUFBQSxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxFQUFFO0lBQ3ZCO0FBRUEsSUFBQSxJQUFJLE1BQU0sQ0FBQyxJQUFJLEVBQUU7QUFDZixRQUFBLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFO0lBQzFCO0FBQ0YsQ0FBQztBQUVEOzs7Ozs7OztBQVFHO0FBQ0gsY0FBYyxDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsR0FBRyxTQUFTLG9CQUFvQixDQUFDLEVBQUUsRUFBRSxRQUFRLEVBQUE7SUFDekYsTUFBTSxZQUFZLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDO0FBQzdDLElBQUEsRUFBRSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDO0lBRTNCLE1BQU0sSUFBSSxHQUFHLElBQUk7QUFDakIsSUFBQSxNQUFNLGNBQWMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBRXZELElBQUEsTUFBTSxXQUFXLEdBQUcsT0FBTyxjQUFjLEtBQUssUUFBUSxHQUFHLGNBQWMsR0FBRyxTQUFTO0FBRW5GLElBQUEsT0FBTyxZQUFZLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBSztBQUN6RCxRQUFBLElBQUksQ0FBQyxjQUFjLENBQUMsRUFBRSxFQUFFLFdBQVcsQ0FBQztRQUVwQyxFQUFFLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsWUFBWSxDQUFDO0FBQ3pDLFFBQUEsRUFBRSxDQUFDLG9CQUFvQixHQUFHLFdBQVc7QUFDdkMsSUFBQSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsU0FBUyxRQUFRLEdBQUE7UUFDeEIsRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLFlBQVksQ0FBQztBQUN0QyxRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLDJEQUEyRCxDQUFDO0FBQzdFLElBQUEsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQUVELGNBQWMsQ0FBQyxTQUFTLENBQUMsa0JBQWtCLEdBQUcsU0FBUyxpQkFBaUIsQ0FBQyxFQUFFLEVBQUE7QUFDekUsSUFBQSxJQUFJLElBQUksQ0FBQyxvQkFBb0IsS0FBSyxFQUFFLEVBQUU7UUFDcEMsT0FBTyxJQUFJLENBQUMscUJBQXFCLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQztJQUM3QztBQUVBLElBQUEsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDO0FBQzdCLElBQUEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO0FBRXZCLElBQUEsT0FBTyxPQUFPLENBQUMsT0FBTyxFQUFFO0FBQzFCLENBQUM7QUFFRDs7Ozs7O0FBTUc7QUFDSCxjQUFjLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBRyxTQUFTLFVBQVUsQ0FBQyxFQUFFLEVBQUUsTUFBTSxFQUFBO0lBQ25FLE1BQU0sS0FBSyxHQUFHLEVBQUUsQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLFlBQVksRUFBRTtBQUNuRCxJQUFBLGNBQWMsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDO0lBQzdCLEtBQUssQ0FBQyxJQUFJLEVBQUU7O0FBR1osSUFBQSxNQUFNLGNBQWMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBRXZELElBQUEsTUFBTSxRQUFRLEdBQUcsT0FBTyxjQUFjLEtBQUssUUFBUSxHQUFHLGNBQWMsR0FBRyxTQUFTO0FBQ2hGLElBQUEsRUFBRSxDQUFDLG9CQUFvQixHQUFHLFFBQVE7SUFDbEMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUM7QUFFbkMsSUFBQSxJQUFJO1FBQ0YsRUFBRSxDQUFDLGtCQUFrQixHQUFHLEVBQUUsQ0FBQyxhQUFhLENBQUMsdUJBQXVCLENBQUMsTUFBTSxDQUFDO0lBQzFFO0lBQUUsT0FBTyxFQUFFLEVBQUU7UUFDWCxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxzREFBc0QsRUFBRSxFQUFFLENBQUM7QUFDMUUsUUFBQSxJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSTtJQUNoQztBQUVBLElBQUEsRUFBRSxDQUFDLFFBQVEsR0FBRyxNQUFNO0lBQ3BCLEVBQUUsQ0FBQyxtQkFBbUIsRUFBRTtBQUMxQixDQUFDO0FBRUQ7Ozs7QUFJRztBQUNILGNBQWMsQ0FBQyxTQUFTLENBQUMsbUJBQW1CLEdBQUcsU0FBUyxrQkFBa0IsQ0FBQyxFQUFFLEVBQUUsTUFBTSxFQUFBO0lBQ25GLE1BQU0sS0FBSyxHQUFHLFFBQVEsSUFBSSxRQUFRLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQztBQUN6RCxJQUFBLEtBQUssQ0FBQyxRQUFRLEdBQUcsSUFBSTtJQUVyQixJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsRUFBRTtBQUNsQyxRQUFBLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLG9DQUFvQyxDQUFDO0lBQ3BEO0lBRUEsRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUM7QUFDdEMsQ0FBQztBQUVELGNBQWMsQ0FBQyxTQUFTLENBQUMsc0JBQXNCLEdBQUcsVUFBUyxVQUFVLEVBQUE7QUFDbkUsSUFBQSxJQUFJLENBQUM7V0FDRSxDQUFDLElBQUksQ0FBQztBQUNOLFdBQUEsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsS0FBSztXQUN0QyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxLQUFLLFVBQVUsRUFBRTtRQUN2RDtJQUNGO0lBRUEsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUU7QUFDM0MsSUFBQSxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsSUFBSSxFQUFFLE1BQU0sQ0FBQyxTQUFTLElBQUksTUFBTSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsRUFBRTtRQUN0RTtJQUNGOztBQUdBLElBQUEsTUFBTSxDQUFDLFFBQVEsR0FBRyxNQUFNOztJQUd4QixJQUFJLE1BQU0sQ0FBQyxTQUFTLElBQUksTUFBTSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUU7QUFDL0MsUUFBQSxNQUFNLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxRQUFRLElBQUc7QUFDbEMsWUFBQSxRQUFRLENBQUMsUUFBUSxHQUFHLE1BQU07QUFDMUIsWUFBQSxRQUFRLENBQUMsZUFBZSxHQUFHLE1BQU07QUFDbkMsUUFBQSxDQUFDLENBQUM7SUFDSjtBQUVBLElBQUEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDO0FBQ3BDLENBQUM7QUFFRCxjQUFjLENBQUMsU0FBUyxDQUFDLG9CQUFvQixHQUFHLFVBQVMsZ0JBQWdCLEVBQUE7SUFDdkUsTUFBTSxJQUFJLEdBQUcsSUFBSTtJQUNqQixNQUFNLE9BQU8sR0FBRyxLQUFLLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxJQUFJLEtBQUssRUFBRSxFQUFFLGlCQUFpQixFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztBQUMvRyxJQUFBLE9BQU8sQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUM7SUFDaEMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUVsQyxNQUFNLGVBQWUsR0FBRyxjQUFjLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU07QUFDdEUsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsRUFBRSxlQUFlLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDO0FBQ3pFLElBQUEsTUFBTSxZQUFZLEdBQUdBLGVBQW9CLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQztJQUNqRixNQUFNLENBQUMsV0FBVyxDQUFDLEdBQUcsT0FBTyxDQUFDLEVBQUUsQ0FBQyxlQUFlLEVBQUU7SUFDbEQsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsdUJBQXVCLEVBQUUsWUFBWSxDQUFDO0FBQ3RELElBQUEsV0FBVyxDQUFDLG1CQUFtQixDQUFDLFlBQVksQ0FBQztBQUU3QyxJQUFBLE1BQU0sU0FBUyxHQUFHLFNBQVMsSUFBSSxPQUFPLENBQUM7QUFDckMsVUFBRSxTQUFTLEdBQUcsYUFBYTtJQUU3QixPQUFPLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEtBQUssSUFBRztBQUM5QixRQUFBLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxhQUFhLEdBQUcsS0FBSyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUVwRSxJQUFJLE9BQU8sT0FBTyxDQUFDLEVBQUUsQ0FBQyxVQUFVLEtBQUssVUFBVSxFQUFFO0FBQy9DLFlBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMzQztBQUVBLFFBQUEsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEVBQUU7QUFDekIsWUFBQSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUM7UUFDaEM7YUFBTztBQUNMLFlBQUEsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBRSxNQUFNLENBQUM7UUFDeEM7UUFFQSxJQUFJLENBQUMsbUJBQW1CLEVBQUU7QUFDNUIsSUFBQSxDQUFDO0FBQ0QsSUFBQSxPQUFPLE9BQU87QUFDaEIsQ0FBQztBQUVELGNBQWMsQ0FBQyxTQUFTLENBQUMsZ0NBQWdDLEdBQUcsVUFBUyxHQUFHLEVBQUE7QUFDdEUsSUFBQSxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsNEJBQTRCLEdBQUcsMEJBQTBCLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRztBQUMxRixDQUFDO0FBRUQsY0FBYyxDQUFDLFNBQVMsQ0FBQyxhQUFhLEdBQUcsWUFBQTtBQUN2QyxJQUFBLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRTs7SUFHMUIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsTUFBTSxHQUFHLE1BQUs7QUFDNUIsUUFBQSxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU07UUFDcEIsSUFBSSxDQUFDLE1BQU0sRUFBRTtBQUNmLElBQUEsQ0FBQzs7SUFHRCxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxhQUFhLEdBQUcsTUFBSztBQUNuQyxRQUFBLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsVUFBVSxLQUFLLFFBQVEsRUFBRTtBQUM5RCxZQUFBLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTTtZQUNwQixJQUFJLENBQUMsTUFBTSxFQUFFO1FBQ2Y7QUFDRixJQUFBLENBQUM7O0lBR0QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsc0JBQXNCLEdBQUcsTUFBSztBQUM1QyxRQUFBLE1BQU0sS0FBSyxHQUFHLEVBQUUsQ0FBQyxjQUFjO1FBQy9CLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUEsbUJBQUEsRUFBc0IsS0FBSyxDQUFBLENBQUEsQ0FBRyxDQUFDO0FBRTlDLFFBQUEsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxjQUFjLEtBQUssUUFBUSxFQUFFO0FBQ2xFLFlBQUEsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNO1lBQ3BCLElBQUksQ0FBQyxNQUFNLEVBQUU7UUFDZjtBQUVBLFFBQUEsSUFBSSxDQUFDLHNCQUFzQixDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUM7QUFDaEQsSUFBQSxDQUFDOztBQUdELElBQUEsRUFBRSxDQUFDLHVCQUF1QixHQUFHLEtBQUssSUFBRztBQUNuQyxRQUFBLElBQUksS0FBSyxHQUFHLEVBQUUsQ0FBQyxlQUFlO1FBQzlCLElBQUksQ0FBQyxLQUFLLElBQUksS0FBSyxJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUU7O0FBRW5DLFlBQUEsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLE1BQU07WUFDN0IsS0FBSyxHQUFHLFFBQVEsQ0FBQyxlQUFlLElBQUksUUFBUSxDQUFDLGdCQUFnQjtZQUM3RCxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFBLHdEQUFBLEVBQTJELEtBQUssQ0FBQSxDQUFFLENBQUM7UUFDcEY7UUFDQSxJQUFJLENBQUMsS0FBSyxFQUFFO1lBQ1YsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQSwrQ0FBQSxFQUFrRCxLQUFLLENBQUEsQ0FBQSxDQUFHLENBQUM7UUFDNUU7YUFBTztZQUNMLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUEsdUJBQUEsRUFBMEIsS0FBSyxDQUFBLENBQUEsQ0FBRyxDQUFDO1FBQ3BEO0FBQ0EsUUFBQSxJQUFJLENBQUMseUJBQXlCLENBQUMsS0FBSyxDQUFDO0FBQ3JDLFFBQUEsSUFBSSxDQUFDLDZCQUE2QixDQUFDLEtBQUssQ0FBQztBQUMzQyxJQUFBLENBQUM7QUFFRCxJQUFBLEVBQUUsQ0FBQyxjQUFjLEdBQUksS0FBSyxJQUFHO0FBQzNCLFFBQUEsTUFBTSxFQUFFLFNBQVMsRUFBRSxHQUFHLEtBQUs7UUFDM0IsSUFBSSxTQUFTLEVBQUU7QUFDYixZQUFBLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJO0FBQzdCLFlBQUEsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUM7WUFDOUIsSUFBSSxDQUFDLDZCQUE2QixFQUFFO1FBQ3RDO0FBRUEsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFBLGVBQUEsRUFBa0IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQSxDQUFFLENBQUM7QUFDL0QsSUFBQSxDQUFDO0FBRUQsSUFBQSxFQUFFLENBQUMseUJBQXlCLEdBQUcsTUFBSztBQUNsQyxRQUFBLE1BQU0sS0FBSyxHQUFHLEVBQUUsQ0FBQyxpQkFBaUI7QUFDbEMsUUFBQSxJQUFJLEtBQUssS0FBSyxXQUFXLEVBQUU7WUFDekIsSUFBSSxDQUFDLHlCQUF5QixFQUFFO1FBRWxDO0FBQU8sYUFBQSxJQUFJLEtBQUssS0FBSyxVQUFVLEVBQUU7WUFDL0IsSUFBSSxDQUFDLHdCQUF3QixFQUFFOztBQUcvQixZQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsaUJBQWlCLEVBQUU7QUFDM0IsZ0JBQUEsSUFBSSxDQUFDLHNCQUFzQixDQUFDLHVCQUF1QixDQUFDO1lBQ3REOzs7WUFJQSxJQUFJLElBQUksQ0FBQyxpQkFBaUIsSUFBSSxJQUFJLENBQUMsd0JBQXdCLEVBQUU7Z0JBQzNELElBQUksQ0FBQyx5QkFBeUIsRUFBRTtZQUNsQztRQUNGO1FBRUEsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQSx5QkFBQSxFQUE0QixFQUFFLENBQUMsaUJBQWlCLENBQUEsQ0FBQSxDQUFHLENBQUM7QUFDbkUsUUFBQSxJQUFJLENBQUMseUJBQXlCLENBQUMsS0FBSyxDQUFDO0FBQ3ZDLElBQUEsQ0FBQztBQUVELElBQUEsRUFBRSxDQUFDLDBCQUEwQixHQUFHLE1BQUs7UUFDbkMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQSwwQkFBQSxFQUE2QixFQUFFLENBQUMsa0JBQWtCLENBQUEsQ0FBQSxDQUFHLENBQUM7QUFDckUsUUFBQSxJQUFJLENBQUMsMEJBQTBCLENBQUMsRUFBRSxDQUFDLGtCQUFrQixDQUFDO0FBQ3RELFFBQUEsSUFBSSxDQUFDLDZCQUE2QixDQUFDLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQztBQUMzRCxJQUFBLENBQUM7QUFDSCxDQUFDO0FBQ0QsY0FBYyxDQUFDLFNBQVMsQ0FBQyxzQkFBc0IsR0FBRyxVQUFTLGdCQUFnQixFQUFBOztBQUV6RSxJQUFBLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxNQUFNLEVBQUU7QUFDMUIsUUFBQSxPQUFPLEtBQUs7SUFDZDtJQUNBLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEtBQUssY0FBYyxFQUFFO0FBQzFDLFFBQUEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLElBQUksRUFBRTtBQUNuQixnQkFBQSxJQUFJLEVBQUUsS0FBSztBQUNYLGdCQUFBLE9BQU8sRUFBRSxxREFBcUQ7QUFDOUQsZ0JBQUEsV0FBVyxFQUFFLElBQUksZUFBZSxDQUFDLHNCQUFzQixFQUFFO0FBQzFELGFBQUEsRUFBRSxDQUFDO1FBQ0osSUFBSSxDQUFDLEtBQUssRUFBRTtBQUNaLFFBQUEsT0FBTyxLQUFLO0lBQ2Q7SUFDQSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxnQkFBZ0IsQ0FBQztJQUMxRCxJQUFJLENBQUMsYUFBYSxFQUFFO0FBQ3BCLElBQUEsT0FBTyxJQUFJO0FBQ2IsQ0FBQztBQUVEOzs7QUFHRztBQUNILGNBQWMsQ0FBQyxTQUFTLENBQUMsNEJBQTRCLEdBQUcsWUFBQTtBQUN0RCxJQUFBLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtRQUNoQixJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDO1FBQzlELElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO0lBQ3ZEO0FBQ0YsQ0FBQztBQUVEOzs7QUFHRztBQUNILGNBQWMsQ0FBQyxTQUFTLENBQUMsOEJBQThCLEdBQUcsWUFBQTtBQUN4RCxJQUFBLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxtQkFBbUIsRUFBRTtBQUVoRCxJQUFBLElBQUksQ0FBQyxhQUFhLElBQUksYUFBYSxDQUFDLGFBQWEsRUFBRTtRQUNqRDtJQUNGO0lBRUEsTUFBTSxPQUFPLEdBQUcsTUFBSztRQUNuQixJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFBLHVCQUFBLEVBQTBCLGFBQWEsQ0FBQyxLQUFLLENBQUEsQ0FBQSxDQUFHLENBQUM7QUFDaEUsUUFBQSxJQUFJLENBQUMsMEJBQTBCLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQztBQUN0RCxJQUFBLENBQUM7O0FBR0QsSUFBQSxPQUFPLEVBQUU7QUFDVCxJQUFBLGFBQWEsQ0FBQyxhQUFhLEdBQUcsT0FBTztBQUN2QyxDQUFDO0FBRUQ7OztBQUdHO0FBQ0gsY0FBYyxDQUFDLFNBQVMsQ0FBQyw2QkFBNkIsR0FBRyxZQUFBO0FBQ3ZELElBQUEsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixFQUFFO0FBRS9DLElBQUEsSUFBSSxDQUFDLFlBQVksSUFBSSxZQUFZLENBQUMsNkJBQTZCLEVBQUU7UUFDL0Q7SUFDRjtBQUVBLElBQUEsWUFBWSxDQUFDLDZCQUE2QixHQUFHLE1BQzNDLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxZQUFZLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztBQUMvRSxDQUFDO0FBRUQ7Ozs7QUFJRztBQUNILGNBQWMsQ0FBQyxTQUFTLENBQUMsVUFBVSxHQUFHLFlBQUE7QUFDcEMsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyw4QkFBOEIsQ0FBQztBQUM5QyxJQUFBLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxLQUFLO0lBQzlCLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsaUJBQWlCLEVBQUUsRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBSztRQUN2RixJQUFJLENBQUMsNEJBQTRCLEVBQUU7QUFFbkMsUUFBQSxJQUFJLENBQUMsa0JBQWtCLEdBQUcsT0FBTyxJQUFHO1lBQ2xDLElBQUksQ0FBQyw0QkFBNEIsRUFBRTtBQUVuQyxZQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLGNBQWMsS0FBSyxrQkFBa0IsRUFBRTtnQkFDekUsTUFBTSxPQUFPLEdBQUc7QUFDWixzQkFBQSxDQUFBLE9BQUEsRUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQSxpQkFBQSxFQUFvQixJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxjQUFjLEVBQUU7QUFDL0UsZ0JBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDO2dCQUN2QjtZQUNGO1lBRUEsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLGdDQUFnQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUM7QUFDOUQsWUFBQSxJQUFJLENBQUMsVUFBVSxHQUFHLEdBQUc7QUFDckIsWUFBQSxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssUUFBUSxFQUFFO0FBQzVCLGdCQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLEdBQUcsSUFBRztBQUNqRSxvQkFBQSxNQUFNLE9BQU8sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLE9BQU8sR0FBRyxHQUFHLENBQUMsT0FBTyxHQUFHLEdBQUc7b0JBQ3RELElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUEsb0RBQUEsRUFBdUQsT0FBTyxDQUFBLENBQUUsQ0FBQztBQUNuRixnQkFBQSxDQUFDLENBQUM7WUFDSjtBQUNGLFFBQUEsQ0FBQztBQUVELFFBQUEsSUFBSSxDQUFDLFNBQVMsR0FBRyxNQUFLO0FBQ3BCLFlBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsb0NBQW9DLENBQUM7WUFDcEQsSUFBSSxDQUFDLDRCQUE0QixFQUFFO0FBQ3JDLFFBQUEsQ0FBQztRQUVELElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUM7UUFDbEQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7QUFDekMsUUFBQSxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUM7QUFFNUQsSUFBQSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLEtBQUk7QUFDZixRQUFBLE1BQU0sT0FBTyxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsT0FBTyxHQUFHLEdBQUcsQ0FBQyxPQUFPLEdBQUcsR0FBRztRQUN0RCxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFBLGlEQUFBLEVBQW9ELE9BQU8sQ0FBQSxDQUFFLENBQUM7OztBQUc5RSxRQUFBLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDO0FBQ3hCLElBQUEsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQUVELGNBQWMsQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLEdBQUcsVUFBUyxNQUFNLEVBQUUsdUJBQXVCLEVBQUUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLGNBQWMsRUFBQTtJQUM3SCxJQUFJLENBQUMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLGdCQUFnQixDQUFDLEVBQUU7UUFDbEQ7SUFDRjtJQUVBLE1BQU0sSUFBSSxHQUFHLElBQUk7QUFDakIsSUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU87QUFDdEIsSUFBQSxTQUFTLGVBQWUsR0FBQTtBQUN0QixRQUFBLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUNoQixJQUFJLENBQUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7UUFDaEQ7QUFDQSxRQUFBLGNBQWMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztJQUNqQztJQUNBLFNBQVMsYUFBYSxDQUFDLEdBQUcsRUFBQTtBQUN4QixRQUFBLE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxPQUFPLElBQUksR0FBRztBQUNqQyxRQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxJQUFJLEVBQUU7QUFDbkIsZ0JBQUEsSUFBSSxFQUFFLEtBQUs7Z0JBQ1gsT0FBTyxFQUFFLENBQUEseUJBQUEsRUFBNEIsTUFBTSxDQUFBLENBQUU7QUFDN0MsZ0JBQUEsV0FBVyxFQUFFLElBQUksV0FBVyxDQUFDLHNCQUFzQixFQUFFO0FBQ3RELGFBQUEsRUFBRSxDQUFDO0lBQ047QUFDQSxJQUFBLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxPQUFPLElBQUc7QUFDbEMsUUFBQSxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRTtZQUFFO1FBQVE7UUFFNUIsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLGdDQUFnQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUM7QUFDOUQsUUFBQSxJQUFJLENBQUMsVUFBVSxHQUFHLEdBQUc7QUFDckIsUUFBQSxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssUUFBUSxFQUFFO0FBQzVCLFlBQUEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLEdBQUcsRUFBRSxlQUFlLEVBQUUsYUFBYSxDQUFDO1FBQ3hGO1FBQ0EsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQztRQUM5RCxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDO0FBQ2pFLElBQUEsQ0FBQztJQUNELElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUM7SUFDbEQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQztBQUVuRCxJQUFBLFNBQVMsY0FBYyxHQUFBO0FBQ3JCLFFBQUEsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLFFBQVEsRUFBRTtZQUM1QixJQUFJLHVCQUF1QixFQUFFO0FBQzNCLGdCQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLEVBQUUsSUFBSSxDQUFDLE9BQU8sRUFBRSx1QkFBdUIsQ0FBQztZQUN0RjtpQkFBTztBQUNMLGdCQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLEVBQUUsSUFBSSxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUM7WUFDbEU7WUFDQSxJQUFJLENBQUMsOEJBQThCLEVBQUU7UUFDdkM7SUFDRjtJQUVBLFNBQVMsWUFBWSxDQUFDLEdBQUcsRUFBQTtBQUN2QixRQUFBLE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxPQUFPLElBQUksR0FBRztBQUNqQyxRQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxJQUFJLEVBQUU7QUFDbkIsZ0JBQUEsSUFBSSxFQUFFLEtBQUs7Z0JBQ1gsT0FBTyxFQUFFLENBQUEsMEJBQUEsRUFBNkIsTUFBTSxDQUFBLENBQUU7QUFDOUMsZ0JBQUEsV0FBVyxFQUFFLElBQUksV0FBVyxDQUFDLHFCQUFxQixFQUFFO0FBQ3JELGFBQUEsRUFBRSxDQUFDO0lBQ047SUFFQSxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGlCQUFpQixFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxFQUFFLGNBQWMsRUFBRSxZQUFZLENBQUM7QUFDekcsQ0FBQztBQUNELGNBQWMsQ0FBQyxTQUFTLENBQUMsa0JBQWtCLEdBQUcsVUFBUyxPQUFPLEVBQUUsR0FBRyxFQUFFLGdCQUFnQixFQUFFLGNBQWMsRUFBQTtJQUNuRyxJQUFJLENBQUMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLGdCQUFnQixDQUFDLEVBQUU7UUFDbEQ7SUFDRjtBQUNBLElBQUEsR0FBRyxHQUFHLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQyxHQUFHLENBQUM7SUFDaEQsSUFBSSxDQUFDLFVBQVUsR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLHFCQUFxQixFQUFFLGlCQUFpQixDQUFDO0FBQ3ZFLElBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPO0lBQ3RCLE1BQU0sSUFBSSxHQUFHLElBQUk7QUFDakIsSUFBQSxTQUFTLGVBQWUsR0FBQTtBQUN0QixRQUFBLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxRQUFRLEVBQUU7QUFDNUIsWUFBQSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxFQUFFLE9BQU8sQ0FBQztBQUNuRCxZQUFBLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtnQkFDaEIsSUFBSSxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO1lBQ2hEO0FBQ0EsWUFBQSxjQUFjLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDL0IsSUFBSSxDQUFDLDhCQUE4QixFQUFFO1FBQ3ZDO0lBQ0Y7SUFDQSxTQUFTLGFBQWEsQ0FBQyxHQUFHLEVBQUE7QUFDeEIsUUFBQSxNQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsT0FBTyxJQUFJLEdBQUc7QUFDakMsUUFBQSxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsSUFBSSxFQUFFO0FBQ25CLGdCQUFBLElBQUksRUFBRSxLQUFLO2dCQUNYLE9BQU8sRUFBRSxDQUFBLDJCQUFBLEVBQThCLE1BQU0sQ0FBQSxDQUFFO0FBQy9DLGdCQUFBLFdBQVcsRUFBRSxJQUFJLFdBQVcsQ0FBQyxzQkFBc0IsRUFBRTtBQUN0RCxhQUFBLEVBQUUsQ0FBQztJQUNOO0lBQ0EsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsR0FBRyxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxFQUFFLGVBQWUsRUFBRSxhQUFhLENBQUM7QUFDdEksQ0FBQztBQUNELGNBQWMsQ0FBQyxTQUFTLENBQUMsS0FBSyxHQUFHLFlBQUE7SUFDL0IsSUFBSSxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFO1FBQ25DLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsY0FBYyxLQUFLLFFBQVEsRUFBRTtBQUMvQyxZQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRTtRQUN6QjtBQUVBLFFBQUEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEdBQUcsSUFBSTtJQUN4QjtBQUNBLElBQUEsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO0FBQ2YsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztRQUNoQixJQUFJLENBQUMsV0FBVyxFQUFFO0lBQ3BCO0FBQ0EsSUFBQSxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUk7SUFDbEIsSUFBSSxDQUFDLDRCQUE0QixFQUFFO0lBQ25DLElBQUksQ0FBQyx3QkFBd0IsRUFBRTtBQUUvQixJQUFBLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLG1CQUFtQixFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBSzs7QUFFbkQsSUFBQSxDQUFDLENBQUM7QUFDRixJQUFBLElBQUksSUFBSSxDQUFDLGtCQUFrQixFQUFFO0FBQzNCLFFBQUEsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFVBQVUsRUFBRTtJQUN0QztBQUNBLElBQUEsSUFBSSxJQUFJLENBQUMsY0FBYyxFQUFFO0FBQ3ZCLFFBQUEsSUFBSSxDQUFDLGNBQWMsQ0FBQyxVQUFVLEVBQUU7SUFDbEM7QUFDQSxJQUFBLElBQUksSUFBSSxDQUFDLGVBQWUsRUFBRTtBQUN4QixRQUFBLElBQUksQ0FBQyxlQUFlLENBQUMsVUFBVSxFQUFFO0lBQ25DO0FBQ0EsSUFBQSxJQUFJLElBQUksQ0FBQyxlQUFlLEVBQUU7QUFDeEIsUUFBQSxJQUFJLENBQUMsZUFBZSxDQUFDLFVBQVUsRUFBRTtJQUNuQztBQUNBLElBQUEsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEVBQUU7QUFDekIsUUFBQSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxFQUFFO0lBQ3BDO0FBQ0EsSUFBQSxJQUFJLENBQUMsTUFBTSxHQUFHLFFBQVE7SUFDdEIsSUFBSSxDQUFDLE9BQU8sRUFBRTtBQUNoQixDQUFDO0FBQ0QsY0FBYyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsVUFBUyxPQUFPLEVBQUE7QUFDaEQsSUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU87QUFDeEIsQ0FBQztBQUNELGNBQWMsQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLFVBQVMsT0FBTyxFQUFBO0FBQ2hELElBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPO0FBQ3hCLENBQUM7QUFDRDs7Ozs7QUFLRztBQUNILGNBQWMsQ0FBQyxTQUFTLENBQUMsSUFBSSxHQUFHLFVBQVMsVUFBVSxFQUFBO0FBQ2pELElBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxVQUFVO0FBQ3pCLElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUU7UUFBRTtJQUFRO0lBRTVCLElBQUksSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRTtRQUN0QyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsQ0FBQyxVQUFVO0lBQzFDO1NBQU87UUFDTCxNQUFNLFdBQVcsR0FBRyxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsY0FBYyxLQUFLO0FBQ3hELGNBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjO0FBQzVCLGNBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXO0FBRTNCLFFBQUEsV0FBVyxDQUFDLE9BQU8sQ0FBQyxLQUFLLElBQUc7QUFDMUIsWUFBQSxLQUFLLENBQUMsT0FBTyxHQUFHLENBQUMsVUFBVTtBQUM3QixRQUFBLENBQUMsQ0FBQztJQUNKO0FBQ0YsQ0FBQztBQUNEOzs7OztBQUtHO0FBQ0gsY0FBYyxDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsR0FBRyxTQUFTLHFCQUFxQixHQUFBO0lBQzdFLElBQUksSUFBSSxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsc0JBQXNCLEVBQUU7QUFDbkQsUUFBQSxPQUFPLElBQUksQ0FBQyxXQUFXLElBQUksSUFBSTtJQUNqQztJQUVBLE1BQU0sSUFBSSxHQUFHLElBQUk7QUFDakIsSUFBQSxNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUU7SUFDMUIsSUFBSSxDQUFDLEVBQUUsRUFBRTtBQUNQLFFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsNERBQTRELENBQUM7QUFDNUUsUUFBQSxPQUFPLElBQUk7SUFDYjtBQUVBLElBQUEsSUFBSSxPQUFPLEVBQUUsQ0FBQyxVQUFVLEtBQUssVUFBVSxLQUFLLE9BQU8sYUFBYSxLQUFLLFVBQVUsSUFBSSxPQUFPLGFBQWEsS0FBSyxVQUFVLENBQUMsRUFBRTtBQUN2SCxRQUFBLE1BQU0sWUFBWSxHQUFHLEVBQUUsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFDaEUsSUFBSSxZQUFZLEVBQUU7QUFDaEIsWUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQztBQUN6QyxZQUFBLElBQUksQ0FBQyxXQUFXLEdBQUcsWUFBWSxDQUFDLElBQUk7WUFDcEMsT0FBTyxJQUFJLENBQUMsV0FBVztRQUN6QjtJQUNGO0FBRUEsSUFBQSxJQUFJLE9BQU8sRUFBRSxDQUFDLGdCQUFnQixLQUFLLFVBQVUsSUFBSSxPQUFPLEVBQUUsQ0FBQyxlQUFlLEtBQUssVUFBVSxFQUFFO1FBQ3pGLE1BQU0sS0FBSyxHQUFHLEVBQUUsQ0FBQyxlQUFlLEVBQUUsQ0FBQyxHQUFHLENBQUMsTUFBTSxJQUFHO1lBQzlDLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDO0FBQzNDLFlBQUEsT0FBTyxNQUFNLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQztBQUM1QixRQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVMLElBQUksQ0FBQyxLQUFLLEVBQUU7QUFDVixZQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGdHQUFnRyxDQUFDO0FBQ2hILFlBQUEsT0FBTyxJQUFJO1FBQ2I7QUFFQSxRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDO1FBQ3hDLElBQUksQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQztRQUM3QyxPQUFPLElBQUksQ0FBQyxXQUFXO0lBQ3pCO0FBRUEsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxrREFBa0QsQ0FBQztBQUNsRSxJQUFBLElBQUksQ0FBQyxzQkFBc0IsR0FBRyxJQUFJO0FBQ2xDLElBQUEsT0FBTyxJQUFJO0FBQ2IsQ0FBQztBQUVEOzs7QUFHRztBQUNILGNBQWMsQ0FBQyxTQUFTLENBQUMsbUJBQW1CLEdBQUcsU0FBUyxtQkFBbUIsR0FBQTtJQUN6RSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUM7V0FDdkMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxVQUFVLEtBQUs7V0FDdEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3BDLElBQUEsT0FBTyxNQUFNLElBQUksTUFBTSxDQUFDLFNBQVMsSUFBSSxJQUFJO0FBQzNDLENBQUM7QUFFRCxjQUFjLENBQUMsU0FBUyxDQUFDLHdCQUF3QixHQUFHLE1BQU0sT0FBTyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsSUFBSSxLQUFLLFVBQVU7QUFFL0csY0FBYyxDQUFDLFNBQVMsQ0FBQyxlQUFlLEdBQUcsTUFBTSxJQUFJLE9BQU8sTUFBTSxDQUFDLGNBQWMsS0FBSyxVQUFVO0lBQzlGLE1BQU0sQ0FBQyxjQUFjLEVBQUUsR0FBRyxNQUFNLENBQUMsV0FBVztBQUU5Qzs7O0FBR0c7QUFDSCxjQUFjLENBQUMsU0FBUyxDQUFDLG1CQUFtQixHQUFHLFNBQVMsbUJBQW1CLEdBQUE7QUFDekUsSUFBQSxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsbUJBQW1CLEVBQUU7QUFDaEQsSUFBQSxPQUFPLGFBQWEsSUFBSSxhQUFhLENBQUMsWUFBWSxJQUFJLElBQUk7QUFDNUQsQ0FBQztBQUVEO0FBQ0EsY0FBYyxDQUFDLFFBQVEsR0FBRyxFQUFFLE1BQU0sS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLElBQUksS0FBSyxFQUFFLEdBQUcsSUFBSSxJQUFJO0FBRXZFLFNBQVMsU0FBUyxDQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUE7QUFDM0IsSUFBQSxJQUFJLE9BQU8sRUFBRSxDQUFDLFFBQVEsS0FBSyxVQUFVLEVBQUU7UUFDckMsTUFBTSxDQUFDLGNBQWMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLElBQUc7OztBQUd0QyxZQUFBLEVBQUUsQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQztBQUM1QixRQUFBLENBQUMsQ0FBQztJQUNKO1NBQU87QUFDTCxRQUFBLEVBQUUsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO0lBQ3RCO0FBQ0Y7QUFFQSxTQUFTLFdBQVcsQ0FBQyxTQUFTLEVBQUUsWUFBWSxFQUFBO0FBQzFDLElBQUEsSUFBSSxTQUFTO0lBQ2IsSUFBSSxZQUFZLEVBQUU7QUFDaEIsUUFBQSxTQUFTLEdBQUcsSUFBSSxZQUFZLEVBQUU7SUFDaEM7QUFBTyxTQUFBLElBQUksT0FBTyxXQUFXLEtBQUssV0FBVyxFQUFFO0FBQzdDLFFBQUEsU0FBUyxHQUFHLElBQUksV0FBVyxFQUFFO0lBQy9CO1NBQU87QUFDTCxRQUFBLFNBQVMsR0FBRyxJQUFJLGlCQUFpQixFQUFFO0lBQ3JDO0FBRUEsSUFBQSxTQUFTLENBQUMsY0FBYyxFQUFFLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDO0FBQ2pFLElBQUEsT0FBTyxTQUFTO0FBQ2xCO0FBVUE7Ozs7O0FBS0c7QUFDSCxTQUFTLGNBQWMsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFBO0FBQ25DLElBQUEsSUFBSSxPQUFPLEtBQUssQ0FBQyxTQUFTLEtBQUssV0FBVyxFQUFFO0FBQzFDLFFBQUEsS0FBSyxDQUFDLFNBQVMsR0FBRyxNQUFNO0lBQzFCO0FBQU8sU0FBQSxJQUFJLE9BQU8sS0FBSyxDQUFDLFlBQVksS0FBSyxXQUFXLEVBQUU7QUFDcEQsUUFBQSxLQUFLLENBQUMsWUFBWSxHQUFHLE1BQU07SUFDN0I7QUFBTyxTQUFBLElBQUksT0FBTyxLQUFLLENBQUMsR0FBRyxLQUFLLFdBQVcsRUFBRTtRQUMzQyxNQUFNLE9BQU8sR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sSUFBSSxNQUFNO0FBQzlDLFFBQUEsS0FBSyxDQUFDLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLElBQUksT0FBTyxDQUFDLFNBQVMsRUFBRSxlQUFlLENBQUMsTUFBTSxDQUFDO0lBQ3hFO1NBQU87QUFDTCxRQUFBLE9BQU8sS0FBSztJQUNkO0FBRUEsSUFBQSxPQUFPLElBQUk7QUFDYjtBQUVBLGNBQWMsQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDLElBQUksRUFBRTs7OzsifQ==
