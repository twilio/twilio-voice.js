import { EventEmitter } from 'events';
import { SignalingAdapter, SignalingAdapterStatus } from './signalingadapter';

const EVENTS_TO_FORWARD = [
  'ack', 'answer', 'cancel', 'candidate', 'close', 'connected',
  'error', 'hangup', 'invite', 'message', 'offline', 'presence',
  'ready', 'ringing', 'roster', 'transportClose', 'transportOpen',
];

export class PStreamSignalingAdapter extends EventEmitter implements SignalingAdapter {
  private _pstream: any;

  constructor(pstream: any) {
    super();
    this._pstream = pstream;

    for (const event of EVENTS_TO_FORWARD) {
      this._pstream.on(event, (...args: any[]) => this.emit(event, ...args));
    }
  }

  get status(): SignalingAdapterStatus { return this._pstream.status; }
  get uri(): string { return this._pstream.uri; }
  get gateway(): string | undefined { return this._pstream.gateway; }
  get region(): string | undefined { return this._pstream.region; }

  setToken(token: string): void {
    this._pstream.setToken(token);
  }

  destroy(): void {
    this._pstream.destroy();
  }

  updatePreferredURI(uri: string | null): void {
    this._pstream.updatePreferredURI(uri);
  }

  updateURIs(uris: string[]): void {
    this._pstream.updateURIs(uris);
  }

  invite(sdp: string, callSid: string, params: string): void {
    this._pstream.invite(sdp, callSid, params);
  }

  answer(sdp: string, callSid: string): void {
    this._pstream.answer(sdp, callSid);
  }

  hangup(callSid: string, message?: string | null): void {
    this._pstream.hangup(callSid, message);
  }

  reject(callSid: string): void {
    this._pstream.reject(callSid);
  }

  reinvite(sdp: string, callSid: string): void {
    this._pstream.reinvite(sdp, callSid);
  }

  reconnect(sdp: string, callSid: string, reconnectToken: string): void {
    this._pstream.reconnect(sdp, callSid, reconnectToken);
  }

  dtmf(callSid: string, digits: string): void {
    this._pstream.dtmf(callSid, digits);
  }

  sendMessage(
    callSid: string, content: string, contentType: string | undefined,
    messageType: string, voiceEventSid: string,
  ): void {
    this._pstream.sendMessage(callSid, content, contentType, messageType, voiceEventSid);
  }

  register(mediaCapabilities: Record<string, any>): void {
    this._pstream.register(mediaCapabilities);
  }
}
