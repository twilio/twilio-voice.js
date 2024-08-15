// import * as assert from 'assert';
// import * as sinon from 'sinon';
// import Device from '../../../lib/twilio/device';
// import type Call from '../../../lib/twilio/call';
// import { generateAccessToken } from '../../lib/token';
// import { expectEvent } from '../../lib/util';
// const env = require('../../env');

// function waitFor(n: number, reject?: boolean) {
//   return new Promise((res, rej) => setTimeout(reject ? rej : res, n));
// }

// describe('callProgressEvent', function() {
//   let teardown: () => void;

//   this.timeout(1000 * 60 * 10); // 10 minute timeout for the whole suite

//   const setup = async (aliceOptions: any, bobOptions: any, tokenTtl = 180) => {
//     const aliceId = `client-id-call-message-tests-alice-${Date.now()}`;
//     const aliceToken = generateAccessToken(aliceId, tokenTtl, env.appSid);
//     const aliceDevice = new Device(aliceToken, aliceOptions);

//     const bobId = `client-id-call-message-tests-bob-${Date.now()}`;
//     const bobToken = generateAccessToken(bobId, tokenTtl, env.appSid);
//     const bobDevice = new Device(bobToken, bobOptions);

//     teardown = () => {
//       aliceDevice.destroy();
//       bobDevice.destroy();
//     };

//     await bobDevice.register();

//     const bobCallPromise: Promise<Call> = expectEvent(
//       Device.EventName.Incoming,
//       bobDevice,
//     );

//     const aliceCall = await aliceDevice.connect({ params: { To: bobId } });
//     const bobCall = await bobCallPromise;

//     const aliceMessageReceivedSpy = sinon.spy();
//     const bobMessageReceivedSpy = sinon.spy();

//     aliceCall.on('messageReceived', aliceMessageReceivedSpy);
//     bobCall.on('messageReceived', bobMessageReceivedSpy);

//     const aliceCallAcceptPromise = expectEvent('accept', aliceCall);
//     const bobCallAcceptPromise = expectEvent('accept', bobCall);

//     bobCall.accept();

//     await aliceCallAcceptPromise;
//     await bobCallAcceptPromise;

//     await waitFor(5000);

//     return {
//       aliceDevice,
//       bobDevice,
//       aliceCall,
//       bobCall,
//       aliceMessageReceivedSpy,
//       bobMessageReceivedSpy,
//     };
//   };

//   beforeEach(() => {
//     teardown = () => {};
//   });

//   afterEach(() => {
//     teardown?.();
//   });

//   // NOTE(mhuynh): Once backend changes are done to facilitate call message
//   // event type filtering, we can re-enable this test.
//   // See VBLOCKS-3332
//   it.skip(
//     'does not receive call progress events',
//     async function() {
//       const callMessageEvents = [];
//       const deviceOptions = { callMessageEvents };

//       const { aliceMessageReceivedSpy, bobMessageReceivedSpy } = await setup(
//         deviceOptions,
//         deviceOptions,
//       );

//       sinon.assert.notCalled(aliceMessageReceivedSpy);
//       sinon.assert.notCalled(bobMessageReceivedSpy);
//     },
//   );

//   it(
//     'receives call progress events',
//     async function() {
//       const callMessageEvents = ['call-progress-event'];
//       const deviceOptions = { callMessageEvents };

//       const { aliceCall, aliceMessageReceivedSpy, bobMessageReceivedSpy } =
//         await setup(deviceOptions, deviceOptions);

//       aliceCall.disconnect();

//       await waitFor(5000);

//       const expectedCallProgressEvents =
//         ['ringing', 'initiated', 'in-progress'];

//       const actualCallProgressEvents: any[] = [];

//       for (const arg of aliceMessageReceivedSpy.args) {
//         assert.strictEqual(arg.length, 1);

//         const {
//           content: {
//             ParentCallSid,
//             CallType,
//             CallStatus,
//             CallSid,
//           },
//           contentType,
//           messageType,
//           voiceEventSid
//         } = arg[0];

//         assert.deepStrictEqual(CallType, 'CLIENT');
//         assert.deepStrictEqual(contentType, 'application/json');
//         assert.deepStrictEqual(messageType, 'call-progress-event');

//         actualCallProgressEvents.push(CallStatus);
//       }

//       assert.deepStrictEqual(
//         actualCallProgressEvents,
//         expectedCallProgressEvents,
//       );
//     },
//   );
// });

describe('empty test suite', function() {
  it('does nothing', function() {});
});
