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
});
