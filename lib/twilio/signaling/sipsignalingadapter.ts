import { EventEmitter } from 'events';
import {
  Invitation,
  Inviter,
  InviterOptions,
  Registerer,
  RegistererState,
  Session,
  SessionState,
  URI,
  UserAgent,
} from 'sip.js';
import Log from '../log';
import {
  AnswerConfig,
  DtmfConfig,
  HangupConfig,
  InviteConfig,
  ReconnectConfig,
  ReinviteConfig,
  SignalingAdapter,
  SignalingAdapterStatus,
  SendMessageConfig,
} from './signalingadapter';

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
 * A no-op SessionDescriptionHandler for SIP.js. SDP relay through
 * SIP.js is deferred to VBLOCKS-6372 (SipSessionDescriptionHandler).
 * This stub satisfies the SIP.js SDH interface without doing any
 * real media work — actual SDP exchange is handled out-of-band by
 * PeerConnection via Call.ts.
 */
function createNoOpSDH(): any {
  return {
    close(): void { /* no-op */ },
    getDescription(): Promise<any> {
      return Promise.resolve({ body: '', contentType: 'application/sdp' });
    },
    hasDescription(contentType: string): boolean {
      return contentType === 'application/sdp';
    },
    setDescription(): Promise<void> {
      return Promise.resolve();
    },
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
      sessionDescriptionHandlerFactory: () => createNoOpSDH(),
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

  invite(callSid: string, { sdp, params }: InviteConfig): void {
    this._sendInvite(sdp, callSid, params);
  }

  answer(callSid: string, config: AnswerConfig): void {
    const invitation = this._pendingInvitations.get(callSid);
    if (!invitation) {
      this._log.warn('answer: no pending invitation for callSid', callSid);
      return;
    }
    this._pendingInvitations.delete(callSid);
    this._inboundSessions.set(callSid, invitation);
    invitation.accept().catch((error: Error) => {
      this._log.error('Failed to accept invitation', error);
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

  reinvite(callSid: string, config: ReinviteConfig): void {
    const session = this._getSession(callSid);
    if (!session || session.state !== SessionState.Established) {
      this._log.warn('reinvite: no established session for callSid', callSid);
      return;
    }
    session.invite({
      requestDelegate: {
        onAccept: () => {
          this.emit('answer', { callsid: callSid, sdp: '' });
        },
        onReject: (response: any) => {
          this._log.warn('re-INVITE rejected', response?.message?.statusCode);
        },
      },
    }).catch((error: Error) => {
      this._log.warn('Failed to send re-INVITE', error);
    });
  }

  reconnect(callSid: string, { sdp, reconnectToken }: ReconnectConfig): void {
    this._sendInvite(sdp, callSid, undefined, reconnectToken);
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

    this.emit('invite', {
      callsid: callSid,
      sdp: invitation.body || '',
      parameters: {
        CallSid: callSid,
        From: invitation.remoteIdentity.uri.toString(),
      },
    });
  }

  private _sendInvite(sdp: string, callSid: string, params?: string, reconnectToken?: string): void {
    if (!this._userAgent) {
      this._log.warn('Cannot invite: UserAgent not initialized');
      return;
    }

    const targetUri = UserAgent.makeURI(`sip:${this._options.sipDomain}`);
    if (!targetUri) {
      this._log.error('Failed to create target URI for invite');
      this.emit('error', { error: { code: 31000, message: 'Invalid SIP target URI' }, callsid: callSid });
      return;
    }

    const createInv = this._options.createInviter
      || ((ua: UserAgent, uri: URI, opts?: InviterOptions) => new Inviter(ua, uri, opts));
    const inviter = createInv(this._userAgent, targetUri);

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
        onAccept: () => {
          const payload: Record<string, any> = { callsid: callSid, sdp: '' };
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
