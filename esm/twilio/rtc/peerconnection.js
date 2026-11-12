import { InvalidArgumentError, NotSupportedError } from '../errors/index.js';
import Deferred from '../deferred.js';
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
    this._dtlsTransportState = null;
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
    this._closed = new Deferred();
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
        // close() can run while the track is being replaced. The browser may then resolve, reject, or never
        // settle (Firefox), so the swap also settles on close. Either way there is no call left to swap on.
        return Promise.race([
            this._sender.replaceTrack(newStream.getAudioTracks()[0]),
            this._closed.promise,
        ]).catch(error => {
            if (this.status !== 'closed') {
                throw error;
            }
            this._log.info('Ignoring a replaceTrack failure after the call closed', error);
        }).then(() => {
            if (this.status === 'closed') {
                return this.stream;
            }
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
    const handler = () => this._reportDtlsTransportState(dtlsTransport.state);
    // Publish initial state
    handler();
    dtlsTransport.onstatechange = handler;
};
PeerConnection.prototype._reportDtlsTransportState = function (state) {
    // Skip a repeat of the last reported state, e.g. a browser closed event after close() reported it.
    if (state === this._dtlsTransportState) {
        return;
    }
    this._dtlsTransportState = state;
    this._log.info(`dtlsTransportState is "${state}"`);
    this.ondtlstransportstatechange(state);
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
        // Per spec, a local close() fires no statechange (Chrome 154+, Firefox), so report closed here.
        if (this._dtlsTransportState) {
            this._reportDtlsTransportState('closed');
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVlcmNvbm5lY3Rpb24uanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi90d2lsaW8vcnRjL3BlZXJjb25uZWN0aW9uLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbInV0aWwuc29ydEJ5TWltZVR5cGVzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBQTtBQWNBLE1BQU0scUJBQXFCLEdBQUcsS0FBSztBQUNuQyxNQUFNLHVCQUF1QixHQUFHLE1BQU07QUFDdEMsTUFBTSwwQkFBMEIsR0FBRyxTQUFTO0FBQzVDLE1BQU0sNEJBQTRCLEdBQUcsS0FBSztBQUMxQyxNQUFNLGtCQUFrQixHQUFHLEVBQUU7QUFFN0I7Ozs7Ozs7QUFPRztBQUNILFNBQVMsY0FBYyxDQUFDLFdBQVcsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFBO0FBQ25ELElBQUEsSUFBSSxDQUFDLFdBQVcsSUFBSSxDQUFDLE9BQU8sRUFBRTtBQUM1QixRQUFBLE1BQU0sSUFBSSxvQkFBb0IsQ0FBQyxpREFBaUQsQ0FBQztJQUNuRjtBQUVBLElBQUEsSUFBSSxFQUFFLElBQUksWUFBWSxjQUFjLENBQUMsRUFBRTtRQUNyQyxPQUFPLElBQUksY0FBYyxDQUFDLFdBQVcsRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDO0lBQzFEO0lBRUEsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQztBQUVyQyxJQUFBLFNBQVMsSUFBSSxHQUFBO0FBQ1gsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyx3Q0FBd0MsQ0FBQztJQUMxRDtBQUNBLElBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJO0FBQ25CLElBQUEsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJO0FBQ2xCLElBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJO0FBQ25CLElBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJO0FBQ25CLElBQUEsSUFBSSxDQUFDLGNBQWMsR0FBRyxJ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
