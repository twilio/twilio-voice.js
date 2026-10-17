// Loads the credentials for local minting from .env. Existing process.env
// values win, so CI is unaffected.
require('dotenv').config();

const bodyParser = require('body-parser');
const express = require('express');
const http = require('http');
const Vendor = require('../../lib/vend');

const app = express();
const server = http.createServer(app);
const port = parseInt(process.env.PORT, 10) || 3030;
const vendor = new Vendor();

app.use(bodyParser.text());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log('Received request for: ' + req.url);
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

app.get('/token', async (req, res) => {
  const identity = req.query.identity;

  // Express 4 does not catch a rejected async handler, so the request would hang.
  let response;
  try {
    response = await vendor.vend(JSON.stringify({
      action: 'mint-voice-token',
      variant: 'extension',
      identity,
      ttl: 3600,
    }));
  } catch (error) {
    console.error('/token failed', error);
    res.status(500).send({ error: 'internal error' });
    return;
  }

  if (response.status !== 200) {
    console.error(`/token failed: ${response.status} ${response.text}`);
    res.status(response.status).type('json').send(response.text);
    return;
  }

  res.send({
    identity,
    token: JSON.parse(response.text).token,
  });
});

server.listen(port, () => {
  console.log(`Listening at port ${port}`);
});
