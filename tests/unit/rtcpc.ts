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
});
