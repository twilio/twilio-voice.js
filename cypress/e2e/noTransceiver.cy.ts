import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { getPreferredCodecInfo } from '../../lib/twilio/rtc/sdp';
import { generateAccessToken } from '../../tests/lib/token';

// Some WebRTC redirection layers (e.g. Citrix HDX) return no transceivers right
// after addTrack, and keep the rtpmap order of the SDP they were given while Chrome
// re-sorts it to match the m= line. This mimics both. A factory, not a subclass,
// because the ES5 build can't extend native classes.
function NoTransceiverRTCPeerConnection(configuration?: RTCConfiguration) {
  const pc: any = new RTCPeerConnection(configuration);
  pc.getTransceivers = () => [];

  const nativeSetLocalDescription = pc.setLocalDescription.bind(pc);
  const nativeLocalDescription = Object.getOwnPropertyDescriptor(RTCPeerConnection.prototype, 'localDescription')!;
  let rtpmapLines: string[] = [];

  pc.setLocalDescription = (description?: RTCSessionDescriptionInit) => {
    rtpmapLines = (description?.sdp || '').split('\r\n').filter(line => line.startsWith('a=rtpmap:'));
    return nativeSetLocalDescription(description);
  };

  Object.defineProperty(pc, 'localDescription', {
    get() {
      const description = nativeLocalDescription.get!.call(pc);
      if (!description) {
        return description;
      }
      let i = 0;
      const sdp = description.sdp.split('\r\n')
        .map((line: string) => line.startsWith('a=rtpmap:') ? rtpmapLines[i++] || line : line)
        .join('\r\n');
      return { sdp, type: description.type };
    },
  });

  return pc;
}

async function getAudioCodecs(pc: RTCPeerConnection, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  let codecs: { send?: string, recv?: string } = {};
  while (Date.now() < deadline) {
    const report = await pc.getStats();
    codecs = {};
    report.forEach((stat: any) => {
      const hasPackets = stat.type === 'outbound-rtp' ? stat.packetsSent > 0 : stat.packetsReceived > 0;
      if ((stat.type === 'outbound-rtp' || stat.type === 'inbound-rtp') && stat.kind === 'audio' && stat.codecId && hasPackets) {
        codecs[stat.type === 'outbound-rtp' ? 'send' : 'recv'] = report.get(stat.codecId).mimeType;
      }
    });
    if (codecs.send && codecs.recv) {
      return codecs;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for audio codec stats, last saw ${JSON.stringify(codecs)}`);
}

[
  { codecPreferences: undefined, expected: 'audio/PCMU' },
  { codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU], expected: 'audio/opus' },
].forEach(({ codecPreferences, expected }) => {
  describe(`No transceiver after addTrack, codecPreferences ${codecPreferences || 'default'}`, () => {
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
      const options: any = { RTCPeerConnection: NoTransceiverRTCPeerConnection };
      if (codecPreferences) {
        options.codecPreferences = codecPreferences;
      }
      device1 = new Device(token1, options);
      device2 = new Device(token2, options);
      await Promise.all([device1.register(), device2.register()]);
    });

    after(() => {
      [device1, device2].forEach(device => {
        if (device) {
          device.disconnectAll();
          device.destroy();
        }
      });
    });

    async function connectAndCheckCodecs(onStep: (step: string) => void) {
      onStep('connect');
      const incoming = new Promise<Call>(resolve => device2.once(Device.EventName.Incoming, resolve));
      const call1 = await device1.connect({ params: { To: identity2 } });
      // The caller's leg can be answered before the callee accepts, so listen now.
      const call1Accepted = new Promise(resolve => call1.once('accept', resolve));
      const failed = new Promise<never>((_, reject) => {
        call1.once('error', (error: any) => reject(new Error(`call1 error ${error.code}: ${error.message}`)));
        call1.once('disconnect', () => reject(new Error('call1 disconnected')));
      });
      // Teardown disconnects the call after the test; don't surface that as unhandled.
      failed.catch(() => undefined);

      onStep('incoming');
      const call2 = await Promise.race([incoming, failed]);
      onStep('accept');
      const call2Failed = new Promise<never>((_, reject) => {
        call2.once('error', (error: any) => reject(new Error(`call2 error ${error.code}: ${error.message}`)));
      });
      call2Failed.catch(() => undefined);
      const call2Accepted = new Promise(resolve => call2.once('accept', resolve));
      call2.accept();
      await Promise.race([Promise.all([call1Accepted, call2Accepted]), failed, call2Failed]);

      for (const [name, call] of [['call1', call1], ['call2', call2]] as Array<[string, Call]>) {
        onStep(`${name} stats`);
        const pc = (call as any)._mediaHandler.version.pc;
        const codecs = await Promise.race([getAudioCodecs(pc, 10000), failed]);
        assert.deepStrictEqual(codecs, { send: expected, recv: expected }, name);

        // The same lookup that reports the codec to Insights.
        const { codecName } = getPreferredCodecInfo(pc.localDescription.sdp);
        assert.equal(`audio/${codecName.split('/')[0]}`.toLowerCase(), expected.toLowerCase(), `${name} local SDP ${codecName}`);
      }
    }

    it(`should connect and use ${expected} in both directions on both calls`, () => {
      // An async it() is cut off at defaultCommandTimeout, so run the call inside a cy command.
      cy.wrap(null).then({ timeout: 30000 }, () => {
        let step = '';
        let stallTimer: ReturnType<typeof setTimeout> | undefined;
        const stalled = new Promise<never>((_, reject) => {
          stallTimer = setTimeout(() => reject(new Error(`Stalled at ${step}`)), 25000);
        });
        return Promise.race([connectAndCheckCodecs(s => { step = s; }), stalled])
          .finally(() => clearTimeout(stallTimer));
      });
    });
  });
});
