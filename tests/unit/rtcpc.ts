import * as assert from 'assert';
import * as sinon from 'sinon';
import * as LogModule from '../../lib/twilio/log';
import RTCPC from '../../lib/twilio/rtc/rtcpc';

describe('rtcpc', function() {
  this.afterEach(function() {
    sinon.restore();
  });

  it('instantiates the default log module', function() {
    const logClassStub = sinon.createStubInstance(LogModule.default);
    const logConstructorStub = sinon.stub(LogModule, 'default').returns(logClassStub);

    new (RTCPC as any)({});

    sinon.assert.calledOnceWithExactly(logConstructorStub, 'RTCPC');
  });

  it('logs a message if the RTCPeerConnection constructor is not available', function() {
    sinon.stub(window, 'RTCPeerConnection').get(() => undefined);

    const result = new (RTCPC as any)({});

    assert(typeof result === 'object');
    assert(typeof result.RTCPeerConnection === 'undefined');
  });

  describe('processSDP', () => {
    const root = global as any;
    let originalRTCSessionDescription: any;

    beforeEach(() => {
      originalRTCSessionDescription = root.RTCSessionDescription;
      root.RTCSessionDescription = function(init: any) { Object.assign(this, init); };
    });

    afterEach(() => {
      root.RTCSessionDescription = originalRTCSessionDescription;
    });

    it('should call onError when setRemoteDescription fails', async () => {
      const error = new Error('rejected offer');
      const rtcpc = new (RTCPC as any)({});
      rtcpc.pc = {
        // Rejects both the promise form and promisify's callback-style retry.
        setRemoteDescription: (_desc: any, _onSuccess?: Function, onFailure?: Function) =>
          onFailure ? onFailure(error) : Promise.reject(error),
      };
      const onSuccess = sinon.stub();
      const onError = sinon.stub();

      await rtcpc.processSDP(undefined, undefined, 'v=0\r\n', { audio: true }, onSuccess, onError);

      sinon.assert.calledOnceWithExactly(onError, error);
      sinon.assert.notCalled(onSuccess);
    });
  });

  describe('localCodecPreferences', () => {
    const root = global as any;
    const SDP = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n'
      + 'm=audio 9 UDP/TLS/RTP/SAVPF 111 0\r\na=rtpmap:111 opus/48000/2\r\na=rtpmap:0 PCMU/8000\r\n';
    let originalRTCSessionDescription: any;

    beforeEach(() => {
      originalRTCSessionDescription = root.RTCSessionDescription;
      root.RTCSessionDescription = function(init: any) { Object.assign(this, init); };
    });

    afterEach(() => {
      root.RTCSessionDescription = originalRTCSessionDescription;
    });

    [['createOffer', 'offer'], ['createAnswer', 'answer']].forEach(([method, type]) => {
      describe(method, () => {
        let rtcpc: any;
        let setLocalDescription: sinon.SinonStub;

        beforeEach(() => {
          setLocalDescription = sinon.stub().resolves();
          rtcpc = new (RTCPC as any)({});
          rtcpc.pc = {
            [method]: () => Promise.resolve({ sdp: SDP, type }),
            setLocalDescription,
          };
        });

        it('should reorder the codecs in the local SDP when set', async () => {
          rtcpc.localCodecPreferences = ['pcmu', 'opus'];
          await rtcpc[method](undefined, { audio: true });
          const desc = setLocalDescription.firstCall.args[0];
          assert.equal(desc.type, type);
          assert(desc.sdp.includes('m=audio 9 UDP/TLS/RTP/SAVPF 0 111\r\n'));
        });

        it('should leave the local SDP unchanged when not set', async () => {
          await rtcpc[method](undefined, { audio: true });
          assert.equal(setLocalDescription.firstCall.args[0].sdp, SDP);
        });
      });
    });
  });
});
