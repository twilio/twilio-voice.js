import { EventEmitter } from 'events';
import {
  AnswerConfig,
  DtmfConfig,
  HangupConfig,
  IceRestartConfig,
  InviteConfig,
  ReconnectConfig,
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

  invite(callSid: string, { sdp, params }: InviteConfig): void {
    this._pstream.invite(sdp, callSid, params);
  }

  answer(callSid: string, { sdp }: AnswerConfig): void {
    if (typeof sdp !== 'string') {
      throw new Error('PStreamSignalingAdapter.answer: sdp is required');
    }
    this._pstream.answer(sdp, callSid);
  }

  hangup(callSid: string, { message }: HangupConfig = {}): void {
    this._pstream.hangup(callSid, message);
  }

  reject(callSid: string): void {
    this._pstream.reject(callSid);
  }

  iceRestart(callSid: string, { mediaHandler }: IceRestartConfig): void {
    // Call (on PStream) owns offer generation: mediaHandler produces a
    // fresh-ICE offer; we ship it via the existing reinvite wire.
    try {
      mediaHandler.iceRestart((offerSdp: string) => {
        this._pstream.reinvite(offerSdp, callSid);
      });
    } catch {
      this.emit('hangup', { callsid: callSid });
    }
  }

  reconnect(callSid: string, { sdp, reconnectToken }: ReconnectConfig): void {
    this._pstream.reconnect(sdp, callSid, reconnectToken);
  }

  dtmf(callSid: string, { digits }: DtmfConfig): void {
    this._pstream.dtmf(callSid, digits);
  }

  sendMessage(callSid: string, { content, contentType, messageType, voiceEventSid }: SendMessageConfig): void {
    this._pstream.sendMessage(callSid, content, contentType, messageType, voiceEventSid);
  }

  register(mediaCapabilities: Record<string, any>): void {
    this._pstream.register(mediaCapabilities);
  }
}
