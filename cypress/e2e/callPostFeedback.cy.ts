import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent } from '../../tests/lib/util';

describe('Call postFeedback', function() {
  this.timeout(30000);
  Cypress.config('defaultCommandTimeout', 30000);

  let device1: Device;
  let device2: Device;
  let identity1: string;
  let identity2: string;
  let call1: Call;
  let call2: Call;

  before(async () => {
    identity1 = 'id1-' + Date.now();
    identity2 = 'id2-' + Date.now();
    const token1 = generateAccessToken(identity1);
    const token2 = generateAccessToken(identity2);
    device1 = new Device(token1);
    device2 = new Device(token2);

    await Promise.all([device1.register(), device2.register()]);

    const incomingPromise: Promise<Call> = expectEvent(Device.EventName.Incoming, device2);
    call1 = await device1.connect({ params: { To: identity2 } });
    call2 = await incomingPromise;

    const acceptPromise = expectEvent('accept', call1);
    call2.accept();
    await acceptPromise;

    // Let the call run briefly
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Disconnect the call so we can post feedback
    const disconnectPromise = expectEvent('disconnect', call1);
    call2.disconnect();
    await disconnectPromise;
  });

  after(() => {
    if (device1) {
      device1.disconnectAll();
      device1.destroy();
    }
    if (device2) {
      device2.disconnectAll();
      device2.destroy();
    }
  });

  it('should post feedback with a valid score', async () => {
    await call1.postFeedback(Call.FeedbackScore.Five);
  });

  it('should post feedback with a score and issue', async () => {
    await call1.postFeedback(Call.FeedbackScore.Three, Call.FeedbackIssue.ChoppyAudio);
  });

  it('should post feedback declined when called without a score', async () => {
    await call1.postFeedback();
  });

  it('should throw on an invalid score', () => {
    assert.throws(() => call1.postFeedback(99 as any), (err: any) => {
      return err.message.includes('Feedback score must be one of');
    });
  });

  it('should throw on an invalid issue', () => {
    assert.throws(
      () => call1.postFeedback(Call.FeedbackScore.Five, 'not-a-real-issue' as any),
      (err: any) => {
        return err.message.includes('Feedback issue must be one of');
      },
    );
  });
});
