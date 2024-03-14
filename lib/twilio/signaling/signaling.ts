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
  GeneralErrors,
  getTwilioError,
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
TODO

check closing device does not destroy signaling
check signaling and device/call/pc methods and events, what should sync?
check emits and methods, make sure private are private, and public are documented
check signaling/device/call/pc private members, which ones are not needed
document that signaling module can be used by one single device only, using with multiple devices may cause issues

test all code that were moved
test imports from TS or Browser global dist script tag

expose close/offline for signaling closed
expose pstream on connected event to indicate signaling is connected
expose on invite/incoming
expose on ready/registered
expose signaling errors, also coming from device.emit(error
implement security in chrome extension messages, check source of the message?
test for memory leaks

save initialization states/options. example, device options
save device state into signaling and reload device state
save _onSignalingConnected states, might call this.register() also
save _onSignalingInvite
save __onSignalingReady

*/

/**
 * @private
 */
export type IPStream = any;

const REGISTRATION_INTERVAL = 30000;

class Signaling extends EventEmitter {

  private _callInvites: Record<string, any>[] = [];
  private _chunderURIs: string[] = [];
  private readonly _defaultOptions: Signaling.InternalOptions = {
    allowIncomingWhileBusy: false,
    enableImprovedSignalingErrorPrecision: false,
    logLevel: LogLevels.ERROR,
    maxCallSignalingTimeoutMs: 0,
    PStream,
    tokenRefreshMs: 10000,
  };
  private _edge: string | null = null;
  private _hasActiveCall: boolean = false;
  private _home: string | null = null;
  private _identity: string | null = null;
  private _log: Log = new Log('Signaling');
  private _options: Signaling.InternalOptions;
  private _preferredURI: string | null = null;
  private _pstream: IPStream = null;
  private _regionShortCode: string | null = null;
  private _region: string | null = null;
  private _regTimer: NodeJS.Timer | null = null;
  private _shouldReRegister: boolean = false;
  private _state: Signaling.State = Signaling.State.Unregistered;
  private readonly _stateEventMapping: Record<Signaling.State, Signaling.EventName> = {
    [Signaling.State.Destroyed]: Signaling.EventName.Destroyed,
    [Signaling.State.Unregistered]: Signaling.EventName.Unregistered,
    [Signaling.State.Registering]: Signaling.EventName.Registering,
    [Signaling.State.Registered]: Signaling.EventName.Registered,
  };
  private _pstreamConnectedPromise: Promise<IPStream> | null = null;
  private _token: string;
  private _tokenWillExpireTimeout: NodeJS.Timer | null = null;

  constructor(token: string, options: Signaling.Options = {}) {
    super();

    // Setup loglevel asap to avoid missed logs
    this._log.setDefaultLevel(options.logLevel);
    this._log.debug('.constructor', JSON.stringify(options));

    // NOTE(csantos): EventEmitter requires that we catch all errors.
    this.on('error', () => {
      this._log.debug('Signaling error detected');
    });

    this.updateToken(token);
    this.updateOptions(options);
  }

  private _destroyPStream() {
    if (this._pstream) {this._pstream.removeListener(Signaling.InternalEventName.Ack, this._onPStreamAck);
      this._pstream.removeListener(Signaling.InternalEventName.Answer, this._onPStreamAnswer);
      this._pstream.removeListener(Signaling.InternalEventName.Cancel, this._onPStreamCancel);
      this._pstream.removeListener(Signaling.InternalEventName.Close, this._onPStreamClose);
      this._pstream.removeListener(Signaling.InternalEventName.Connected, this._onPStreamConnected);
      this._pstream.removeListener(Signaling.InternalEventName.Error, this._onPStreamError);
      this._pstream.removeListener(Signaling.InternalEventName.Hangup, this._onPStreamHangup);
      this._pstream.removeListener(Signaling.InternalEventName.Invite, this._onPStreamInvite);
      this._pstream.removeListener(Signaling.InternalEventName.Message, this._onPStreamMessage);
      this._pstream.removeListener(Signaling.InternalEventName.Offline, this._onPStreamOffline);
      this._pstream.removeListener(Signaling.InternalEventName.Ready, this._onPStreamReady);
      this._pstream.removeListener(Signaling.InternalEventName.Ringing, this._onPStreamRinging);
      this._pstream.removeListener(Signaling.InternalEventName.Status, this._onPStreamStatus);
      this._pstream.removeListener(Signaling.InternalEventName.TransportClose, this._onPStreamTransportClose);
      this._pstream.removeListener(Signaling.InternalEventName.TransportOpen, this._onPStreamTransportOpen);

      this._pstream.destroy();
      this._pstream = null;
    }

    this._onPStreamOffline();

    this._pstreamConnectedPromise = null;
  }

  private _dtmf(callsid: string, digits: string) {
    this._pstream.dtmf(callsid, digits);
  }

  private _emitSignalingMessage(message: Signaling.Message) {
    const msgStr = JSON.stringify(message);
    this._log.debug(`#${Signaling.EventName.SignalingMessage}`, msgStr);
    this.emit(Signaling.EventName.SignalingMessage, msgStr);
  }

  private _hangup(callsid: string, message: string | null) {
    this._pstream.hangup(callsid, message);
  }

  private _handlePStreamPassthrough = (name: Signaling.InternalEventName, payload: Record<string, any>) => {
    this._log.debug('VSP ' + name);
    this._emitSignalingMessage({ type: 'event', payload: {
      name,
      params: [payload],
    }});
  }

  private _onPStreamAck = (payload: Record<string, any>) => {
    this._handlePStreamPassthrough(Signaling.InternalEventName.Ack, payload);
  }

  private _onPStreamAnswer = (payload: Record<string, any>) => {
    this._handlePStreamPassthrough(Signaling.InternalEventName.Answer, payload);
  }

  private _onPStreamCancel = (payload: Record<string, any>) => {
    this._log.debug('VSP cancel');
    this._removeCallInvite(payload.callsid);
    this._handlePStreamPassthrough(Signaling.InternalEventName.Cancel, payload);
  }

  private _onPStreamClose = () => {
    this._log.debug('VSP close');
    this._pstream = null;
    this._pstreamConnectedPromise = null;
    this._emitSignalingMessage({ type: 'event', payload: { name: Signaling.InternalEventName.Close }});
  }

  private _onPStreamConnected = (payload: Record<string, any>) => {
    this._log.debug('VSP connected');
    const region = getRegionShortcode(payload.region);
    this._edge = payload.edge || regionToEdge[region as Region] || payload.region;
    this._home = payload.home;
    this._region = payload.region;
    this._regionShortCode = region || payload.region;

    if (payload.token) {
      this._identity = payload.token.identity;
      if (
        typeof payload.token.ttl === 'number' &&
        typeof this._options.tokenRefreshMs === 'number'
      ) {
        const ttlMs: number = payload.token.ttl * 1000;
        const timeoutMs: number = Math.max(0, ttlMs - this._options.tokenRefreshMs);
        this._tokenWillExpireTimeout = setTimeout(() => {
          this._log.debug(`#${Signaling.EventName.TokenWillExpire}`);
          this.emit(Signaling.EventName.TokenWillExpire);
          this._emitSignalingMessage({ type: 'event', payload: { name: Signaling.EventName.TokenWillExpire }});

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

    this._emitSignalingMessage({ type: 'event', payload: {
      name: Signaling.InternalEventName.Connected,
      params: [{
        edge: this._edge,
        home: this._home,
        identity: this._identity,
        preferredURI: this._preferredURI,
        region: this._region,
        regionShortCode: this._regionShortCode,
      }],
    }});

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

    const { error: originalError, callsid, voiceeventsid } = payload;
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
        twilioError = getTwilioError(!!this._options.enableImprovedSignalingErrorPrecision, code, originalError);
      }
    }

    if (!twilioError) {
      this._log.warn('Unknown signaling error: ', originalError);
      twilioError = new GeneralErrors.UnknownError(customMessage, originalError);
    }

    this._log.error('Received error: ', twilioError);
    this._log.debug(`#${Signaling.EventName.Error}`, originalError);
    this.emit(Signaling.EventName.Error, twilioError);
    this._emitSignalingMessage({ type: 'event', payload: {
      name: Signaling.EventName.Error,
      params: [{
        callsid,
        code: twilioError.code,
        message: twilioError.message,
        voiceeventsid,
      }],
    }});
  }

  private _onPStreamHangup = (payload: Record<string, any>) => {
    this._handlePStreamPassthrough(Signaling.InternalEventName.Hangup, payload);
  }

  private _onPStreamInvite = (payload: Record<string, any>) => {
    this._log.debug('VSP invite');
    if (this._hasActiveCall && !this._options.allowIncomingWhileBusy) {
      this._log.debug('Signaling busy; ignoring incoming invite', payload);
      return;
    }

    if (!payload.callsid || !payload.sdp) {
      this._log.debug(`#${Signaling.EventName.Error}`, payload);
      const code = 31400;
      const message = 'Malformed invite from gateway';
      const twilioError = getTwilioError(!!this._options.enableImprovedSignalingErrorPrecision, code, message);
      this._log.debug(`#${Signaling.EventName.Error}`, twilioError);
      this.emit(Signaling.EventName.Error, twilioError);
      this._emitSignalingMessage({ type: 'event', payload: {
        name: Signaling.EventName.Error,
        params: [{ code, message }],
      }});
      return;
    }

    payload.parameters = payload.parameters || { };
    payload.parameters.CallSid = payload.parameters.CallSid || payload.callsid;
    this._callInvites.push(payload);

    this._log.debug(`#${Signaling.EventName.Incoming}`, payload);
    this.emit(Signaling.EventName.Incoming, payload.parameters);
    this._emitSignalingMessage({ type: 'event', payload: {
      name: Signaling.InternalEventName.Invite,
      params: [payload],
    }});
  }

  private _onPStreamMessage = (payload: Record<string, any>) => {
    this._handlePStreamPassthrough(Signaling.InternalEventName.Message, payload);
  }

  private _onPStreamOffline = () => {
    this._log.debug('VSP offline');
    this._edge = null;
    this._home = null;
    this._region = null;
    this._regionShortCode = null;
    this._shouldReRegister = this._state !== Signaling.State.Unregistered;
    this._setState(Signaling.State.Unregistered);
    this._emitSignalingMessage({ type: 'event', payload: { name: Signaling.InternalEventName.Offline }});
  }

  private _onPStreamReady = () => {
    this._log.debug('VSP ready');
    this._setState(Signaling.State.Registered);
    this._emitSignalingMessage({ type: 'event', payload: { name: Signaling.InternalEventName.Ready }});
  }

  private _onPStreamRinging = (payload: Record<string, any>) => {
    this._handlePStreamPassthrough(Signaling.InternalEventName.Ringing, payload);
  }

  private _onPStreamStatus = (payload: Record<string, any>) => {
    this._handlePStreamPassthrough(Signaling.InternalEventName.Status, payload);
  }

  private _onPStreamTransportClose = (payload: Record<string, any>) => {
    this._handlePStreamPassthrough(Signaling.InternalEventName.TransportClose, payload);
  }

  private _onPStreamTransportOpen = (payload: Record<string, any>) => {
    this._handlePStreamPassthrough(Signaling.InternalEventName.TransportOpen, payload);
  }

  private _answer(sdp: string, callsid: string) {
    this._pstream.answer(sdp, callsid);
  }

  private _invite(sdp: string, callsid: string, preflight: boolean, inviteParams: any) {
    this._pstream.invite(sdp, callsid, preflight, inviteParams);
  }

  private _reconnect(sdp: string, callsid: string, signalingReconnectToken: string) {
    this._pstream.reconnect(sdp, callsid, signalingReconnectToken);
  }

  private _reinvite(sdp: string, callsid: string) {
    this._pstream.reinvite(sdp, callsid);
  }

  private _reject(callsid: string) {
    this._pstream.reject(callsid);
  }

  private _removeCallInvite(callsid: string) {
    for (let i = 0; i < this._callInvites.length; i++) {
      const callInvite = this._callInvites[i];
      const currentCallSid = callInvite.callsid || callInvite.parameters.CallSid;
      if (currentCallSid === callsid) {
        this._callInvites.splice(i, 1);
      }
    }
  }

  private _retrieveCallInvites(): Record<string, any>[] {
    // Handoff invites and forget
    return this._callInvites.splice(0);
  }

  private _sendMessage(
    callSid: string, content: string, contentType: string, messageType: string, voiceEventSid: string
  ) {
    this._pstream.sendMessage(callSid, content, contentType, messageType, voiceEventSid);
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

  private _setHasActiveCall(hasActiveCall: boolean) {
    this._hasActiveCall = hasActiveCall;
  }

  private _setState(state: Signaling.State): void {
    if (state === this._state) {
      return;
    }

    this._state = state;
    const name = this._stateEventMapping[state];
    this._log.debug(`#${name}`);
    this.emit(name);
    this._emitSignalingMessage({ type: 'event', payload: { name }});
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

    this._pstream.addListener(Signaling.InternalEventName.Ack, this._onPStreamAck);
    this._pstream.addListener(Signaling.InternalEventName.Answer, this._onPStreamAnswer);
    this._pstream.addListener(Signaling.InternalEventName.Cancel, this._onPStreamCancel);
    this._pstream.addListener(Signaling.InternalEventName.Close, this._onPStreamClose);
    this._pstream.addListener(Signaling.InternalEventName.Connected, this._onPStreamConnected);
    this._pstream.addListener(Signaling.InternalEventName.Error, this._onPStreamError);
    this._pstream.addListener(Signaling.InternalEventName.Hangup, this._onPStreamHangup);
    this._pstream.addListener(Signaling.InternalEventName.Invite, this._onPStreamInvite);
    this._pstream.addListener(Signaling.InternalEventName.Message, this._onPStreamMessage);
    this._pstream.addListener(Signaling.InternalEventName.Offline, this._onPStreamOffline);
    this._pstream.addListener(Signaling.InternalEventName.Ready, this._onPStreamReady);
    this._pstream.addListener(Signaling.InternalEventName.Ringing, this._onPStreamRinging);
    this._pstream.addListener(Signaling.InternalEventName.Status, this._onPStreamStatus);
    this._pstream.addListener(Signaling.InternalEventName.TransportClose, this._onPStreamTransportClose);
    this._pstream.addListener(Signaling.InternalEventName.TransportOpen, this._onPStreamTransportOpen);

    return this._pstreamConnectedPromise =
      promisifyEvents(this._pstream, Signaling.InternalEventName.Connected, Signaling.InternalEventName.Close).then(() => this._pstream);
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

  private _updatePreferredURI(uri: string | null) {
    if (this._pstream) {
      this._pstream.updatePreferredURI(uri);
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

  async unregister(): Promise<void> {
    this._log.debug('.unregister');
    if (this._state !== Signaling.State.Registered) {
      throw new InvalidStateError(
        `Attempt to unregister when signaling is in state "${this._state}". ` +
        `Must be "${Signaling.State.Registered}".`,
      );
    }

    this._shouldReRegister = false;

    const pstream = await this._pstreamConnectedPromise;
    const pstreamOfflinePromise = new Promise(resolve => {
      pstream.on('offline', resolve);
    });
    await this._sendPresence(false);
    await pstreamOfflinePromise;
  }

  async sendSignalingMessage(message: string) {
    this._log.debug('.sendSignalingMessage', message);
    let messageObj: Signaling.Message;
    try {
      messageObj = JSON.parse(message);
    } catch {
      const msg = 'Unable to parse signaling message';
      this._log.error(msg);
      throw new Error(msg);
    }
    const { id, payload: { name, params = [] } } = messageObj;
    let result: any;
    try {
      if (name === Signaling.MethodName.Destroy) {
        result = this.destroy();
      } else if (name === Signaling.MethodName.Answer) {
        result = this._answer.apply(this, params);
      } else if (name === Signaling.MethodName.Dtmf) {
        result = this._dtmf.apply(this, params);
      } else if (name === Signaling.MethodName.Hangup) {
        result = this._hangup.apply(this, params);
      } else if (name === Signaling.MethodName.Invite) {
        result = this._invite.apply(this, params);
      } else if (name === Signaling.MethodName.Reconnect) {
        result = this._reconnect.apply(this, params);
      } else if (name === Signaling.MethodName.Reject) {
        result = this._reject.apply(this, params);
      } else if (name === Signaling.MethodName.Register) {
        result = await this.register();
      } else if (name === Signaling.MethodName.Reinvite) {
        result = this._reinvite.apply(this, params);
      } else if (name === Signaling.MethodName.RetrieveCallInvites) {
        result = this._retrieveCallInvites();
      } else if (name === Signaling.MethodName.SendMessage) {
        result = this._sendMessage.apply(this, params);
      } else if (name === Signaling.MethodName.SetHasActiveCall) {
        result = this._setHasActiveCall.apply(this, params);
      } else if (name === Signaling.MethodName.Unregister) {
        result = await this.unregister();
      } else if (name === Signaling.MethodName.UpdateOptions) {
        result = this.updateOptions.apply(this, params);
      } else if (name === Signaling.MethodName.UpdatePreferredURI) {
        result = this._updatePreferredURI.apply(this, params);
      } else if (name === Signaling.MethodName.UpdateToken) {
        result = this.updateToken.apply(this, params);
      } else {
        this._log.warn('Received unrecognized signaling message');
        return;
      }
    } catch (err) {
      const msg = `Error invoking ${name} method from signaling message`;
      this._log.error(msg, err);
      this._emitSignalingMessage({ id, type: 'method', payload: { name, error: { message: err.message } }});
      return;
    }
    this._emitSignalingMessage({ id, type: 'method', payload: { name, result }});
  }

  destroy() {
    this._log.debug('.destroy');
    this._stopRegistrationTimer();
    this._destroyPStream();
    this._setState(Signaling.State.Destroyed);
  }

  updateOptions(options: Signaling.Options) {
    this._log.debug('.updateOptions', JSON.stringify(options));
    if (this._state === Signaling.State.Destroyed) {
      throw new InvalidStateError(
        `Attempt to "updateOptions" when signaling is in state "${this._state}".`,
      );
    }
    const newOptions = { ...this._defaultOptions, ...this._options, ...options };
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

    if (this._hasActiveCall && hasChunderURIsChanged) {
      throw new InvalidStateError('Cannot change Edge while on an active Call');
    }
    
    this._options = newOptions;
    this._chunderURIs = newChunderURIs;
    this._log.setDefaultLevel(this._options.logLevel);

    if (hasChunderURIsChanged) {
      this._setupPStream();
    }
  }

  updateToken(token: string) {
    this._log.debug('.updateToken');

    // WARNING: These checks are duplicated in Device.updateToken
    // Combine once we start getting more of these
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
}

namespace Signaling {

  export enum EventName {
    Error = 'error',
    Destroyed = 'destroyed',
    Incoming = 'incoming',
    Unregistered = 'unregistered',
    Registering = 'registering',
    Registered = 'registered',
    SignalingMessage = 'signalingMessage',
    TokenWillExpire = 'tokenWillExpire',
  }

  /**
   * @private
   */
  export enum InternalEventName {
    Ack = 'ack',
    Answer = 'answer',
    Cancel = 'cancel',
    Close = 'close',
    Connected = 'connected',
    Error = 'error',
    Hangup = 'hangup',
    Invite = 'invite',
    Offline = 'offline',
    Ready = 'ready',
    Ringing = 'ringing',
    Status = 'status',
    TransportClose = 'transportClose',
    TransportOpen = 'transportOpen',
    Message = 'message',
  }

  /**
   * @private
   * Internal methods that can be invoked with a signaling message
   */
  export enum MethodName {
    Answer = 'answer',
    Destroy = 'destroy',
    Dtmf = 'dtmf',
    Hangup = 'hangup',
    Invite = 'invite',
    Reconnect = 'reconnect',
    Register = 'register',
    Reinvite = 'reinvite',
    Reject = 'reject',
    RetrieveCallInvites = 'retrieveCallInvites',
    SendMessage = 'sendMessage',
    SetHasActiveCall = 'setHasActiveCall',
    Unregister = 'unregister',
    UpdateOptions = 'updateOptions',
    UpdatePreferredURI = 'updatePreferredURI',
    UpdateToken = 'updateToken',
  }

  export interface Message {
    id?: number;
    type: 'event' | 'method';
    payload: {
      error?: { message: string },
      name: string;
      params?: any[];
      result?: any;
    }
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
