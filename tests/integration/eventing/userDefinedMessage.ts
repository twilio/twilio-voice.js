import * as assert from 'assert';
import axios from 'axios';
import Device from '../../../lib/twilio/device';
import { generateAccessToken } from '../../lib/token';
const env = require('../../env');

const RELAY_SERVER_URL = 'http://localhost:3030';

describe('userDefinedMessage', function() {
  this.timeout(1000 * 60 * 10); // 10 minute timeout for the whole suite

  describe('outgoing call', function() {
    const createOutgoingCallTest = async () => {
      const token = generateAccessToken(
        `client-id-eventing-tests-outgoing-call-${Date.now()}`,
        60 * 3, // 3 minute TTL
        env.eventingTwimlAppSid,
      );
      const device = new Device(token);
      const call = await device.connect();
      await new Promise((res) => {
        console.log('waiting for call to be accepted');
        call.on('accept', () => {
          console.log('call accepted');
          res();
        });
      });
      return { device, call };
    };

    it(
      'should successfully send a message to the customer server',
      async function() {
        const { device, call } = await createOutgoingCallTest();

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
        await new Promise((res, rej) => {
          console.log('waiting for twilio to receive the message')
          call.once('messageSent', (msg) => {
            if (msg.voiceEventSid === eventSid) {
              return res();
            }
            rej();
          });
        });
        console.log('sent message', eventSid);

        // NOTE(mhuynh): Using a quick solution here such that we just wait for
        // the message from Twilio to reach the test server. Otherwise, there is
        // a high likelihood that the message will be missed.
        await new Promise((res) => {
          setTimeout(() => {
            res();
          }, 3000);
        });

        const receivedMessagesResponse = await axios.post(
          `${RELAY_SERVER_URL}/get-received-messages`,
          { CallSid },
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

        device.destroy();
      },
    );

    it('should successfully receive an incoming message', async function() {
      const { device, call } = await createOutgoingCallTest();

      const messageReceivedPromise = new Promise<any>((res) => {
        call.on('messageReceived', (msg) => {
          res(msg);
        });
      });

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

      device.destroy();
    });
  });
});
