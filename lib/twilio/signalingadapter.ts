export interface SignalingAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  register(token: string): Promise<void>;
  invite(target: any, sdpOffer: any, callParams: any): Promise<void>;
  answer(sessionId: any, sdpAnswer: any): Promise<void>;
  hangup(sessionId: any): Promise<void>;
  reject(sessionId: any): Promise<void>;
  sendDTMF(sessionId: any, digit: any): Promise<void>;
  sendReinvite(sessionId: any, sdpOffer: any): Promise<void>;
}
