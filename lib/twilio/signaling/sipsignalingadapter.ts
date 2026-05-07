import { EventEmitter } from 'events';
import {
  Invitation,
  Inviter,
  InviterOptions,
  Registerer,
  RegistererState,
  SessionDescriptionHandler,
  Session,
  SessionInviteOptions,
  SessionState,
  URI,
  UserAgent,
} from 'sip.js';
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
  SessionDescriptionHandlerOptions,
  SipSessionDescriptionHandler,
} from './sipsessiondescriptionhandler';

// SIP.js's SessionInviteOptions.sessionDescriptionHandlerOptions is typed
// as the base SessionDescriptionHandlerOptions, which does not expose
// offerOptions. Override that field with our SDH's extended type so the
// iceRestart flag is typechecked at the call site.
type IceRestartInviteOptions = Omit<SessionInviteOptions, 'sessionDescriptionHandlerOptions'> & {
  sessionDescriptionHandlerOptions?: SessionDescriptionHandlerOptions;
};

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
   * Trigger an ICE restart by sending a re-INVITE with
   * offerOptions.iceRestart:true. SIP.js asks the SDH to produce the
   * fresh-ICE offer via getDescription(options), so config.mediaHandler
   * is unused here (the PStream adapter needs it; we preserve the shared
   * interface). All failure paths (no session, onReject, catch) emit
   * 'hangup' for the callSid so Call can clean up its inline re-INVITE
   * listeners and transition out of the reconnecting state.
   */
  iceRestart(callSid: string, _config: IceRestartConfig): void {
    const session = this._getSession(callSid);
    if (!session || session.state !== SessionState.Established) {
      this._log.warn('iceRestart: no established session for callSid', callSid);
      this.emit('hangup', {
        callsid: callSid,
        error: { code: 31000, message: 'No established session for ICE restart' },
      });
      return;
    }
    const inviteOptions: IceRestartInviteOptions = {
      requestDelegate: {
        onAccept: () => {
          this.emit('answer', { callsid: callSid, sdp: '' });
        },
        onReject: (response: any) => {
          const code = response?.message?.statusCode;
          this._log.warn('ICE-restart re-INVITE rejected', code);
          this.emit('hangup', {
            callsid: callSid,
            error: { code: code || 31000, message: `ICE-restart re-INVITE rejected (${code || 'unknown'})` },
          });
        },
      },
      sessionDescriptionHandlerOptions: {
        offerOptions: { iceRestart: true },
      },
    };
    session.invite(inviteOptions).catch((error: Error) => {
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
    this._log.info('WebSocket connected');
    this._status = 'connected';

    const payload: Record<string, any> = {
      region: this._region,
      token: {
        identity: this._options.credentials.username,
      },
    };

    this.emit('connected', payload);
  }

  private _onTransportDisconnect(error?: Error): void {
    this._log.info('WebSocket disconnected', error?.message);

    this._inboundSessions.clear();
    this._outboundSessions.clear();
    this._pendingInvitations.clear();

    if (this._registerer) {
      this._registerer.dispose().catch((err: Error) => {
        this._log.warn('Error disposing registerer during disconnect', err);
      });
      this._registerer = null;
    }

    if (this._status !== 'disconnected') {
      this._status = 'disconnected';
      this.emit('transportClose');
      this.emit('offline', this);
    }
  }
}
