import { EventEmitter } from 'events';
import Backoff from './backoff';
import Device from './device';
import DialtonePlayer from './dialtonePlayer';
import {
  GeneralErrors,
  getPreciseSignalingErrorByCode,
  InvalidArgumentError,
  InvalidStateError,
  MediaErrors,
  SignalingErrors,
  TwilioError,
  UserMediaErrors,
} from './errors';
import Log from './log';
import { PeerConnection } from './rtc';
import { IceCandidate, RTCIceCandidate } from './rtc/icecandidate';
import RTCSample from './rtc/sample';
import { getPreferredCodecInfo } from './rtc/sdp';
import RTCWarning from './rtc/warning';
import { generateVoiceEventSid } from './sid';
import StatsMonitor from './statsMonitor';
import { isChrome } from './util';

import { RELEASE_VERSION } from './constants';

// Placeholders until we convert the respective files to TypeScript.
export type IAudioHelper = any;
export type IPStream = any;
export type IPeerConnection = any;
export type IPublisher = any;
export type ISound = any;

const BACKOFF_CONFIG = {
  factor: 1.1,
  jitter: 0.5,
  max: 30000,
  min: 1,
};

const DTMF_INTER_TONE_GAP: number = 70;
const DTMF_PAUSE_DURATION: number = 500;
const DTMF_TONE_DURATION: number = 160;

const METRICS_BATCH_SIZE: number = 10;
const METRICS_DELAY: number = 5000;

const MEDIA_DISCONNECT_ERROR = {
  disconnect: true,
  info: {
    code: 31003,
    message: 'Connection with Twilio was interrupted.',
    twilioError: new MediaErrors.ConnectionError(),
  },
};

const MULTIPLE_THRESHOLD_WARNING_NAMES: Record<string, Record<string, string>> = {
  // The stat `packetsLostFraction` is monitored by two separate thresholds,
  // `maxAverage` and `max`. Each threshold emits a different warning name.
  packetsLostFraction: {
    max: 'packet-loss',
    maxAverage: 'packets-lost-fraction',
  },
};

const WARNING_NAMES: Record<string, string> = {
  audioInputLevel: 'audio-input-level',
  audioOutputLevel: 'audio-output-level',
  bytesReceived: 'bytes-received',
  bytesSent: 'bytes-sent',
  jitter: 'jitter',
  mos: 'mos',
  rtt: 'rtt',
};

const WARNING_PREFIXES: Record<string, string> = {
  max: 'high-',
  maxAverage: 'high-',
  maxDuration: 'constant-',
  min: 'low-',
  minStandardDeviation: 'constant-',
};

/**
 * A {@link Call} represents a media and signaling connection to a TwiML application.
 */
class Call extends EventEmitter {
  /**
   * String representation of the {@link Call} class.
   */
  static toString = () => '[Twilio.Call class]';

  /**
   * Returns caller verification information about the caller.
   * If no caller verification information is available this will return null.
   */
  readonly callerInfo: Call.CallerInfo | null;

  /**
   * The custom parameters sent to (outgoing) or received by (incoming) the TwiML app.
   */
  readonly customParameters: Map<string, string>;

  /**
   * Whether this {@link Call} is incoming or outgoing.
   */
  get direction(): Call.CallDirection {
    return this._direction;
  }

  /**
   * Audio codec used for this {@link Call}. Expecting {@link Call.Codec} but
   * will copy whatever we get from RTC stats.
   */
  get codec(): string {
    return this._codec;
  }

  /**
   * The connect token is available as soon as the call is established
   * and connected to Twilio. Use this token to reconnect to a call via the {@link Device.connect}
   * method.
   *
   * For incoming calls, it is available in the call object after the {@link Device.incomingEvent} is emitted.
   * For outgoing calls, it is available after the {@link Call.acceptEvent} is emitted.
   */
  get connectToken(): string | undefined {
    const signalingReconnectToken = this._signalingReconnectToken;
    const callSid = this.parameters && this.parameters.CallSid ? this.parameters.CallSid : undefined;

    if (!signalingReconnectToken || !callSid) {
      return;
    }

    const customParameters = this.customParameters && typeof this.customParameters.keys === 'function' ?
    Array.from(this.customParameters.keys()).reduce((result: Record<string, string>, key: string) => {
      result[key] = this.customParameters.get(key)!;
      return result;
    }, {}) : {};

    const parameters = this.parameters || {};

    return btoa(encodeURIComponent(JSON.stringify({
      customParameters,
      parameters,
      signalingReconnectToken,
    })));
  }

  /**
   * The temporary CallSid for this call, if it's outbound.
   */
  readonly outboundConnectionId?: string;

  /**
   * Call parameters received from Twilio for an incoming call.
   */
  parameters: Record<string, string> = { };

  /**
   * Audio codec used for this {@link Call}. Expecting {@link Call.Codec} but
   * will copy whatever we get from RTC stats.
   */
  private _codec: string;

  /**
   * Whether this {@link Call} is incoming or outgoing.
   */
  private readonly _direction: Call.CallDirection;

  /**
   * The number of times input volume has been the same consecutively.
   */
  private _inputVolumeStreak: number = 0;

  /**
   * Whether the call has been answered.
   */
  private _isAnswered: boolean = false;

  /**
   * Whether the call has been cancelled.
   */
  private _isCancelled: boolean = false;

  /**
   * Whether the call has been rejected
   */
  private _isRejected: boolean = false;

  /**
   * Whether or not the browser uses unified-plan SDP by default.
   */
  private readonly _isUnifiedPlanDefault: boolean | undefined;

  /**
   * The most recent public input volume value. 0 -> 1 representing -100 to -30 dB.
   */
  private _latestInputVolume: number = 0;

  /**
   * The most recent public output volume value. 0 -> 1 representing -100 to -30 dB.
   */
  private _latestOutputVolume: number = 0;

  /**
   * An instance of Logger to use.
   */
  private _log: Log = new Log('Call');

  /**
   * The MediaHandler (Twilio PeerConnection) this {@link Call} is using for
   * media signaling.
   */
  private _mediaHandler: IPeerConnection;

  /**
   * An instance of Backoff for media reconnection
   */
  private _mediaReconnectBackoff: any;

  /**
   * Timestamp for the initial media reconnection
   */
  private _mediaReconnectStartTime: number;

  /**
   * State of the {@link Call}'s media.
   */
  private _mediaStatus: Call.State = Call.State.Pending;

  /**
   * A map of messages sent via sendMessage API using voiceEventSid as the key.
   * The message will be deleted once an 'ack' or an error is received from the server.
   */
  private _messages: Map<string, Call.Message> = new Map();

  /**
   * A batch of metrics samples to send to Insights. Gets cleared after
   * each send and appended to on each new sample.
   */
  private readonly _metricsSamples: Call.CallMetrics[] = [];

  /**
   * An instance of StatsMonitor.
   */
  private readonly _monitor: StatsMonitor;

  /**
   * Method to be run after {@link Call.ignore} is called.
   */
  private _onIgnore: () => void;

  /**
   * Options passed to this {@link Call}.
   */
  private _options: Call.Options = {
    MediaHandler: PeerConnection,
    MediaStream: null,
    enableImprovedSignalingErrorPrecision: false,
    offerSdp: null,
    shouldPlayDisconnect: () => true,
    voiceEventSidGenerator: generateVoiceEventSid,
  };

  /**
   * The number of times output volume has been the same consecutively.
   */
  private _outputVolumeStreak: number = 0;

  /**
   * The PStream instance to use for Twilio call signaling.
   */
  private readonly _pstream: IPStream;

  /**
   * An instance of EventPublisher.
   */
  private readonly _publisher: IPublisher;

  /**
   * Whether the {@link Call} should send a hangup on disconnect.
   */
  private _shouldSendHangup: boolean = true;

  /**
   * The signaling reconnection token used to re-establish a lost signaling connection.
   */
  private _signalingReconnectToken: string | undefined;

  /**
   * State of the {@link Call}'s signaling.
   */
  private _signalingStatus: Call.State = Call.State.Pending;

  /**
   * A Map of Sounds to play.
   */
  private readonly _soundcache: Map<Device.SoundName, ISound> = new Map();

  /**
   * State of the {@link Call}.
   */
  private _status: Call.State = Call.State.Pending;

  /**
   * Voice event SID generator, creates a unique voice event SID.
   */
  private _voiceEventSidGenerator: () => string;

  /**
   * Whether the {@link Call} has been connected. Used to determine if we are reconnected.
   */
  private _wasConnected: boolean = false;

  /**
   * @internal
   * @param config - Mandatory configuration options
   * @param options - Optional settings
   */
  constructor(config: Call.Config, options?: Call.Options) {
    super();

    this._isUnifiedPlanDefault = config.isUnifiedPlanDefault;
    this._soundcache = config.soundcache;

    if (typeof config.onIgnore === 'function') {
      this._onIgnore = config.onIgnore;
    }

    const message = options && options.twimlParams || { };
    this.customParameters = new Map(
      Object.entries(message).map(([key, val]: [string, any]): [string, string] => [key, String(val)]));

    Object.assign(this._options, options);

    if (this._options.callParameters) {
      this.parameters = this._options.callParameters;
    }

    if (this._options.reconnectToken) {
      this._signalingReconnectToken = this._options.reconnectToken;
    }

    this._voiceEventSidGenerator =
      this._options.voiceEventSidGenerator || generateVoiceEventSid;

    this._direction = this.parameters.CallSid && !this._options.reconnectCallSid ?
      Call.CallDirection.Incoming : Call.CallDirection.Outgoing;

    if (this.parameters) {
      this.callerInfo = this.parameters.StirStatus
        ? { isVerified: this.parameters.StirStatus === 'TN-Validation-Passed-A' }
        : null;
    } else {
      this.callerInfo = null;
    }

    this._mediaReconnectBackoff = new Backoff(BACKOFF_CONFIG);
    this._mediaReconnectBackoff.on('ready', () => this._mediaHandler.iceRestart());

    // temporary call sid to be used for outgoing calls
    this.outboundConnectionId = generateTempCallSid();

    const publisher = this._publisher = config.publisher;

    if (this._direction === Call.CallDirection.Incoming) {
      publisher.info('connection', 'incoming', null, this);
    } else {
      publisher.info('connection', 'outgoing', {
        preflight: this._options.preflight,
        reconnect: !!this._options.reconnectCallSid,
      }, this);
    }

    const monitor = this._monitor = new (this._options.StatsMonitor || StatsMonitor)();
    monitor.on('sample', this._onRTCSample);

    // First 20 seconds or so are choppy, so let's not bother with these warnings.
    monitor.disableWarnings();
    setTimeout(() => monitor.enableWarnings(), METRICS_DELAY);

    monitor.on('warning', (data: RTCWarning, wasCleared?: boolean) => {
      if (data.name === 'bytesSent' || data.name === 'bytesReceived') {
        this._onMediaFailure(Call.MediaFailure.LowBytes);
      }
      this._reemitWarning(data, wasCleared);
    });
    monitor.on('warning-cleared', (data: RTCWarning) => {
      this._reemitWarningCleared(data);
    });

    this._mediaHandler = new (this._options.MediaHandler)
      (config.audioHelper, config.pstream, {
        MediaStream: this._options.MediaStream,
        RTCPeerConnection: this._options.RTCPeerConnection,
        codecPreferences: this._options.codecPreferences,
        dscp: this._options.dscp,
        forceAggressiveIceNomination: this._options.forceAggressiveIceNomination,
        isUnifiedPlan: this._isUnifiedPlanDefault,
        maxAverageBitrate: this._options.maxAverageBitrate,
      });

    this.on('volume', (inputVolume: number, outputVolume: number): void => {
      this._inputVolumeStreak = this._checkVolume(
        inputVolume, this._inputVolumeStreak, this._latestInputVolume, 'input');
      this._outputVolumeStreak = this._checkVolume(
        outputVolume, this._outputVolumeStreak, this._latestOutputVolume, 'output');
      this._latestInputVolume = inputVolume;
      this._latestOutputVolume = outputVolume;
    });

    this._mediaHandler.onaudio = (remoteAudio: typeof Audio) => {
      this._log.debug('#audio');
      this.emit('audio', remoteAudio);
    };

    this._mediaHandler.onvolume = (inputVolume: number, outputVolume: number,
                                   internalInputVolume: number, internalOutputVolume: number) => {
      // (rrowland) These values mock the 0 -> 32767 format used by legacy getStats. We should look into
      // migrating to a newer standard, either 0.0 -> linear or -127 to 0 in dB, matching the range
      // chosen below.
      monitor.addVolumes((internalInputVolume / 255) * 32767, (internalOutputVolume / 255) * 32767);

      // (rrowland) 0.0 -> 1.0 linear
      this.emit('volume', inputVolume, outputVolume);
    };

    this._mediaHandler.ondtlstransportstatechange = (state: string): void => {
      const level = state === 'failed' ? 'error' : 'debug';
      this._publisher.post(level, 'dtls-transport-state', state, null, this);
    };

    this._mediaHandler.onpcconnectionstatechange = (state: string): void => {
      let level = 'debug';
      const dtlsTransport = this._mediaHandler.getRTCDtlsTransport();

      if (state === 'failed') {
        level = dtlsTransport && dtlsTransport.state === 'failed' ? 'error' : 'warning';
      }
      this._publisher.post(level, 'pc-connection-state', state, null, this);
    };

    this._mediaHandler.onicecandidate = (candidate: RTCIceCandidate): void => {
      const payload = new IceCandidate(candidate).toPayload();
      this._publisher.debug('ice-candidate', 'ice-candidate', payload, this);
    };

    this._mediaHandler.onselectedcandidatepairchange = (pair: RTCIceCandidatePair): void => {
      const localCandidatePayload = new IceCandidate(pair.local).toPayload();
      const remoteCandidatePayload = new IceCandidate(pair.remote, true).toPayload();

      this._publisher.debug('ice-candidate', 'selected-ice-candidate-pair', {
        local_candidate: localCandidatePayload,
        remote_candidate: remoteCandidatePayload,
      }, this);
    };

    this._mediaHandler.oniceconnectionstatechange = (state: string): void => {
      const level = state === 'failed' ? 'error' : 'debug';
      this._publisher.post(level, 'ice-connection-state', state, null, this);
    };

    this._mediaHandler.onicegatheringfailure = (type: Call.IceGatheringFailureReason): void => {
      this._publisher.warn('ice-gathering-state', type, null, this);
      this._onMediaFailure(Call.MediaFailure.IceGatheringFailed);
    };

    this._mediaHandler.onicegatheringstatechange = (state: string): void => {
      this._publisher.debug('ice-gathering-state', state, null, this);
    };

    this._mediaHandler.onsignalingstatechange = (state: string): void => {
      this._publisher.debug('signaling-state', state, null, this);
    };

    this._mediaHandler.ondisconnected = (msg: string): void => {
      this._log.warn(msg);
      this._publisher.warn('network-quality-warning-raised', 'ice-connectivity-lost', {
        message: msg,
      }, this);
      this._log.debug('#warning', 'ice-connectivity-lost');
      this.emit('warning', 'ice-connectivity-lost');

      this._onMediaFailure(Call.MediaFailure.ConnectionDisconnected);
    };

    this._mediaHandler.onfailed = (msg: string): void => {
      this._onMediaFailure(Call.MediaFailure.ConnectionFailed);
    };

    this._mediaHandler.onconnected = (): void => {
      // First time _mediaHandler is connected, but ICE Gathering issued an ICE restart and succeeded.
      if (this._status === Call.State.Reconnecting) {
        this._onMediaReconnected();
      }
    };

    this._mediaHandler.onreconnected = (msg: string): void => {
      this._log.info(msg);
      this._publisher.info('network-quality-warning-cleared', 'ice-connectivity-lost', {
        message: msg,
      }, this);
      this._log.debug('#warning-cleared', 'ice-connectivity-lost');
      this.emit('warning-cleared', 'ice-connectivity-lost');
      this._onMediaReconnected();
    };

    this._mediaHandler.onerror = (e: any): void => {
      if (e.disconnect === true) {
        this._disconnect(e.info && e.info.message);
      }

      const error = e.info.twilioError || new GeneralErrors.UnknownError(e.info.message);
      this._log.error('Received an error from MediaStream:', e);
      this._log.debug('#error', error);
      this.emit('error', error);
    };

    this._mediaHandler.onopen = () => {
      // NOTE(mroberts): While this may have been happening in previous
      // versions of Chrome, since Chrome 45 we have seen the
      // PeerConnection's onsignalingstatechange handler invoked multiple
      // times in the same signalingState 'stable'. When this happens, we
      // invoke this onopen function. If we invoke it twice without checking
      // for _status 'open', we'd accidentally close the PeerConnection.
      //
      // See <https://code.google.com/p/webrtc/issues/detail?id=4996>.
      if (this._status === Call.State.Open || this._status === Call.State.Reconnecting) {
        return;
      } else if (this._status === Call.State.Ringing || this._status === Call.State.Connecting) {
        this.mute(this._mediaHandler.isMuted);
        this._mediaStatus = Call.State.Open;
        this._maybeTransitionToOpen();
      } else {
        // call was probably canceled sometime before this
        this._mediaHandler.close();
      }
    };

    this._mediaHandler.onclose = () => {
      this._status = Call.State.Closed;
      if (this._options.shouldPlayDisconnect && this._options.shouldPlayDisconnect()
        // Don't play disconnect sound if this was from a cancel event. i.e. the call
        // was ignored or hung up even before it was answered.
        // Similarly, don't play disconnect sound if the call was rejected.
        && !this._isCancelled && !this._isRejected) {

        this._soundcache.get(Device.SoundName.Disconnect).play();
      }

      monitor.disable();
      this._publishMetrics();

      if (!this._isCancelled && !this._isRejected) {
        // tslint:disable no-console
        this._log.debug('#disconnect');
        this.emit('disconnect', this);
      }
    };

    this._pstream = config.pstream;
    this._pstream.on('ack', this._onAck);
    this._pstream.on('cancel', this._onCancel);
    this._pstream.on('error', this._onSignalingError);
    this._pstream.on('ringing', this._onRinging);
    this._pstream.on('transportClose', this._onTransportClose);
    this._pstream.on('connected', this._onConnected);
    this._pstream.on('message', this._onMessageReceived);

    this.on('error', error => {
      this._publisher.error('connection', 'error', {
        code: error.code, message: error.message,
      }, this);

      if (this._pstream && this._pstream.status === 'disconnected') {
        this._cleanupEventListeners();
      }
    });

    this.on('disconnect', () => {
      this._cleanupEventListeners();
    });
  }

  /**
   * Set the audio input tracks from a given stream.
   * @internal
   * @param stream
   */
  _setInputTracksFromStream(stream: MediaStream | null): Promise<void> {
    return this._mediaHandler.setInputTracksFromStream(stream);
  }

  /**
   * Set the audio output sink IDs.
   * @internal
   * @param sinkIds
   */
  _setSinkIds(sinkIds: string[]): Promise<void> {
    return this._mediaHandler._setSinkIds(sinkIds);
  }

  /**
   * Accept the incoming {@link Call}.
   * @param [options]
   */
  accept(options?: Call.AcceptOptions): void {
    this._log.debug('.accept', options);
    if (this._status !== Call.State.Pending) {
      this._log.debug(`.accept noop. status is '${this._status}'`);
      return;
    }

    options = options || { };
    const rtcConfiguration = options.rtcConfiguration || this._options.rtcConfiguration;
    const rtcConstraints = options.rtcConstraints || this._options.rtcConstraints || { };
    const audioConstraints = {
      audio: typeof rtcConstraints.audio !== 'undefined' ? rtcConstraints.audio : true,
    };

    this._status = Call.State.Connecting;

    const connect = () => {
      if (this._status !== Call.State.Connecting) {
        // call must have been canceled
        this._cleanupEventListeners();
        this._mediaHandler.close();
        return;
      }

      const onAnswer = (pc: RTCPeerConnection) => {
        // Report that the call was answered, and directionality
        const eventName = this._direction === Call.CallDirection.Incoming
          ? 'accepted-by-local'
          : 'accepted-by-remote';
        this._publisher.info('connection', eventName, null, this);

        // Report the preferred codec and params as they appear in the SDP
        const { codecName, codecParams } = getPreferredCodecInfo(this._mediaHandler.version.getSDP());
        this._publisher.info('settings', 'codec', {
          codec_params: codecParams,
          selected_codec: codecName,
        }, this);

        // Enable RTC monitoring
        this._monitor.enable(pc);
      };

      const sinkIds = typeof this._options.getSinkIds === 'function' && this._options.getSinkIds();
      if (Array.isArray(sinkIds)) {
        this._mediaHandler._setSinkIds(sinkIds).catch(() => {
          // (rrowland) We don't want this to throw to console since the customer
          // can't control this. This will most commonly be rejected on browsers
          // that don't support setting sink IDs.
        });
      }

      this._pstream.addListener('hangup', this._onHangup);

      if (this._direction === Call.CallDirection.Incoming) {
        this._isAnswered = true;
        this._pstream.on('answer', this._onAnswer);
        this._mediaHandler.answerIncomingCall(this.parameters.CallSid,
          this._options.offerSdp, rtcConfiguration, onAnswer);
      } else {
        const params = Array.from(this.customParameters.entries()).map(pair =>
         `${encodeURIComponent(pair[0])}=${encodeURIComponent(pair[1])}`).join('&');
        this._pstream.on('answer', this._onAnswer);
        this._mediaHandler.makeOutgoingCall(params, this._signalingReconnectToken,
          this._options.reconnectCallSid || this.outboundConnectionId, rtcConfiguration, onAnswer);
      }
    };

    if (this._options.beforeAccept) {
      this._options.beforeAccept(this);
    }

    const inputStream = typeof this._options.getInputStream === 'function' && this._options.getInputStream();

    const promise = inputStream
      ? this._mediaHandler.setInputTracksFromStream(inputStream)
      : this._mediaHandler.openDefaultDeviceWithConstraints(audioConstraints);

    promise.then(() => {
      this._publisher.info('get-user-media', 'succeeded', {
        data: { audioConstraints },
      }, this);

      connect();
    }, (error: Record<string, any>) => {
      let twilioError;

      if (error.code === 31208
        || ['PermissionDeniedError', 'NotAllowedError'].indexOf(error.name) !== -1) {
        twilioError = new UserMediaErrors.PermissionDeniedError();
        this._publisher.error('get-user-media', 'denied', {
          data: {
            audioConstraints,
            error,
          },
        }, this);
      } else {
        twilioError = new UserMediaErrors.AcquisitionFailedError();

        this._publisher.error('get-user-media', 'failed', {
          data: {
            audioConstraints,
            error,
          },
        }, this);
      }

      this._disconnect();
      this._log.debug('#error', error);
      this.emit('error', twilioError);
    });
  }

  /**
   * Disconnect from the {@link Call}.
   */
  disconnect(): void {
    this._log.debug('.disconnect');
    this._disconnect();
  }

  /**
   * Get the local MediaStream, if set.
   */
  getLocalStream(): MediaStream | undefined {
    return this._mediaHandler && this._mediaHandler.stream;
  }

  /**
   * Get the remote MediaStream, if set.
   */
  getRemoteStream(): MediaStream | undefined {
    return this._mediaHandler && this._mediaHandler._remoteStream;
  }

  /**
   * Ignore the incoming {@link Call}.
   */
  ignore(): void {
    this._log.debug('.ignore');
    if (this._status !== Call.State.Pending) {
      this._log.debug(`.ignore noop. status is '${this._status}'`);
      return;
    }

    this._status = Call.State.Closed;
    this._mediaHandler.ignore(this.parameters.CallSid);
    this._publisher.info('connection', 'ignored-by-local', null, this);

    if (this._onIgnore) {
      this._onIgnore();
    }
  }

  /**
   * Check whether call is muted
   */
  isMuted(): boolean {
    return this._mediaHandler.isMuted;
  }

  /**
   * Mute incoming audio.
   * @param shouldMute - Whether the incoming audio should be muted. Defaults to true.
   */
  mute(shouldMute: boolean = true): void {
    this._log.debug('.mute', shouldMute);
    const wasMuted = this._mediaHandler.isMuted;
    this._mediaHandler.mute(shouldMute);

    const isMuted = this._mediaHandler.isMuted;
    if (wasMuted !== isMuted) {
      this._publisher.info('connection', isMuted ? 'muted' : 'unmuted', null, this);
      this._log.debug('#mute', isMuted);
      this.emit('mute', isMuted, this);
    }
  }

  /**
   * Post an event to Endpoint Analytics indicating that the end user
   *   has given call quality feedback. Called without a score, this
   *   will report that the customer declined to give feedback.
   * @param score - The end-user's rating of the call; an
   *   integer 1 through 5. Or undefined if the user declined to give
   *   feedback.
   * @param issue - The primary issue the end user
   *   experienced on the call. Can be: ['one-way-audio', 'choppy-audio',
   *   'dropped-call', 'audio-latency', 'noisy-call', 'echo']
   */
  postFeedback(score?: Call.FeedbackScore, issue?: Call.FeedbackIssue): Promise<void> {
    if (typeof score === 'undefined' || score === null) {
      return this._postFeedbackDeclined();
    }

    if (!Object.values(Call.FeedbackScore).includes(score)) {
      throw new InvalidArgumentError(`Feedback score must be one of: ${Object.values(Call.FeedbackScore)}`);
    }

    if (typeof issue !== 'undefined' && issue !== null && !Object.values(Call.FeedbackIssue).includes(issue)) {
      throw new InvalidArgumentError(`Feedback issue must be one of: ${Object.values(Call.FeedbackIssue)}`);
    }

    return this._publisher.info('feedback', 'received', {
      issue_name: issue,
      quality_score: score,
    }, this, true);
  }

  /**
   * Reject the incoming {@link Call}.
   */
  reject(): void {
    this._log.debug('.reject');
    if (this._status !== Call.State.Pending) {
      this._log.debug(`.reject noop. status is '${this._status}'`);
      return;
    }

    this._isRejected = true;
    this._pstream.reject(this.parameters.CallSid);
    this._mediaHandler.reject(this.parameters.CallSid);
    this._publisher.info('connection', 'rejected-by-local', null, this);
    this._cleanupEventListeners();
    this._mediaHandler.close();
    this._status = Call.State.Closed;
    this._log.debug('#reject');
    this.emit('reject');
  }

  /**
   * Send a string of digits.
   * @param digits
   */
  sendDigits(digits: string): void {
    this._log.debug('.sendDigits', digits);
    if (digits.match(/[^0-9*#w]/)) {
      throw new InvalidArgumentError('Illegal character passed into sendDigits');
    }

    const customSounds = this._options.customSounds || {};
    const sequence: string[] = [];
    digits.split('').forEach((digit: string) => {
      let dtmf = (digit !== 'w') ? `dtmf${digit}` : '';
      if (dtmf === 'dtmf*') { dtmf = 'dtmfs'; }
      if (dtmf === 'dtmf#') { dtmf = 'dtmfh'; }
      sequence.push(dtmf);
    });

    const playNextDigit = () => {
      const digit = sequence.shift() as Device.SoundName | undefined;
      if (digit) {
        if (this._options.dialtonePlayer && !customSounds[digit]) {
          this._options.dialtonePlayer.play(digit);
        } else {
          this._soundcache.get(digit).play();
        }
      }
      if (sequence.length) {
        setTimeout(() => playNextDigit(), 200);
      }
    };
    playNextDigit();

    const dtmfSender = this._mediaHandler.getOrCreateDTMFSender();

    function insertDTMF(dtmfs: string[]) {
      if (!dtmfs.length) { return; }
      const dtmf: string | undefined = dtmfs.shift();

      if (dtmf && dtmf.length) {
        dtmfSender.insertDTMF(dtmf, DTMF_TONE_DURATION, DTMF_INTER_TONE_GAP);
      }

      setTimeout(insertDTMF.bind(null, dtmfs), DTMF_PAUSE_DURATION);
    }

    if (dtmfSender) {
      if (!('canInsertDTMF' in dtmfSender) || dtmfSender.canInsertDTMF) {
        this._log.info('Sending digits using RTCDTMFSender');
        // NOTE(mroberts): We can't just map 'w' to ',' since
        // RTCDTMFSender's pause duration is 2 s and Twilio's is more
        // like 500 ms. Instead, we will fudge it with setTimeout.
        insertDTMF(digits.split('w'));
        return;
      }

      this._log.info('RTCDTMFSender cannot insert DTMF');
    }

    // send pstream message to send DTMF
    this._log.info('Sending digits over PStream');

    if (this._pstream !== null && this._pstream.status !== 'disconnected') {
      this._pstream.dtmf(this.parameters.CallSid, digits);
    } else {
      const error = new GeneralErrors.ConnectionError('Could not send DTMF: Signaling channel is disconnected');
      this._log.debug('#error', error);
      this.emit('error', error);
    }
  }

  /**
   * Send a message to Twilio. Your backend application can listen for these
   * messages to allow communication between your frontend and backend applications.
   * <br/><br/>This feature is currently in Beta.
   * @param message - The message object to send.
   * @returns A voice event sid that uniquely identifies the message that was sent.
   */
  sendMessage(message: Call.Message): string {
    this._log.debug('.sendMessage', JSON.stringify(message));
    const { content, contentType, messageType } = message;

    if (typeof content === 'undefined' || content === null) {
      throw new InvalidArgumentError('`content` is empty');
    }

    if (typeof messageType !== 'string') {
      throw new InvalidArgumentError(
        '`messageType` must be a string.',
      );
    }

    if (messageType.length === 0) {
      throw new InvalidArgumentError(
        '`messageType` must be a non-empty string.',
      );
    }

    if (this._pstream === null) {
      throw new InvalidStateError(
        'Could not send CallMessage; Signaling channel is disconnected',
      );
    }

    const callSid = this.parameters.CallSid;
    if (typeof this.parameters.CallSid === 'undefined') {
      throw new InvalidStateError(
        'Could not send CallMessage; Call has no CallSid',
      );
    }

    const voiceEventSid = this._voiceEventSidGenerator();
    this._messages.set(voiceEventSid, { content, contentType, messageType, voiceEventSid });
    this._pstream.sendMessage(callSid, content, contentType, messageType, voiceEventSid);
    return voiceEventSid;
  }

  /**
   * Get the current {@link Call} status.
   */
  status(): Call.State {
    return this._status;
  }

  /**
   * String representation of {@link Call} instance.
   * @internal
   */
  toString = () => '[Twilio.Call instance]';

  /**
   * Check the volume passed, emitting a warning if one way audio is detected or cleared.
   * @param currentVolume - The current volume for this direction
   * @param streakFieldName - The name of the field on the {@link Call} object that tracks how many times the
   *   current value has been repeated consecutively.
   * @param lastValueFieldName - The name of the field on the {@link Call} object that tracks the most recent
   *   volume for this direction
   * @param direction - The directionality of this audio track, either 'input' or 'output'
   * @returns The current streak; how many times in a row the same value has been polled.
   */
  private _checkVolume(currentVolume: number, currentStreak: number,
                       lastValue: number, direction: 'input'|'output'): number {
    const wasWarningRaised: boolean = currentStreak >= 10;
    let newStreak: number = 0;

    if (lastValue === currentVolume) {
      newStreak = currentStreak;
    }

    if (newStreak >= 10) {
      this._emitWarning('audio-level-', `constant-audio-${direction}-level`, 10, newStreak, false);
    } else if (wasWarningRaised) {
      this._emitWarning('audio-level-', `constant-audio-${direction}-level`, 10, newStreak, true);
    }

    return newStreak;
  }

  /**
   * Clean up event listeners.
   */
  private _cleanupEventListeners(): void {
    const cleanup = () => {
      if (!this._pstream) { return; }

      this._pstream.removeListener('ack', this._onAck);
      this._pstream.removeListener('answer', this._onAnswer);
      this._pstream.removeListener('cancel', this._onCancel);
      this._pstream.removeListener('error', this._onSignalingError);
      this._pstream.removeListener('hangup', this._onHangup);
      this._pstream.removeListener('ringing', this._onRinging);
      this._pstream.removeListener('transportClose', this._onTransportClose);
      this._pstream.removeListener('connected', this._onConnected);
      this._pstream.removeListener('message', this._onMessageReceived);
    };

    // This is kind of a hack, but it lets us avoid rewriting more code.
    // Basically, there's a sequencing problem with the way PeerConnection raises
    // the
    //
    //   Cannot establish call. SDK is disconnected
    //
    // error in Call#accept. It calls PeerConnection#onerror, which emits
    // the error event on Call. An error handler on Call then calls
    // cleanupEventListeners, but then control returns to Call#accept. It's
    // at this point that we add a listener for the answer event that never gets
    // removed. setTimeout will allow us to rerun cleanup again, _after_
    // Call#accept returns.
    cleanup();
    setTimeout(cleanup, 0);
  }

  /**
   * Create the payload wrapper for a batch of metrics to be sent to Insights.
   */
  private _createMetricPayload(): Partial<Record<string, string|boolean>> {
    const payload: Partial<Record<string, string|boolean>> = {
      call_sid: this.parameters.CallSid,
      dscp: !!this._options.dscp,
      sdk_version: RELEASE_VERSION,
    };

    if (this._options.gateway) {
      payload.gateway = this._options.gateway;
    }

    payload.direction = this._direction;
    return payload;
  }

  /**
   * Disconnect the {@link Call}.
   * @param message - A message explaining why the {@link Call} is being disconnected.
   * @param wasRemote - Whether the disconnect was triggered locally or remotely.
   */
  private _disconnect(message?: string | null, wasRemote?: boolean): void {
    message = typeof message === 'string' ? message : null;

    if (this._status !== Call.State.Open
        && this._status !== Call.State.Connecting
        && this._status !== Call.State.Reconnecting
        && this._status !== Call.State.Ringing) {
      return;
    }

    this._log.info('Disconnecting...');

    // send pstream hangup message
    if (this._pstream !== null && this._pstream.status !== 'disconnected' && this._shouldSendHangup) {
      const callsid: string | undefined = this.parameters.CallSid || this.outboundConnectionId;
      if (callsid) {
        this._pstream.hangup(callsid, message);
      }
    }

    this._cleanupEventListeners();
    this._mediaHandler.close();

    if (!wasRemote) {
      this._publisher.info('connection', 'disconnected-by-local', null, this);
    }
  }

  private _emitWarning = (groupPrefix: string, warningName: string, threshold: number,
                          value: number|number[], wasCleared?: boolean, warningData?: RTCWarning): void => {
    const groupSuffix = wasCleared ? '-cleared' : '-raised';
    const groupName = `${groupPrefix}warning${groupSuffix}`;

    // Ignore constant input if the Call is muted (Expected)
    if (warningName === 'constant-audio-input-level' && this.isMuted()) {
      return;
    }

    let level = wasCleared ? 'info' : 'warning';

    // Avoid throwing false positives as warnings until we refactor volume metrics
    if (warningName === 'constant-audio-output-level') {
      level = 'info';
    }

    const payloadData: Record<string, any> = { threshold };

    if (value) {
      if (value instanceof Array) {
        payloadData.values = value.map((val: any) => {
          if (typeof val === 'number') {
            return Math.round(val * 100) / 100;
          }

          return value;
        });
      } else {
        payloadData.value = value;
      }
    }

    this._publisher.post(level, groupName, warningName, { data: payloadData }, this);

    if (warningName !== 'constant-audio-output-level') {
      const emitName = wasCleared ? 'warning-cleared' : 'warning';
      this._log.debug(`#${emitName}`, warningName);
      this.emit(emitName, warningName, warningData && !wasCleared ? warningData : null);
    }
  }

  /**
   * Transition to {@link CallStatus.Open} if criteria is met.
   */
  private _maybeTransitionToOpen(): void {
    const wasConnected = this._wasConnected;
    if (this._isAnswered) {
      this._onSignalingReconnected();
      this._signalingStatus = Call.State.Open;
      if (this._mediaHandler && this._mediaHandler.status === 'open') {
        this._status = Call.State.Open;
        if (!this._wasConnected) {
          this._wasConnected = true;
          this._log.debug('#accept');
          this.emit('accept', this);
        }
      }
    }
  }

  /**
   * Called when the {@link Call} receives an ack from signaling
   * @param payload
   */
  private _onAck = (payload: Record<string, any>): void => {
    const { acktype, callsid, voiceeventsid } = payload;
    if (this.parameters.CallSid !== callsid) {
      this._log.warn(`Received ack from a different callsid: ${callsid}`);
      return;
    }
    if (acktype === 'message') {
      this._onMessageSent(voiceeventsid);
    }
  }

  /**
   * Called when the {@link Call} is answered.
   * @param payload
   */
  private _onAnswer = (payload: Record<string, any>): void => {
    if (typeof payload.reconnect === 'string') {
      this._signalingReconnectToken = payload.reconnect;
    }

    // answerOnBridge=false will send a 183 which we need to catch in _onRinging when
    // the enableRingingState flag is disabled. In that case, we will receive a 200 after
    // the callee accepts the call firing a second `accept` event if we don't
    // short circuit here.
    if (this._isAnswered && this._status !== Call.State.Reconnecting) {
      return;
    }

    this._setCallSid(payload);
    this._isAnswered = true;
    this._maybeTransitionToOpen();
  }

  /**
   * Called when the {@link Call} is cancelled.
   * @param payload
   */
  private _onCancel = (payload: Record<string, any>): void => {
    // (rrowland) Is this check necessary? Verify, and if so move to pstream / VSP module.
    const callsid = payload.callsid;
    if (this.parameters.CallSid === callsid) {
      this._isCancelled = true;
      this._publisher.info('connection', 'cancel', null, this);
      this._cleanupEventListeners();
      this._mediaHandler.close();

      this._status = Call.State.Closed;
      this._log.debug('#cancel');
      this.emit('cancel');
      this._pstream.removeListener('cancel', this._onCancel);
    }
  }

  /**
   * Called when we receive a connected event from pstream.
   * Re-emits the event.
   */
  private _onConnected = (): void => {
    this._log.info('Received connected from pstream');
    if (this._signalingReconnectToken && this._mediaHandler.version) {
      this._pstream.reconnect(
        this._mediaHandler.version.getSDP(),
        this.parameters.CallSid,
        this._signalingReconnectToken,
      );
    }
  }

  /**
   * Called when the {@link Call} is hung up.
   * @param payload
   */
  private _onHangup = (payload: Record<string, any>): void => {
    if (this.status() === Call.State.Closed) {
      return;
    }

    /**
     *  see if callsid passed in message matches either callsid or outbound id
     *  call should always have either callsid or outbound id
     *  if no callsid passed hangup anyways
     */
    if (payload.callsid && (this.parameters.CallSid || this.outboundConnectionId)) {
      if (payload.callsid !== this.parameters.CallSid
          && payload.callsid !== this.outboundConnectionId) {
        return;
      }
    } else if (payload.callsid) {
      // hangup is for another call
      return;
    }

    this._log.info('Received HANGUP from gateway');
    if (payload.error) {
      const code = payload.error.code;
      const errorConstructor = getPreciseSignalingErrorByCode(
        this._options.enableImprovedSignalingErrorPrecision,
        code,
      );
      const error = typeof errorConstructor !== 'undefined'
        ? new errorConstructor(payload.error.message)
        : new GeneralErrors.ConnectionError('Error sent from gateway in HANGUP', payload.error);
      this._log.error('Received an error from the gateway:', error);
      this._log.debug('#error', error);
      this.emit('error', error);
    }
    this._shouldSendHangup = false;
    this._publisher.info('connection', 'disconnected-by-remote', null, this);
    this._disconnect(null, true);
    this._cleanupEventListeners();
  }

  /**
   * Called when there is a media failure.
   * Manages all media-related states and takes action base on the states
   * @param type - Type of media failure
   */
  private _onMediaFailure = (type: Call.MediaFailure): void => {
    const {
      ConnectionDisconnected, ConnectionFailed, IceGatheringFailed, LowBytes,
    } = Call.MediaFailure;

    // These types signifies the end of a single ICE cycle
    const isEndOfIceCycle = type === ConnectionFailed || type === IceGatheringFailed;

    // All browsers except chrome doesn't update pc.iceConnectionState and pc.connectionState
    // after issuing an ICE Restart, which we use to determine if ICE Restart is complete.
    // Since we cannot detect if ICE Restart is complete, we will not retry.
    if (!isChrome(window, window.navigator) && type === ConnectionFailed) {
      return this._mediaHandler.onerror(MEDIA_DISCONNECT_ERROR);
    }

    // Ignore subsequent requests if ice restart is in progress
    if (this._mediaStatus === Call.State.Reconnecting) {

      // This is a retry. Previous ICE Restart failed
      if (isEndOfIceCycle) {

        // We already exceeded max retry time.
        if (Date.now() - this._mediaReconnectStartTime > BACKOFF_CONFIG.max) {
          this._log.warn('Exceeded max ICE retries');
          return this._mediaHandler.onerror(MEDIA_DISCONNECT_ERROR);
        }

        // Issue ICE restart with backoff
        try {
          this._mediaReconnectBackoff.backoff();
        } catch (error) {
          // Catch and ignore 'Backoff in progress.' errors. If a backoff is
          // ongoing and we try to start another one, there shouldn't be a
          // problem.
          if (!(error.message && error.message === 'Backoff in progress.')) {
            throw error;
          }
        }
      }

      return;
    }

    const pc = this._mediaHandler.version.pc;
    const isIceDisconnected = pc && pc.iceConnectionState === 'disconnected';
    const hasLowBytesWarning = this._monitor.hasActiveWarning('bytesSent', 'min')
      || this._monitor.hasActiveWarning('bytesReceived', 'min');

    // Only certain conditions can trigger media reconnection
    if ((type === LowBytes && isIceDisconnected)
      || (type === ConnectionDisconnected && hasLowBytesWarning)
      || isEndOfIceCycle) {

      const mediaReconnectionError = new MediaErrors.ConnectionError('Media connection failed.');
      this._log.warn('ICE Connection disconnected.');
      this._publisher.warn('connection', 'error', mediaReconnectionError, this);
      this._publisher.info('connection', 'reconnecting', null, this);

      this._mediaReconnectStartTime = Date.now();
      this._status = Call.State.Reconnecting;
      this._mediaStatus = Call.State.Reconnecting;
      this._mediaReconnectBackoff.reset();
      this._mediaReconnectBackoff.backoff();

      this._log.debug('#reconnecting');
      this.emit('reconnecting', mediaReconnectionError);
    }
  }

  /**
   * Called when media call is restored
   */
  private _onMediaReconnected = (): void => {
    // Only trigger once.
    // This can trigger on pc.onIceConnectionChange and pc.onConnectionChange.
    if (this._mediaStatus !== Call.State.Reconnecting) {
      return;
    }
    this._log.info('ICE Connection reestablished.');
    this._mediaStatus = Call.State.Open;

    if (this._signalingStatus === Call.State.Open) {
      this._publisher.info('connection', 'reconnected', null, this);
      this._log.debug('#reconnected');
      this.emit('reconnected');
      this._status = Call.State.Open;
    }
  }

  /**
   * Raised when a Call receives a message from the backend.
   * @param payload - A record representing the payload of the message from the
   * Twilio backend.
   */
  private _onMessageReceived = (payload: Record<string, any>): void => {
    const { callsid, content, contenttype, messagetype, voiceeventsid } = payload;

    if (this.parameters.CallSid !== callsid) {
      this._log.warn(`Received a message from a different callsid: ${callsid}`);
      return;
    }
    const data = {
      content,
      contentType: contenttype,
      messageType: messagetype,
      voiceEventSid: voiceeventsid,
    };
    this._publisher.info('call-message', messagetype, {
      content_type: contenttype,
      event_type: 'received',
      voice_event_sid: voiceeventsid,
    }, this);
    this._log.debug('#messageReceived', JSON.stringify(data));
    this.emit('messageReceived', data);
  }

  /**
   * Raised when a Call receives an 'ack' with an 'acktype' of 'message.
   * This means that the message sent via sendMessage API has been received by the signaling server.
   * @param voiceEventSid
   */
  private _onMessageSent = (voiceEventSid: string): void => {
    if (!this._messages.has(voiceEventSid)) {
      this._log.warn(`Received a messageSent with a voiceEventSid that doesn't exists: ${voiceEventSid}`);
      return;
    }
    const message = this._messages.get(voiceEventSid);
    this._messages.delete(voiceEventSid);
    this._publisher.info('call-message', message?.messageType, {
      content_type: message?.contentType,
      event_type: 'sent',
      voice_event_sid: voiceEventSid,
    }, this);
    this._log.debug('#messageSent', JSON.stringify(message));
    this.emit('messageSent', message);
  }

  /**
   * When we get a RINGING signal from PStream, update the {@link Call} status.
   * @param payload
   */
  private _onRinging = (payload: Record<string, any>): void => {
    this._setCallSid(payload);

    // If we're not in 'connecting' or 'ringing' state, this event was received out of order.
    if (this._status !== Call.State.Connecting && this._status !== Call.State.Ringing) {
      return;
    }

    const hasEarlyMedia = !!payload.sdp;
    this._status = Call.State.Ringing;
    this._publisher.info('connection', 'outgoing-ringing', { hasEarlyMedia }, this);
    this._log.debug('#ringing');
    this.emit('ringing', hasEarlyMedia);
  }

  /**
   * Called each time StatsMonitor emits a sample.
   * Emits stats event and batches the call stats metrics and sends them to Insights.
   * @param sample
   */
  private _onRTCSample = (sample: RTCSample): void => {
    const callMetrics: Call.CallMetrics = {
      ...sample,
      inputVolume: this._latestInputVolume,
      outputVolume: this._latestOutputVolume,
    };

    this._codec = callMetrics.codecName;

    this._metricsSamples.push(callMetrics);
    if (this._metricsSamples.length >= METRICS_BATCH_SIZE) {
      this._publishMetrics();
    }

    this.emit('sample', sample);
  }

  /**
   * Called when an 'error' event is received from the signaling stream.
   */
  private _onSignalingError = (payload: Record<string, any>): void => {
    const { callsid, voiceeventsid, error } = payload;
    if (this.parameters.CallSid !== callsid) {
      this._log.warn(`Received an error from a different callsid: ${callsid}`);
      return;
    }
    if (voiceeventsid && this._messages.has(voiceeventsid)) {
      // Do not emit an error here. Device is handling all signaling related errors.
      this._messages.delete(voiceeventsid);
      this._log.warn(`Received an error while sending a message.`, payload);

      this._publisher.error('call-message', 'error', {
        code: error.code,
        message: error.message,
        voice_event_sid: voiceeventsid,
      }, this);

      let twilioError;
      const errorConstructor = getPreciseSignalingErrorByCode(
        !!this._options.enableImprovedSignalingErrorPrecision,
        error.code,
      );

      if (typeof errorConstructor !== 'undefined') {
        twilioError = new errorConstructor(error);
      }

      if (!twilioError) {
        this._log.error('Unknown Call Message Error: ', error);
        twilioError = new GeneralErrors.UnknownError(error.message, error);
      }

      this._log.debug('#error', error, twilioError);
      this.emit('error', twilioError);
    }
   }

  /**
   * Called when signaling is restored
   */
  private _onSignalingReconnected = (): void => {
    if (this._signalingStatus !== Call.State.Reconnecting) {
      return;
    }
    this._log.info('Signaling Connection reestablished.');

    this._signalingStatus = Call.State.Open;

    if (this._mediaStatus === Call.State.Open) {
      this._publisher.info('connection', 'reconnected', null, this);
      this._log.debug('#reconnected');
      this.emit('reconnected');
      this._status = Call.State.Open;
    }
  }

  /**
   * Called when we receive a transportClose event from pstream.
   * Re-emits the event.
   */
  private _onTransportClose = (): void => {
    this._log.error('Received transportClose from pstream');
    this._log.debug('#transportClose');
    this.emit('transportClose');
    if (this._signalingReconnectToken) {
      this._status = Call.State.Reconnecting;
      this._signalingStatus = Call.State.Reconnecting;
      this._log.debug('#reconnecting');
      this.emit('reconnecting', new SignalingErrors.ConnectionDisconnected());
    } else {
      this._status = Call.State.Closed;
      this._signalingStatus = Call.State.Closed;
    }
  }

  /**
   * Post an event to Endpoint Analytics indicating that the end user
   *   has ignored a request for feedback.
   */
  private _postFeedbackDeclined(): Promise<void> {
    return this._publisher.info('feedback', 'received-none', null, this, true);
  }

  /**
   * Publish the current set of queued metrics samples to Insights.
   */
  private _publishMetrics(): void {
    if (this._metricsSamples.length === 0) {
      return;
    }

    this._publisher.postMetrics(
      'quality-metrics-samples', 'metrics-sample', this._metricsSamples.splice(0), this._createMetricPayload(), this,
    ).catch((e: any) => {
      this._log.warn('Unable to post metrics to Insights. Received error:', e);
    });
  }

  /**
   * Re-emit an StatsMonitor warning as a {@link Call}.warning or .warning-cleared event.
   * @param warningData
   * @param wasCleared - Whether this is a -cleared or -raised event.
   */
  private _reemitWarning = (warningData: Record<string, any>, wasCleared?: boolean): void => {
    const groupPrefix = /^audio/.test(warningData.name) ?
      'audio-level-' : 'network-quality-';

    const warningPrefix = WARNING_PREFIXES[warningData.threshold.name];

    /**
     * NOTE: There are two "packet-loss" warnings: `high-packet-loss` and
     * `high-packets-lost-fraction`, so in this case we need to use a different
     * `WARNING_NAME` mapping.
     */
    let warningName: string | undefined;
    if (warningData.name in MULTIPLE_THRESHOLD_WARNING_NAMES) {
      warningName = MULTIPLE_THRESHOLD_WARNING_NAMES[warningData.name][warningData.threshold.name];
    } else if (warningData.name in WARNING_NAMES) {
      warningName = WARNING_NAMES[warningData.name];
    }

    const warning: string = warningPrefix + warningName;

    this._emitWarning(groupPrefix, warning, warningData.threshold.value,
                      warningData.values || warningData.value, wasCleared, warningData);
  }

  /**
   * Re-emit an StatsMonitor warning-cleared as a .warning-cleared event.
   * @param warningData
   */
  private _reemitWarningCleared = (warningData: Record<string, any>): void => {
    this._reemitWarning(warningData, true);
  }

  /**
   * Set the CallSid
   * @param payload
   */
  private _setCallSid(payload: Record<string, string>): void {
    const callSid = payload.callsid;
    if (!callSid) { return; }

    this.parameters.CallSid = callSid;
    this._mediaHandler.callSid = callSid;
  }
}

/**
 * @mergeModuleWith Call
 */
namespace Call {
  /**
   * Emitted when the {@link Call} is accepted.
   * @event
   * @param call - The {@link Call}.
   * @example
   * ```ts
   * call.on('accept', (call) => { });
   * ```
   */
  export declare function acceptEvent(call: Call): void;

  /**
   * Emitted after the HTMLAudioElement for the remote audio is created.
   * @event
   * @param remoteAudio - The HTMLAudioElement.
   * @example
   * ```ts
   * call.on('audio', (remoteAudio) => { });
   * ```
   */
  export declare function audioEvent(remoteAudio: HTMLAudioElement): void;

  /**
   * Emitted when the {@link Call} is canceled.
   * @event
   * @example
   * ```ts
   * call.on('cancel', () => { });
   * ```
   */
  export declare function cancelEvent(): void;

  /**
   * Emitted when the {@link Call} is disconnected.
   * @event
   * @param call - The {@link Call}.
   * @example
   * ```ts
   * call.on('disconnect', (call) => { });
   * ```
   */
  export declare function disconnectEvent(call: Call): void;

  /**
   * Emitted when the {@link Call} receives an error.
   * @event
   * @param error
   * @example
   * ```ts
   * call.on('error', (error) => { });
   * ```
   */
  export declare function errorEvent(error: TwilioError): void;

  /**
   * Emitted when a Call receives a message from the backend.
   * <br/><br/>This feature is currently in Beta.
   * @event
   * @param message - A message object representing the payload
   * that was received from the Twilio backend.
   */
  export declare function messageReceivedEvent(message: Call.Message): void;

  /**
   * Emitted after calling the {@link Call.sendMessage} API.
   * This event indicates that Twilio has received the message.
   * <br/><br/>This feature is currently in Beta.
   * @event
   * @param message - A message object that was sent to the Twilio backend.
   */
  export declare function messageSentEvent(message: Call.Message): void;

  /**
   * Emitted when the {@link Call} is muted or unmuted.
   * @event
   * @param isMuted - Whether the {@link Call} is muted.
   * @param call - The {@link Call}.
   * @example
   * ```ts
   * call.on('mute', (isMuted, call) => { });
   * ```
   */
  export declare function muteEvent(isMuted: boolean, call: Call): void;

  /**
   * Emitted when the {@link Call} has regained media connectivity.
   * @event
   * @example
   * ```ts
   * call.on('reconnected', () => { })
   * ```
   */
  export declare function reconnectedEvent(): void;

  /**
   * Emitted when the {@link Call} has lost media connectivity and is reconnecting.
   * @event
   * @param error - The {@link TwilioError} that caused the media connectivity loss
   * @example
   * ```ts
   * call.on('reconnecting', (error) => { });
   * ```
   */
  export declare function reconnectingEvent(error: TwilioError): void;

  /**
   * Emitted when the {@link Call} is rejected.
   * @event
   * @example
   * ```ts
   * call.on('reject', () => { })
   * ```
   */
  export declare function rejectEvent(): void;

  /**
   * Emitted when the {@link Call} has entered the `ringing` state.
   * When using the Dial verb with `answerOnBridge=true`, the ringing state will begin when
   * the callee has been notified of the call and will transition into open after the callee accepts the call,
   * or closed if the call is rejected or cancelled.
   * @event
   * @param hasEarlyMedia - Denotes whether there is early media available from the callee.
   * If `true`, the Client SDK will automatically play the early media. Sometimes this is ringing,
   * other times it may be an important message about the call. If `false`, there is no remote media to play,
   * so the application may want to play its own outgoing ringtone sound.
   * @example
   * ```ts
   * call.on('ringing', (hasEarlyMedia) => { });
   * ```
   */
  export declare function ringingEvent(hasEarlyMedia: boolean): void;

  /**
   * Emitted when the {@link Call} gets a webrtc sample object.
   * This event is published every second.
   * @event
   * @param sample
   * @example
   * ```ts
   * call.on('sample', (sample) => { });
   * ```
   */
  export declare function sampleEvent(sample: RTCSample): void;

  /**
   * Emitted every 50ms with the current input and output volumes, as a percentage of maximum
   * volume, between -100dB and -30dB. Represented by a floating point number.
   * @event
   * @param inputVolume - A floating point number between 0.0 and 1.0 inclusive.
   * @param outputVolume - A floating point number between 0.0 and 1.0 inclusive.
   * @example
   * ```ts
   * call.on('volume', (inputVolume, outputVolume) => { });
   * ```
   */
  export declare function volumeEvent(inputVolume: number, outputVolume: number): void;

  /**
   * Emitted when the SDK detects a drop in call quality or other conditions that may indicate
   * the user is having trouble with the call. You can implement callbacks on these events to
   * alert the user of an issue.
   *
   * To alert the user that an issue has been resolved, you can listen for the `warning-cleared` event,
   * which indicates that a call quality metric has returned to normal.
   *
   * For a full list of conditions that will raise a warning event, check the
   * [Voice Insights SDK Events Reference](https://www.twilio.com/docs/voice/voice-insights/api/call/details-sdk-call-quality-events) page.
   *
   * @event
   * @param name - The name of the warning
   * @param data - An object containing data on the warning
   * @example
   * ```ts
   * call.on('warning', (name, data) => { });
   * ```
   */
  export declare function warningEvent(name: string, data: any): void;

  /**
   * Emitted when a call quality metric has returned to normal.
   * You can listen for this event to update the user when a call quality issue has been resolved.
   *
   * @event
   * @param name - The name of the warning
   * @example
   * ```ts
   * call.on('warning-cleared', (name) => { });
   * ```
   */
  export declare function warningClearedEvent(name: string): void;

  /**
   * Possible states of the {@link Call}.
   */
  export enum State {
    Closed = 'closed',
    Connecting = 'connecting',
    Open = 'open',
    Pending = 'pending',
    Reconnecting = 'reconnecting',
    Ringing = 'ringing',
  }

  /**
   * Different issues that may have been experienced during a call, that can be
   * reported to Twilio Insights via {@link Call}.postFeedback().
   */
  export enum FeedbackIssue {
    AudioLatency = 'audio-latency',
    ChoppyAudio = 'choppy-audio',
    DroppedCall = 'dropped-call',
    Echo = 'echo',
    NoisyCall = 'noisy-call',
    OneWayAudio = 'one-way-audio',
  }

  /**
   * A rating of call quality experienced during a call, to be reported to Twilio Insights
   * via {@link Call}.postFeedback().
   */
  export enum FeedbackScore {
    One = 1,
    Two,
    Three,
    Four,
    Five,
  }

  /**
   * The directionality of the {@link Call}, whether incoming or outgoing.
   */
  export enum CallDirection {
    Incoming = 'INCOMING',
    Outgoing = 'OUTGOING',
  }

  /**
   * Valid audio codecs to use for the media connection.
   */
  export enum Codec {
    Opus = 'opus',
    PCMU = 'pcmu',
  }

  /**
   * Possible ICE Gathering failures
   */
  export enum IceGatheringFailureReason {
    None = 'none',
    Timeout = 'timeout',
  }

  /**
   * Possible media failures
   */
  export enum MediaFailure {
    ConnectionDisconnected = 'ConnectionDisconnected',
    ConnectionFailed = 'ConnectionFailed',
    IceGatheringFailed = 'IceGatheringFailed',
    LowBytes = 'LowBytes',
  }

  /**
   * Options to be used to acquire media tracks and connect media.
   */
  export interface AcceptOptions {
    /**
     * An RTCConfiguration to pass to the RTCPeerConnection constructor.
     */
    rtcConfiguration?: RTCConfiguration;

    /**
     * MediaStreamConstraints to pass to getUserMedia when making or accepting a Call.
     */
    rtcConstraints?: MediaStreamConstraints;
  }

  /**
   * A CallerInfo provides caller verification information.
   */
  export interface CallerInfo {
    /**
     * Whether or not the caller's phone number has been verified by
     * Twilio using SHAKEN/STIR validation. True if the caller has
     * been validated at level 'A', false if the caller has been
     * verified at any lower level or has failed validation.
     */
    isVerified: boolean;
  }

  /**
   * Mandatory config options to be passed to the {@link Call} constructor.
   * @internal
   */
  export interface Config {
    /**
     * An AudioHelper instance to be used for input/output devices.
     */
    audioHelper: IAudioHelper;

    /**
     * Whether or not the browser uses unified-plan SDP by default.
     */
    isUnifiedPlanDefault: boolean;

    /**
     * A function to be called after {@link Call.ignore} is called.
     */
    onIgnore: () => void;

    /**
     * The PStream instance to use for Twilio call signaling.
     */
    pstream: IPStream;

    /**
     * An EventPublisher instance to use for publishing events
     */
    publisher: IPublisher;

    /**
     * A Map of Sounds to play.
     */
    soundcache: Map<Device.SoundName, ISound>;
  }

  /**
   * A Call Message represents the data that is being transferred between
   * Twilio and the SDK.
   */
  export interface Message {
    /**
     * The content of the message which should match the contentType parameter.
     */
    content: any;

    /**
     * The MIME type of the content. The default value is application/json
     * and is the only contentType that is supported at the moment.
     */
    contentType?: string;

    /**
     * The type of message. Currently, only 'user-defined-message' is supported.
     * More message types will be added in the future.
     * See [call resource](https://www.twilio.com/docs/voice/api/call-resource) documentation for more details.
     */
    messageType: string;

    /**
     * An autogenerated id that uniquely identifies the instance of this message.
     * This is not required when sending a message from the SDK as this is autogenerated.
     * But it will be available after the message is sent, or when a message is received.
     */
    voiceEventSid?: string;
  }

  /**
   * Options to be passed to the {@link Call} constructor.
   * @internal
   */
  export interface Options {
    /**
     * A method to call before Call.accept is processed.
     */
    beforeAccept?: (call: Call) => void;

    /**
     * Custom format context parameters associated with this call.
     */
    callParameters?: Record<string, string>;

    /**
     * An ordered array of codec names, from most to least preferred.
     */
    codecPreferences?: Codec[];

    /**
     * A mapping of custom sound URLs by sound name.
     */
    customSounds?: Partial<Record<Device.SoundName, string>>;

    /**
     * A DialTone player, to play mock DTMF sounds.
     */
    dialtonePlayer?: DialtonePlayer;

    /**
     * Whether or not to enable DSCP.
     */
    dscp?: boolean;

    enableImprovedSignalingErrorPrecision: boolean;

    /**
     * Experimental feature.
     * Force Chrome's ICE agent to use aggressive nomination when selecting a candidate pair.
     */
    forceAggressiveIceNomination?: boolean;

    /**
     * The gateway currently connected to.
     */
    gateway?: string;

    /**
     * A method that returns the current input MediaStream set on {@link Device}.
     */
    getInputStream?: () => MediaStream;

    /**
     * A method that returns the current SinkIDs set on {@link Device}.
     */
    getSinkIds?: () => string[];

    /**
     * The maximum average audio bitrate to use, in bits per second (bps) based on
     * [RFC-7587 7.1](https://tools.ietf.org/html/rfc7587#section-7.1). By default, the setting
     * is not used. If you specify 0, then the setting is not used. Any positive integer is allowed,
     * but values outside the range 6000 to 510000 are ignored and treated as 0. The recommended
     * bitrate for speech is between 8000 and 40000 bps as noted in
     * [RFC-7587 3.1.1](https://tools.ietf.org/html/rfc7587#section-3.1.1).
     */
    maxAverageBitrate?: number;

    /**
     * Custom MediaHandler (PeerConnection) constructor.
     */
    MediaHandler?: IPeerConnection;

    /**
     * Overrides the native MediaStream class.
     */
    MediaStream?: any;

    /**
     * The offer SDP, if this is an incoming call.
     */
    offerSdp?: string | null;

    /**
     * Whether this is a preflight call or not
     */
    preflight?: boolean;

    /**
     * The callSid to reconnect to.
     */
    reconnectCallSid?: string;

    /**
     * A reconnect token for the {@link Call}. Passed in for incoming {@link Calls}.
     */
    reconnectToken?: string;

    /**
     * An RTCConfiguration to pass to the RTCPeerConnection constructor.
     */
    rtcConfiguration?: RTCConfiguration;

    /**
     * RTC Constraints to pass to getUserMedia when making or accepting a Call.
     * The format of this object depends on browser.
     */
    rtcConstraints?: MediaStreamConstraints;

    /**
     * The RTCPeerConnection passed to {@link Device} on setup.
     */
    RTCPeerConnection?: any;

    /**
     * Whether the disconnect sound should be played.
     */
    shouldPlayDisconnect?: () => boolean;

    /**
     * An override for the StatsMonitor dependency.
     */
    StatsMonitor?: new () => StatsMonitor;

    /**
     * TwiML params for the call. May be set for either outgoing or incoming calls.
     */
    twimlParams?: Record<string, any>;

    /**
     * Voice event SID generator.
     */
    voiceEventSidGenerator?: () => string;
  }

  /**
   * Call metrics published to Insight Metrics.
   * This include rtc samples and audio information.
   * @internal
   */
  export interface CallMetrics extends RTCSample {
    /**
     * Percentage of maximum volume, between 0.0 to 1.0, representing -100 to -30 dB.
     */
    inputVolume: number;

    /**
     * Percentage of maximum volume, between 0.0 to 1.0, representing -100 to -30 dB.
     */
    outputVolume: number;
  }
}

function generateTempCallSid() {
  return 'TJSxxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    /* tslint:disable:no-bitwise */
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    /* tslint:enable:no-bitwise */
    return v.toString(16);
  });
}

export default Call;
