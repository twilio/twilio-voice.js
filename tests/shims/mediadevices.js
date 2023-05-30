const assert = require('assert');
const sinon = require('sinon');
const getMediaDevicesInstance = require('../../lib/twilio/shims/mediadevices').default;

describe('MediaDevicesShim', () => {
  const userMediaStream = 'USER-STREAM';

  let clock;
  let globalMediaDevices;
  let getDevices;
  let mediaDevices;
  let mediaDeviceList;
  let nativeMediaDevices;

  const sampleDevices = async () => {
    await clock.tickAsync(500);
  };

  beforeEach(() => {
    clock = sinon.useFakeTimers(Date.now());

    mediaDeviceList = [
      { deviceId: 'id1', kind: 'audioinput', label: 'label1' },
      { deviceId: 'id2', kind: 'audiooutput', label: 'label2' },
      { deviceId: 'id3', kind: 'videoinput', label: 'label3' },
      { deviceId: 'id4', kind: 'videooutput', label: 'label4' },
    ];

    // Always return a deep copy
    getDevices = () => new Promise(res => res(mediaDeviceList.map(d => ({ ...d }))));

    nativeMediaDevices = {
      enumerateDevices: sinon.stub().callsFake(getDevices),
      getUserMedia: sinon.stub().returns(Promise.resolve(userMediaStream)),
    };
    
    globalMediaDevices = global.navigator.mediaDevices;
    global.navigator.mediaDevices = nativeMediaDevices;

    mediaDevices = getMediaDevicesInstance();
  });

  afterEach(() => {
    global.navigator.mediaDevices = globalMediaDevices;
    clock.restore();
  });

  describe('.enumerateDevices()', () => {
    it('should call native enumerateDevices properly', async () => {
      sinon.assert.calledOnce(nativeMediaDevices.enumerateDevices);
      const devices = await mediaDevices.enumerateDevices();
      sinon.assert.calledTwice(nativeMediaDevices.enumerateDevices);
      assert.deepStrictEqual(devices, mediaDeviceList);
    });

    it('should return null if the browser does not support enumerateDevices', async () => {
      nativeMediaDevices.enumerateDevices = null;
      const devices = await mediaDevices.enumerateDevices();
      assert.deepStrictEqual(devices, null);
    });
  });

  describe('.getUserMedia()', () => {
    it('should call native getUserMedia properly', async () => {
      const stream = await mediaDevices.getUserMedia({ foo: 'foo' });
      sinon.assert.calledOnce(nativeMediaDevices.getUserMedia);
      sinon.assert.calledWithExactly(nativeMediaDevices.getUserMedia, { foo: 'foo' })
      assert.strictEqual(stream, userMediaStream);
    });
  });

  describe('#devicechange', () => {
    let callback;

    beforeEach(async () => {
      callback = sinon.stub();
      mediaDevices.addEventListener('devicechange', callback);
      await sampleDevices();
    });

    it('should stop polling after removing listeners', async () => {
      const existingCallCount = nativeMediaDevices.enumerateDevices.callCount;
      mediaDevices.removeEventListener('devicechange', callback);
      sinon.assert.callCount(nativeMediaDevices.enumerateDevices, existingCallCount);
      await sampleDevices();
      sinon.assert.callCount(nativeMediaDevices.enumerateDevices, existingCallCount);
    });

    it('should not emit the first time', async () => {
      sinon.assert.notCalled(callback);
    });

    it('should emit once if a new device is added', async () => {
      mediaDeviceList.push({ deviceId: 'id5', kind: 'audioinput', label: 'label5' });
      await sampleDevices();
      sinon.assert.calledOnce(callback);
      await sampleDevices();
      sinon.assert.calledOnce(callback);
    });

    it('should emit once if a device is removed', async () => {
      mediaDeviceList.pop();
      await sampleDevices();
      sinon.assert.calledOnce(callback);
      await sampleDevices();
      sinon.assert.calledOnce(callback);
    });

    it('should emit once if a device is removed and a new device is added', async () => {
      mediaDeviceList.pop();
      mediaDeviceList.push({ deviceId: 'id5', kind: 'audioinput', label: 'label5' });
      await sampleDevices();
      sinon.assert.calledOnce(callback);
      await sampleDevices();
      sinon.assert.calledOnce(callback);
    });

    describe('when native event is supported', () => {
      const setup = async () => {
        nativeMediaDevices.ondevicechange = null;
        mediaDevices = getMediaDevicesInstance();
        callback = sinon.stub();
        mediaDevices.addEventListener('devicechange', callback);
        await sampleDevices();
      };

      beforeEach(async () => await setup());

      it('should not emit manually', async () => {
        mediaDeviceList.pop();
        await sampleDevices();
        sinon.assert.notCalled(callback);
      });

      it('should reemit if addEventListener is not supported', async () => {
        await sampleDevices();
        nativeMediaDevices.ondevicechange({ type: 'devicechange' });
        sinon.assert.calledOnce(callback);
      });

      it('should reemit if addEventListener is supported', async () => {
        nativeMediaDevices.addEventListener = (eventName, dispatchEvent) => {
          nativeMediaDevices[`_emit${eventName}`] = () => dispatchEvent({ type: eventName });
        };
        await setup();
        await sampleDevices();
        nativeMediaDevices._emitdevicechange();
        sinon.assert.calledOnce(callback);
      });
    });
  });

  describe('#deviceinfochange', () => {
    let callback;

    const setup = async () => {
      callback = sinon.stub();
      mediaDevices = getMediaDevicesInstance();
      mediaDevices.addEventListener('deviceinfochange', callback);
      await sampleDevices();
    };

    beforeEach(async () => {
      mediaDeviceList.forEach(d => d.label = '');
      await setup();
    });

    it('should stop polling after removing listeners', async () => {
      const existingCallCount = nativeMediaDevices.enumerateDevices.callCount;
      mediaDevices.removeEventListener('deviceinfochange', callback);
      sinon.assert.callCount(nativeMediaDevices.enumerateDevices, existingCallCount);
      await sampleDevices();
      sinon.assert.callCount(nativeMediaDevices.enumerateDevices, existingCallCount);
    });

    it('should not emit the first time', async () => {
      sinon.assert.notCalled(callback);
    });

    it('should emit once when device labels become available', async () => {
      mediaDeviceList.forEach((d, i) => d.label = `label${i}`);
      await sampleDevices();
      sinon.assert.calledOnce(callback);
      await sampleDevices();
      sinon.assert.calledOnce(callback);
    });

    it('should emit once when only audioinput or audiooutput device labels become available', async () => {
      mediaDeviceList.forEach((d, i) => {
        if (d.kind === 'audioinput' || d.kind === 'audiooutput') {
          d.label = `label${i}`;
        }
      });
      await sampleDevices();
      sinon.assert.calledOnce(callback);
      await sampleDevices();
      sinon.assert.calledOnce(callback);
    });

    it('should emit once when there are duplicate ids across different types of devices', async () => {
      mediaDeviceList.forEach((d, i) => {
        d.deviceId = 'foo';
        d.label = '';
      });
      await setup();
      mediaDeviceList.forEach((d, i) => {
        d.deviceId = 'foo';
        d.label = `label${i}`;
      });
      await sampleDevices();
      sinon.assert.calledOnce(callback);
      await sampleDevices();
      sinon.assert.calledOnce(callback);
      await sampleDevices();
      sinon.assert.calledOnce(callback);
    });

    it('should not emit when device labels become available for a videoinput or videooutput device', async () => {
      mediaDeviceList.forEach((d, i) => {
        if (d.kind === 'videoinput' || d.kind === 'videooutput') {
          d.label = `label${i}`;
        }
      });
      await sampleDevices();
      sinon.assert.notCalled(callback);
      await sampleDevices();
      sinon.assert.notCalled(callback);
    });

    it('should emit once when ids are all empty initially', async () => {
      mediaDeviceList.forEach((d, i) => {
        d.deviceId = '';
        d.label = '';
      });
      await setup();
      mediaDeviceList.forEach((d, i) => {
        d.deviceId = `id${i}`;
        d.label = `label${i}`;
      });
      await sampleDevices();
      sinon.assert.calledOnce(callback);
      await sampleDevices();
      sinon.assert.calledOnce(callback);
      await sampleDevices();
      sinon.assert.calledOnce(callback);
    });

    describe('when native event is supported', () => {
      const setupForNative = async () => {
        nativeMediaDevices.ondeviceinfochange = null;
        await setup();
      };

      beforeEach(async () => await setupForNative());

      it('should not emit manually', async () => {
        mediaDeviceList.forEach((d, i) => d.label = `label${i}`);
        await sampleDevices();
        sinon.assert.notCalled(callback);
      });

      it('should reemit if addEventListener is not supported', async () => {
        await sampleDevices();
        nativeMediaDevices.ondeviceinfochange({ type: 'deviceinfochange' });
        sinon.assert.calledOnce(callback);
      });

      it('should reemit if addEventListener is supported', async () => {
        nativeMediaDevices.addEventListener = (eventName, dispatchEvent) => {
          nativeMediaDevices[`_emit${eventName}`] = () => dispatchEvent({ type: eventName });
        };
        await setupForNative();
        await sampleDevices();
        nativeMediaDevices._emitdeviceinfochange();
        sinon.assert.calledOnce(callback);
      });
    });
  });
});
