import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent, grantMicPermission, waitFor } from '../../tests/lib/util';

describe('Selected input device', function() {
  this.timeout(30000);
  Cypress.config('defaultCommandTimeout', 30000);

  let callerA: Device;
  let callerB: Device;
  let callee: Device;
  let calleeIdentity: string;

  beforeEach(async () => {
    calleeIdentity = 'callee-' + Date.now();
    callerA = new Device(await generateAccessToken('callerA-' + Date.now()));
    callerB = new Device(await generateAccessToken('callerB-' + Date.now()));
    callee = new Device(await generateAccessToken(calleeIdentity));
    await callee.register();
    await grantMicPermission(callee);
    const deviceId = Array.from(callee.audio!.availableInputDevices.keys())[0];
    await callee.audio!.setInputDevice(deviceId);
  });

  afterEach(() => {
    [callerA, callerB, callee].forEach(device => {
      if (device) {
        device.disconnectAll();
        device.destroy();
      }
    });
  });

  const incomingFrom = async (caller: Device): Promise<Call> => {
    const incoming: Promise<Call> = expectEvent(Device.EventName.Incoming, callee);
    await caller.connect({ params: { To: calleeIdentity } });
    return incoming;
  };

  const assertLiveInput = (call: Call) => {
    assert.strictEqual(call.status(), Call.State.Open);
    assert.strictEqual(call.getLocalStream()!.getAudioTracks()[0].readyState, 'live');
    assert.strictEqual(callee.audio!.inputStream!.getAudioTracks()[0].readyState, 'live');
  };

  it('should keep the selected device live after a call is disconnected right after accept', async () => {
    const callA = await incomingFrom(callerA);
    callA.accept();
    callA.disconnect();

    const callB = await incomingFrom(callerB);
    const acceptB = expectEvent('accept', callB);
    callB.accept();
    await waitFor(acceptB, 15000);

    assertLiveInput(callB);
  });

  it('should keep the selected device live when a second call supersedes the first', async () => {
    const callA = await incomingFrom(callerA);
    const callB = await incomingFrom(callerB);

    const acceptB = expectEvent('accept', callB);
    callA.accept();
    callB.accept();
    await waitFor(acceptB, 15000);

    assertLiveInput(callB);
  });

  it('should show the Device idle to the replaced call disconnect handler', async () => {
    callee.updateOptions({ allowIncomingWhileBusy: true });
    const callA = await incomingFrom(callerA);
    const acceptA = expectEvent('accept', callA);
    callA.accept();
    await waitFor(acceptA, 15000);

    // The handler from the setInputDevice docs, run when callB replaces callA.
    let unsetResult: Promise<string> | null = null;
    callA.once('disconnect', () => {
      unsetResult = callee.audio!.unsetInputDevice().then(() => 'resolved', error => error.name);
    });
    const callB = await incomingFrom(callerB);
    const acceptB = expectEvent('accept', callB);
    callB.accept();
    await waitFor(acceptB, 15000);

    assert.strictEqual(await unsetResult, 'resolved');
    assert.strictEqual(callA.status(), Call.State.Closed);
    assert.strictEqual(callB.status(), Call.State.Open);
  });

  it('should leave the Device idle when the replaced call disconnect handler ends the accepted call', async () => {
    callee.updateOptions({ allowIncomingWhileBusy: true });
    const callA = await incomingFrom(callerA);
    const acceptA = expectEvent('accept', callA);
    callA.accept();
    await waitFor(acceptA, 15000);

    const callB = await incomingFrom(callerB);
    callA.once('disconnect', () => callee.disconnectAll());
    callB.accept();

    assert.strictEqual(callA.status(), Call.State.Closed);
    assert.strictEqual(callB.status(), Call.State.Closed);
    assert.strictEqual(callee.isBusy, false);
  });
});
