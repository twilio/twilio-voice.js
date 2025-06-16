import * as assert from 'assert';
import * as sinon from 'sinon';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';

function waitFor(n: number, reject?: boolean) {
  return new Promise((res, rej) => setTimeout(reject ? rej : res, n));
}

describe('mutable options', function() {
  let device: Device | null = null;
  let token: string;

  beforeEach(() => {
    const id = `device-id-${Date.now()}`;
    token = generateAccessToken(id);
  });

  afterEach(() => {
    if (device) {
      device.disconnectAll();
      device.destroy();
      device = null;
    }
  });

  it('should update edge', async function() {
    this.timeout(10000);

    const dev = device = new Device(token, { edge: 'sydney' });

    await dev.register();
    assert.equal(dev.edge, 'sydney');

    dev.updateOptions({ edge: 'ashburn' });
    return new Promise((resolve, reject) => {
      dev.once('registered', () => {
        if (dev.edge === 'ashburn') {
          resolve();
        } else {
          reject(new Error('Expected ashburn, got ' + dev.edge));
        }
      });
    });
  });

  it('should not throw during re-registration', async function() {
    this.timeout(10000);

    const dev = device = new Device(token, { edge: 'sydney' });

    await dev.register();

    const regCalls: Array<Promise<any>> = [];

    dev.register = () => {
      const regCall = Device.prototype.register.call(dev);
      regCalls.push(regCall);
      return regCall;
    };

    const registeredPromise = new Promise(resolve => {
      dev.once(Device.EventName.Registered, resolve);
    });

    dev.updateOptions({ edge: 'ashburn' });

    await registeredPromise;

    assert(regCalls.length);
    await Promise.all(regCalls);
  });

  context('ongoing calls', function() {
    Cypress.config('defaultCommandTimeout', 30000);
    this.timeout(30000);

    let caller: Device;
    let callerId: string;
    let callerToken: string;
    let callerCall: Call;

    let receiver: Device;
    let receiverId: string;
    let receiverToken: string;
    let receiverCall: Call;

    beforeEach(async function() {
      const timestamp = Date.now();

      [
        [caller, callerId, callerToken],
        [receiver, receiverId, receiverToken],
      ] = await Promise.all(['caller', 'receiver'].map(async (n): Promise<[Device, string, string]> => {
        const id = `device-${n}-${timestamp}`;
        const t = generateAccessToken(id);
        const dev = new Device(t);
        await dev.register();
        return [dev, id, t];
      }));

      const receiverConnPromise = new Promise<Call>(resolve => {
        receiver.once(Device.EventName.Incoming, resolve);
      });

      callerCall = await caller.connect({ params: { To: receiverId } });
      receiverCall = await receiverConnPromise;
      receiverCall.accept();

      await waitFor(1000);
    });

    afterEach(async function() {
      await waitFor(1000);

      caller.disconnectAll();
      caller.destroy();

      receiver.disconnectAll();
      receiver.destroy();
    });

    it('should not allow updating edge while connections are ongoing', function() {
      const logSpy = sinon.spy();
      caller['_log'].warn = logSpy;

      try {
        caller.updateOptions({ edge: 'ashburn' });
      } catch (e) {
        assert.equal(e.message, 'Cannot change Edge while on an active Call');
      }
    });

    it('should allow updating options after all calls have ended', function() {
      const logSpy = sinon.spy();
      caller['_log'].warn = logSpy;

      callerCall.disconnect();
      caller.updateOptions({ edge: 'ashburn' });
    });
  });
});
