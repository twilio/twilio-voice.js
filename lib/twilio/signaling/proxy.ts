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

  constructor() {
    super();
    this._log.debug('.constructor');
  }

  private _emitSignalingMessage(message: Signaling.Message) {
    const msgStr = JSON.stringify(message);
    this._log.debug(`#${Signaling.Events.SignalingMessage}`, msgStr);
    this.emit(Signaling.Events.SignalingMessage, msgStr);
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
    const { id, type, payload: { name, params = [], result } } = messageObj;
    if (type === 'event') {
      this.emit(name, ...params);
    } else if (type === 'method' && id && this._deferredPromises.has(id)) {
      const deferred = this._deferredPromises.get(id);
      this._deferredPromises.delete(id);
      deferred!.resolve(result);
    }
  }

  async register() {
    this._log.debug('.register');
    return this._defer('register');
  }

  async unregister() {
    this._log.debug('.unregister');
    return this._defer('unregister');
  }

  destroy() {
    this._log.debug('.destroy');
    this._defer('destroy');
  }

  updateOptions(options: Signaling.Options) {
    this._log.debug('.updateOptions');
    return this._defer('updateOptions', options);
  }

  updateToken(token: string) {
    this._log.debug('.updateToken');
    return this._defer('updateToken', token);
  }
}

export default SignalingProxy;
