const bodyParser = require('body-parser');
const express = require('express');
const http = require('http');
const Twilio = require('twilio');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const ws = new WebSocket.Server({ server });
const port = parseInt(process.env.PORT, 10) || 3030;
const jfConfig = { type: 'space', size: 2 };

// WARNING
// This server is tracking only one WebSocket connection
// and has no authentication/user management implemented.
// It serves as a proof of concept and can be used as a
// starting point for a production ready application.

let wsClient;
let clientIdentity;
ws.on('connection', (client, req) => {
  console.log(`client connected: ${req.connection.remoteAddress}`);
  wsClient = client;
  wsClient.on('message', (message) => {
    message = message.toString();
    try {
      message = jsonFormat(JSON.parse(message), jfConfig);
    } catch {}
    console.log('WebSocket message received:');
    console.log(message);

    if (message.includes('register:')) {
      clientIdentity = message.split(':')[1];
      console.log('Client set:' + clientIdentity);
    }
  });
});

app.use(bodyParser.text());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/**
 * When testing locally using a tool like `ngrok`, `ngrok` acts as a proxy in
 * front of this `express` app.
 *
 * Configure the following line according to your environment, development or
 * production.
 *
 * Please see the official Express documentation for more information.
 * https://expressjs.com/en/guide/behind-proxies.html
 */
app.set('trust proxy', 1);

// CORS
app.use((req, res, next) => {
  console.log('Received request for: ' + req.url);
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

app.get('/token', (req, res) => {
  const identity = req.query.identity;
  const twimlAppSid = process.env.APPLICATION_SID;
  const twilioAccountSid = process.env.ACCOUNT_SID;
  const twilioApiKey = process.env.API_KEY;
  const twilioApiSecret = process.env.API_SECRET;

  const voiceGrant = new Twilio.jwt.AccessToken.VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: !!identity,
  });

  const token = new Twilio.jwt.AccessToken(
    twilioAccountSid,
    twilioApiKey,
    twilioApiSecret,
    {
      identity,
      ttl: 3600,
    });

  token.addGrant(voiceGrant);

  res.send({
    identity,
    token: token.toJwt()
  });
});

app.post('/twiml', (req, res) => {
  const twiml = new Twilio.twiml.VoiceResponse();
  let recipient = req.body.recipient;
  let to = req.body.To;

  if (to === process.env.INBOUND_NUMBER) {
    // The INBOUND_NUMBER is a Twilio Phone Number that is configured
    // to POST to this twiml endpoint when called.
    // If we get to this point, it means the Twilio Phone Number is being called.
    // Same hardcoded identity name in worker.js
    recipient = 'alice';
  }

  const done = () => {
    const attr = /^[\d\+\-\(\) ]+$/.test(recipient) ? 'number' : 'client';
    const dial = twiml.dial({
      callerId: process.env.CALLER_ID,
    });
    dial[attr]({}, recipient);

    res
      .header('Content-Type', 'text/xml')
      .status(200)
      .send(twiml.toString());
  };

  if (wsClient && clientIdentity === recipient) {
    // The recipient is the same identity as the registered
    // client. Meaning, this is an inbound call to the extension
    // so we need to notify it.
    const onMessage = (message) => {
      message = message.toString();
      if (message === 'registered') {
        wsClient.off('message', onMessage);
        done();
      }
    };
    wsClient.on('message', onMessage);
    wsClient.send(JSON.stringify({type: 'incoming', identity: recipient }));
  } else {
    done();
  }
});

server.listen(port, () => {
  console.log(`Listening at port ${port}`);
});
