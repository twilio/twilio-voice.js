import AudioHelper from '../audiohelper';
import { AudioProcessorEventObserver } from '../audioprocessoreventobserver';
import Call from '../call';
import {
  InvalidArgumentError,
  MediaErrors,
  NotSupportedError,
  SignalingErrors,
  TwilioError,
} from '../errors';
import Log from '../log';
import * as util from '../util';
import PStream from '../pstream';
import RTCPC from './rtcpc';
import { setIceAggressiveNomination } from './sdp';

const ICE_GATHERING_TIMEOUT = 15000;
const ICE_GATHERING_FAIL_NONE = 'none';
const ICE_GATHERING_FAIL_TIMEOUT = 'timeout';
const INITIAL_ICE_CONNECTION_STATE = 'new';
const VOLUME_INTERVAL_MS = 50;

// TODO: remove this when RTCPC has a better type
type IRTCPC = {
  pc: RTCPeerConnection;

  create(config: RTCConfiguration): void;

  createOffer(
    maxAverageBitrate: number | undefined,
    constraints: RTCOfferOptions,
    onSuccess?: () => void,
    onError?: (err: any) => void
  ): Promise<void>;

  createAnswer(
    maxAverageBitrate: number | undefined,
    constraints: RTCAnswerOptions,
    onSuccess?: () => void,
    onError?: (err: any) => void
  ): Promise<void>;

  processSDP(
    maxAverageBitrate: number | undefined,
    codecPreferences: Call.Codec[] | undefined,
    sdp: string,
    constraints: RTCOfferAnswerOptions,
    onSuccess?: () => void,
    onError?: (err: any) => void
  ): void;

  processAnswer(
    codecPreferences: Call.Codec[] | undefined,
    sdp: string,
    onSuccess?: (() => void) | null,
    onError?: (err: any) => void,
  ): Promise<void>;

  getSDP(): string;
};

export type SignalingCallbacks = {

};

export type PeerConnectionOptions = {
  MediaStream?: typeof MediaStream;
  RTCPeerConnection?: typeof RTCPeerConnection;
  codecPreferences?: Call.Codec[];
  dscp?: boolean;
  forceAggressiveIceNomination?: boolean;
  maxAverageBitrate?: number;
  navigator?: Navigator;
  util?: typeof util;
  rtcpcFactory?: new (options: { RTCPeerConnection?: typeof RTCPeerConnection }) => IRTCPC;
};

export type CreateAnalyserOptions = Partial<Pick<AnalyserNode,
  | 'fftSize'
  | 'smoothingTimeConstant'
  | 'maxDecibels'
  | 'minDecibels'
>>;

export class PeerConnection {
  _log = new Log('PeerConnection');

  _noop = () => {
    this._log.warn('Unexpected noop call in peerconnection');
  }

  /**
   * TODO: do we want more desscriptive parameter names?
   */
  onaudio: (a: HTMLAudioElement) => void = this._noop;
  onopen: () => void = this._noop;
  onerror: (e: { disconnect?: boolean; info: { code: number; message: string; twilioError?: TwilioError } }) => void = this._noop;
  onclose: () => void = this._noop;
  ondisconnected: (m: string) => void = this._noop;
  onfailed: (m: string) => void = this._noop;
  onconnected: (m: string) => void = this._noop;
  onreconnected: (m: string) => void = this._noop;
  onsignalingstatechange: (s: RTCSignalingState) => void = this._noop;
  ondtlstransportstatechange: (s: RTCDtlsTransportState) => void = this._noop;
  onicegatheringfailure: (t: typeof ICE_GATHERING_FAIL_NONE | typeof ICE_GATHERING_FAIL_TIMEOUT) => void = this._noop;
  onicegatheringstatechange: (s: RTCIceGatheringState) => void = this._noop;
  oniceconnectionstatechange: (s: RTCIceConnectionState) => void = this._noop;
  onpcconnectionstatechange: (s: RTCPeerConnectionState) => void = this._noop;
  onicecandidate: (c: RTCIceCandidate) => void = this._noop;
  onselectedcandidatepairchange: (p: RTCIceCandidatePair | null) => void = this._noop;
  onvolume: (n0: number, n1: number, n2: number, n3: number) => void = this._noop;

  version: IRTCPC | null = null;
  stream: MediaStream | null = null;
  sinkIds = new Set(['default']);
  outputs: Map<string, { audio: HTMLAudioElement; dest?: MediaStreamAudioDestinationNode | null }> = new Map();
  status: 'connecting' | 'open' | 'closed' = 'connecting';
  callSid: string | null = null;
  isMuted: boolean = false;

  _isSinkSupported: boolean;
  _audioHelper: AudioHelper;
  _audioContext: AudioContext;
  _audioProcessorEventObserver: AudioProcessorEventObserver;
  _hasIceCandidates: boolean = false;
  _hasIceGatheringFailures: boolean = false;
  _iceGatheringTimeoutId: ReturnType<typeof setTimeout> | null = null;
  _masterAudio: HTMLAudioElement | null = null;
  _masterAudioDeviceId: string | null = null;
  _mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  _dtmfSender: RTCDTMFSender | null = null;
  _dtmfSenderUnsupported: boolean = false;
  _callEvents = []; // TODO: do we still need this?
  _nextTimeToPublish: number = Date.now();
  _onAnswerOrRinging: (p: Record<string, any>) => void = this._noop;
  _onAudioProcessorAdded: (isRemote: boolean) => void = this._noop;
  _onAudioProcessorRemoved: (isRemote: boolean) => void = this._noop;
  _onHangup: () => void = this._noop;
  _remoteStream: MediaStream | null = null;
  _shouldManageStream: boolean = true;
  _iceState: RTCPeerConnectionState | RTCIceConnectionState = INITIAL_ICE_CONNECTION_STATE;

  _inputAnalyser: AnalyserNode;
  _outputAnalyser: AnalyserNode;
  _inputAnalyser2: AnalyserNode;
  _outputAnalyser2: AnalyserNode;
  _inputStreamSource: MediaStreamAudioSourceNode | null;
  _outputStreamSource: MediaStreamAudioSourceNode | null;

  _sender: RTCRtpSender | null;

  options: PeerConnectionOptions;

  navigator: Navigator | null;

  util: typeof util;

  codecPreferences: Call.Codec[] | undefined;

  _answerSdp: string;

  pcStream: MediaStream;

  pstream: PStream;

  // TODO: revisit the necessity of the below code. if needed, reconsider "as any"
  // Is PeerConnection.protocol used outside of our SDK? We should remove this if not.
  static protocol = ((() => RTCPC.test() ? new (RTCPC as any)() : null))();
  static enabled = RTCPC.test();

  constructor(
    audioHelper: AudioHelper,
    pstream: PStream,
    options: PeerConnectionOptions
  ) {
    if (!audioHelper || !pstream) {
      throw new InvalidArgumentError('Audiohelper, and pstream are required arguments');
    }

    this.pstream = pstream;

    const AudioContext = typeof window !== 'undefined' &&
      (window.AudioContext || (window as any).webkitAudioContext);

    this._isSinkSupported = !!AudioContext &&
      typeof HTMLAudioElement !== 'undefined' && !!HTMLAudioElement.prototype.setSinkId;

    this._audioHelper = audioHelper;

    // NOTE(mmalavalli): Since each Connection creates its own AudioContext,
    // after 6 instances an exception is thrown. Refer https://www.w3.org/2011/audio/track/issues/3.
    // In order to get around it, we are re-using the Device's AudioContext.
    this._audioContext = AudioContext && audioHelper['_audioContext'] as any; // TODO: revisit the logic here. shouldn't it be an || instead?

    this._audioProcessorEventObserver = audioHelper._getAudioProcessorEventObserver();

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
  }

  // TODO: this is supposedly never actually used in the codebase and
  // this._uri is never set. leaving it for now
  _uri: any; // TODO: added just to appease the compiler
  uri() {
    return this._uri;
  }

  /**
   * Open the underlying RTCPeerConnection with a MediaStream obtained by
   * passed constraints. The resulting MediaStream is created internally
   * and will therefore be managed and destroyed internally.
   */
  openDefaultDeviceWithConstraints(constraints: MediaStreamConstraints) {
    return this._audioHelper
      ._openDefaultDeviceWithConstraints(constraints)
      .then(this._setInputTracksFromStream.bind(this, false));
  }

  /**
   * Replace the existing input audio tracks with the audio tracks from the
   * passed input audio stream. We re-use the existing stream because
   * the AnalyzerNode is bound to the stream.
   */
  setInputTracksFromStream(stream: MediaStream) {
    return this._setInputTracksFromStream(true, stream)
      .then(() => {
        this._shouldManageStream = false;
      });
  }

  _createAnalyser(audioContext: AudioContext, options?: CreateAnalyserOptions) {
    const _options = Object.assign({
      fftSize: 32,
      smoothingTimeConstant: 0.3,
    }, options);

    const analyser = audioContext.createAnalyser();

    // tslint:disable-next-line
    for (const field in _options) {
      (analyser as any)[field] = (_options as any)[field];
    }

    return analyser;
  }

  _setVolumeHandler(handler: typeof this.onvolume) {
    this.onvolume = handler;
  }

  _startPollingVolume() {
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
  }

  _stopStream() {
    // We shouldn't stop the tracks if they were not created inside
    //   this PeerConnection.
    if (!this._shouldManageStream) {
      return;
    }

    this._audioHelper._stopDefaultInputDeviceStream();
  }

  /**
   * Update the stream source with the new input audio stream.
   */
  _updateInputStreamSource(stream: MediaStream) {
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
  }

  /**
   * Update the stream source with the new ouput audio stream.
   */
  _updateOutputStreamSource(stream: MediaStream) {
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
  }

  /**
   * Replace the tracks of the current stream with new tracks. We do this rather than replacing the
   *   whole stream because AnalyzerNodes are bound to a stream.
   * @param {Boolean} shouldClone - Whether the stream should be cloned if it is the first
   *   stream, or set directly. As a rule of thumb, streams that are passed in externally may have
   *   their lifecycle managed externally, and should be cloned so that we do not tear it or its tracks
   *   down when the call ends. Streams that we create internally (inside PeerConnection) should be set
   *   directly so that when the call ends it is disposed of.
   * @param {MediaStream} newStream - The new stream to copy the tracks over from.
   */
  _setInputTracksFromStream(shouldClone: boolean, newStream: MediaStream) {
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
      // TODO: remove "!"
      // We can't use MediaStream.clone() here because it stopped copying over tracks
      //   as of Chrome 61. https://bugs.chromium.org/p/chromium/issues/detail?id=770908
      this.stream = shouldClone ? cloneStream(newStream, this.options.MediaStream!) : newStream;
    } else {
      // If the call was started with gUM, and we are now replacing that track with an
      // external stream's tracks, we should stop the old managed track.
      if (this._shouldManageStream) {
        this._stopStream();
      }

      if (!this._sender) {
        this._sender = this.version!.pc.getSenders()[0]; // TODO: rework so we don't need "!"
      }

      // TODO: rework so we don't need as any
      return (this._sender as any).replaceTrack(newStream.getAudioTracks()[0]).then(() => {
        this._updateInputStreamSource(newStream);
        // TODO: remove "!"
        this.stream = shouldClone ? cloneStream(newStream, this.options.MediaStream!) : newStream;
        return getStreamPromise();
      });
    }

    return getStreamPromise();
  }

  _onInputDevicesChanged() {
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
  }

  _onIceGatheringFailure(type: typeof ICE_GATHERING_FAIL_NONE | typeof ICE_GATHERING_FAIL_TIMEOUT) {
    this._hasIceGatheringFailures = true;
    this.onicegatheringfailure(type);
  }

  _onMediaConnectionStateChange(newState: RTCPeerConnectionState | RTCIceConnectionState) {
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
  }

  _setSinkIds(sinkIds: string | string[]) {
    if (!this._isSinkSupported) {
      return Promise.reject(new NotSupportedError('Audio output selection is not supported by this browser'));
    }

    // TODO: use Array.isArray instead of double as any
    this.sinkIds = new Set(((sinkIds as any).forEach ? sinkIds : [sinkIds] as any));
    return this.version
      ? this._updateAudioOutputs()
      : Promise.resolve();
  }

  /**
   * Start timeout for ICE Gathering
   */
  _startIceGatheringTimeout() {
    this._stopIceGatheringTimeout();
    this._iceGatheringTimeoutId = setTimeout(() => {
      this._onIceGatheringFailure(ICE_GATHERING_FAIL_TIMEOUT);
    }, ICE_GATHERING_TIMEOUT);
  };

  /**
   * Stop timeout for ICE Gathering
   */
  _stopIceGatheringTimeout() {
    // TODO: add a null check
    clearInterval(this._iceGatheringTimeoutId!);
  };

  _updateAudioOutputs() {
    // TODO: used arrow functions here
    const addedOutputIds = Array.from(this.sinkIds).filter((id) => {
      return !this.outputs.has(id);
    }, this);

    // TODO: used arrow functions here
    const removedOutputIds = Array.from(this.outputs.keys()).filter((id) => {
      return !this.sinkIds.has(id);
    }, this);

    const self = this;
    const createOutputPromises = addedOutputIds.map(this._createAudioOutput, this);
    return Promise.all(createOutputPromises).then(() => Promise.all(removedOutputIds.map(self._removeAudioOutput, self)));
  }

  _createAudio(arr?: string) {
    const audio = new Audio(arr);
    this.onaudio(audio);
    return audio;
  }

  _createAudioOutput(id: string) {
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
  }

  _removeAudioOutputs() {
    if (this._masterAudio && typeof this._masterAudioDeviceId !== 'undefined') {
      this._disableOutput(this, this._masterAudioDeviceId);
      this.outputs.delete(this._masterAudioDeviceId!); // TODO: proper null check
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
  }

  // TODO: consider just using "this" instead of letting invokers pass in pc
  _disableOutput(pc: PeerConnection, id: string | null) {
    const output = pc.outputs.get(id!); // TODO: add a null check?
    if (!output) { return; }

    if (output.audio) {
      output.audio.pause();
      output.audio.src = '';
    }

    if (output.dest) {
      output.dest.disconnect();
    }
  }

  /**
   * Disable a non-master output, and update the master output to assume its state. This
   * is called when the device ID assigned to the master output has been removed from
   * active devices. We can not simply remove the master audio output, so we must
   * instead reassign it.
   */
  _reassignMasterOutput(pc: PeerConnection, masterId: string) {
    const masterOutput: any = pc.outputs.get(masterId); // TODO: don't use "any" here
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
  }

  _removeAudioOutput(id: string) {
    if (this._masterAudioDeviceId === id) {
      return this._reassignMasterOutput(this, id);
    }

    this._disableOutput(this, id);
    this.outputs.delete(id);

    return Promise.resolve();
  }

  /**
   * Use an AudioContext to potentially split our audio output stream to multiple
   * audio devices. This is only available to browsers with AudioContext and
   * HTMLAudioElement.setSinkId() available. We save the source stream in
   * _masterAudio, and use it for one of the active audio devices. We keep
   * track of its ID because we must replace it if we lose its initial device.
   */
  _onAddTrack(pc: PeerConnection, stream: MediaStream) {
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
    } catch (ex) {
      this._log.warn('Unable to create a MediaStreamSource from onAddTrack', ex);
      this._mediaStreamSource = null;
    }

    pc.pcStream = stream;
    pc._updateAudioOutputs();
  }

  /**
   * Use a single audio element to play the audio output stream. This does not
   * support multiple output devices, and is a fallback for when AudioContext
   * and/or HTMLAudioElement.setSinkId() is not available to the client.
   */
  _fallbackOnAddTrack(pc: PeerConnection, stream: MediaStream) {
    const audio = document && document.createElement('audio');
    setAudioSource(audio, stream, this._audioHelper)
      .then(() => audio.play())
      .catch(() => pc._log.error('Error attaching stream to element (_fallbackOnAddTrack).'));

    pc.outputs.set('default', { audio });
  }

  _setEncodingParameters(enableDscp: boolean) {
    if (!enableDscp
        || !this._sender
        || typeof this._sender.getParameters !== 'function'
        || typeof this._sender.setParameters !== 'function') {
      return;
    }

    const params = this._sender.getParameters();
    // TODO: reconsider "as any"
    if (!(params as any).priority && !(params.encodings && params.encodings.length)) {
      return;
    }

    // This is how MDN's RTPSenderParameters defines priority
    (params as any).priority = 'high'; // TODO: reconsider "as any"

    // And this is how it's currently implemented in Chrome M72+
    if (params.encodings && params.encodings.length) {
      params.encodings.forEach(encoding => {
        encoding.priority = 'high';
        encoding.networkPriority = 'high';
      });
    }

    this._sender.setParameters(params);
  }

  _setupPeerConnection(rtcConfiguration: RTCConfiguration) {
    const self = this;
    const version = new (this.options.rtcpcFactory || RTCPC as any)({ RTCPeerConnection: this.options.RTCPeerConnection });
    version.create(rtcConfiguration);
    addStream(version.pc, this.stream!); // TODO: proper null check

    const supportedCodecs = RTCRtpReceiver.getCapabilities('audio')!.codecs; // TODO: need to null check and remove the "!"
    this._log.debug('sorting codecs', supportedCodecs, this.codecPreferences);
    const sortedCodecs = util.sortByMimeTypes(supportedCodecs, this.codecPreferences);
    const [transceiver] = version.pc.getTransceivers();
    this._log.debug('setting sorted codecs', sortedCodecs);
    transceiver.setCodecPreferences(sortedCodecs);

    const eventName = 'ontrack' in version.pc
      ? 'ontrack' : 'onaddstream';

    version.pc[eventName] = (event: any) => { // TODO: remove "any"
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
  }

  _maybeSetIceAggressiveNomination(sdp: string) {
    return this.options.forceAggressiveIceNomination
      ? setIceAggressiveNomination(sdp)
      : sdp;
  }

  _setupChannel() {
    // TODO: rework whole method so we don't need "!"

    const pc = this.version!.pc;

    // Chrome 25 supports onopen
    // TODO: revisit, no longer in the standard
    (this.version!.pc as any).onopen = () => {
      this.status = 'open';
      this.onopen();
    };

    // Chrome 26 doesn't support onopen so must detect state change
    // TODO: revisit, no longer in the standard
    (this.version!.pc as any).onstatechange = () => {
      if (this.version!.pc && (this.version!.pc as any).readyState === 'stable') {
        this.status = 'open';
        this.onopen();
      }
    };

    // Chrome 27 changed onstatechange to onsignalingstatechange
    this.version!.pc.onsignalingstatechange = () => {
      const state = pc.signalingState;
      this._log.info(`signalingState is "${state}"`);

      if (this.version!.pc && this.version!.pc.signalingState === 'stable') {
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
        const targetPc: any = event.target; // TODO: reconsider "any"
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
  }

  _initializeMediaStream(rtcConfiguration: RTCConfiguration) {
    // if mediastream already open then do nothing
    if (this.status === 'open') {
      return false;
    }
    // TODO: remove "any" when PStream has a proper type
    if ((this.pstream as any).status === 'disconnected') {
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
  }

  /**
   * Remove reconnection-related listeners
   */
  _removeReconnectionListeners() {
    if (this.pstream) {
      this.pstream.removeListener('answer', this._onAnswerOrRinging);
      this.pstream.removeListener('hangup', this._onHangup);
    }
  }

  /**
   * Setup a listener for RTCDtlsTransport to capture state changes events
   */
  _setupRTCDtlsTransportListener() {
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
  }

  /**
   * Setup a listener for RTCIceTransport to capture selected candidate pair changes
   */
  _setupRTCIceTransportListener() {
    const iceTransport = this._getRTCIceTransport();

    if (!iceTransport || iceTransport.onselectedcandidatepairchange) {
      return;
    }

    iceTransport.onselectedcandidatepairchange = () =>
      this.onselectedcandidatepairchange(iceTransport.getSelectedCandidatePair());
  }

  /**
   * Restarts ICE for the current connection
   * ICE Restart failures are ignored. Retries are managed in Connection
   */
  iceRestart() {
    // TODO: reconsider using "!" by adding proper null checks

    this._log.info('Attempting to restart ICE...');
    this._hasIceCandidates = false;
    this.version!.createOffer(this.options.maxAverageBitrate, { iceRestart: true }).then(() => {
      this._removeReconnectionListeners();

      this._onAnswerOrRinging = payload => {
        this._removeReconnectionListeners();

        if (!payload.sdp || this.version!.pc.signalingState !== 'have-local-offer') {
          const message = 'Invalid state or param during ICE Restart:'
            + `hasSdp:${!!payload.sdp}, signalingState:${this.version!.pc.signalingState}`;
          this._log.warn(message);
          return;
        }

        const sdp = this._maybeSetIceAggressiveNomination(payload.sdp);
        this._answerSdp = sdp;
        if (this.status !== 'closed') {
          this.version!.processAnswer(this.codecPreferences, sdp, null, err => {
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
      // TODO: reconsider "as any"
      (this.pstream as any).reinvite(this.version!.getSDP(), this.callSid);

    }).catch((err) => {
      const message = err && err.message ? err.message : err;
      this._log.error(`Failed to createOffer during ICE Restart. Error: ${message}`);
      // CreateOffer failures doesn't transition ice state to failed
      // We need trigger it so it can be picked up by retries
      this.onfailed(message);
    });
  }

  async setRemoteAnswer(sdp: string): Promise<{ status: 'success'; pc: RTCPeerConnection } | { status: 'error' }> {
    this._answerSdp = this._maybeSetIceAggressiveNomination(sdp);

    const processAnswerPromiseResult = await new Promise<{ status: 'success' | 'error' }>((resolve) => {
      if (this.status === 'closed') {
        resolve({ status: 'error' });
        return;
      }

      const onProcessAnswerSuccess = () => {
        if (this.options) {
          this._setEncodingParameters(this.options.dscp!); // TODO: remove "!"
        }

        resolve({ status: 'success' });
      };

      const onProcessAnswerError = (err: any) => {
        const errMsg = err.message || err;

        this.onerror({
          info: {
            code: 31000,
            message: `Error processing answer: ${errMsg}`,
            twilioError: new MediaErrors.ClientRemoteDescFailed(),
          },
        });

        resolve({ status: 'error' });
      };

      this.version?.processAnswer(
        this.codecPreferences,
        this._answerSdp,
        onProcessAnswerSuccess,
        onProcessAnswerError
      );
    });

    if (processAnswerPromiseResult.status === 'error') {
      return { status: 'error' };
    }

    return { status: 'success', pc: this.version!.pc };
  }

  async makeOutgoingCall(
    callsid: string,
    rtcConfiguration: RTCConfiguration
  ): Promise<{ status: 'success'; offerSdp: string } | { status: 'error' }> {
    if (!this._initializeMediaStream(rtcConfiguration)) {
      return { status: 'error' };
    }

    this.callSid = callsid;

    const createOfferPromiseResult = await new Promise<{ status: 'success' | 'error' }>((resolve) => {
      const onCreateOfferSuccess = () => {
        if (this.status === 'closed') {
          resolve({ status: 'error' });
          return;
        }

        this._setupRTCDtlsTransportListener();

        resolve({ status: 'success' });
      };

      const onCreateOfferError = (err: any) => {
        const errMsg = err.message || err;

        this.onerror({
          info: {
            code: 31000,
            message: `Error creating the offer: ${errMsg}`,
            twilioError: new MediaErrors.ClientLocalDescFailed(),
          },
        });

        resolve({ status: 'error' });
      };

      this.version?.createOffer(
        this.options.maxAverageBitrate,
        { audio: true } as any,
        onCreateOfferSuccess,
        onCreateOfferError,
      );
    });

    if (createOfferPromiseResult.status === 'error') {
      return { status: 'error' };
    }

    return { status: 'success', offerSdp: this.version!.getSDP() };
  }

  answerIncomingCall(
    callSid: string,
    sdp: string,
    rtcConfiguration: RTCConfiguration,
    onMediaStarted: (pc: RTCPeerConnection) => void
  ) {
    if (!this._initializeMediaStream(rtcConfiguration)) {
      return;
    }
    sdp = this._maybeSetIceAggressiveNomination(sdp);
    this._answerSdp = sdp.replace(/^a=setup:actpass$/gm, 'a=setup:passive');
    this.callSid = callSid;
    const self = this;
    function onAnswerSuccess() {
      if (self.status !== 'closed') {
        // TODO: remove "as any" and "!"
        (self.pstream as any).answer(self.version!.getSDP(), callSid);
        if (self.options) {
          // TODO: remove "!"
          self._setEncodingParameters(self.options.dscp!);
        }
        // TODO: remove "!"
        onMediaStarted(self.version!.pc);
        self._setupRTCDtlsTransportListener();
      }
    }
    // TODO: remove "any"
    function onAnswerError(err: any) {
      const errMsg = err.message || err;
      self.onerror({ info: {
        code: 31000,
        message: `Error creating the answer: ${errMsg}`,
        twilioError: new MediaErrors.ClientRemoteDescFailed(),
      } });
    }
    // TODO: remove "!"
    this.version!.processSDP(this.options.maxAverageBitrate, this.codecPreferences, sdp, { audio: true }, onAnswerSuccess, onAnswerError);
  }

  close() {
    if (this.version && this.version.pc) {
      if (this.version.pc.signalingState !== 'closed') {
        this.version.pc.close();
      }

      // TODO: remove "as any"
      this.version.pc = null as any;
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
  }

  // TODO: revisit the necessity of this method
  reject(callSid: string) {
    this.callSid = callSid;
  }

  // TODO: revisit the necessity of this method
  ignore(callSid: string) {
    this.callSid = callSid;
  }

  /**
   * Mute or unmute input audio. If the stream is not yet present, the setting
   * is saved and applied to future streams/tracks.
   * @param {boolean} shouldMute - Whether the input audio should be muted or
   * unmuted.
   */
  mute(shouldMute: boolean) {
    this.isMuted = shouldMute;
    if (!this.stream) { return; }

    if (this._sender && this._sender.track) {
      this._sender.track.enabled = !shouldMute;
    } else {
      const audioTracks = typeof this.stream.getAudioTracks === 'function'
        ? this.stream.getAudioTracks()
        // TODO: remove "as any"
        : (this.stream as any).audioTracks;

      // TODO: remove "any"
      audioTracks.forEach((track: any) => {
        track.enabled = !shouldMute;
      });
    }
  }

  /**
   * Get or create an RTCDTMFSender for the first local audio MediaStreamTrack
   * we can get from the RTCPeerConnection. Return null if unsupported.
   * @instance
   * @returns ?RTCDTMFSender
   */
  getOrCreateDTMFSender() {
    if (this._dtmfSender || this._dtmfSenderUnsupported) {
      return this._dtmfSender || null;
    }

    const self = this;
    const pc = this.version!.pc; // TODO: remove "!"
    if (!pc) {
      this._log.warn('No RTCPeerConnection available to call createDTMFSender on');
      return null;
    }

    // TODO: revist the need for no-longer-existent RTCDtmfSender (lowercase instead of all allcaps DTMF)
    // @ts-ignore
    if (typeof pc.getSenders === 'function' && (typeof RTCDTMFSender === 'function' || typeof RTCDtmfSender === 'function')) {
      const chosenSender = pc.getSenders().find(sender => sender.dtmf);
      if (chosenSender) {
        this._log.info('Using RTCRtpSender#dtmf');
        this._dtmfSender = chosenSender.dtmf;
        return this._dtmfSender;
      }
    }

    // TODO: remove "as any"
    if (typeof (pc as any).createDTMFSender === 'function' && typeof (pc as any).getLocalStreams === 'function') {
      // TODO: remove "as any" and "any"
      const track = (pc as any).getLocalStreams().map((stream: any) => {
        const tracks = self._getAudioTracks(stream);
        return tracks && tracks[0];
      })[0];

      if (!track) {
        this._log.warn('No local audio MediaStreamTrack available on the RTCPeerConnection to pass to createDTMFSender');
        return null;
      }

      this._log.info('Creating RTCDTMFSender');
      // TODO: remove "as any"
      this._dtmfSender = (pc as any).createDTMFSender(track);
      return this._dtmfSender;
    }

    this._log.info('RTCPeerConnection does not support RTCDTMFSender');
    this._dtmfSenderUnsupported = true;
    return null;
  }

  /**
   * Get the RTCDtlsTransport object from the PeerConnection
   */
  getRTCDtlsTransport() {
    const sender = this.version && this.version.pc
      && typeof this.version.pc.getSenders === 'function'
      && this.version.pc.getSenders()[0];
    return sender && sender.transport || null;
  }

  // TODO: revisit necessity of this method
  _canStopMediaStreamTrack() {
    return typeof MediaStreamTrack.prototype.stop === 'function';
  }

  // TODO: revisit necessity of this method
  _getAudioTracks(stream: MediaStream) {
    return typeof stream.getAudioTracks === 'function'
      ? stream.getAudioTracks()
      : (stream as any).audioTracks;
  }

  /**
   * Get the RTCIceTransport object from the PeerConnection
   * @returns RTCIceTransport
   */
  _getRTCIceTransport() {
    const dtlsTransport = this.getRTCDtlsTransport();
    return dtlsTransport && dtlsTransport.iceTransport || null;
  }

  _handleAudioProcessorEvent(isRemote: boolean, isAddProcessor: boolean) {
    if (!isRemote || !this._remoteStream) {
      return;
    }

    let audio = null;
    if (this._masterAudio) {
      this._log.info('Setting audio source for master audio.')
      audio = this._masterAudio;
    } else {
      this._log.info('No master audio. Setting audio source for default audio output.')
      audio = this.outputs.get('default')!.audio; // TODO: remove "!"
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
  }
}

function addStream(pc: RTCPeerConnection, stream: MediaStream) {
  if (typeof pc.addTrack === 'function') {
    stream.getAudioTracks().forEach(track => {
      // The second parameters, stream, should not be necessary per the latest editor's
      //   draft, but FF requires it. https://bugzilla.mozilla.org/show_bug.cgi?id=1231414
      pc.addTrack(track, stream);
    });
  } else {
    (pc as any).addStream(stream); // TODO: remove "as any"
  }
}

function cloneStream(oldStream: MediaStream, _MediaStream: typeof MediaStream) {
  let newStream;
  if (_MediaStream) {
    newStream = new _MediaStream();
  } else if (typeof MediaStream !== 'undefined') {
    newStream = new MediaStream();
  } else {
    // TODO: do we need this webkitMediaStream construction?
    // @ts-ignore
    newStream = new webkitMediaStream();
  }

  oldStream.getAudioTracks().forEach(newStream.addTrack, newStream);
  return newStream;
}

function removeStream(pc: RTCPeerConnection, stream: MediaStream) {
  if (typeof pc.removeTrack === 'function') {
    pc.getSenders().forEach(sender => { pc.removeTrack(sender); });
  } else {
    (pc as any).removeStream(stream); // TODO: do we need this?
  }
}

/**
 * Sets the source of an HTMLAudioElement to the specified MediaStream and
 * applies a remote audio processor if available
 */
function setAudioSource(audio: HTMLAudioElement, stream: MediaStream, audioHelper: AudioHelper) {
  return audioHelper._maybeCreateRemoteProcessedStream(stream).then(maybeProcessedStream => {
    if (typeof audio.srcObject !== 'undefined') {
      audio.srcObject = maybeProcessedStream;
    } else if (typeof (audio as any).mozSrcObject !== 'undefined') {
      (audio as any).mozSrcObject = maybeProcessedStream;
    } else if (typeof audio.src !== 'undefined') {
      const _window = (audio as any).options.window || window;
      audio.src = (_window.URL || _window.webkitURL).createObjectURL(maybeProcessedStream);
    } else {
      return Promise.reject();
    }

    return Promise.resolve();
  });
}

export default PeerConnection;
