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

  beforeEach(async () => {
    const id = `device-id-${Date.now()}`;
    token = await generateAccessToken(id);
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

  it('should keep the previous options after rejecting an invalid edge', async function() {
    this.timeout(10000);

    const dev = device = new Device(token, { edge: 'sydney' });

    await dev.register();
    assert.throws(() => dev.updateOptions({ edge: 123 as any }), /must be of type `string`/);

    dev.updateOptions({ appName: 'foo' });
    assert.equal(dev['_options'].edge, 'sydney');
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
        const t = await generateAccessToken(id);
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

      assert.throws(() => caller.updateOptions({ edge: 'ashburn' }), /Cannot change Edge while on an active Call/);
    });

    it('should allow updating options after all calls have ended', function() {
      const logSpy = sinon.spy();
      caller['_log'].warn = logSpy;

      callerCall.disconnect();
      caller.updateOptions({ edge: 'ashburn' });
    });

    it('should apply an edge rejected during a call when retried after the call ends', async function() {
      assert.throws(() => caller.updateOptions({ edge: 'sydney' }), /Cannot change Edge/);

      callerCall.disconnect();
      const registeredPromise = new Promise(resolve => {
        caller.once(Device.EventName.Registered, resolve);
      });
      caller.updateOptions({ edge: 'sydney' });

      await Promise.race([
        registeredPromise,
        waitFor(15000).then(() => {
          throw new Error(`Device did not re-register on sydney, edge is ${caller.edge}`);
        }),
      ]);
      assert.equal(caller.edge, 'sydney');
    });
  });
});
