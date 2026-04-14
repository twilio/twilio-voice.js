import { EventEmitter } from 'events';
import {
  Registerer,
  RegistererState,
  UserAgent,
} from 'sip.js';
import { NotSupportedError } from '../errors';
import Log from '../log';
import { SignalingAdapter, SignalingAdapterStatus } from './signalingadapter';

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
}

/**
 * A no-op SessionDescriptionHandler for SIP.js. Call signaling is not yet
 * implemented in this ticket (VBLOCKS-6374), so this stub satisfies the
 * SIP.js SDH interface without doing any real media work.
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
 * connection and SIP registration lifecycle. Call-level signaling methods
 * are not yet implemented (VBLOCKS-6374).
 */
export class SipSignalingAdapter extends EventEmitter implements SignalingAdapter {
  private _log: Log = new Log('SipSignalingAdapter');
  private _options: SipSignalingAdapterOptions;
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
        onInvite: () => {
          this._log.warn('Received incoming INVITE but call signaling is not yet implemented (VBLOCKS-6374)');
        },
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
  // Call signaling — not yet implemented (VBLOCKS-6374)
  // ---------------------------------------------------------------------------

  invite(_sdp: string, _callSid: string, _params: string): void {
    throw new NotSupportedError('SIP call signaling is not yet implemented (VBLOCKS-6374)');
  }

  answer(_sdp: string, _callSid: string): void {
    throw new NotSupportedError('SIP call signaling is not yet implemented (VBLOCKS-6374)');
  }

  hangup(_callSid: string, _message?: string | null): void {
    throw new NotSupportedError('SIP call signaling is not yet implemented (VBLOCKS-6374)');
  }

  reject(_callSid: string): void {
    throw new NotSupportedError('SIP call signaling is not yet implemented (VBLOCKS-6374)');
  }

  reinvite(_sdp: string, _callSid: string): void {
    throw new NotSupportedError('SIP call signaling is not yet implemented (VBLOCKS-6374)');
  }

  reconnect(_sdp: string, _callSid: string, _reconnectToken: string): void {
    throw new NotSupportedError('SIP call signaling is not yet implemented (VBLOCKS-6374)');
  }

  dtmf(_callSid: string, _digits: string): void {
    throw new NotSupportedError('SIP call signaling is not yet implemented (VBLOCKS-6374)');
  }

  sendMessage(
    _callSid: string,
    _content: string,
    _contentType: string | undefined,
    _messageType: string,
    _voiceEventSid: string,
  ): void {
    throw new NotSupportedError('SIP call signaling is not yet implemented (VBLOCKS-6374)');
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

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
