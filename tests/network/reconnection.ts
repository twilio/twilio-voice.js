import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../lib/token';
import { expectEvent, isFirefox, runDockerCommand, waitFor } from '../lib/util';
import * as assert from 'assert';
import { EventEmitter } from 'events';

type CB = any;

const EVENT_TIMEOUT = 20000;
const RTP_TIMEOUT = 60000;
const SUITE_TIMEOUT = 300000;
const USE_CASE_TIMEOUT = 180000;

describe('Reconnection', function() {
  this.timeout(SUITE_TIMEOUT);

  let call1: Call;
  let call2: Call;
  let device1: Device;
  let device2: Device;
  let identity1: string;
  let identity2: string;
  let token1: string;
  let token2: string;

  // Since both devices lives in the same machine, one device may receive
  // events faster than the other. We will then run the test on the device
  // who gets it first. The other device will receive hangup event which is
  // not part of this test.
  const bindTestPerCall = (test: CB) => {
    return Promise.race([
      test(call1),
      test(call2)
    ]);
  };

  const bindTestPerDevice = (test: CB) => {
    return Promise.race([
      test(device1),
      test(device2)
    ]);
  };

  const setupDevices = async (
    device1Options: Device.Options = { },
    device2Options: Device.Options = { },
  ) => {
    identity1 = 'id1-' + Date.now();
    identity2 = 'id2-' + Date.now();
    token1 = generateAccessToken(identity1);
    token2 = generateAccessToken(identity2);
    device1 = new Device(token1, device1Options);
    device2 = new Device(token2, device2Options);

    device1.on('error', () => { });
    device2.on('error', () => { });

    await device1.register();
    await device2.register();

    const incomingPromise = new Promise(resolve => {
      device2.once(Device.EventName.Incoming, (call) => {
        call2 = call;
        call.accept();
        resolve();
      });
    });

    call1 = await device1.connect({
      params: { To: identity2, Custom1: 'foo + bar', Custom2: undefined, Custom3: '我不吃蛋' } as any,
    });

    await incomingPromise;
  };

  const destroyDevices = () => {
    if (device1) {
      device1.disconnectAll();
      device1.destroy();
    }

    if (device2) {
      device2.disconnectAll();
      device2.destroy();
    }
  };

  /**
   * NOTE(mhuynh): Firefox websockets have indeterminate signaling loss
   * behavior.
   */
  (isFirefox() ? describe.skip : describe)('signaling reconnection', function() {
    this.timeout(USE_CASE_TIMEOUT);

    before(async () => {
      await runDockerCommand('resetNetwork');
    });

    it('should reconnect to signaling on the same edge after 8 seconds', async () => {
      await setupDevices({
        edge: ['ashburn', 'sydney', 'dublin'],
        maxCallSignalingTimeoutMs: 30000,
      }, {
        edge: ['ashburn', 'sydney', 'dublin'],
        maxCallSignalingTimeoutMs: 30000,
      });
      /**
       * NOTE(mhuynh): This is a delay to ensure that the call has "settled" and
       * is no longer in some "ringing" state.
       */
      await new Promise(resolve => setTimeout(resolve, 4000));

      await runDockerCommand('disconnectFromAllNetworks');

      const reconnectPromises = Promise.all([call1, call2].map(
        call => new Promise(res => call.on('reconnected', res)),
      ));

      setTimeout(() => runDockerCommand('resetNetwork'), 8000);

      await waitFor(reconnectPromises, 20000);

      assert([call1, call2].every(call => call.status() === Call.State.Open));

      assert.equal(device1.edge, 'ashburn');
      assert.equal(device2.edge, 'ashburn');
    });

    it.skip('should reconnect to a fallback edge after 8 seconds', async () => {
      await setupDevices({
        edge: ['ashburn', 'sydney', 'sydney', 'sydney', 'sydney', 'sydney'],
        // default; maxCallSignalingTimeoutMs: 0,
      }, {
        edge: ['ashburn', 'sydney', 'sydney', 'sydney', 'sydney', 'sydney'],
        // default; maxCallSignalingTimeoutMs: 0,
      });
      /**
       * NOTE(mhuynh): This is a delay to ensure that the call has "settled" and
       * is no longer in some "ringing" state.
       */
      await new Promise(resolve => setTimeout(resolve, 4000));

      await runDockerCommand('disconnectFromAllNetworks');

      const reconnectPromises = Promise.all([device1, device2].map(
        dev => new Promise(res => dev.on('registered', res)),
      ));

      setTimeout(() => runDockerCommand('resetNetwork'), 12000);

      await waitFor(reconnectPromises, 60000);

      assert.equal(device1.edge, 'sydney');
      assert.equal(device2.edge, 'sydney');
    });

    after(async () => {
      destroyDevices();
      await runDockerCommand('resetNetwork');
    });
  });

  (isFirefox() ? describe.skip : describe)('ICE Restart', function() {
    this.timeout(SUITE_TIMEOUT);

    describe('and ICE connection fails', function() {
      this.timeout(USE_CASE_TIMEOUT);

      before(async () => {
        await runDockerCommand('unblockMediaPorts');
        await setupDevices();
      });
      after(() => {
        destroyDevices();
        return runDockerCommand('unblockMediaPorts');
      });

      it('should trigger reconnecting', async () => {
        await runDockerCommand('blockMediaPorts');
        await waitFor(bindTestPerCall((call: Call) => expectEvent('reconnecting', call)
          .then(() => assert(call.status() === Call.State.Reconnecting))), EVENT_TIMEOUT);
      });

      it('should trigger reconnected', async () => {
        await runDockerCommand('unblockMediaPorts');
        await waitFor(bindTestPerCall((call: Call) => expectEvent('reconnected', call)
        .then(() => assert(call.status() === Call.State.Open))), EVENT_TIMEOUT);
      });

      // Firefox only allows reconnection once as it doesn't update iceConnectionState
      // and pcConnectionState back to 'connected' after issuing the first ice restart
      if (!isFirefox()) {
        it('should trigger reconnecting after reconnected', async () => {
          await runDockerCommand('blockMediaPorts');
          await waitFor(bindTestPerCall((call: Call) => expectEvent('reconnecting', call)
            .then(() => assert(call.status() === Call.State.Reconnecting))), EVENT_TIMEOUT);
        });
      }

      it('should disconnect call with error 53405', async () => {
        await runDockerCommand('blockMediaPorts');
        await waitFor(bindTestPerCall((call: Call) => Promise.all([
          expectEvent('disconnect', call),
          new Promise((resolve) => call.on('error', (error) => error.code === 53405 && resolve())),
        ]).then(() =>  assert(call.status() === Call.State.Closed))), RTP_TIMEOUT);
      });
    });
  });

  // TODO: Re-enable after CLIENT-7771
  (isFirefox() ? describe.skip : describe)('When network disconnects', function() {
    this.timeout(USE_CASE_TIMEOUT);

    before(() => setupDevices());
    after(() => {
      destroyDevices();
      return runDockerCommand('resetNetwork');
    });

    it('should trigger device.unregistered', async () => {
      await runDockerCommand('disconnectFromAllNetworks');
      await waitFor(bindTestPerDevice((device: Device) => expectEvent(Device.EventName.Unregistered, device)), EVENT_TIMEOUT);
    });

    it('should disconnect call with error 53405', () => {
      return waitFor(bindTestPerCall((call: Call) => Promise.all([
        expectEvent('disconnect', call),
        new Promise((resolve) => call.on('error', (error) => error.code === 53405 && resolve())),
      ]).then(() =>  assert(call.status() === Call.State.Closed))), RTP_TIMEOUT);
    });

    it('should trigger device.registered after network resumes', async () => {
      await runDockerCommand('resetNetwork');
      await waitFor(bindTestPerDevice((device: Device) => expectEvent(Device.EventName.Registered, device)), EVENT_TIMEOUT);
    });
  });

  (isFirefox() ? it : it.skip)('Dummy test for Firefox', () => {
    // no-op
  });
});
