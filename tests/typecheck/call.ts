import { Call, Device } from '../../lib/twilio';

const checkCall = async () => {
  const call: Call = await (new Device('foo', {})).connect();

  call.on('messageReceived', (message: Call.Message) => {
    const content: string = message.content;
    const contentType: string | undefined = message.contentType;
    const messageType: string = message.messageType;
    const voiceEventSid: string | undefined = message.voiceEventSid;
  });

  const isVerified: boolean | undefined = call.callerInfo?.isVerified;
  const customParameters: Map<string, string> = call.customParameters;
  const outboundConnectionId: string | undefined =  call.outboundConnectionId;
  const parameters: Record<string, string> = call.parameters;

  const codec: string = call.codec;
  const direction: Call.CallDirection = call.direction;

  call.accept({
    rtcConfiguration: {},
    rtcConstraints: {},
  });

  call.disconnect();
  call.ignore();
  call.mute();
  call.reject();
  call.sendDigits('foo');
  call.sendMessage({ content: 'foo', messageType: 'user-defined-message' });

  await call.postFeedback(Call.FeedbackScore.One, Call.FeedbackIssue.AudioLatency);
  const connectToken: string | undefined = call.connectToken;
  const isMuted: boolean = call.isMuted();
  const localStream: MediaStream | undefined = call.getLocalStream();
  const remoteStream: MediaStream | undefined = call.getRemoteStream();
  const status: Call.State = call.status();
};

export default checkCall;
