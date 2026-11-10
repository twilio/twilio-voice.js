import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent, grantMicPermission, waitFor } from '../../tests/lib/util';

describe('Late getUserMedia results', function() {
  this.timeout(30000);
  Cypress.config('defaultCommandTimeout', 30000);

  let caller: Device;
  let callerB: Device | null;
  let callee: Device;
  let calleeIdentity: string;
  // Each default-device getUserMedia result (no deviceId constraint), in request order.
  let defaultRequests: Array<Promise<MediaStream>>;
  // Holds the default-device result with this request index until the promise resolves.
  let holds: Map<number, Promise<void>>;
  // When set, holds every selected-device result until this promise resolves.
  let selectedHold: Promise<void> | null;
  // When set, every default-device request fails with this error.
  let defaultFailure: Error | null;

  // Lets every pending promise callback chained on a settled request run.
  const settle = () => new Promise(resolve => setTimeout(resolve, 0));

  beforeEach(async () => {
    calleeIdentity = 'callee-' + Date.now();
    defaultRequests = [];
    holds = new Map();
    selectedHold = null;
    defaultFailure = null;
    callerB = null;
    caller = new Device(await generateAccessToken('caller-' + Date.now()));
    callee = new Device(await generateAccessToken(calleeIdentity), {
      getUserMedia: (constraints: MediaStreamConstraints) => {
        const audio: any = constraints.audio;
        const stream = navigator.mediaDevices.getUserMedia(constraints);
        if (audio && typeof audio === 'object' && audio.deviceId) {
          const selected = selectedHold;
          return selected ? stream.then(s => selected.then(() => s)) : stream;
        }
        const failure = defaultFailure;
        if (failure) {
          const failed = stream.then(s => {
            s.getTracks().forEach(track => track.stop());
            throw failure;
          });
          defaultRequests.push(failed);
          return failed;
        }
        const hold = holds.get(defaultRequests.length);
        const result = hold ? stream.then(s => hold.then(() => s)) : stream;
        defaultRequests.push(result);
        return result;
      },
    } as any);
    await callee.register();
  });

  afterEach(() => {
    [caller, callerB, callee].forEach(device => {
      if (device) {
        device.disconnectAll();
        device.destroy();
      }
    });
  });

  const incomingCall = async (from: Device = caller): Promise<Call> => {
    const incoming: Promise<Call> = expectEvent(Device.EventName.Incoming, callee);
    await from.connect({ params: { To: calleeIdentity } });
    return incoming;
  };

  it('should release a late default stream when the call ends after setInputDevice', async () => {
    await grantMicPermission(callee);
    const deviceId = Array.from(callee.audio!.availableInputDevices.keys())[0];

    const call = await incomingCall();
    let releaseDefault!: () => void;
    holds.set(0, new Promise<void>(resolve => { releaseDefault = resolve; }));
    call.accept();
    await callee.audio!.setInputDevice(deviceId);
    call.disconnect();

    releaseDefault();
    const late = await waitFor(defaultRequests[0], 15000).then(() => defaultRequests[0]);
    await settle();

    assert.strictEqual(call.status(), Call.State.Closed);
    assert.strictEqual(late.getAudioTracks()[0].readyState, 'ended');
  });

  it('should keep the new track after the default device is lost', async () => {
    const call = await incomingCall();
    const accept = expectEvent('accept', call);
    call.accept();
    await waitFor(accept, 15000);

    const lostTrack = call.getLocalStream()!.getAudioTracks()[0];
    lostTrack.stop();
    callee.audio!.emit('deviceChange', []);

    assert.strictEqual(defaultRequests.length, 2);
    const reopened = await waitFor(defaultRequests[1], 15000).then(() => defaultRequests[1]);
    await waitFor(new Promise<void>(resolve => {
      const poll = () => call.getLocalStream()!.getAudioTracks()[0] !== lostTrack ? resolve() : setTimeout(poll, 50);
      poll();
    }), 15000);

    assert.strictEqual(reopened.getAudioTracks()[0].readyState, 'live');
    assert.strictEqual(call.getLocalStream()!.getAudioTracks()[0].readyState, 'live');
  });

  it('should not destroy the next call remote processed stream on a repeat close', async () => {
    let destroyCount = 0;
    await callee.audio!.addProcessor({
      createProcessedStream: (stream: MediaStream) => Promise.resolve(new MediaStream(stream.getAudioTracks())),
      destroyProcessedStream: () => { destroyCount++; return Promise.resolve(); },
    }, true);

    callerB = new Device(await generateAccessToken('callerB-' + Date.now()));
    const callA = await incomingCall();
    const callB = await incomingCall(callerB);
    let releaseA!: () => void;
    holds.set(0, new Promise<void>(resolve => { releaseA = resolve; }));

    const acceptB = expectEvent('accept', callB);
    callA.accept();
    callB.accept();
    await waitFor(acceptB, 15000);
    await waitFor(new Promise<void>(resolve => {
      const poll = () => callee.audio!.remoteProcessedStream ? resolve() : setTimeout(poll, 50);
      poll();
    }), 15000);
    const processedB = callee.audio!.remoteProcessedStream;

    // callA was superseded while its getUserMedia was held; releasing it runs callA's late close.
    releaseA();
    await waitFor(defaultRequests[0], 15000);
    await settle();

    assert.strictEqual(callA.status(), Call.State.Closed);
    assert.strictEqual(callB.status(), Call.State.Open);
    assert.strictEqual(destroyCount, 0);
    assert.strictEqual(callee.audio!.remoteProcessedStream, processedB);
  });

  it('should release each call raw stream with a local processor after a late result', async () => {
    let destroyCount = 0;
    await callee.audio!.addProcessor({
      createProcessedStream: (stream: MediaStream) =>
        Promise.resolve(new MediaStream(stream.getAudioTracks().map(track => track.clone()))),
      destroyProcessedStream: () => { destroyCount++; return Promise.resolve(); },
    });

    callerB = new Device(await generateAccessToken('callerB-' + Date.now()));
    const callA = await incomingCall();
    const callB = await incomingCall(callerB);
    let releaseA!: () => void;
    holds.set(0, new Promise<void>(resolve => { releaseA = resolve; }));

    const acceptB = expectEvent('accept', callB);
    callA.accept();
    callB.accept();
    await waitFor(acceptB, 15000);

    // callA's late result arrives while callB is still open.
    releaseA();
    const [rawA, rawB] = await waitFor(defaultRequests, 15000).then(() => Promise.all(defaultRequests));
    await settle();

    const disconnectB = expectEvent('disconnect', callB);
    callB.disconnect();
    await waitFor(disconnectB, 15000);
    await settle();

    assert.deepStrictEqual([rawA, rawB].map(raw => raw.getAudioTracks()[0].readyState), ['ended', 'ended']);
    assert.strictEqual(destroyCount, 2);
  });

  it('should keep the live call processed stream after a late result, through removeProcessor', async () => {
    await grantMicPermission(callee);
    let destroyCount = 0;
    const processor = {
      createProcessedStream: (stream: MediaStream) =>
        Promise.resolve(new MediaStream(stream.getAudioTracks().map(track => track.clone()))),
      destroyProcessedStream: () => { destroyCount++; return Promise.resolve(); },
    };
    await callee.audio!.addProcessor(processor);

    callerB = new Device(await generateAccessToken('callerB-' + Date.now()));
    const callA = await incomingCall();
    const callB = await incomingCall(callerB);
    let releaseA!: () => void;
    holds.set(0, new Promise<void>(resolve => { releaseA = resolve; }));

    const acceptB = expectEvent('accept', callB);
    callA.accept();
    callB.accept();
    await waitFor(acceptB, 15000);
    const processedB = callB.getLocalStream()!;

    releaseA();
    await waitFor(defaultRequests, 15000);
    await settle();
    assert.strictEqual(callee.audio!.localProcessedStream, processedB);

    await callee.audio!.removeProcessor(processor);

    assert.strictEqual(processedB.getAudioTracks()[0].readyState, 'ended');
    assert.strictEqual(destroyCount, 2);
    assert.strictEqual(callB.status(), Call.State.Open);
    assert.strictEqual(callB.getLocalStream()!.getAudioTracks()[0].readyState, 'live');
  });

  it('should stop the default raw track when it lands before setInputDevice, with a processor', async () => {
    await grantMicPermission(callee);
    await callee.audio!.addProcessor({
      createProcessedStream: (stream: MediaStream) =>
        Promise.resolve(new MediaStream(stream.getAudioTracks().map(track => track.clone()))),
      destroyProcessedStream: () => Promise.resolve(),
    });
    const deviceId = Array.from(callee.audio!.availableInputDevices.keys())[0];

    const call = await incomingCall();
    let releaseSelected!: () => void;
    selectedHold = new Promise<void>(resolve => { releaseSelected = resolve; });
    const accept = expectEvent('accept', call);
    call.accept();
    const selected = callee.audio!.setInputDevice(deviceId);
    // The default stream is adopted while setInputDevice still waits on its getUserMedia.
    await waitFor(accept, 15000);
    releaseSelected();
    await waitFor(selected, 15000);
    const rawDefault = await defaultRequests[0];

    assert.strictEqual(rawDefault.getAudioTracks()[0].readyState, 'ended');
    assert.strictEqual(call.status(), Call.State.Open);
    assert.strictEqual(call.getLocalStream()!.getAudioTracks()[0].readyState, 'live');
  });

  it('should stop the raw track when the local processor returns a stream without audio', async () => {
    await callee.audio!.addProcessor({
      createProcessedStream: () => Promise.resolve(new MediaStream()),
      destroyProcessedStream: () => Promise.resolve(),
    });

    const call = await incomingCall();
    const error = expectEvent('error', call);
    call.accept();
    await waitFor(error, 15000);
    const raw = await defaultRequests[0];
    await settle();

    assert.strictEqual(call.status(), Call.State.Closed);
    assert.strictEqual(raw.getAudioTracks()[0].readyState, 'ended');
    assert.strictEqual((callee.audio as any)._defaultInput, null);
  });

  it('should emit disconnect once for an outgoing call disconnected while acquiring its microphone', async () => {
    let releaseDefault!: () => void;
    holds.set(0, new Promise<void>(resolve => { releaseDefault = resolve; }));
    const call = await callee.connect({ params: { To: 'nobody-' + Date.now() } });
    let disconnectCount = 0;
    call.on('disconnect', () => disconnectCount++);

    call.disconnect();
    releaseDefault();
    const raw = await waitFor(defaultRequests[0], 15000).then(() => defaultRequests[0]);
    await settle();

    assert.strictEqual(disconnectCount, 1);
    assert.strictEqual(raw.getAudioTracks()[0].readyState, 'ended');
  });

  it('should emit disconnect once for an incoming call disconnected while acquiring its microphone', async () => {
    const call = await incomingCall();
    let releaseDefault!: () => void;
    holds.set(0, new Promise<void>(resolve => { releaseDefault = resolve; }));
    let disconnectCount = 0;
    call.on('disconnect', () => disconnectCount++);

    call.accept();
    call.disconnect();
    releaseDefault();
    const raw = await waitFor(defaultRequests[0], 15000).then(() => defaultRequests[0]);
    await settle();

    assert.strictEqual(disconnectCount, 1);
    assert.strictEqual(raw.getAudioTracks()[0].readyState, 'ended');
  });

  it('should stop the raw track when the local processor throws', async () => {
    await callee.audio!.addProcessor({
      createProcessedStream: () => { throw new Error('forced processor throw'); },
      destroyProcessedStream: () => Promise.resolve(),
    });

    const call = await incomingCall();
    const error = expectEvent('error', call);
    call.accept();
    await waitFor(error, 15000);
    assert.strictEqual(((await error) as any).code, 31402);
    assert.strictEqual(((await error) as any).originalError.message, 'forced processor throw');
    const raw = await defaultRequests[0];

    assert.strictEqual(call.status(), Call.State.Closed);
    assert.strictEqual(raw.getAudioTracks()[0].readyState, 'ended');
  });

  it('should stop the raw track when the local processor returns no stream', async () => {
    await callee.audio!.addProcessor({
      createProcessedStream: () => Promise.resolve(undefined as any),
      destroyProcessedStream: () => Promise.resolve(),
    });

    const call = await incomingCall();
    const error = expectEvent('error', call);
    call.accept();
    await waitFor(error, 15000);
    assert.strictEqual(((await error) as any).code, 31402);
    assert.strictEqual(((await error) as any).originalError.message,
      'The local AudioProcessor did not return a MediaStream');
    const raw = await defaultRequests[0];

    assert.strictEqual(call.status(), Call.State.Closed);
    assert.strictEqual(raw.getAudioTracks()[0].readyState, 'ended');
    assert.strictEqual(callee.isBusy, false);
  });

  it('should stop the raw track when the local processor fails', async () => {
    await callee.audio!.addProcessor({
      createProcessedStream: () => Promise.reject(new Error('forced processor failure')),
      destroyProcessedStream: () => Promise.resolve(),
    });

    const call = await incomingCall();
    const error = expectEvent('error', call);
    call.accept();
    await waitFor(error, 15000);
    assert.strictEqual(((await error) as any).code, 31402);
    assert.strictEqual(((await error) as any).originalError.message, 'forced processor failure');
    const raw = await defaultRequests[0];

    assert.strictEqual(call.status(), Call.State.Closed);
    assert.strictEqual(raw.getAudioTracks()[0].readyState, 'ended');
    assert.strictEqual(callee.isBusy, false);
  });

  it('should reopen the microphone without a processor removed while it was being created', async () => {
    let releaseProcessed!: () => void;
    const held = new Promise<void>(resolve => { releaseProcessed = resolve; });
    let createReached!: () => void;
    const reached = new Promise<void>(resolve => { createReached = resolve; });
    let processed: MediaStream | null = null;
    const destroyed: MediaStream[] = [];
    const processor = {
      createProcessedStream: (stream: MediaStream) => {
        createReached();
        return held.then(() => processed = new MediaStream(stream.getAudioTracks().map(track => track.clone())));
      },
      destroyProcessedStream: (stream: MediaStream) => { destroyed.push(stream); return Promise.resolve(); },
    };
    await callee.audio!.addProcessor(processor);

    const call = await incomingCall();
    const accept = expectEvent('accept', call);
    call.accept();
    await waitFor(reached, 15000);
    await callee.audio!.removeProcessor(processor);
    releaseProcessed();
    await waitFor(accept, 15000);

    assert.strictEqual(defaultRequests.length, 2);
    assert.strictEqual((await defaultRequests[0]).getAudioTracks()[0].readyState, 'ended');
    assert.strictEqual(processed!.getAudioTracks()[0].readyState, 'ended');
    assert.deepStrictEqual(destroyed, [processed]);
    assert.strictEqual(callee.audio!.localProcessedStream, null);
    assert.strictEqual(call.getLocalStream(), await defaultRequests[1]);
  });

  it('should keep the current input when a reacquired stream is rejected', async () => {
    let createCount = 0;
    const destroyed: MediaStream[] = [];
    await callee.audio!.addProcessor({
      createProcessedStream: (stream: MediaStream) => Promise.resolve(++createCount === 1
        ? new MediaStream(stream.getAudioTracks().map(track => track.clone()))
        : new MediaStream()),
      destroyProcessedStream: (stream: MediaStream) => { destroyed.push(stream); return Promise.resolve(); },
    });
    // The device-lost path does not handle the swap's rejection.
    const ignoreRejection = (error: Error) => !/no audio tracks/.test(error.message);
    Cypress.on('uncaught:exception', ignoreRejection);

    try {
      const call = await incomingCall();
      const accept = expectEvent('accept', call);
      call.accept();
      await waitFor(accept, 15000);

      call.getLocalStream()!.getAudioTracks()[0].stop();
      callee.audio!.emit('deviceChange', []);
      const reacquired = await waitFor(defaultRequests[1], 15000).then(() => defaultRequests[1]);
      await settle();
      assert.strictEqual(reacquired.getAudioTracks()[0].readyState, 'ended');
      assert.strictEqual(destroyed.length, 1);

      call.disconnect();
      assert.strictEqual((await defaultRequests[0]).getAudioTracks()[0].readyState, 'ended');
      assert.strictEqual(destroyed.length, 2);
    } finally {
      Cypress.removeListener('uncaught:exception', ignoreRejection);
    }
  });

  it('should keep rejecting connect() when a call accepted while it waits then fails', async () => {
    await grantMicPermission(callee);
    const deviceId = Array.from(callee.audio!.availableInputDevices.keys())[0];
    const callB = await incomingCall();

    let releaseSelected!: () => void;
    selectedHold = new Promise<void>(resolve => { releaseSelected = resolve; });
    const selected = callee.audio!.setInputDevice(deviceId);
    // connect() waits for setInputDevice before it creates its call.
    const outgoing = callee.connect({ params: { To: 'nobody-' + Date.now() } });

    defaultFailure = new DOMException('forced getUserMedia failure', 'NotReadableError');
    const errorB = expectEvent('error', callB);
    callB.accept();
    await waitFor(errorB, 15000);
    assert.strictEqual(callB.status(), Call.State.Closed);

    const second = callee.connect({ params: { To: 'nobody-' + Date.now() } }).then(() => null, error => error);
    const secondError = await waitFor(second, 5000).then(() => second);
    assert.strictEqual(secondError && secondError.name, 'InvalidStateError');

    releaseSelected();
    await waitFor(selected, 15000);
    const call = await waitFor(outgoing, 15000).then(() => outgoing);
    assert.strictEqual((callee as any)._activeCall, call);
  });

  it('should not reacquire the default microphone while setInputDevice swaps the track', async () => {
    await grantMicPermission(callee);
    const deviceId = Array.from(callee.audio!.availableInputDevices.keys())[0];
    const call = await incomingCall();
    const accept = expectEvent('accept', call);
    call.accept();
    await waitFor(accept, 15000);

    // Hold the swap's replaceTrack, after it has stopped the default track.
    const sender = (call as any)._mediaHandler.version.pc.getSenders()[0];
    const replaceTrack = sender.replaceTrack.bind(sender);
    let releaseSwap!: () => void;
    const swapHold = new Promise<void>(resolve => { releaseSwap = resolve; });
    let swapStarted!: () => void;
    const started = new Promise<void>(resolve => { swapStarted = resolve; });
    sender.replaceTrack = (track: MediaStreamTrack) => {
      swapStarted();
      return swapHold.then(() => replaceTrack(track));
    };
    const selected = callee.audio!.setInputDevice(deviceId);
    await waitFor(started, 15000);

    callee.audio!.emit('deviceChange', []);
    assert.strictEqual(defaultRequests.length, 1);

    releaseSwap();
    await waitFor(selected, 15000);
    assert.strictEqual(call.getLocalStream()!.getAudioTracks()[0].readyState, 'live');
    assert.strictEqual((await defaultRequests[0]).getAudioTracks()[0].readyState, 'ended');
  });

  it('should keep the selected input after an earlier overlapping swap fails', async () => {
    await grantMicPermission(callee);
    const deviceId = Array.from(callee.audio!.availableInputDevices.keys())[0];
    const call = await incomingCall();
    const accept = expectEvent('accept', call);
    call.accept();
    await waitFor(accept, 15000);

    // The first swap's replaceTrack is held, then fails after the second swap succeeded.
    const sender = (call as any)._mediaHandler.version.pc.getSenders()[0];
    const replaceTrack = sender.replaceTrack.bind(sender);
    let failFirstSwap!: () => void;
    let firstSwapStarted!: () => void;
    const started = new Promise<void>(resolve => { firstSwapStarted = resolve; });
    let swaps = 0;
    sender.replaceTrack = (track: MediaStreamTrack) => {
      if (swaps++ > 0) {
        return replaceTrack(track);
      }
      firstSwapStarted();
      return new Promise<void>((_, reject) => {
        failFirstSwap = () => reject(new Error('forced replaceTrack failure'));
      });
    };
    const first = callee.audio!.setInputDevice(deviceId).then(() => null, error => error);
    await waitFor(started, 15000);
    await waitFor(callee.audio!.setInputDevice(deviceId), 15000);
    failFirstSwap();
    const firstError = await waitFor(first, 15000).then(() => first);
    assert.ok(firstError);

    // The call now sends the selected stream, so losing it must not reacquire the default device.
    call.getLocalStream()!.getAudioTracks()[0].stop();
    callee.audio!.emit('deviceChange', []);
    assert.strictEqual(defaultRequests.length, 1);
  });
});
