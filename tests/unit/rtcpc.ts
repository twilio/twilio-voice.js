import * as sinon from 'sinon';
import * as LogModule from '../../lib/twilio/log';
import RTCPC from '../../lib/twilio/rtc/rtcpc';

describe('rtcpc', function() {
  this.afterEach(function() {
    sinon.restore();
  });

  it('uses the default Log module when not passed an option', function() {
    const logClassStub = sinon.createStubInstance(LogModule.default);
    const logConstructorStub = sinon.stub(LogModule, 'default').returns(logClassStub);

    RTCPC({});

    sinon.assert.calledOnceWithExactly(logConstructorStub, 'RTCPC');
  });

  it('logs a message when legacy edge is detected', function() {
    (window.navigator as any).userAgent = 'foobar foobar Edge/12.34 foobar';

    const logClassStub = sinon.createStubInstance(LogModule.default);
    sinon.stub(LogModule, 'default').returns(logClassStub);

    RTCPC({});

    sinon.assert.calledOnceWithExactly(logClassStub.info, 'This browser is not supported.');
  });
});
