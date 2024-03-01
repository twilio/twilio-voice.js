import { WSAdapter, WSProxy } from "./ws.mjs";

let adapter;
let proxy;

const bridge = new EventEmitter3();
bridge.on('proxy-message', (message) => adapter.sendMessage(message));
bridge.on('adapter-message', (message) => proxy.sendMessage(message));

adapter = new WSAdapter((message) => {
  bridge.emit('adapter-message', message);
});

proxy = new WSProxy((message) => {
  bridge.emit('proxy-message', message);
});

const ws = proxy;
ws.init('ws://127.0.0.1:3030');
ws.addEventListener('message', (message) => console.log(message.data));

sendHeartbeat();

async function sendHeartbeat() {
  await ws.readyState() === WebSocket.OPEN && await ws.send('ping');
  setTimeout(sendHeartbeat, 1000);
}
