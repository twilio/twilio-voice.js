import * as assert from 'assert';
import * as sinon from 'sinon';
import Device from '../../lib/twilio/device';
import Call from '../../lib/twilio/call';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent } from '../../tests/lib/util';

describe('connectToken', function() {
  this.timeout(10000);

  function waitFor(n: number, reject?: boolean) {
    return new Promise((res, rej) => setTimeout(reject ? rej : res, n));
  }

  function toObject(map: Map<string, string>) {
    return Array.from(map.keys()).reduce((result: Record<string, string>, key: string) => {
      result[key] = map.get(key)!;
      return result;
    }, {})
  }

  let callerDeviceA: Device;
  let callerDeviceB: Device;
  let receiverDevice: Device;
  let reconnectDeviceA: Device;
  let reconnectDeviceB: Device;
  let identity: string;

  const setupDevices = () => {
    identity = 'id2-' + Date.now();
    const callerTokenA = generateAccessToken();
    const callerTokenB = generateAccessToken();
    const receiverDeviceToken = generateAccessToken(identity);
    const reconnectDeviceTokenA = generateAccessToken(identity);
    const reconnectDeviceTokenB = generateAccessToken(identity);

    callerDeviceA = new Device(callerTokenA);
    callerDeviceB = new Device(callerTokenB);
    receiverDevice = new Device(receiverDeviceToken);
    reconnectDeviceA = new Device(reconnectDeviceTokenA);
    reconnectDeviceB = new Device(reconnectDeviceTokenB);

    // Only register the device that receives the incoming
    receiverDevice.register();

    return expectEvent(Device.EventName.Registered, receiverDevice);
  };

  const destroyDevices = () => {
    [callerDeviceA, callerDeviceB, receiverDevice, reconnectDeviceA, reconnectDeviceB].forEach(device => {
      if (device) {
        device.disconnectAll();
        device.destroy();
      }
    });
  };

  afterEach(() => {
    destroyDevices();
  });

  it('should maintain simultaneous forwarded calls', async () => {
    await setupDevices();
    await callerDeviceA.connect({ params: { To: identity } });
    const incomingCallA: Call = await expectEvent('incoming', receiverDevice);
    const cancelStubA = sinon.stub();
    incomingCallA.on('cancel', cancelStubA);
    const forwardedCallA = await reconnectDeviceA.connect({ connectToken: incomingCallA.connectToken });
    const acceptStubA = sinon.stub();
    const disconnectStubA = sinon.stub();
    forwardedCallA.on('accept', acceptStubA);
    forwardedCallA.on('disconnect', disconnectStubA);

    // Maintain the call for at least 3s
    await waitFor(3000);

    // Setup another incoming to forward
    await callerDeviceB.connect({ params: { To: identity } });
    const incomingCallB: Call = await expectEvent('incoming', receiverDevice);
    const cancelStubB = sinon.stub();
    incomingCallB.on('cancel', cancelStubB);
    const forwardedCallB = await reconnectDeviceB.connect({ connectToken: incomingCallB.connectToken });
    const acceptStubB = sinon.stub();
    const disconnectStubB = sinon.stub();
    forwardedCallB.on('accept', acceptStubB);
    forwardedCallB.on('disconnect', disconnectStubB);

    // Maintain the call for at least 3s
    await waitFor(3000);

    sinon.assert.calledOnce(cancelStubA);
    sinon.assert.calledOnce(acceptStubA);
    sinon.assert.notCalled(disconnectStubA);

    sinon.assert.calledOnce(cancelStubB);
    sinon.assert.calledOnce(acceptStubB);
    sinon.assert.notCalled(disconnectStubB);

    assert.equal(incomingCallA.direction, Call.CallDirection.Incoming);
    assert.equal(forwardedCallA.direction, Call.CallDirection.Outgoing);

    assert.equal(incomingCallB.direction, Call.CallDirection.Incoming);
    assert.equal(forwardedCallB.direction, Call.CallDirection.Outgoing);

    assert.deepStrictEqual(forwardedCallA.parameters, incomingCallA.parameters);
    assert.deepStrictEqual(toObject(forwardedCallA.customParameters), toObject(incomingCallA.customParameters));

    assert.deepStrictEqual(forwardedCallB.parameters, incomingCallB.parameters);
    assert.deepStrictEqual(toObject(forwardedCallB.customParameters), toObject(incomingCallB.customParameters));
  });
});
