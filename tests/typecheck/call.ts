import { Call, Device, RTCSample, RTCWarning, TwilioError } from '../../lib/twilio';

const checkCall = async () => {
  const call: Call = await (new Device('foo', {})).connect();

  // --- Events ---

  call.on('accept', (acceptedCall: Call) => {
    const c: Call = acceptedCall;
  });

  call.on('audio', (remoteAudio: HTMLAudioElement) => {
    const el: HTMLAudioElement = remoteAudio;
  });

  call.on('cancel', () => {});

  call.on('disconnect', (disconnectedCall: Call) => {
    const c: Call = disconnectedCall;
  });

  call.on('error', (error: TwilioError.TwilioError) => {
    const code: number = error.code;
    const message: string = error.message;
  });

  call.on('messageReceived', (message: Call.Message) => {
    const content: string = message.content;
    const contentType: string | undefined = message.contentType;
    const messageType: string = message.messageType;
    const voiceEventSid: string | undefined = message.voiceEventSid;
  });

  call.on('messageSent', (message: Call.Message) => {
    const content: string = message.content;
    const messageType: string = message.messageType;
  });

  call.on('mute', (isMuted: boolean, mutedCall: Call) => {
    const m: boolean = isMuted;
    const c: Call = mutedCall;
  });

  call.on('reconnected', () => {});

  call.on('reconnecting', (error: TwilioError.TwilioError) => {
    const code: number = error.code;
  });

  call.on('reject', () => {});

  call.on('ringing', (hasEarlyMedia: boolean) => {
    const early: boolean = hasEarlyMedia;
  });

  call.on('sample', (sample: RTCSample) => {
    const audioInputLevel: number = sample.audioInputLevel;
    const audioOutputLevel: number = sample.audioOutputLevel;
  });

  call.on('volume', (inputVolume: number, outputVolume: number) => {
    const iv: number = inputVolume;
    const ov: number = outputVolume;
  });

  call.on('warning', (name: string, data: any) => {
    const warningName: string = name;
  });

  call.on('warning-cleared', (name: string) => {
    const warningName: string = name;
  });

  // --- Properties ---

  const isVerified: boolean | undefined = call.callerInfo?.isVerified;
  const customParameters: Map<string, string> = call.customParameters;
  const outboundConnectionId: string | undefined = call.outboundConnectionId;
  const parameters: Record<string, string> = call.parameters;

  const codec: string = call.codec;
  const direction: Call.CallDirection = call.direction;
  const connectToken: string | undefined = call.connectToken;

  // --- Methods ---

  const acceptOptions: Call.AcceptOptions = {
    rtcConfiguration: {},
    rtcConstraints: {},
  };
  call.accept(acceptOptions);
  call.accept();

  call.disconnect();
  call.ignore();
  call.mute();
  call.mute(true);
  call.mute(false);
  call.reject();
  call.sendDigits('123*#w');
  const voiceEventSid: string = call.sendMessage({ content: 'foo', messageType: 'user-defined-message' });
  call.sendMessage({ content: { hello: 'world' }, contentType: 'application/json', messageType: 'user-defined-message' });

  await call.postFeedback(Call.FeedbackScore.One, Call.FeedbackIssue.AudioLatency);
  await call.postFeedback(Call.FeedbackScore.Two, Call.FeedbackIssue.ChoppyAudio);
  await call.postFeedback(Call.FeedbackScore.Three, Call.FeedbackIssue.DroppedCall);
  await call.postFeedback(Call.FeedbackScore.Four, Call.FeedbackIssue.Echo);
  await call.postFeedback(Call.FeedbackScore.Five, Call.FeedbackIssue.NoisyCall);
  await call.postFeedback(Call.FeedbackScore.Five, Call.FeedbackIssue.OneWayAudio);
  await call.postFeedback();

  const isMuted: boolean = call.isMuted();
  const localStream: MediaStream | undefined = call.getLocalStream();
  const remoteStream: MediaStream | undefined = call.getRemoteStream();
  const status: Call.State = call.status();

  // --- Enums ---

  // Call.State
  const closed: Call.State = Call.State.Closed;
  const connecting: Call.State = Call.State.Connecting;
  const open: Call.State = Call.State.Open;
  const pending: Call.State = Call.State.Pending;
  const reconnecting: Call.State = Call.State.Reconnecting;
  const ringing: Call.State = Call.State.Ringing;

  // Call.CallDirection
  const incoming: Call.CallDirection = Call.CallDirection.Incoming;
  const outgoing: Call.CallDirection = Call.CallDirection.Outgoing;

  // Call.Codec
  const opus: Call.Codec = Call.Codec.Opus;
  const pcmu: Call.Codec = Call.Codec.PCMU;

  // Call.FeedbackScore
  const s1: Call.FeedbackScore = Call.FeedbackScore.One;
  const s2: Call.FeedbackScore = Call.FeedbackScore.Two;
  const s3: Call.FeedbackScore = Call.FeedbackScore.Three;
  const s4: Call.FeedbackScore = Call.FeedbackScore.Four;
  const s5: Call.FeedbackScore = Call.FeedbackScore.Five;

  // Call.FeedbackIssue
  const i1: Call.FeedbackIssue = Call.FeedbackIssue.AudioLatency;
  const i2: Call.FeedbackIssue = Call.FeedbackIssue.ChoppyAudio;
  const i3: Call.FeedbackIssue = Call.FeedbackIssue.DroppedCall;
  const i4: Call.FeedbackIssue = Call.FeedbackIssue.Echo;
  const i5: Call.FeedbackIssue = Call.FeedbackIssue.NoisyCall;
  const i6: Call.FeedbackIssue = Call.FeedbackIssue.OneWayAudio;

  // Call.MediaFailure
  const mf1: Call.MediaFailure = Call.MediaFailure.ConnectionDisconnected;
  const mf2: Call.MediaFailure = Call.MediaFailure.ConnectionFailed;
  const mf3: Call.MediaFailure = Call.MediaFailure.IceGatheringFailed;
  const mf4: Call.MediaFailure = Call.MediaFailure.LowBytes;

  // Call.IceGatheringFailureReason
  const ig1: Call.IceGatheringFailureReason = Call.IceGatheringFailureReason.None;
  const ig2: Call.IceGatheringFailureReason = Call.IceGatheringFailureReason.Timeout;
};

export default checkCall;
