import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent, waitFor } from '../../tests/lib/util';

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
    // Firefox hides device IDs until microphone permission is granted.
    const permission = await navigator.mediaDevices.getUserMedia({ audio: true });
    permission.getTracks().forEach(track => track.stop());
    await (callee.audio as any)._updateAvailableDevices();
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
});
