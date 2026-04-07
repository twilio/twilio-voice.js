import { EventEmitter } from 'events';

export type SignalingAdapterStatus = 'disconnected' | 'connected' | 'ready' | 'offline';

export interface SignalingAdapter extends EventEmitter {
  status: SignalingAdapterStatus;
  uri: string;
  gateway?: string;
  region?: string;

  setToken(token: string): void;
  destroy(): void;
  updatePreferredURI(uri: string | null): void;
  updateURIs(uris: string[]): void;

  invite(sdp: string, callSid: string, params: string): void;
  answer(sdp: string, callSid: string): void;
  hangup(callSid: string, message?: string | null): void;
  reject(callSid: string): void;
  reinvite(sdp: string, callSid: string): void;
  reconnect(sdp: string, callSid: string, reconnectToken: string): void;

  dtmf(callSid: string, digits: string): void;
  sendMessage(callSid: string, content: string, contentType: string | undefined,
              messageType: string, voiceEventSid: string): void;
  register(mediaCapabilities: Record<string, any>): void;
}

export type SignalingAdapterEvent =
  | 'invite' | 'answer' | 'ringing' | 'hangup' | 'cancel'
  | 'error' | 'offline' | 'ready' | 'connected' | 'transportClose'
  | 'transportOpen' | 'ack' | 'message' | 'candidate' | 'presence' | 'roster' | 'close';
