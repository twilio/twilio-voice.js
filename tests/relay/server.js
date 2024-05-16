// @ts-check

'use strict';

const ngrok = require('@ngrok/ngrok');
const axios = require('axios').default;
const express = require('express');
const cors = require('cors');

/** @type {Map<string, any[]>} */
const receivedMessages = new Map();

/**
 * @returns {{
 *    apiKeySid: string;
 *    apiKeySecret: string;
 *    accountSid: string;
 *    eventingTwimlAppSid: string;
 * }}
 */
const getEnvVars = () => {
  const apiKeySid = process.env['API_KEY_SID'];
  if (typeof apiKeySid !== 'string') {
    throw new Error('API_KEY_SID env var not defined.');
  }

  const apiKeySecret = process.env['API_KEY_SECRET'];
  if (typeof apiKeySecret !== 'string') {
    throw new Error('API_KEY_SECRET env var not defined.');
  }

  const accountSid = process.env['ACCOUNT_SID'];
  if (typeof accountSid !== 'string') {
    throw new Error('ACCOUNT_SID env var not defined.');
  }

  const eventingTwimlAppSid = process.env['EVENTING_TWIML_APP_SID'];
  if (typeof eventingTwimlAppSid !== 'string') {
    throw new Error('EVENTING_TWIML_APP_SID env var not defined.');
  }

  return { apiKeySid, apiKeySecret, accountSid, eventingTwimlAppSid };
};

/**
 * @typedef {(callSid: string, callbackUrl: string) => Promise<import('axios').AxiosResponse>} CreateSubscription
 */

/**
 * @typedef {(callSid: string) => Promise<import('axios').AxiosResponse>} SendMessage
 */

/**
 * @param {string} accountSid
 * @param {string} apiKeySid
 * @param {string} apiKeySecret
 */
const createTwilioUserDefinedMessageActions = (accountSid, apiKeySid, apiKeySecret) => {
  const baseUrl = 'https://api.twilio.com/2010-04-01';
  const extendedUrl = `${baseUrl}/Accounts/${accountSid}/Calls`;

  /**
   * @type {CreateSubscription}
   */
  const createSubscription = (callSid, callbackUrl) => {
    const url =
      `${extendedUrl}/${callSid}/UserDefinedMessageSubscriptions.json`;

    const params = new URLSearchParams();
    params.append('Method', 'POST');
    params.append('Callback', callbackUrl);

    return axios.post(url, params, {
      auth: {
        username: apiKeySid,
        password: apiKeySecret,
      },
    });
  };

  /**
   * @type {SendMessage}
   */
  const sendMessage = (callSid) => {
    const url =
      `${extendedUrl}/${callSid}/UserDefinedMessages.json`;

    const params = new URLSearchParams();
    params.append('Content', JSON.stringify({ message: 'ahoy, world!' }));

    return axios.post(url, params, {
      auth: {
        username: apiKeySid,
        password: apiKeySecret,
      },
    });
  };

  return { createSubscription, sendMessage };
}

/**
 * @param {CreateSubscription} createSubscription
 * @param {SendMessage} sendMessage
 */
const createExpressApp = (createSubscription, sendMessage) => {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.post('/create-subscription', async (req, res) => {
    const { CallSid } = req.body;
    if (typeof CallSid !== 'string') {
      res.sendStatus(400);
      throw new Error('CallSid is not of type string');
    }
    const callbackUrl = `${app.listener.url()}/receive-message`;
    console.log('creating a subscription', { CallSid, callbackUrl });

    const subscription = await createSubscription(CallSid, callbackUrl);
    console.log(subscription.data);

    res.json(subscription.data);
  });

  app.post('/receive-message', (req, res) => {
    console.log('received message', req.body);

    const { CallSid } = req.body;
    if (typeof CallSid !== 'string') {
      res.sendStatus(400);
      throw new Error('CallSid is not of type string');
    }

    const existingMessages = receivedMessages.get(CallSid) || [];
    receivedMessages.set(CallSid, [...existingMessages, req.body]);

    res.sendStatus(200);
  });

  app.post('/get-received-messages', (req, res) => {
    console.log('sending received messages', req.body);

    const { CallSid } = req.body;
    if (typeof CallSid !== 'string') {
      res.sendStatus(400);
      throw new Error('CallSid is not of type string');
    }

    res.json(receivedMessages.get(CallSid));
  });

  app.post('/send-message', async (req, res) => {
    const { CallSid } = req.body;
    if (typeof CallSid !== 'string') {
      res.sendStatus(400);
      throw new Error('CallSid is not of type string');
    }

    const sendMessageResponse = await sendMessage(CallSid);
    console.log('sent message', sendMessageResponse.data);

    res.json(sendMessageResponse.data);
  });

  return app;
};

const start = async () => {
  const envVars = getEnvVars();

  const { createSubscription, sendMessage } =
    createTwilioUserDefinedMessageActions(
      envVars.accountSid,
      envVars.apiKeySid,
      envVars.apiKeySecret,
    );
  const app = createExpressApp(createSubscription, sendMessage);

  await ngrok.listen(app);

  console.log(`listening on ${app.listener.url()}`);

  app.listen(3030, () => {
    console.log('listening on 3030');
  });
};

start();
