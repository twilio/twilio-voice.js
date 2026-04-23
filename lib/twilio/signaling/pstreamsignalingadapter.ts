import { EventEmitter } from 'events';
import {
  AnswerConfig,
  DtmfConfig,
  HangupConfig,
  InviteConfig,
  ReconnectConfig,
  ReinviteConfig,
  SendMessageConfig,
  SignalingAdapter,
  SignalingAdapterStatus,
} from './signalingadapter';

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

  get gateway(): string | undefined {
    return this._pstream.gateway;
  }

  get region(): string | undefined {
    return this._pstream.region;
  }

  get status(): SignalingAdapterStatus {
    return this._pstream.status;
  }

  get uri(): string {
    return this._pstream.uri;
  }

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

  invite(callSid: string, config: InviteConfig): void {
    const { sdp, params } = config;
    this._pstream.invite(sdp, callSid, params);
  }

  answer(callSid: string, config: AnswerConfig): void {
    const { sdp } = config;
    this._pstream.answer(sdp, callSid);
  }

  hangup(callSid: string, config: HangupConfig = {}): void {
    const { message } = config;
    this._pstream.hangup(callSid, message);
  }

  reject(callSid: string): void {
    this._pstream.reject(callSid);
  }

  reinvite(callSid: string, config: ReinviteConfig): void {
    const { sdp } = config;
    this._pstream.reinvite(sdp, callSid);
  }

  reconnect(callSid: string, config: ReconnectConfig): void {
    const { sdp, reconnectToken } = config;
    this._pstream.reconnect(sdp, callSid, reconnectToken);
  }

  dtmf(callSid: string, config: DtmfConfig): void {
    const { digits } = config;
    this._pstream.dtmf(callSid, digits);
  }

  sendMessage(callSid: string, config: SendMessageConfig): void {
    const { content, contentType, messageType, voiceEventSid } = config;
    this._pstream.sendMessage(callSid, content, contentType, messageType, voiceEventSid);
  }

  register(mediaCapabilities: Record<string, any>): void {
    this._pstream.register(mediaCapabilities);
  }
}
