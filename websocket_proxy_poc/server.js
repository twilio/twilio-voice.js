const express = require('express');
const bodyParser = require('body-parser');
const jsonFormat = require('json-format');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const ws = new WebSocket.Server({ server });
const port = parseInt(process.env.PORT, 10) || 3030;
const webDir = process.argv[2] || __dirname;
const jfConfig = { type: 'space', size: 2 };

let wsClient;
ws.on('connection', (client, req) => {
  console.log(`client connected: ${req.connection.remoteAddress}`);
  wsClient = client;
  wsClient.send('ack');
  wsClient.on('message', (message) => {
    // console.log(message.toString());
    wsClient.send('ok');
  });
});

app.use(bodyParser.text());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  console.log('Received request for: ' + req.url);
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

app.use('/', express.static(webDir));

app.route('/*').get((req, res) => {
  res.sendFile(webDir + '/index.html');
});

server.listen(port, () => {
  console.log(`Serving ${webDir} at port ${port}`);
});
