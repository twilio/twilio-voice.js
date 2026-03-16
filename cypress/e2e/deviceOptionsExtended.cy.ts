import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent } from '../../tests/lib/util';

describe('Device Options Extended', function() {
  this.timeout(60000);
  Cypress.config('defaultCommandTimeout', 60000);

  describe('allowIncomingWhileBusy', () => {
    let callerDevice: Device;
    let callerDevice2: Device;
    let receiverDevice: Device;

    afterEach(() => {
      [callerDevice, callerDevice2, receiverDevice].forEach(d => {
        if (d) {
          d.disconnectAll();
          d.destroy();
        }
      });
    });

    it('should not receive a second incoming call when allowIncomingWhileBusy is false (default)', async () => {
      const receiverId = 'id-receiver-' + Date.now();
      const callerId1 = 'id-caller1-' + Date.now();
      const callerId2 = 'id-caller2-' + Date.now();

      receiverDevice = new Device(generateAccessToken(receiverId), {
        allowIncomingWhileBusy: false,
      });
      callerDevice = new Device(generateAccessToken(callerId1));
      callerDevice2 = new Device(generateAccessToken(callerId2));

      await Promise.all([
        receiverDevice.register(),
        callerDevice.register(),
        callerDevice2.register(),
      ]);

      // First call
      const incomingPromise1: Promise<Call> = expectEvent(Device.EventName.Incoming, receiverDevice);
      await callerDevice.connect({ params: { To: receiverId } });
      const incomingCall1 = await incomingPromise1;

      const acceptPromise = expectEvent('accept', incomingCall1);
      incomingCall1.accept();
      await acceptPromise;

      assert.strictEqual(receiverDevice.isBusy, true);

      // Second call should not trigger an incoming event
      let secondIncomingReceived = false;
      receiverDevice.once(Device.EventName.Incoming, () => {
        secondIncomingReceived = true;
      });

      await callerDevice2.connect({ params: { To: receiverId } });
      await new Promise(resolve => setTimeout(resolve, 3000));

      assert.strictEqual(secondIncomingReceived, false, 'Should not receive second incoming call');
    });

    it('should receive a second incoming call when allowIncomingWhileBusy is true', async () => {
      const receiverId = 'id-receiver-' + Date.now();
      const callerId1 = 'id-caller1-' + Date.now();
      const callerId2 = 'id-caller2-' + Date.now();

      receiverDevice = new Device(generateAccessToken(receiverId), {
        allowIncomingWhileBusy: true,
      });
      callerDevice = new Device(generateAccessToken(callerId1));
      callerDevice2 = new Device(generateAccessToken(callerId2));

      await Promise.all([
        receiverDevice.register(),
        callerDevice.register(),
        callerDevice2.register(),
      ]);

      // First call
      const incomingPromise1: Promise<Call> = expectEvent(Device.EventName.Incoming, receiverDevice);
      await callerDevice.connect({ params: { To: receiverId } });
      const incomingCall1 = await incomingPromise1;

      const acceptPromise = expectEvent('accept', incomingCall1);
      incomingCall1.accept();
      await acceptPromise;

      assert.strictEqual(receiverDevice.isBusy, true);

      // Second call should trigger an incoming event
      const incomingPromise2: Promise<Call> = expectEvent(Device.EventName.Incoming, receiverDevice);
      await callerDevice2.connect({ params: { To: receiverId } });
      const incomingCall2 = await incomingPromise2;

      assert(incomingCall2, 'Should receive a second incoming call');
    });
  });

  describe('closeProtection', () => {
    it('should accept closeProtection as a boolean option', () => {
      const identity = 'id-' + Date.now();
      const token = generateAccessToken(identity);

      assert.doesNotThrow(() => {
        const device = new Device(token, { closeProtection: true });
        device.destroy();
      });
    });

    it('should accept closeProtection as a string option', () => {
      const identity = 'id-' + Date.now();
      const token = generateAccessToken(identity);

      assert.doesNotThrow(() => {
        const device = new Device(token, { closeProtection: 'Are you sure you want to leave?' });
        device.destroy();
      });
    });
  });

  describe('maxCallSignalingTimeoutMs', () => {
    it('should accept maxCallSignalingTimeoutMs option', () => {
      const identity = 'id-' + Date.now();
      const token = generateAccessToken(identity);

      assert.doesNotThrow(() => {
        const device = new Device(token, { maxCallSignalingTimeoutMs: 15000 });
        device.destroy();
      });
    });

    it('should accept maxCallSignalingTimeoutMs as 0 (no timeout)', () => {
      const identity = 'id-' + Date.now();
      const token = generateAccessToken(identity);

      assert.doesNotThrow(() => {
        const device = new Device(token, { maxCallSignalingTimeoutMs: 0 });
        device.destroy();
      });
    });
  });

  describe('dscp', () => {
    let dscpDevice1: Device;
    let dscpDevice2: Device;

    afterEach(() => {
      if (dscpDevice1) {
        dscpDevice1.disconnectAll();
        dscpDevice1.destroy();
      }
      if (dscpDevice2) {
        dscpDevice2.disconnectAll();
        dscpDevice2.destroy();
      }
    });

    it('should accept dscp option set to true', { retries: 1 }, async () => {
      const identity1 = 'id1-' + Date.now();
      const identity2 = 'id2-' + Date.now();

      dscpDevice1 = new Device(generateAccessToken(identity1), { dscp: true });
      dscpDevice2 = new Device(generateAccessToken(identity2), { dscp: true });

      await Promise.all([dscpDevice1.register(), dscpDevice2.register()]);

      const incomingPromise: Promise<Call> = expectEvent(Device.EventName.Incoming, dscpDevice2);
      const outgoingCall = await dscpDevice1.connect({ params: { To: identity2 } });
      const incomingCall = await incomingPromise;

      const acceptPromise = expectEvent('accept', outgoingCall);
      incomingCall.accept();
      await acceptPromise;

      // Call should be open
      assert.strictEqual(outgoingCall.status(), Call.State.Open);
    });

    it('should accept dscp option set to false', { retries: 1 }, async () => {
      const identity1 = 'id1-' + Date.now();
      const identity2 = 'id2-' + Date.now();

      dscpDevice1 = new Device(generateAccessToken(identity1), { dscp: false });
      dscpDevice2 = new Device(generateAccessToken(identity2), { dscp: false });

      await Promise.all([dscpDevice1.register(), dscpDevice2.register()]);

      const incomingPromise: Promise<Call> = expectEvent(Device.EventName.Incoming, dscpDevice2);
      const outgoingCall = await dscpDevice1.connect({ params: { To: identity2 } });
      const incomingCall = await incomingPromise;

      const acceptPromise = expectEvent('accept', outgoingCall);
      incomingCall.accept();
      await acceptPromise;

      assert.strictEqual(outgoingCall.status(), Call.State.Open);
    });
  });

  describe('enableImprovedSignalingErrorPrecision', () => {
    it('should accept enableImprovedSignalingErrorPrecision option', () => {
      const identity = 'id-' + Date.now();
      const token = generateAccessToken(identity);

      assert.doesNotThrow(() => {
        const device = new Device(token, { enableImprovedSignalingErrorPrecision: true });
        device.destroy();
      });
    });
  });

  describe('sounds', () => {
    it('should accept custom sound URLs without throwing', () => {
      const identity = 'id-' + Date.now();
      const token = generateAccessToken(identity);

      assert.doesNotThrow(() => {
        const device = new Device(token, {
          sounds: {
            [Device.SoundName.Incoming]: 'https://example.com/incoming.mp3',
            [Device.SoundName.Outgoing]: 'https://example.com/outgoing.mp3',
            [Device.SoundName.Disconnect]: 'https://example.com/disconnect.mp3',
          },
        });
        device.destroy();
      });
    });
  });
});
