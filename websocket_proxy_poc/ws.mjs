export class WSAdapter {

  constructor(onMessage) {
    this._onMessage = (message) => {
      onMessage(JSON.stringify(message));
    };
  }

  sendMessage(message) {
    const { id, type, payload } = JSON.parse(message);
    if (type === 'init') {
      this._ws = new WebSocket(payload.uri);
      this._ws.addEventListener('message', (event) => {
        this._onMessage({
          type: 'event',
          payload: {
            name: 'message',
            data: event.data
          }
        });
      });

    } else if (type === 'property') {
      this._onMessage({
        id,
        type,
        payload: {
          name: payload.name,
          value: this._ws[payload.name]
        }
      });
    } else if (type === 'method') {
      const result = this._ws[payload.name](...payload.params);
      this._onMessage({
        id,
        type,
        payload: {
          name: payload.name,
          result,
        }
      });
    }
  }
}


export class WSProxy extends EventTarget {

  constructor(onMessage) {
    super();
    this._onMessage = (message) => {
      onMessage(JSON.stringify(message));
    };
    this._deferredPromises = new Map();
  }

  init(uri) {
    this._onMessage({
      type: 'init',
      payload: {
        uri
      }
    });
  }

  sendMessage(message) {
    const { id, type, payload } = JSON.parse(message);
    if (type === 'event' && payload.name === 'message') {
      this.dispatchEvent(new MessageEvent('message', { data: payload.data }));
    } else if (type === 'property' && this._deferredPromises.has(id)) {
      const promise = this._deferredPromises.get(id);
      this._deferredPromises.delete(id);
      promise.resolve(payload.value);
    } else if (type === 'method' && this._deferredPromises.has(id)) {
      const promise = this._deferredPromises.get(id);
      this._deferredPromises.delete(id);
      promise.resolve(payload.result);
    }
  }

  async send(data) {
    return new Promise((resolve, reject) => {
      const id = Date.now();
      this._deferredPromises.set(id, { resolve, reject });
      this._onMessage({
        id,
        type: 'method',
        payload: {
          name: 'send',
          params: [data]
        }
      });
    });
  }

  async readyState() {
    return new Promise((resolve, reject) => {
      const id = Date.now();
      this._deferredPromises.set(id, { resolve, reject });
      this._onMessage({
        id,
        type: 'property',
        payload: {
          name: 'readyState'
        }
      });
    });
  }
}
