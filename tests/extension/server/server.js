const bodyParser = require('body-parser');
const express = require('express');
const http = require('http');
const Twilio = require('twilio');

const app = express();
const server = http.createServer(app);
const port = parseInt(process.env.PORT, 10) || 3030;

app.use(bodyParser.text());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log('Received request for: ' + req.url);
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

app.get('/token', (req, res) => {
  const identity = req.query.identity;
  const twimlAppSid = process.env.APPLICATION_SID_EXTENSION;
  const twilioAccountSid = process.env.ACCOUNT_SID;
  const twilioApiKey = process.env.API_KEY_SID;
  const twilioApiSecret = process.env.API_KEY_SECRET;
  console.log("applicationsid", twimlAppSid)
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

server.listen(port, () => {
  console.log(`Listening at port ${port}`);
});
