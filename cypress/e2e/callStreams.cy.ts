import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent } from '../../tests/lib/util';

describe('Call Streams', function() {
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

  it('should return a local MediaStream for the outgoing call', () => {
    const localStream = call1.getLocalStream();
    assert(localStream instanceof MediaStream, 'Expected a MediaStream instance');
    assert(localStream.getAudioTracks().length > 0, 'Expected at least one audio track');
  });

  it('should return a remote MediaStream for the outgoing call', () => {
    const remoteStream = call1.getRemoteStream();
    assert(remoteStream instanceof MediaStream, 'Expected a MediaStream instance');
  });

  it('should return a local MediaStream for the incoming call', () => {
    const localStream = call2.getLocalStream();
    assert(localStream instanceof MediaStream, 'Expected a MediaStream instance');
    assert(localStream.getAudioTracks().length > 0, 'Expected at least one audio track');
  });

  it('should return a remote MediaStream for the incoming call', () => {
    const remoteStream = call2.getRemoteStream();
    assert(remoteStream instanceof MediaStream, 'Expected a MediaStream instance');
  });

  it('should hang up', (done) => {
    call1.once('disconnect', () => done());
    call2.disconnect();
  });
});
