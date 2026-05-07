import { EventEmitter } from 'events';
import type { IMediaHandler } from './mediahandler';
import type { IPeerConnection } from './sipsessiondescriptionhandler';

export type SignalingAdapterStatus = 'disconnected' | 'connected' | 'ready' | 'offline';

export interface InviteConfig {
  sdp: string;
  // Optional: PStream encodes these as the INVITE body; reconnect flows
  // and the SIP adapter don't carry caller-supplied params, so callers
  // can omit this field instead of passing a dummy empty string.
  params?: string;
  peerConnection?: IPeerConnection;
  rtcConfiguration?: RTCConfiguration;
}

export interface AnswerConfig {
  // Optional because the SIP adapter derives the answer SDP from the
  // invitation body via the SDH, rather than receiving it from the
  // caller. The PStream adapter requires it and will reject undefined.
  sdp?: string;
  peerConnection?: IPeerConnection;
  rtcConfiguration?: RTCConfiguration;
}

export interface HangupConfig {
  message?: string;
}

export interface IceRestartConfig {
  // Used by the PStream adapter to generate the fresh-ICE offer; the
  // SIP adapter ignores it because SIP.js asks the SDH to produce the
  // offer via session.invite() + offerOptions.iceRestart.
  mediaHandler: IMediaHandler;
}

export interface ReconnectConfig {
  sdp: string;
  reconnectToken: string;
  peerConnection?: IPeerConnection;
  rtcConfiguration?: RTCConfiguration;
}

export interface DtmfConfig {
  digits: string;
}

export interface SendMessageConfig {
  content: string;
  contentType?: string;
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
  hangup(callSid: string, config: HangupConfig): void;
  reject(callSid: string): void;
  reconnect(callSid: string, config: ReconnectConfig): void;

  /**
   * Trigger an ICE restart for the given call. Each adapter encapsulates
   * its own offer-generation strategy:
   *  - PStream: asks config.mediaHandler to generate the offer, then
   *    ships it via the existing reinvite wire.
   *  - SIP: calls session.invite() with offerOptions.iceRestart so SIP.js
   *    asks the SDH to produce the offer itself.
   * On failure, emits 'hangup' for the callSid so Call can clean up its
   * reinvite listeners.
   */
  iceRestart(callSid: string, config: IceRestartConfig): void;

  dtmf(callSid: string, config: DtmfConfig): void;
  sendMessage(callSid: string, config: SendMessageConfig): void;
  register(mediaCapabilities: Record<string, any>): void;
}

export type SignalingAdapterEvent =
  | 'invite' | 'answer' | 'ringing' | 'hangup' | 'cancel'
  | 'error' | 'offline' | 'ready' | 'connected' | 'transportClose'
  | 'transportOpen' | 'ack' | 'message' | 'candidate' | 'presence' | 'roster' | 'close';
