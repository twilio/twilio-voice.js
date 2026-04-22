import { EventEmitter } from 'events';

export type SignalingAdapterStatus = 'disconnected' | 'connected' | 'ready' | 'offline';

export interface InviteConfig {
  sdp: string;
  params: string;
}

export interface AnswerConfig {
  sdp: string;
}

export interface HangupConfig {
  message?: string | null;
}

export interface ReinviteConfig {
  sdp: string;
}

export interface ReconnectConfig {
  sdp: string;
  reconnectToken: string;
}

export interface DtmfConfig {
  digits: string;
}

export interface SendMessageConfig {
  content: string;
  contentType: string | undefined;
  messageType: string;
  voiceEventSid: string;
}

export interface SignalingAdapter extends EventEmitter {
  status: SignalingAdapterStatus;
  uri: string;
  gateway?: string;
  region?: string;

  setToken(token: string): void;
  destroy(): void;
  updatePreferredURI(uri: string | null): void;
  updateURIs(uris: string[]): void;

  invite(callSid: string, config: InviteConfig): void;
  answer(callSid: string, config: AnswerConfig): void;
  hangup(callSid: string, config?: HangupConfig): void;
  reject(callSid: string): void;
  reinvite(callSid: string, config: ReinviteConfig): void;
  reconnect(callSid: string, config: ReconnectConfig): void;

  dtmf(callSid: string, config: DtmfConfig): void;
  sendMessage(callSid: string, config: SendMessageConfig): void;
  register(mediaCapabilities: Record<string, any>): void;
}

export type SignalingAdapterEvent =
  | 'invite' | 'answer' | 'ringing' | 'hangup' | 'cancel'
  | 'error' | 'offline' | 'ready' | 'connected' | 'transportClose'
  | 'transportOpen' | 'ack' | 'message' | 'candidate' | 'presence' | 'roster' | 'close';
