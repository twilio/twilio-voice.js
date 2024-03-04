/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
import { EventEmitter } from 'events';
import { levels as LogLevels, LogLevelDesc } from 'loglevel';
import Log from '../log';
import {
  AuthorizationErrors,
  ClientErrors,
  GeneralErrors,
  getPreciseSignalingErrorByCode,
  InvalidArgumentError,
  InvalidStateError,
} from '../errors';
import PStream from './pstream';
import {
  createSignalingEndpointURL,
  Edge,
  getChunderURIs,
  getRegionShortcode,
  Region,
  regionToEdge,
} from '../regions';
import { promisifyEvents } from '../util';

/**
 * @private
 */
export type IPStream = any;

const REGISTRATION_INTERVAL = 30000;

class Signaling extends EventEmitter {

  private _chunderURIs: string[] = [];
  private _callInvites: Record<string, Record<string, any>>[] = [];
  private readonly _defaultOptions: Signaling.InternalOptions = {
    allowIncomingWhileBusy: false,
    enableImprovedSignalingErrorPrecision: false,
    logLevel: LogLevels.ERROR,
    maxCallSignalingTimeoutMs: 0,
    PStream,
    tokenRefreshMs: 10000,
  };
  private _edge: string | null = null;
  private _home: string | null = null;
  private _identity: string | null = null;
  private _log: Log = new Log('Signaling');
  private _options: Signaling.InternalOptions;
  private _preferredURI: string | null = null;
  private _pstream: IPStream = null;
  private _region: string | null = null;
  private _regTimer: NodeJS.Timer | null = null;
  private _shouldReRegister: boolean = false;
  private _state: Signaling.State = Signaling.State.Unregistered;
  private readonly _stateEventMapping: Record<Signaling.State, Signaling.Events> = {
    [Signaling.State.Destroyed]: Signaling.Events.Destroyed,
    [Signaling.State.Unregistered]: Signaling.Events.Unregistered,
    [Signaling.State.Registering]: Signaling.Events.Registering,
    [Signaling.State.Registered]: Signaling.Events.Registered,
  };
  private _pstreamConnectedPromise: Promise<IPStream> | null = null;
  private _token: string;
  private _tokenWillExpireTimeout: NodeJS.Timer | null = null;

  constructor(token: string, options: Signaling.Options) {
    super();

    // Setup loglevel asap to avoid missed logs
    this._log.setDefaultLevel(options.logLevel);
    this._log.debug('.constructor', JSON.stringify(options));

    this._options = { ...this._defaultOptions, ...options };

    this.updateToken(token);
    this.updateOptions(this._options);
  }

  private _destroyPStream() {
    if (this._pstream) {
      this._pstream.removeListener('close', this._onPStreamClose);
      this._pstream.removeListener('connected', this._onPStreamConnected);
      this._pstream.removeListener('error', this._onPStreamError);
      this._pstream.removeListener('invite', this._onPStreamInvite);
      this._pstream.removeListener('offline', this._onPStreamOffline);
      this._pstream.removeListener('ready', this._onPStreamReady);
      this._pstream.destroy();
      this._pstream = null;
    }

    this._onPStreamOffline();

    this._pstreamConnectedPromise = null;
  }

  private _onPStreamClose = () => {
    this._log.debug('VSP close');
    this._pstream = null;
    this._pstreamConnectedPromise = null;
  }

  private _onPStreamConnected = (payload: Record<string, any>) => {
    this._log.debug('VSP connected');
    const region = getRegionShortcode(payload.region);
    this._edge = payload.edge || regionToEdge[region as Region] || payload.region;
    this._region = region || payload.region;
    this._home = payload.home;

    if (payload.token) {
      this._identity = payload.token.identity;
      if (
        typeof payload.token.ttl === 'number' &&
        typeof this._options.tokenRefreshMs === 'number'
      ) {
        const ttlMs: number = payload.token.ttl * 1000;
        const timeoutMs: number = Math.max(0, ttlMs - this._options.tokenRefreshMs);
        this._tokenWillExpireTimeout = setTimeout(() => {
          this._log.debug('#tokenWillExpire');
          this.emit('tokenWillExpire', this);
          if (this._tokenWillExpireTimeout) {
            clearTimeout(this._tokenWillExpireTimeout);
            this._tokenWillExpireTimeout = null;
          }
        }, timeoutMs);
      }
    }

    const preferredURIs = getChunderURIs(this._edge as Edge);
    if (preferredURIs.length > 0) {
      const [preferredURI] = preferredURIs;
      this._preferredURI = createSignalingEndpointURL(preferredURI);
    } else {
      this._log.warn('Could not parse a preferred URI from the pstream#connected event.');
    }

    // The signaling stream emits a `connected` event after reconnection, if the
    // it was registered before this, then register again.
    if (this._shouldReRegister) {
      this.register();
    }
  }

  private _onPStreamError = (payload: Record<string, any>) => {
    if (typeof payload !== 'object') {
      this._log.warn('VSP error raised but payload is missing');
      return;
    }

    const { error: originalError, callsid } = payload;
    if (typeof originalError !== 'object') {
      this._log.warn('VSP error raised but error object is missing');
      return;
    }

    this._log.debug('VSP error');

    const { code, message: customMessage } = originalError;
    let { twilioError } = originalError;

    if (typeof code === 'number') {
      if (code === 31201) {
        twilioError = new AuthorizationErrors.AuthenticationFailed(originalError);
      } else if (code === 31204) {
        twilioError = new AuthorizationErrors.AccessTokenInvalid(originalError);
      } else if (code === 31205) {
        // Stop trying to register presence after token expires
        this._stopRegistrationTimer();
        twilioError = new AuthorizationErrors.AccessTokenExpired(originalError);
      } else {
        const errorConstructor = getPreciseSignalingErrorByCode(
          !!this._options.enableImprovedSignalingErrorPrecision,
          code,
        );
        if (typeof errorConstructor !== 'undefined') {
          twilioError = new errorConstructor(originalError);
        }
      }
    }

    if (!twilioError) {
      this._log.error('Unknown signaling error: ', originalError);
      twilioError = new GeneralErrors.UnknownError(customMessage, originalError);
    }

    this._log.error('Received error: ', twilioError);
    this._log.debug('#error', originalError);
    // TODO: Device should emit call object instead of callsid
    this.emit(Signaling.Events.Error, twilioError, callsid);
  }

  private _onPStreamInvite = (payload: Record<string, any>) => {
    this._log.debug('VSP invite');
    const hasActiveCall = false; // TODO: check if in an active call
    if (hasActiveCall && !this._options.allowIncomingWhileBusy) {
      this._log.info('Device busy; ignoring incoming invite from signaling');
      return;
    }

    if (!payload.callsid || !payload.sdp) {
      this._log.debug('#error', payload);
      this.emit(Signaling.Events.Error, new ClientErrors.BadRequest('Malformed invite from gateway'));
      return;
    }

    const parameters = payload.parameters || { };
    const callSid = parameters.CallSid || payload.callsid;

    // this._callInvites.push({ [callSid]: payload });
    // TODO, what to emit, how to handle other call events
    // see what call object emits and do the same here
  }

  private _onPStreamOffline = () => {
    this._log.debug('VSP offline');
    this._edge = null;
    this._region = null;
    this._shouldReRegister = this._state !== Signaling.State.Unregistered;
    this._setState(Signaling.State.Unregistered);
  }

  private _onPStreamReady = () => {
    this._log.debug('VSP ready');
    this._setState(Signaling.State.Registered);
  }

  private async _sendPresence(presence: boolean): Promise<void> {
    const pstream = await this._pstreamConnectedPromise;

    if (!pstream) {
      return;
    }

    pstream.register({ audio: presence });
    if (presence) {
      this._startRegistrationTimer();
    } else {
      this._stopRegistrationTimer();
    }
  }

  private _setState(state: Signaling.State): void {
    if (state === this._state) {
      return;
    }

    this._state = state;
    const name = this._stateEventMapping[state];
    this._log.debug(`#${name}`);
    this.emit(name);
  }

  private _setupPStream(): Promise<IPStream> {
    if (this._pstream) {
      this._log.debug('Found existing pstream; destroying...');
      this._destroyPStream();
    }

    this._log.debug('Setting up VSP');
    this._pstream = new this._options.PStream(this._token, this._chunderURIs, {
      maxPreferredDurationMs: this._options.maxCallSignalingTimeoutMs,
    });

    this._pstream.addListener('close', this._onPStreamClose);
    this._pstream.addListener('connected', this._onPStreamConnected);
    this._pstream.addListener('error', this._onPStreamError);
    this._pstream.addListener('invite', this._onPStreamInvite);
    this._pstream.addListener('offline', this._onPStreamOffline);
    this._pstream.addListener('ready', this._onPStreamReady);

    return this._pstreamConnectedPromise =
      promisifyEvents(this._pstream, 'connected', 'close').then(() => this._pstream);
  }

  private _startRegistrationTimer() {
    this._stopRegistrationTimer();
    this._regTimer = setTimeout(() => {
      this._sendPresence(true);
    }, REGISTRATION_INTERVAL);
  }

  private _stopRegistrationTimer() {
    if (this._regTimer) {
      clearTimeout(this._regTimer);
    }
  }

  async register(): Promise<void> {
    this._log.debug('.register');
    if (this._state !== Signaling.State.Unregistered) {
      throw new InvalidStateError(
        `Attempt to register when signaling is in state "${this._state}". ` +
        `Must be "${Signaling.State.Unregistered}".`,
      );
    }

    this._shouldReRegister = false;
    this._setState(Signaling.State.Registering);

    await (this._pstreamConnectedPromise || this._setupPStream());
    await this._sendPresence(true);
    await promisifyEvents(this, Signaling.State.Registered, Signaling.State.Unregistered);
  }

  updateOptions(options: Signaling.Options) {
    this._log.debug('.updateOptions', JSON.stringify(options));

    const newOptions = { ...this._options, ...options };
    const originalChunderURIs: Set<string> = new Set(this._chunderURIs);
    const chunderw = typeof newOptions.chunderw === 'string'
      ? [newOptions.chunderw]
      : Array.isArray(newOptions.chunderw) && newOptions.chunderw;

    const newChunderURIs = (chunderw || getChunderURIs(newOptions.edge))
      .map(createSignalingEndpointURL);

    let hasChunderURIsChanged = originalChunderURIs.size !== newChunderURIs.length;

    if (!hasChunderURIsChanged) {
      for (const uri of newChunderURIs) {
        if (!originalChunderURIs.has(uri)) {
          hasChunderURIsChanged = true;
          break;
        }
      }
    }

    const hasActiveCall = false; // TODO: check if in an active call
    if (hasActiveCall && hasChunderURIsChanged) {
      throw new InvalidStateError('Cannot change Edge while on an active Call');
    }
    
    this._options = newOptions;
    this._chunderURIs = newChunderURIs;
    this._log.setDefaultLevel(this._options.logLevel);

    if (hasChunderURIsChanged && this._pstreamConnectedPromise) {
      this._setupPStream();
    }
  }

  updateToken(token: string) {
    this._log.debug('.updateToken');

    if (this._state === Signaling.State.Destroyed) {
      throw new InvalidStateError(
        `Attempt to "updateToken" when signaling is in state "${this._state}".`,
      );
    }

    if (typeof token !== 'string') {
      throw new InvalidArgumentError('Parameter "token" must be of type "string".');
    }
    this._token = token;
    if (this._pstream) {
      this._pstream.setToken(this._token);
    }
  }

  get state(): Signaling.State {
    return this._state;
  }
}

namespace Signaling {

  export enum Events {
    Error = 'error',
    Destroyed = 'destroyed',
    Unregistered = 'unregistered',
    Registering = 'registering',
    Registered = 'registered',
  }

  export interface Options {
    allowIncomingWhileBusy?: boolean;
    edge?: string[] | string;
    enableImprovedSignalingErrorPrecision?: boolean;
    logLevel?: LogLevelDesc;
    maxCallSignalingTimeoutMs?: number;
    tokenRefreshMs?: number;
  }

  export interface InternalOptions extends Options {
    PStream: IPStream;
    chunderw?: string;
  }

  export enum State {
    Destroyed = 'destroyed',
    Unregistered = 'unregistered',
    Registering = 'registering',
    Registered = 'registered',
  }
}

export default Signaling;
