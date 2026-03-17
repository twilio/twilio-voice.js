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
    this._onAudioProcessorAdded = (isRemote) => {
        this._handleAudioProcessorEvent(isRemote, true);
    };
    this._onAudioProcessorRemoved = (isRemote) => {
        this._handleAudioProcessorEvent(isRemote, false);
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
    setAudioSource(audio, dest && dest.stream ? dest.stream : this.pcStream, this._audioHelper)
        .catch(() => this._log.error('Error attaching stream to element (_createAudioOutput).'));
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
    setAudioSource(audio, stream, this._audioHelper)
        .then(() => audio.play())
        .catch(() => pc._log.error('Error attaching stream to element (_onAddTrack).'));
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
    setAudioSource(audio, stream, this._audioHelper)
        .then(() => audio.play())
        .catch(() => pc._log.error('Error attaching stream to element (_fallbackOnAddTrack).'));
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
    this._audioHelper._destroyRemoteProcessedStream();
    this._audioProcessorEventObserver.removeListener('add', this._onAudioProcessorAdded);
    this._audioProcessorEventObserver.removeListener('remove', this._onAudioProcessorRemoved);
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
PeerConnection.prototype._handleAudioProcessorEvent = function (isRemote, isAddProcessor) {
    if (!isRemote || !this._remoteStream) {
        return;
    }
    let audio = null;
    if (this._masterAudio) {
        this._log.info('Setting audio source for master audio.');
        audio = this._masterAudio;
    }
    else {
        this._log.info('No master audio. Setting audio source for default audio output.');
        audio = this.outputs.get('default').audio;
    }
    setAudioSource(audio, this._remoteStream, this._audioHelper)
        .then(() => {
        const successLog = isAddProcessor
            ? 'Successfully updated audio source with processed stream'
            : 'Successfully reverted audio source to original stream';
        this._log.info(successLog);
        // If the audio was paused, resume playback
        if (audio.paused) {
            this._log.info('Resuming audio playback');
            audio.play();
        }
    })
        .catch(() => {
        const errorLog = isAddProcessor
            ? 'Failed to update audio source'
            : 'Failed to revert audio source';
        this._log.error(errorLog);
    });
};
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
 * Sets the source of an HTMLAudioElement to the specified MediaStream and
 * applies a remote audio processor if available
 * @param {HTMLAudioElement} audio
 * @param {MediaStream} stream
 * @returns {Promise} Fulfilled if the audio source was set successfully
 */
function setAudioSource(audio, stream, audioHelper) {
    return audioHelper._maybeCreateRemoteProcessedStream(stream).then(maybeProcessedStream => {
        if (typeof audio.srcObject !== 'undefined') {
            audio.srcObject = maybeProcessedStream;
        }
        else if (typeof audio.mozSrcObject !== 'undefined') {
            audio.mozSrcObject = maybeProcessedStream;
        }
        else if (typeof audio.src !== 'undefined') {
            const _window = audio.options.window || window;
            audio.src = (_window.URL || _window.webkitURL).createObjectURL(maybeProcessedStream);
        }
        else {
            return Promise.reject();
        }
        return Promise.resolve();
    });
}
PeerConnection.enabled = RTCPC.test();

export { PeerConnection as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVlcmNvbm5lY3Rpb24uanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi90d2lsaW8vcnRjL3BlZXJjb25uZWN0aW9uLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbInV0aWwuc29ydEJ5TWltZVR5cGVzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFBO0FBWUEsTUFBTSxxQkFBcUIsR0FBRyxLQUFLO0FBQ25DLE1BQU0sdUJBQXVCLEdBQUcsTUFBTTtBQUN0QyxNQUFNLDBCQUEwQixHQUFHLFNBQVM7QUFDNUMsTUFBTSw0QkFBNEIsR0FBRyxLQUFLO0FBQzFDLE1BQU0sa0JBQWtCLEdBQUcsRUFBRTtBQUU3Qjs7Ozs7OztBQU9HO0FBQ0gsU0FBUyxjQUFjLENBQUMsV0FBVyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUE7QUFDbkQsSUFBQSxJQUFJLENBQUMsV0FBVyxJQUFJLENBQUMsT0FBTyxFQUFFO0FBQzVCLFFBQUEsTUFBTSxJQUFJLG9CQUFvQixDQUFDLGlEQUFpRCxDQUFDO0lBQ25GO0FBRUEsSUFBQSxJQUFJLEVBQUUsSUFBSSxZQUFZLGNBQWMsQ0FBQyxFQUFFO1FBQ3JDLE9BQU8sSUFBSSxjQUFjLENBQUMsV0FBVyxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUM7SUFDMUQ7SUFFQSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDO0FBRXJDLElBQUEsU0FBUyxJQUFJLEdBQUE7QUFDWCxRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHdDQUF3QyxDQUFDO0lBQzFEO0FBQ0EsSUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUk7QUFDbkIsSUFBQSxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUk7QUFDbEIsSUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUk7QUFDbkIsSUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUk7QUFDbkIsSUFBQSxJQUFJLENBQUMsY0FBYyxHQUFHLElB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
