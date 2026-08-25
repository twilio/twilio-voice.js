import { EventEmitter } from 'events';
import {
  Invitation,
  Inviter,
  InviterOptions,
  Registerer,
  RegistererState,
  RequestPendingError,
  SessionDescriptionHandler,
  Session,
  SessionInviteOptions,
  SessionState,
  URI,
  UserAgent,
} from 'sip.js';
import Backoff from '../backoff';
import { GeneralErrors, SignalingErrors } from '../errors';
import Log from '../log';
import {
  AnswerConfig,
  DtmfConfig,
  HangupConfig,
  IceRestartConfig,
  InviteConfig,
  ReconnectConfig,
  SignalingAdapter,
  SignalingAdapterStatus,
  SendMessageConfig,
} from './signalingadapter';
import {
  IPeerConnection,
  SipSessionDescriptionHandler,
} from './sipsessiondescriptionhandler';
import { CloseCodeRecorder, installCloseCodeHook } from './sipclosecodehook';

// Reconnect backoff policy mirrors WSTransport's two-tier model:
// - Preferred: short retries on the same URI for a bounded window (15s).
// - Primary: unbounded fallback retries with a higher delay cap.
// Twilio's SIP-over-WS exposes a single URI today, so primary retries the
// same URI. Multi-edge SIP is on the roadmap; when it lands, primary is
// the tier that should rotate through fallback edges (see WSTransport).
const PREFERRED_BACKOFF_CONFIG = { factor: 2.0, jitter: 0.40, min: 100, max: 1000 };
const PRIMARY_BACKOFF_CONFIG = { factor: 2.0, jitter: 0.40, min: 100, max: 20000 };
const MAX_PREFERRED_DURATION_MS = 15000;
const MAX_PRIMARY_DURATION_MS = Infinity;

// SIP.js's socket connect timeout, pinned to its default.
const SIP_CONNECTION_TIMEOUT_MS = 5000;
// Backstop for a reconnect() that never settles. Must be longer, or we abandon
// sockets SIP.js is still connecting and the retry just re-attaches.
const CONNECT_TIMEOUT_MS = SIP_CONNECTION_TIMEOUT_MS + 1000;
// How long a connection must stay open to count as successful and reset the
// backoff counters. Without the gate a flapping connection restarts from `min`
// every time and hammers the server.
const CONNECT_SUCCESS_TIMEOUT_MS = 10000;
// Close codes meaning the server was unreachable rather than shut down
// cleanly. 1006: abnormal close. 1015: TLS handshake failure.
const ABNORMAL_CLOSE_CODES = [1006, 1015];

type SipSendMessageConfig = Pick<SendMessageConfig, 'content' | 'contentType' | 'voiceEventSid'>;

/**
 * Options for constructing a SipSignalingAdapter.
 */
export interface SipSignalingAdapterOptions {
  sipDomain: string;
  sipUri: string;
  sipTransportServer: string;
  credentials: { username: string; password: string };
  region?: string;
  /**
   * Factory override for testing.
   */
  createUserAgent?: (...args: ConstructorParameters<typeof UserAgent>) => UserAgent;
  /**
   * Factory override for testing.
   */
  createRegisterer?: (userAgent: UserAgent) => Registerer;
  /**
   * Factory override for testing.
   */
  createInviter?: (userAgent: UserAgent, targetURI: URI, options?: InviterOptions) => Inviter;
}

/**
 * Binding registered on the adapter before a SIP.js Session is created,
 * carrying everything the SDH factory needs to construct a real SDH.
 */
interface SdhBinding {
  callSid: string;
  peerConnection: IPeerConnection;
  rtcConfiguration?: RTCConfiguration;
}

/**
 * Per-invocation handle for an in-flight ICE-restart re-INVITE. Captured by
 * the requestDelegate closures so onAccept/onReject can act on the specific
 * invite that produced them, even after the adapter has moved on.
 */
interface InflightIceRestart {
  callSid: string;
  stale: boolean;
}

/**
 * A send deferred while the transport was down.
 */
interface QueuedMessage {
  callSid: string;
  send: () => void;
}

/**
 * Fallback SDH returned from the factory when no binding is registered
 * for a session. Every operation rejects with a clear error so SIP.js's
 * Promise-based accept/invite paths fail cleanly instead of crashing
 * synchronously inside setupSessionDescriptionHandler.
 */
function createUnboundSdh(): SessionDescriptionHandler {
  const reject = () => Promise.reject(
    new Error('SipSignalingAdapter: no PeerConnection binding registered for SIP session'),
  );
  return {
    getDescription: reject,
    hasDescription: () => false,
    setDescription: reject,
    sendDtmf: () => false,
    close: () => { /* no-op */ },
  };
}

/**
 * SignalingAdapter implementation backed by SIP.js. Handles WebSocket
 * connection, SIP registration lifecycle, and call-level signaling
 * (INVITE, BYE, re-INVITE, INFO, MESSAGE).
 */
export class SipSignalingAdapter extends EventEmitter implements SignalingAdapter {
  private _log: Log = new Log('SipSignalingAdapter');
  private _options: SipSignalingAdapterOptions;
  private _inboundSessions: Map<string, Invitation> = new Map();
  private _outboundSessions: Map<string, Inviter> = new Map();
  private _pendingInvitations: Map<string, Invitation> = new Map();
  private _sessionBindings: WeakMap<Session, SdhBinding> = new WeakMap();
  private _registerer: any | null = null;
  private _region: string | undefined;
  private _status: SignalingAdapterStatus = 'disconnected';
  private _token: string = '';
  private _uri: string;
  private _userAgent: any | null = null;
  private _backoff: { preferred: Backoff, primary: Backoff } | null = null;
  private _backoffStartTime: { preferred: number | null, primary: number | null } = {
    preferred: null,
    primary: null,
  };
  private _isReconnecting: boolean = false;
  // Backstop for the attempt currently in flight, so destroy() can cancel it.
  private _connectTimeout: NodeJS.Timeout | null = null;
  private _wasRegistered: boolean = false;
  // Timestamp of the most recent connect, or null while down. Feeds the
  // CONNECT_SUCCESS_TIMEOUT_MS check.
  private _timeOpened: number | null = null;
  // Invites issued while the transport was down, replayed on reconnect.
  // Mirrors PStream's per-method retry policy: invite queues, ICE-restart
  // re-INVITE defers via _pendingIceRestartRecovery instead. Keyed by callSid
  // so hangup() can drop an entry cancelled before the flush.
  private _messageQueue: QueuedMessage[] = [];
  // Populated by the close-code hook installed over the SIP.js transport.
  private _closeCodeRecorder: CloseCodeRecorder = {};
  // One entry per in-flight ICE-restart re-INVITE, captured by its
  // requestDelegate closures. On disconnect each is marked stale so its
  // eventual rejection (typically a 408) is suppressed rather than tearing the
  // call down. Entries survive the reconnect, so even a late SIP.js Timer B
  // rejection (~32s) is still suppressed.
  private _inFlightIceRestarts: Set<InflightIceRestart> = new Set();
  // Call SIDs whose re-INVITE was orphaned by a disconnect and need an
  // iceRestartNeeded emit once the transport is back. Separate from
  // _inFlightIceRestarts so onAccept/onReject don't interfere.
  private _pendingIceRestartRecovery: Set<string> = new Set();

  constructor(options: SipSignalingAdapterOptions) {
    super();
    this._options = options;
    this._uri = options.sipTransportServer;
    this._region = options.region;

    const createUA = options.createUserAgent || ((...args: ConstructorParameters<typeof UserAgent>) => new UserAgent(...args));

    const sipUri = UserAgent.makeURI(options.sipUri);
    if (!sipUri) {
      throw new Error(`Failed to create SIP URI from "${options.sipUri}"`);
    }

    this._userAgent = createUA({
      uri: sipUri,
      transportOptions: {
        server: options.sipTransportServer,
        reconnectionAttempts: 0,
        // In SECONDS. See SIP_CONNECTION_TIMEOUT_MS.
        connectionTimeout: SIP_CONNECTION_TIMEOUT_MS / 1000,
      },
      authorizationUsername: options.credentials.username,
      authorizationPassword: options.credentials.password,
      sessionDescriptionHandlerFactory: (session: Session) => {
        // Throwing here would bubble through SIP.js's synchronous setup path
        // (session.js setupSessionDescriptionHandler) in non-obvious ways. If
        // the binding is missing (programming error — answer() forgot to bind,
        // or SIP.js calls the factory earlier than expected), return a
        // fail-safe SDH that rejects every Promise. SIP.js catches rejections
        // in setOfferAndGetAnswer/getOffer, so the session terminates cleanly.
        const binding = this._sessionBindings.get(session);
        if (!binding) {
          this._log.error('sessionDescriptionHandlerFactory: no binding for session');
          return createUnboundSdh();
        }
        return new SipSessionDescriptionHandler(
          binding.peerConnection,
          binding.callSid,
          binding.rtcConfiguration,
        );
      },
      delegate: {
        onConnect: () => this._onTransportConnect(),
        onDisconnect: (error?: Error) => this._onTransportDisconnect(error),
        onInvite: (invitation: Invitation) => this._handleIncomingInvite(invitation),
      },
    });

    // Installed once: SIP.js reuses the same Transport across reconnect().
    this._closeCodeRecorder = installCloseCodeHook(this._userAgent.transport, this._log);

    this._userAgent.start().catch((error: Error) => {
      this._log.error('Failed to start UserAgent', error);
      this.emit('error', { error: { code: 31000, message: error.message } });
    });
  }

  // ---------------------------------------------------------------------------
  // SignalingAdapter properties
  // ---------------------------------------------------------------------------

  get gateway(): string | undefined {
    return undefined;
  }

  get region(): string | undefined {
    return this._region;
  }

  get status(): SignalingAdapterStatus {
    return this._status;
  }

  get uri(): string {
    return this._uri;
  }

  // ---------------------------------------------------------------------------
  // Connection & registration lifecycle
  // ---------------------------------------------------------------------------

  setToken(token: string): void {
    this._log.debug('setToken called (stored but not used for SIP digest auth)');
    this._token = token;
  }

  register(mediaCapabilities: Record<string, any>): void {
    if (!this._userAgent) {
      this._log.warn('Cannot register: UserAgent not initialized');
      return;
    }

    const isPresent = mediaCapabilities?.audio === true;
    this._wasRegistered = isPresent;

    // Defer registerer ops while reconnecting; _onTransportConnect will re-create
    // the registerer based on _wasRegistered once the transport is back.
    if (this._isReconnecting) {
      this._log.debug('Skipping register call while reconnecting');
      return;
    }

    if (!isPresent) {
      if (this._registerer) {
        this._registerer.unregister().catch((error: Error) => {
          this._log.error('SIP unregister failed', error);
          this._status = 'offline';
          this.emit('offline', this);
        });
      }
      return;
    }

    // SIP.js Registerer handles refresh internally, so skip if one already exists.
    if (this._registerer) {
      this._log.debug('Registerer already exists, skipping duplicate register call');
      return;
    }

    this._createAndStartRegisterer();
  }

  private _createAndStartRegisterer(): void {
    if (!this._userAgent) {
      return;
    }

    const createReg = this._options.createRegisterer
      || ((userAgent: UserAgent) => new Registerer(userAgent));
    this._registerer = createReg(this._userAgent);

    this._registerer.stateChange.addListener((state: RegistererState) => {
      switch (state) {
        case RegistererState.Registered:
          this._log.info('SIP registered');
          this._status = 'ready';
          this.emit('ready');
          break;
        case RegistererState.Unregistered:
          this._log.info('SIP unregistered');
          if (this._status !== 'disconnected') {
            this._status = 'offline';
            this.emit('offline', this);
          }
          break;
        case RegistererState.Terminated:
          this._log.info('Registerer terminated');
          break;
      }
    });

    this._registerer.register().catch((error: Error) => {
      this._log.error('SIP registration failed', error);
      this._registerer?.dispose().catch((err: Error) => {
        this._log.warn('Error disposing registerer after failed registration', err);
      });
      this._registerer = null;
      this._status = 'offline';
      this.emit('error', {
        error: {
          code: 31201,
          message: `SIP registration failed: ${error.message}`,
        },
      });
      this.emit('offline', this);
    });
  }

  destroy(): void {
    this._log.info('Destroying SipSignalingAdapter');

    this._isReconnecting = false;
    if (this._connectTimeout) {
      clearTimeout(this._connectTimeout);
      this._connectTimeout = null;
    }
    if (this._backoff) {
      this._backoff.preferred.reset();
      this._backoff.preferred.removeAllListeners();
      this._backoff.primary.reset();
      this._backoff.primary.removeAllListeners();
      this._backoff = null;
    }
    this._backoffStartTime.preferred = null;
    this._backoffStartTime.primary = null;
    this._wasRegistered = false;

    const byeEstablished = (session: Session) => {
      if (session.state === SessionState.Established) {
        session.bye().catch((error: Error) => {
          this._log.warn('Error sending BYE during destroy', error);
        });
      }
    };
    this._inboundSessions.forEach(byeEstablished);
    this._outboundSessions.forEach(byeEstablished);
    this._inboundSessions.clear();
    this._outboundSessions.clear();
    this._pendingInvitations.clear();
    this._inFlightIceRestarts.clear();
    this._pendingIceRestartRecovery.clear();
    this._messageQueue.length = 0;
    this._timeOpened = null;

    if (this._registerer) {
      this._registerer.dispose().catch((error: Error) => {
        this._log.warn('Error disposing registerer during destroy', error);
      });
      this._registerer = null;
    }

    if (this._userAgent) {
      this._userAgent.stop().catch((error: Error) => {
        this._log.warn('Error stopping UserAgent during destroy', error);
      });
      this._userAgent = null;
    }

    this._status = 'disconnected';
    this.emit('close');
  }

  updatePreferredURI(uri: string | null): void {
    this._log.debug('updatePreferredURI called (no-op for SIP)');
  }

  updateURIs(uris: string[]): void {
    this._log.debug('updateURIs called (no-op for SIP)');
  }

  // ---------------------------------------------------------------------------
  // Call signaling
  // ---------------------------------------------------------------------------

  invite(callSid: string, config: InviteConfig): void {
    this._sendInvite(callSid, config);
  }

  answer(callSid: string, config: AnswerConfig): void {
    const invitation = this._pendingInvitations.get(callSid);
    if (!invitation) {
      this._log.warn('answer: no pending invitation for callSid', callSid);
      return;
    }
    this._pendingInvitations.delete(callSid);
    this._inboundSessions.set(callSid, invitation);
    this._bindSession(invitation, callSid, config);
    invitation.accept().catch((error: Error) => {
      this._log.error('Failed to accept invitation', error);
      // Drop the half-bound session so a later hangup/retry for this callSid
      // doesn't dispatch against a Terminated-but-still-mapped invitation.
      this._inboundSessions.delete(callSid);
      this._sessionBindings.delete(invitation);
      // TODO(VBLOCKS-6604): when the SIP.js error carries a response
      // statusCode (486, 480, 503, ...), translate it through
      // getPreciseSignalingErrorByCode rather than hardcoding 31000.
      // Consistent treatment needed across reject()/hangup()/reconnect()/
      // sendMessage() as well.
      this.emit('error', { error: { code: 31000, message: error.message }, callsid: callSid });
    });
  }

  hangup(callSid: string, _config: HangupConfig = {}): void {
    // Don't let the post-reconnect path emit 'iceRestartNeeded' for a call
    // hung up mid-reconnect.
    this._pendingIceRestartRecovery.delete(callSid);

    // A call cancelled while its INVITE is queued has no session to tear down,
    // so dropping the entry is the whole hangup. Otherwise the flush would
    // place a call the user gave up on.
    if (this._dequeueMessages(callSid)) {
      this._log.info(`hangup: dropped queued invite for ${callSid}`);
      return;
    }

    const pendingInvitation = this._pendingInvitations.get(callSid);
    if (pendingInvitation) {
      return this._hangupPendingInvitation(pendingInvitation, callSid);
    }

    const outboundSession = this._outboundSessions.get(callSid);
    if (outboundSession) {
      return this._hangupOutboundSession(outboundSession, callSid);
    }

    const inboundSession = this._inboundSessions.get(callSid);
    if (inboundSession) {
      return this._hangupInboundSession(inboundSession, callSid);
    }

    this._log.warn('hangup: no session for callSid', callSid);
  }

  reject(callSid: string): void {
    const invitation = this._pendingInvitations.get(callSid);
    if (!invitation) {
      this._log.warn('reject: no pending invitation for callSid', callSid);
      return;
    }
    this._pendingInvitations.delete(callSid);
    invitation.reject().catch((error: Error) => {
      this._log.error('Failed to reject invitation', error);
      this.emit('error', { error: { code: 31000, message: error.message }, callsid: callSid });
    });
  }

  /**
   * Re-INVITE for a fresh-ICE offer, which the armed SDH produces (so
   * _config is unused). Failures emit 'hangup' so Call can drop its inline
   * listeners, except while reconnecting, which defers to 'iceRestartNeeded'.
   */
  iceRestart(callSid: string, _config: IceRestartConfig): void {
    const session = this._getSession(callSid);
    if (!session || session.state !== SessionState.Established) {
      this._log.warn('iceRestart: no established session for callSid', callSid);
      this.emit('hangup', { callsid: callSid });
      return;
    }
    // A re-INVITE over a dead transport just 408s once Timer B expires (~32s).
    // Record the intent; _onTransportConnect emits 'iceRestartNeeded' instead.
    if (this._isReconnecting) {
      this._log.info(`iceRestart deferred while reconnecting: ${callSid}`);
      this._pendingIceRestartRecovery.add(callSid);
      return;
    }
    // Arm the SDH directly. Invite options stick to the dialog and replay
    // onto later server-initiated re-INVITEs.
    const sdh = session.sessionDescriptionHandler as
      Partial<SipSessionDescriptionHandler> | undefined;
    if (typeof sdh?.requestIceRestart !== 'function') {
      this._log.warn('iceRestart: no usable description handler for callSid', callSid);
      this.emit('hangup', { callsid: callSid });
      return;
    }
    sdh.requestIceRestart();

    const inflight: InflightIceRestart = { callSid, stale: false };
    this._inFlightIceRestarts.add(inflight);
    const inviteOptions: SessionInviteOptions = {
      requestDelegate: {
        onAccept: () => {
          this._inFlightIceRestarts.delete(inflight);
          // SDP intentionally empty: the SDH consumed the remote answer via
          // SIP.js's setDescription before this event fires, so Call's
          // onAnswerOrRinging skips processAnswer on empty SDP. Passing a
          // real SDP here would trigger a double-processAnswer.
          this.emit('answer', { callsid: callSid, sdp: '' });
        },
        onReject: (response: any) => {
          this._inFlightIceRestarts.delete(inflight);
          if (inflight.stale) {
            // The WS dropped while this was in flight. Don't hang up;
            // _onTransportConnect emits 'iceRestartNeeded' so Call re-triggers.
            this._log.info('Suppressing stale ICE-restart re-INVITE rejection');
            return;
          }
          const code = response?.message?.statusCode;
          this._log.warn('ICE-restart re-INVITE rejected', code);
          this.emit('hangup', {
            callsid: callSid,
            error: { code: code ?? 31000, message: `ICE-restart re-INVITE rejected (${code ?? 'unknown'})` },
          });
        },
      },
    };
    session.invite(inviteOptions).catch((error: Error) => {
      this._inFlightIceRestarts.delete(inflight);
      // A previous re-INVITE is still in flight — its requestDelegate owns the
      // outcome. Treating this as fatal here would tear down the call before
      // the in-flight re-INVITE has a chance to succeed or surface the real
      // failure (timeout, reject, etc.).
      if (error instanceof RequestPendingError) {
        this._log.info('iceRestart skipped: previous re-INVITE still pending');
        return;
      }
      this._log.warn('Failed to send ICE-restart re-INVITE', error);
      this.emit('hangup', {
        callsid: callSid,
        error: { code: 31000, message: `Failed to send ICE-restart re-INVITE: ${error.message}` },
      });
    });
  }

  reconnect(callSid: string, config: ReconnectConfig): void {
    this._sendInvite(callSid, {
      sdp: config.sdp,
      peerConnection: config.peerConnection,
      rtcConfiguration: config.rtcConfiguration,
    }, config.reconnectToken);
  }

  dtmf(callSid: string, { digits }: DtmfConfig): void {
    const session = this._getSession(callSid);
    if (!session || session.state !== SessionState.Established) {
      this._log.warn('dtmf: no established session for callSid', callSid);
      return;
    }
    const sendDigits = async () => {
      for (const digit of digits) {
        try {
          await session.info({
            requestOptions: {
              body: {
                contentDisposition: 'render',
                contentType: 'application/dtmf-relay',
                content: `Signal=${digit}\r\nDuration=100\r\n`,
              },
            },
          });
        } catch (error: any) {
          this._log.warn('Failed to send DTMF digit', digit, error?.message);
        }
      }
    };
    sendDigits();
  }

  sendMessage(callSid: string, { content, contentType, voiceEventSid }: SipSendMessageConfig): void {
    const session = this._getSession(callSid);
    if (!session || session.state !== SessionState.Established) {
      this._log.warn('sendMessage: no established session for callSid', callSid);
      return;
    }
    session.message({
      requestOptions: {
        body: {
          contentDisposition: 'render',
          contentType: contentType || 'application/json',
          content,
        },
      },
    }).then(() => {
      this.emit('ack', { acktype: 'message', callsid: callSid, voiceeventsid: voiceEventSid });
    }).catch((error: Error) => {
      this._log.error('Failed to send message', error);
      this.emit('error', {
        error: { code: 31000, message: error.message },
        callsid: callSid,
        voiceeventsid: voiceEventSid,
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _hangupPendingInvitation(invitation: Invitation, callSid: string): void {
    this._pendingInvitations.delete(callSid);
    invitation.reject().catch((error: Error) => {
      this._log.error('Failed to reject invitation during hangup', error);
      this.emit('error', { error: { code: 31000, message: error.message }, callsid: callSid });
    });
  }

  private _hangupOutboundSession(session: Inviter, callSid: string): void {
    this._outboundSessions.delete(callSid);

    switch (session.state) {
      case SessionState.Established:
        session.bye().catch((error: Error) => {
          this._log.error('Failed to send BYE', error);
          this.emit('error', { error: { code: 31000, message: error.message }, callsid: callSid });
        });
        return;
      case SessionState.Initial:
      case SessionState.Establishing:
        session.cancel().catch((error: Error) => {
          this._log.error('Failed to cancel outgoing call', error);
          this.emit('error', { error: { code: 31000, message: error.message }, callsid: callSid });
        });
        return;
      case SessionState.Terminating:
      case SessionState.Terminated:
        this._log.debug('_hangupOutboundSession: session already ending', session.state);
        return;
      default: {
        const _exhaustive: never = session.state;
        this._log.warn('_hangupOutboundSession: unexpected session state', _exhaustive);
      }
    }
  }

  private _hangupInboundSession(session: Invitation, callSid: string): void {
    this._inboundSessions.delete(callSid);

    switch (session.state) {
      case SessionState.Established:
        session.bye().catch((error: Error) => {
          this._log.error('Failed to send BYE', error);
          this.emit('error', { error: { code: 31000, message: error.message }, callsid: callSid });
        });
        return;
      case SessionState.Initial:
      case SessionState.Establishing:
        session.reject().catch((error: Error) => {
          this._log.error('Failed to reject invitation during hangup', error);
          this.emit('error', { error: { code: 31000, message: error.message }, callsid: callSid });
        });
        return;
      case SessionState.Terminating:
      case SessionState.Terminated:
        this._log.debug('_hangupInboundSession: session already ending', session.state);
        return;
      default: {
        const _exhaustive: never = session.state;
        this._log.warn('_hangupInboundSession: unexpected session state', _exhaustive);
      }
    }
  }

  private _getSession(callSid: string): Session | undefined {
    return this._outboundSessions.get(callSid) || this._inboundSessions.get(callSid);
  }

  private _bindSession(
    session: Session,
    callSid: string,
    config: { peerConnection?: IPeerConnection; rtcConfiguration?: RTCConfiguration },
  ): void {
    if (!config.peerConnection) {
      throw new Error('SipSignalingAdapter: peerConnection is required on the SIP path');
    }
    this._sessionBindings.set(session, {
      callSid,
      peerConnection: config.peerConnection,
      rtcConfiguration: config.rtcConfiguration,
    });
  }

  private _handleIncomingInvite(invitation: Invitation): void {
    const callSid = invitation.request.getHeader('X-Twilio-CallSid');
    if (!callSid) {
      this._log.error('Incoming INVITE missing X-Twilio-CallSid header');
      invitation.reject().catch((error: Error) => {
        this._log.error('Failed to reject invitation missing CallSid', error);
      });
      return;
    }
    this._pendingInvitations.set(callSid, invitation);

    if (!invitation.delegate) {
      invitation.delegate = {};
    }
    invitation.delegate.onCancel = () => {
      this._pendingInvitations.delete(callSid);
      this._inboundSessions.delete(callSid);
      this.emit('cancel', { callsid: callSid });
    };
    invitation.delegate.onBye = () => {
      this._inboundSessions.delete(callSid);
      this.emit('hangup', { callsid: callSid });
    };

    invitation.stateChange.addListener((state: SessionState) => {
      if (state === SessionState.Terminated) {
        this._pendingInvitations.delete(callSid);
        this._inboundSessions.delete(callSid);
      }
    });

    const from = invitation.remoteIdentity?.uri?.toString() || '';
    if (!from) {
      this._log.warn('Incoming INVITE has no parseable remoteIdentity URI');
    }

    this.emit('invite', {
      callsid: callSid,
      sdp: invitation.body || '',
      parameters: {
        CallSid: callSid,
        From: from,
      },
    });
  }

  private _sendInvite(tempCallSid: string, config: InviteConfig, reconnectToken?: string): void {
    if (!this._userAgent) {
      this._log.warn('Cannot invite: UserAgent not initialized');
      return;
    }

    // An INVITE written to a dead socket only fails once SIP.js's Timer B
    // expires (~32s), so queue and replay on reconnect instead.
    //
    // Gated on _isReconnecting, not "not yet connected": Device awaits the
    // connected promise before inviting, and queueing pre-connect would strand
    // invites with no reconnect cycle to flush them.
    if (this._isReconnecting) {
      this._log.info(`Transport is down; queueing invite for ${tempCallSid}`);
      this._messageQueue.push({
        callSid: tempCallSid,
        send: () => this._sendInvite(tempCallSid, config, reconnectToken),
      });
      this._emitTransportError();
      return;
    }

    const targetUri = UserAgent.makeURI(`sip:${this._options.sipDomain}`);
    if (!targetUri) {
      this._log.error('Failed to create target URI for invite');
      this.emit('error', { error: { code: 31000, message: 'Invalid SIP target URI' }, callsid: tempCallSid });
      return;
    }

    const createInv = this._options.createInviter
      || ((ua: UserAgent, uri: URI, opts?: InviterOptions) => new Inviter(ua, uri, opts));
    const inviter = createInv(this._userAgent, targetUri);

    // Starts as the client-generated temp sid; replaced with the server-issued
    // CallSid from the 200 OK's X-Twilio-CallSid header once the INVITE is accepted.
    let callSid = tempCallSid;

    this._bindSession(inviter, tempCallSid, config);
    this._outboundSessions.set(callSid, inviter);

    inviter.delegate = {
      onBye: () => {
        this._outboundSessions.delete(callSid);
        this.emit('hangup', { callsid: callSid });
      },
    };

    inviter.stateChange.addListener((state: SessionState) => {
      if (state === SessionState.Terminated) {
        this._outboundSessions.delete(callSid);
      }
    });

    inviter.invite({
      requestDelegate: {
        onProgress: () => {
          this.emit('ringing', { callsid: callSid });
        },
        onAccept: (response: any) => {
          const serverCallSid = response?.message?.getHeader?.('X-Twilio-CallSid');
          if (serverCallSid && serverCallSid !== callSid) {
            this._outboundSessions.delete(callSid);
            this._outboundSessions.set(serverCallSid, inviter);
            // Keep the SdhBinding in sync so any future reader (debug
            // logging, SDH refactors that construct lazily) sees the
            // server-issued CallSid rather than the client temp sid.
            const binding = this._sessionBindings.get(inviter);
            if (binding) {
              binding.callSid = serverCallSid;
            }
            callSid = serverCallSid;
          }
          const payload: Record<string, any> = {
            callsid: callSid,
            sdp: '',
          };
          if (reconnectToken) {
            payload.reconnect = reconnectToken;
          }
          this.emit('answer', payload);
        },
        onReject: (response: any) => {
          const code = response?.message?.statusCode || 31000;
          const message = response?.message?.reasonPhrase || 'Call rejected';
          this._outboundSessions.delete(callSid);
          this.emit('hangup', { callsid: callSid, error: { code, message } });
        },
      },
    }).catch((error: Error) => {
      this._log.error('Failed to send INVITE', error);
      this._outboundSessions.delete(callSid);
      this.emit('error', { error: { code: 31000, message: error.message }, callsid: callSid });
    });
  }

  private _onTransportConnect(): void {
    if (this._status === 'connected') {
      return;
    }
    this._log.info('WebSocket connected');
    this._status = 'connected';
    // Cleared here, not in _onReconnectSuccess: onConnect fires first, and the
    // flush below would re-queue everything it just drained.
    this._isReconnecting = false;
    this._timeOpened = Date.now();

    const payload: Record<string, any> = {
      region: this._region,
      token: {
        identity: this._options.credentials.username,
      },
    };

    this.emit('connected', payload);

    this._flushMessageQueue();

    // Everything below belongs here, not in _onReconnectSuccess: an abandoned
    // attempt whose socket opens anyway leaves this delegate as the only
    // signal, and slow reconnects were landing unregistered.
    if (this._wasRegistered) {
      this._createAndStartRegisterer();
    }

    // The server never received the orphaned re-INVITE's ICE/DTLS creds, so
    // Call has to re-trigger. _inFlightIceRestarts entries stay stale so their
    // eventual rejection is still suppressed.
    const recovery = Array.from(this._pendingIceRestartRecovery);
    this._pendingIceRestartRecovery.clear();
    this._log.info(`_onTransportConnect: ${recovery.length} stale ICE-restart(s) to re-trigger`);
    recovery.forEach((callSid: string) => {
      this._log.info(`Emitting iceRestartNeeded for ${callSid}`);
      this.emit('iceRestartNeeded', { callsid: callSid });
    });
  }

  /**
   * Replay whatever queued while the transport was down.
   */
  private _flushMessageQueue(): void {
    if (!this._messageQueue.length) {
      return;
    }
    const queued = this._messageQueue.splice(0, this._messageQueue.length);
    this._log.info(`Flushing ${queued.length} queued message(s)`);
    queued.forEach((message: QueuedMessage) => message.send());
  }

  /**
   * Drop every queued message belonging to a callSid. Returns true if
   * anything was removed.
   */
  private _dequeueMessages(callSid: string): boolean {
    const remaining = this._messageQueue.filter(
      (message: QueuedMessage) => message.callSid !== callSid,
    );
    if (remaining.length === this._messageQueue.length) {
      return false;
    }
    this._messageQueue = remaining;
    return true;
  }

  /**
   * The transport-unavailable error PStream raises on an undeliverable send,
   * so Device and Call see the same signal on both adapters.
   */
  private _emitTransportError(): void {
    this.emit('error', {
      error: {
        code: 31009,
        message: 'No transport available to send or receive messages',
        twilioError: new GeneralErrors.TransportError(),
      },
    });
  }

  private _onTransportDisconnect(error?: Error): void {
    this._log.info('WebSocket disconnected', error?.message);

    if (this._isReconnecting || !this._userAgent) {
      return;
    }
    // _status is still 'disconnected' only if onConnect never fired, i.e. the
    // initial userAgent.start() handshake failed. There's no session to
    // recover, and start()'s caller already surfaces that error.
    if (this._status === 'disconnected') {
      return;
    }

    this._isReconnecting = true;

    this._handleCloseCode();

    // Only a connection that lasted counts as successful. A short-lived one
    // keeps its counters so a flapping transport keeps backing off.
    if (this._timeOpened !== null && Date.now() - this._timeOpened > CONNECT_SUCCESS_TIMEOUT_MS) {
      this._log.info('Connection was open long enough to be successful; resetting backoffs');
      this._resetBackoffs();
    }
    this._timeOpened = null;

    // In-flight re-INVITEs are now orphaned on a dead socket. Mark them stale
    // so their rejection doesn't tear the call down, and queue them for an
    // iceRestartNeeded emit once the transport recovers.
    this._log.info(`_onTransportDisconnect: marking ${this._inFlightIceRestarts.size} in-flight re-INVITE(s) stale`);
    this._inFlightIceRestarts.forEach((inflight: InflightIceRestart) => {
      inflight.stale = true;
      this._pendingIceRestartRecovery.add(inflight.callSid);
    });

    // Dispose the registerer — SIP.js requires a fresh Registerer after the
    // transport reconnects. Do NOT clear session maps; they remain addressable
    // through the blip so hangup(callSid) can still route and existing
    // sessions stay valid if WS recovers in time.
    if (this._registerer) {
      this._registerer.dispose().catch((err: Error) => {
        this._log.warn('Error disposing registerer during disconnect', err);
      });
      this._registerer = null;
    }

    this._status = 'disconnected';
    this.emit('transportClose');
    // Mirror PStream: emit offline on every transport close so Device flips
    // to Unregistered and sets _shouldReRegister, matching PStream-mode
    // behavior end-to-end.
    this.emit('offline', this);

    if (!this._backoff) {
      this._backoff = this._setupBackoffs();
    }
    // Stamp the cycle start explicitly. The attempt counter survives a
    // short-lived connection, so it can't mark the start; without this the
    // preferred window never expires and primary never engages.
    this._backoffStartTime.preferred = Date.now();
    // preferred.backoff() clears its own pending timer; nothing re-arms primary
    // here, so drop its leftover or it fires inside this cycle.
    this._backoff.primary.reset();
    this._backoff.preferred.backoff();
  }

  /**
   * For close codes meaning the server was unreachable, emit the same error
   * WSTransport raises.
   */
  private _handleCloseCode(): void {
    const closeCode = this._closeCodeRecorder.lastCloseCode;
    // Consume either way: a disconnect with no close event must not inherit it.
    this._closeCodeRecorder.lastCloseCode = undefined;

    if (closeCode === undefined || !ABNORMAL_CLOSE_CODES.includes(closeCode)) {
      return;
    }

    this._log.error(`Received websocket close event code: ${closeCode}`);
    this.emit('error', {
      error: {
        code: 31005,
        message: 'Websocket connection to Twilio\'s signaling servers were ' +
          'unexpectedly ended. If this is happening consistently, there may ' +
          'be an issue resolving the hostname provided. If a region or an ' +
          'edge is being specified in Device setup, ensure it is valid.',
        twilioError: new SignalingErrors.ConnectionError(),
      },
    });
  }

  private _setupBackoffs(): { preferred: Backoff, primary: Backoff } {
    // Cycle start times are stamped by the callers that begin a cycle, not by
    // an `attempt === 0` check here, since counters persist across
    // unsuccessful connections.
    const preferred = new Backoff(PREFERRED_BACKOFF_CONFIG);
    preferred.on('ready', (attempt: number) => this._onPreferredBackoffReady(attempt));

    const primary = new Backoff(PRIMARY_BACKOFF_CONFIG);
    primary.on('ready', (attempt: number) => this._onPrimaryBackoffReady(attempt));

    return { preferred, primary };
  }

  private _onPreferredBackoffReady(attempt: number): void {
    if (!this._userAgent || !this._isReconnecting || !this._backoff) {
      return;
    }

    if (this._backoffStartTime.preferred !== null
        && Date.now() - this._backoffStartTime.preferred > MAX_PREFERRED_DURATION_MS) {
      this._log.info('Max preferred reconnect duration exceeded; falling back to primary backoff.');
      this._backoffStartTime.primary = Date.now();
      this._backoff.primary.backoff();
      return;
    }

    this._attemptReconnect(attempt, 'preferred');
  }

  private _onPrimaryBackoffReady(attempt: number): void {
    if (!this._userAgent || !this._isReconnecting || !this._backoff) {
      return;
    }

    if (this._backoffStartTime.primary !== null
        && Date.now() - this._backoffStartTime.primary > MAX_PRIMARY_DURATION_MS) {
      this._log.warn('Max primary reconnect duration exceeded; not attempting a connection.');
      return;
    }

    this._attemptReconnect(attempt, 'primary');
  }

  private _attemptReconnect(attempt: number, tier: 'preferred' | 'primary'): void {
    if (!this._userAgent || !this._backoff) {
      return;
    }
    this._log.info(`Reconnect attempt #${attempt} (${tier})`);

    this._withConnectTimeout(tier, this._userAgent.reconnect()).then(
      (connected: boolean) => {
        if (connected) {
          this._onReconnectSuccess();
        }
      },
      (err: Error) => {
        this._log.warn('Reconnect attempt failed', err);
        this._backoff?.[tier].backoff();
      },
    );
  }

  /**
   * Own the per-attempt backstop end to end: arm it, and if it wins the race,
   * log it and schedule the tier's next delay. Exactly one of the two outcomes
   * is acted on, so a late result is dropped.
   *
   * Resolves true if the attempt connected and false if it was abandoned;
   * rejects only when the attempt itself failed.
   */
  private _withConnectTimeout(
    tier: 'preferred' | 'primary',
    attempt: Promise<void>,
  ): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        this._log.warn(`Reconnect attempt timed out after ${CONNECT_TIMEOUT_MS}ms`);
        this._backoff?.[tier].backoff();
        resolve(false);
      }, CONNECT_TIMEOUT_MS);
      this._connectTimeout = timeout;

      attempt.then(
        () => {
          if (settled) {
            // A retry is already scheduled, and if the socket did open the
            // onConnect delegate has already run the post-connect work.
            this._log.info('Ignoring reconnect success that landed after the attempt timed out');
            return;
          }
          settled = true;
          clearTimeout(timeout);
          resolve(true);
        },
        (err: Error) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timeout);
          reject(err);
        },
      );
    });
  }

  private _onReconnectSuccess(): void {
    if (!this._userAgent) {
      return;
    }
    this._log.info('Reconnect succeeded');
    // The counters are deliberately NOT reset here: connecting is not proof of
    // health, only staying open past CONNECT_SUCCESS_TIMEOUT_MS is, and
    // _onTransportDisconnect makes that call. The post-connect work lives in
    // _onTransportConnect, which onConnect normally reaches first.
    this._onTransportConnect();
  }

  private _resetBackoffs(): void {
    this._backoffStartTime.preferred = null;
    this._backoffStartTime.primary = null;
    this._backoff?.preferred.reset();
    this._backoff?.primary.reset();
  }
}
