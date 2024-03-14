/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
import { EventEmitter } from 'events';
import Signaling from './signaling';
import Log from '../log';
import Deferred from '../deferred';

class SignalingProxy extends EventEmitter {

  private _previousId: number = Date.now();
  private _deferredPromises: Map<number, Deferred> = new Map();
  private _log: Log = new Log('SignalingProxy');
  private _status: 'disconnected' | 'connected' | 'ready' | 'offline' = 'disconnected';
  private _token: string;

  constructor() {
    super();
    this._log.debug('.constructor');
  }

  private _emitSignalingMessage(message: Signaling.Message) {
    const msgStr = JSON.stringify(message);
    this._log.debug(`#${Signaling.EventName.SignalingMessage}`, msgStr);
    this.emit(Signaling.EventName.SignalingMessage, msgStr);
  }

  private _generateId(): number {
    return this._previousId++;
  }

  private async _defer(method: string, ...params: any[]) {
    const deferred = new Deferred();
    const id = this._generateId();
    this._deferredPromises.set(id, deferred);
    this._emitSignalingMessage({ id, type: 'method', payload: { name: method, params }});
    return deferred.promise;
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
    const { id, type, payload: { error, name, params = [], result } } = messageObj;
    if (type === 'event') {
      if (name === 'status') {
        this._status = params[0];
      }
      this.emit(name, ...params);
    } else if (type === 'method' && id && this._deferredPromises.has(id)) {
      const deferred = this._deferredPromises.get(id);
      this._deferredPromises.delete(id);
      if (error) {
        deferred!.reject(new Error(error.message));
      } else {
        deferred!.resolve(result);
      }
    }
  }

  get status() {
    return this._status;
  }

  get token() {
    return this._token;
  }

  async answer(sdp: string, callsid: string) {
    this._log.debug('.answer');
    return this._defer(Signaling.MethodName.Answer, sdp, callsid);
  }

  async invite(sdp: string, callsid: string, preflight: boolean, inviteParams: any) {
    this._log.debug('.invite');
    return this._defer(Signaling.MethodName.Invite, sdp, callsid, preflight, inviteParams);
  }

  async reinvite(sdp: string, callsid: string) {
    this._log.debug('.reinvite');
    return this._defer(Signaling.MethodName.Reinvite, sdp, callsid);
  }

  async register() {
    this._log.debug('.register');
    return this._defer(Signaling.MethodName.Register);
  }

  async unregister() {
    this._log.debug('.unregister');
    return this._defer(Signaling.MethodName.Unregister);
  }

  async destroy() {
    this._log.debug('.destroy');
    return this._defer(Signaling.MethodName.Destroy);
  }

  async dtmf(callsid: string, digits: string) {
    this._log.debug('.dtmf');
    return this._defer(Signaling.MethodName.Dtmf, callsid, digits);
  }

  async hangup(callsid: string, message: string | null) {
    this._log.debug('.hangup');
    return this._defer(Signaling.MethodName.Hangup, callsid, message);
  }

  async reconnect(sdp: string, callsid: string, signalingReconnectToken: string) {
    this._log.debug('.reconnect');
    return this._defer(Signaling.MethodName.Reconnect, sdp, callsid, signalingReconnectToken);
  }

  async reject(callsid: string) {
    this._log.debug('.reject');
    return this._defer(Signaling.MethodName.Reject, callsid);
  }

  async retrieveCallInvites(): Promise<Record<string, any>[]> {
    this._log.debug('.retrieveCallInvites');
    return this._defer(Signaling.MethodName.RetrieveCallInvites);
  }

  async sendMessage(
    callSid: string, content: string, contentType: string | undefined, messageType: string, voiceEventSid: string | undefined
  ) {
    this._log.debug('.sendMessage');
    return this._defer(Signaling.MethodName.SendMessage, callSid, content, contentType, messageType, voiceEventSid);
  }

  async setHasActiveCall(hasActiveCall: boolean) {
    this._log.debug('.setHasActiveCall');
    return this._defer(Signaling.MethodName.SetHasActiveCall, hasActiveCall);
  }

  async updateOptions(options: Signaling.Options) {
    this._log.debug('.updateOptions');
    return this._defer(Signaling.MethodName.UpdateOptions, options);
  }

  async updatePreferredURI(uri: string | null) {
    this._log.debug('.updatePreferredURI');
    return this._defer(Signaling.MethodName.UpdatePreferredURI, uri);
  }

  async updateToken(token: string) {
    this._log.debug('.updateToken');
    // TODO: make sure this._token is also updated when signaling.updateToken is called
    this._token = token;
    return this._defer(Signaling.MethodName.UpdateToken, token);
  }
}

export default SignalingProxy;
