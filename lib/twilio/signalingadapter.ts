import { EventEmitter } from 'events';
import PStream from './pstream';

/**
 * Interface that signaling adapters must implement. Device uses this interface
 * so that PStream can be swapped out for alternative signaling implementations.
 * @private
 */
export interface ISignalingAdapter extends EventEmitter {
  gateway: string | null;
  region: string | null;
  status: string;
  uri: string | null;

  answer(sdp: string, callsid: string): void;
  destroy(): this;
  dtmf(callsid: string, digits: string): void;
  hangup(callsid: string, message?: string): void;
  invite(sdp: string, callsid: string, params?: Record<string, string>): void;
  publish(type: string, payload: Record<string, any>): void;
  reconnect(sdp: string, callsid: string, reconnect: string): void;
  register(mediaCapabilities: Record<string, any>): void;
  reinvite(sdp: string, callsid: string): void;
  reject(callsid: string): void;
  sendMessage(
    callsid: string,
    content: string,
    contenttype: string | undefined,
    messagetype: string,
    voiceeventsid: string,
  ): void;
  setToken(token: string): void;
  updatePreferredURI(uri: string | null): void;
  updateURIs(uris: string[]): void;
}

/**
 * Wraps PStream to implement ISignalingAdapter. All method calls are
 * forwarded 1:1 to the underlying PStream instance.
 * @private
 */
export class PStreamAdapter extends EventEmitter implements ISignalingAdapter {
  private readonly _pstream: any;

  constructor(token: string | null, uris: string[], options?: Record<string, any>) {
    super();
    this._pstream = new PStream(token, uris, options);

    // Forward all events from the underlying PStream to this adapter.
    const originalEmit = this._pstream.emit.bind(this._pstream);
    this._pstream.emit = (event: string, ...args: any[]) => {
      this.emit(event, ...args);
      return originalEmit(event, ...args);
    };
  }

  get gateway(): string | null {
    return this._pstream.gateway;
  }

  get region(): string | null {
    return this._pstream.region;
  }

  get status(): string {
    return this._pstream.status;
  }

  get uri(): string | null {
    return this._pstream.uri;
  }

  answer(sdp: string, callsid: string): void {
    this._pstream.answer(sdp, callsid);
  }

  destroy(): this {
    this._pstream.destroy();
    return this;
  }

  dtmf(callsid: string, digits: string): void {
    this._pstream.dtmf(callsid, digits);
  }

  hangup(callsid: string, message?: string): void {
    this._pstream.hangup(callsid, message);
  }

  invite(sdp: string, callsid: string, params?: Record<string, string>): void {
    this._pstream.invite(sdp, callsid, params);
  }

  publish(type: string, payload: Record<string, any>): void {
    this._pstream.publish(type, payload);
  }

  reconnect(sdp: string, callsid: string, reconnect: string): void {
    this._pstream.reconnect(sdp, callsid, reconnect);
  }

  register(mediaCapabilities: Record<string, any>): void {
    this._pstream.register(mediaCapabilities);
  }

  reinvite(sdp: string, callsid: string): void {
    this._pstream.reinvite(sdp, callsid);
  }

  reject(callsid: string): void {
    this._pstream.reject(callsid);
  }

  sendMessage(
    callsid: string,
    content: string,
    contenttype: string | undefined,
    messagetype: string,
    voiceeventsid: string,
  ): void {
    this._pstream.sendMessage(callsid, content, contenttype, messagetype, voiceeventsid);
  }

  setToken(token: string): void {
    this._pstream.setToken(token);
  }

  updatePreferredURI(uri: string | null): void {
    this._pstream.updatePreferredURI(uri);
  }

  updateURIs(uris: string[]): void {
    this._pstream.updateURIs(uris);
  }
}
