import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';

// Chrome re-serializes localDescription, hiding malformed SDP. Some wrappers
// (e.g. Citrix HDX WebRTC redirection) pass it through verbatim. This mimics
// that for fmtp lines while keeping Chrome's gathered ICE candidates. A factory,
// not a subclass, because the ES5 build can't extend native classes.
function VerbatimFmtpRTCPeerConnection(configuration?: RTCConfiguration) {
  const pc: any = new RTCPeerConnection(configuration);
  const nativeSetLocalDescription = pc.setLocalDescription.bind(pc);
  const nativeLocalDescription = Object.getOwnPropertyDescriptor(RTCPeerConnection.prototype, 'localDescription')!;
  let fmtpLines = new Map<string, string>();

  pc.setLocalDescription = (description?: RTCSessionDescriptionInit) => {
    fmtpLines = new Map((description?.sdp || '').split('\n')
      .filter(line => line.startsWith('a=fmtp:'))
      .map(line => [line.split(' ')[0], line] as [string, string]));
    return nativeSetLocalDescription(description);
  };

  Object.defineProperty(pc, 'localDescription', {
    get() {
      const description = nativeLocalDescription.get!.call(pc);
      if (!description) {
        return description;
      }
      const sdp = description.sdp.split('\n')
        .map((line: string) => fmtpLines.get(line.split(' ')[0]) || line)
        .join('\n');
      return { sdp, type: description.type };
    },
  });

  return pc;
}

describe('maxAverageBitrate', () => {
  let device1: Device;
  let device2: Device;
  let identity2: string;

  before(async () => {
    const identity1 = 'id1-' + Date.now();
    identity2 = 'id2-' + Date.now();
    const [token1, token2] = await Promise.all([
      generateAccessToken(identity1),
      generateAccessToken(identity2),
    ]);
    const options = {
      RTCPeerConnection: VerbatimFmtpRTCPeerConnection,
      codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
      maxAverageBitrate: 16000,
    };
    device1 = new Device(token1, options);
    device2 = new Device(token2, options);
    await Promise.all([device1.register(), device2.register()]);
  });

  afterEach(() => {
    device1.disconnectAll();
    device2.disconnectAll();
  });

  after(() => {
    [device1, device2].forEach(device => {
      if (device) {
        device.destroy();
      }
    });
  });

  it('should send well-formed CRLF SDP and connect the call', () => {
    // An async it() is cut off at defaultCommandTimeout, so run the call inside a cy command.
    cy.wrap(null).then({ timeout: 30000 }, async () => {
      const incoming = new Promise<Call>(resolve => device2.once(Device.EventName.Incoming, resolve));
      const call1 = await device1.connect({ params: { To: identity2 } });
      // The caller's leg can be answered before the callee accepts, so listen now.
      const call1Accepted = new Promise(resolve => call1.once('accept', resolve));
      const failed = new Promise<never>((_, reject) => {
        call1.once('error', (error: any) => reject(new Error(`call1 error ${error.code}: ${error.message}`)));
        call1.once('disconnect', () => reject(new Error('call1 disconnected before accept')));
      });
      // Teardown disconnects the call after the test; don't surface that as unhandled.
      failed.catch(() => undefined);

      const call2 = await Promise.race([incoming, failed]);
      const call2Failed = new Promise<never>((_, reject) => {
        call2.once('error', (error: any) => reject(new Error(`call2 error ${error.code}: ${error.message}`)));
      });
      call2Failed.catch(() => undefined);
      const call2Accepted = new Promise(resolve => call2.once('accept', resolve));
      call2.accept();
      await Promise.race([Promise.all([call1Accepted, call2Accepted]), failed, call2Failed]);

      for (const [name, call] of [['call1', call1], ['call2', call2]] as Array<[string, Call]>) {
        const sdp: string = (call as any)._mediaHandler.version.getSDP();
        assert(!/\r(?!\n)/.test(sdp), `Expected no bare CR in the ${name} SDP`);
        const fmtp = sdp.split('\r\n').find(line => /^a=fmtp:\d+ .*maxaveragebitrate=16000/.test(line));
        assert(fmtp, `Expected an fmtp line with maxaveragebitrate=16000 in the ${name} SDP`);
      }
    });
  });
});
