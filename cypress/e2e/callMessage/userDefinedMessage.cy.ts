import * as assert from 'assert';
import axios from 'axios';
import Device from '../../../lib/twilio/device';
import type Call from '../../../lib/twilio/call';
import { generateAccessToken } from '../../../tests/lib/token';
import { expectEvent } from '../../../tests/lib/util';

const RELAY_SERVER_URL = 'http://localhost:3030';

function waitFor(n: number, reject?: boolean) {
  return new Promise((res, rej) => setTimeout(reject ? rej : res, n));
}

describe('userDefinedMessage', function() {
  const MAX_TIMEOUT = 1000 * 60 * 10; // 10 minute timeout for the whole suite
  this.timeout(MAX_TIMEOUT); 
  Cypress.config('defaultCommandTimeout', MAX_TIMEOUT);

  const createCallTest = async () => {
    const tokenTtl = 60 * 3; // 3 minute TTL

    const aliceId = `client-id-call-message-tests-alice-${Date.now()}`;
    const aliceToken = generateAccessToken(aliceId, tokenTtl);
    const aliceDevice = new Device(aliceToken);

    const bobId = `client-id-call-message-tests-bob-${Date.now()}`;
    const bobToken = generateAccessToken(bobId, tokenTtl);
    const bobDevice = new Device(bobToken);

    await bobDevice.register();
    const bobCallPromise: Promise<Call> = expectEvent(
      Device.EventName.Incoming,
      bobDevice,
    );

    const aliceCall = await aliceDevice.connect({ params: { To: bobId } });
    const bobCall = await bobCallPromise;

    const aliceCallAcceptPromise = expectEvent('accept', aliceCall);
    const bobCallAcceptPromise = expectEvent('accept', bobCall);

    bobCall.accept();

    await aliceCallAcceptPromise;
    await bobCallAcceptPromise;

    const performTeardown = () => {
      aliceDevice.destroy();
      bobDevice.destroy();
    };

    return {
      performTeardown,
      alice: {
        device: aliceDevice,
        call: aliceCall,
      },
      bob: {
        device: bobDevice,
        call: bobCall,
      },
    };
  };

  describe('outgoing call leg', function() {
    let alice: { device: Device, call: Call };
    let bob: { device: Device, call: Call };
    let performTeardown: () => void;

    beforeEach(async function() {
      ({ alice, bob, performTeardown } = await createCallTest());
    });

    afterEach(function() {
      performTeardown();
    });

    it('should successfully send a message to the customer server',
      async function() {
        const { call } = alice;

        const CallSid = call.parameters.CallSid;
        console.log('call sid', CallSid);
        const subscription = await axios.post(
          `${RELAY_SERVER_URL}/create-subscription`,
          { CallSid },
        );
        console.log(`subscription made for call ${CallSid}`, subscription.data);

        const eventSid = call.sendMessage({
          content: { hello: 'world' },
          messageType: 'user-defined-message',
        });
        const msg = await expectEvent('messageSent', call);
        assert.strictEqual(msg.voiceEventSid, eventSid);
        console.log('sent message', eventSid);

        /**
         * NOTE(mhuynh): Using a quick solution here such that we just wait for
         * the message from Twilio to reach the test server. Otherwise, there is
         * a high likelihood that the message will be missed.
         */
        await waitFor(3000);

        const receivedMessagesResponse = await axios.get(
          `${RELAY_SERVER_URL}/get-received-messages/${CallSid}`,
        );
        const receivedMessages = receivedMessagesResponse.data;
        console.log('received messages', receivedMessages);

        assert.strictEqual(typeof receivedMessages, 'object');
        assert(
          Array.isArray(receivedMessages),
          'received messages is not of type array',
        );
        assert.strictEqual(receivedMessages.length, 1);

        const [receivedMessage] = receivedMessages
        assert.strictEqual(receivedMessage.ContentType, 'application/json');
        assert.strictEqual(receivedMessage.Content, JSON.stringify({
          hello: 'world',
        }));
        assert.strictEqual(receivedMessage.SequenceNumber, '1');
        assert.strictEqual(receivedMessage.CallSid, CallSid);
        assert.strictEqual(receivedMessage.Sid, eventSid);
      },
    );

    it('should successfully receive an incoming message', async function() {
      const { call } = alice;

      const messageReceivedPromise: Promise<Call.Message> = expectEvent(
        'messageReceived',
        call,
      );

      const CallSid = call.parameters.CallSid;
      const sendMessageResponse = await axios.post(
        `${RELAY_SERVER_URL}/send-message`,
        { CallSid },
      );
      const sentMessage = sendMessageResponse.data;
      console.log('message sent by server', sentMessage);

      const receivedMessage = await messageReceivedPromise;
      console.log('message received by client', receivedMessage);

      assert.strictEqual(receivedMessage.voiceEventSid, sentMessage.sid);
      assert.deepStrictEqual(
        receivedMessage.content,
        { message: 'ahoy, world!' },
      );
      assert.strictEqual(receivedMessage.contentType, 'application/json');
      assert.strictEqual(receivedMessage.messageType, 'user-defined-message');
    });

    it('should receive an error if the message type is invalid', async function() {
      const { call } = alice;
      const errorPromise = expectEvent('error', call);
      call.sendMessage({
        content: { foo: 'bar' },
        messageType: 'not-a-valid-message-type',
      });
      const error = await errorPromise;
      assert.strictEqual(error.code, 31210);
    });
  });
});
