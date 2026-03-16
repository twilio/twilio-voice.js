import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent, waitFor } from '../../tests/lib/util';

const EVENT_TIMEOUT = 30000;

describe('Call Events', function() {
  this.timeout(60000);
  Cypress.config('defaultCommandTimeout', 60000);

  describe('volume event', () => {
    let device1: Device;
    let device2: Device;
    let call1: Call;
    let call2: Call;

    before(async () => {
      const identity1 = 'id1-' + Date.now();
      const identity2 = 'id2-' + Date.now();
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

    it('should emit volume events with input and output values', () => {
      return waitFor(
        new Promise<void>((resolve) => {
          call1.once('volume', (inputVolume: number, outputVolume: number) => {
            assert(typeof inputVolume === 'number', 'inputVolume should be a number');
            assert(typeof outputVolume === 'number', 'outputVolume should be a number');
            assert(inputVolume >= 0 && inputVolume <= 1, `inputVolume ${inputVolume} should be between 0 and 1`);
            assert(outputVolume >= 0 && outputVolume <= 1, `outputVolume ${outputVolume} should be between 0 and 1`);
            resolve();
          });
        }),
        EVENT_TIMEOUT,
      );
    });

    it('should hang up', (done) => {
      call1.once('disconnect', () => done());
      call2.disconnect();
    });
  });

  describe('sample event', () => {
    let device1: Device;
    let device2: Device;
    let call1: Call;
    let call2: Call;

    before(async () => {
      const identity1 = 'id1-' + Date.now();
      const identity2 = 'id2-' + Date.now();
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

    it('should emit sample events with RTC data', () => {
      return waitFor(
        new Promise<void>((resolve) => {
          call1.once('sample', (sample: any) => {
            assert(sample, 'Sample should be defined');
            assert(typeof sample.audioInputLevel === 'number', 'sample should have audioInputLevel');
            assert(typeof sample.audioOutputLevel === 'number', 'sample should have audioOutputLevel');
            resolve();
          });
        }),
        EVENT_TIMEOUT,
      );
    });

    it('should hang up', (done) => {
      call1.once('disconnect', () => done());
      call2.disconnect();
    });
  });

  describe('warning and warning-cleared events', () => {
    let device1: Device;
    let device2: Device;
    let call1: Call;
    let call2: Call;

    before(async () => {
      const identity1 = 'id1-' + Date.now();
      const identity2 = 'id2-' + Date.now();
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

    it('should emit a warning event when a quality threshold is crossed', () => {
      return waitFor(
        new Promise<void>((resolve) => {
          call1.once('warning', (warningName: string) => {
            assert(typeof warningName === 'string', 'Warning name should be a string');
            resolve();
          });

          // Trigger a warning by emitting from the internal monitor
          const monitor = (call1 as any)._monitor;
          if (monitor) {
            setTimeout(() => {
              monitor.emit('warning', {
                name: 'audioInputLevel',
                threshold: { name: 'maxDuration' },
              });
            }, 100);
          }
        }),
        EVENT_TIMEOUT,
      );
    });

    it('should emit a warning-cleared event when a warning is resolved', () => {
      return waitFor(
        new Promise<void>((resolve) => {
          call1.once('warning-cleared', (warningName: string) => {
            assert(typeof warningName === 'string', 'Warning name should be a string');
            resolve();
          });

          // Trigger a warning-cleared by emitting from the internal monitor
          const monitor = (call1 as any)._monitor;
          if (monitor) {
            setTimeout(() => {
              monitor.emit('warning-cleared', {
                name: 'audioInputLevel',
                threshold: { name: 'maxDuration' },
              });
            }, 100);
          }
        }),
        EVENT_TIMEOUT,
      );
    });

    it('should hang up', (done) => {
      call1.once('disconnect', () => done());
      call2.disconnect();
    });
  });
});
