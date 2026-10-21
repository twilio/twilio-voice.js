import { InvalidArgumentError, NotSupportedError } from '../errors/index.js';
import Log from '../log.js';
import * as util from '../util.js';
import { sortByMimeTypes } from '../util.js';
import RTCPC from './rtcpc.js';
import { setIceAggressiveNomination } from './sdp.js';
import { SignalingErrors, GeneralErrors, MediaErrors } from '../errors/generated.js';

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
    this._openedInput = null;
    this._inputSwap = 0;
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
    return this._audioHelper._openDefaultDeviceWithConstraints(constraints).then(input => {
        // A late result: the call ended, or setInputDevice() gave it the selected stream meanwhile.
        // It was never adopted, so releasing it leaves the shared default stream alone.
        if (this.status === 'closed' || !this._shouldManageStream) {
            this._log.info('Releasing a default input stream that opened after the call closed or switched input');
            this._audioHelper._stopDefaultInputDeviceStream(input);
            return this.stream;
        }
        // The local processor was added, removed or replaced while this stream was opening.
        if (input.processor !== this._audioHelper._localProcessor) {
            this._log.info('The local processor changed while opening the default input; reopening it');
            this._audioHelper._stopDefaultInputDeviceStream(input);
            return this.openDefaultDeviceWithConstraints(constraints);
        }
        const result = this._setInputTracksFromStream(false, input.processed || input.raw);
        // The swap rejected this stream up front, before releasing the call's current input, which stays in use.
        if (this._openedInput) {
            this._audioHelper._stopDefaultInputDeviceStream(input);
            return result;
        }
        // Adopt once the swap's _stopStream has released the previous input, and before replaceTrack
        // settles, so a close() in between still releases this one.
        this._audioHelper._adoptDefaultInputDeviceStream(input);
        this._openedInput = input;
        return result;
    }, error => {
        // setInputDevice() gave the call the selected stream meanwhile, so it no longer needs this one.
        if (this.status !== 'closed' && !this._shouldManageStream && this.stream) {
            this._log.warn('Ignoring a default input failure after the call switched input', error);
            return this.stream;
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
    // Stop managing the stream before the swap, so a default result that lands during it is released.
    const wasManaged = this._shouldManageStream;
    const swap = ++this._inputSwap;
    this._shouldManageStream = false;
    return this._setInputTracksFromStream(true, stream).then(() => undefined, error => {
        // A swap that started after this one owns the flag now.
        if (this._inputSwap === swap) {
            this._shouldManageStream = wasManaged;
        }
        throw error;
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
    try {
        addStream(version.pc, this.stream);
        const supportedCodecs = RTCRtpReceiver.getCapabilities('audio').codecs;
        this._log.debug('sorting codecs', supportedCodecs, this.codecPreferences);
        const sortedCodecs = sortByMimeTypes(supportedCodecs, this.codecPreferences);
        const [transceiver] = version.pc.getTransceivers();
        this._log.debug('setting sorted codecs', sortedCodecs);
        transceiver.setCodecPreferences(sortedCodecs);
    }
    catch (error) {
        // The caller never receives this version, so close its RTCPeerConnection here.
        version.pc.close();
        throw error;
    }
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
    try {
        this.version = this._setupPeerConnection(rtcConfiguration);
    }
    catch (error) {
        // E.g. the RTCPeerConnection constructor rejected rtcConfiguration.
        this.onerror({ disconnect: true, info: {
                code: 31000,
                message: `Unable to set up the RTCPeerConnection: ${error.message}`,
                twilioError: new GeneralErrors.UnknownError(error.message, error),
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
        if (self.status === 'closed') {
            self._log.info('Ignoring an answer error for a closed call', err);
            return;
        }
        const errMsg = err.message || err;
        self.onerror({ disconnect: true, info: {
                code: 31000,
                message: `Error creating the answer: ${errMsg}`,
                twilioError: new MediaErrors.ClientRemoteDescFailed(),
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVlcmNvbm5lY3Rpb24uanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi90d2lsaW8vcnRjL3BlZXJjb25uZWN0aW9uLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbInV0aWwuc29ydEJ5TWltZVR5cGVzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFBO0FBYUEsTUFBTSxxQkFBcUIsR0FBRyxLQUFLO0FBQ25DLE1BQU0sdUJBQXVCLEdBQUcsTUFBTTtBQUN0QyxNQUFNLDBCQUEwQixHQUFHLFNBQVM7QUFDNUMsTUFBTSw0QkFBNEIsR0FBRyxLQUFLO0FBQzFDLE1BQU0sa0JBQWtCLEdBQUcsRUFBRTtBQUU3Qjs7Ozs7OztBQU9HO0FBQ0gsU0FBUyxjQUFjLENBQUMsV0FBVyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUE7QUFDbkQsSUFBQSxJQUFJLENBQUMsV0FBVyxJQUFJLENBQUMsT0FBTyxFQUFFO0FBQzVCLFFBQUEsTUFBTSxJQUFJLG9CQUFvQixDQUFDLGlEQUFpRCxDQUFDO0lBQ25GO0FBRUEsSUFBQSxJQUFJLEVBQUUsSUFBSSxZQUFZLGNBQWMsQ0FBQyxFQUFFO1FBQ3JDLE9BQU8sSUFBSSxjQUFjLENBQUMsV0FBVyxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUM7SUFDMUQ7SUFFQSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDO0FBRXJDLElBQUEsU0FBUyxJQUFJLEdBQUE7QUFDWCxRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHdDQUF3QyxDQUFDO0lBQzFEO0FBQ0EsSUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUk7QUFDbkIsSUFBQSxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUk7QUFDbEIsSUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUk7QUFDbkIsSUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUk7QUFDbkIsSUFBQSxJQUFJLENBQUMsY0FBYyxHQUFHLElB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
