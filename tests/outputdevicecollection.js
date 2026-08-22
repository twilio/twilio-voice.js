const assert = require('assert');
const sinon = require('sinon');
const OutputDeviceCollection = require('../lib/twilio/outputdevicecollection').default;

describe('OutputDeviceCollection', () => {
  let collection;

  context('when not supported', () => {
    beforeEach(() => {
      collection = new OutputDeviceCollection('foo', new Map(), () => { }, false);
    });

    describe('constructor', () => {
      it('should set ._isSupported to false', () => {
        assert.equal(collection._isSupported, false);
      });
    });

    describe('.get', () => {
      it('should return _activeDevices', () => {
        assert.equal(collection.get(), collection._activeDevices);
      });
    });

    describe('.set', () => {
      it('should return a rejected Promise', () => collection.set('foo').then(() => {
        throw new Error('Promise was unexpectedly fulfilled');
      }, () => { }));
    });

    describe('.test', () => {
      it('should return a rejected Promise', () => collection.test().then(() => {
        throw new Error('Promise was unexpectedly fulfilled');
      }, () => { }));
    });

    describe('.delete', () => {
      it('should remove the device without calling _beforeChange', () => {
        const onChange = sinon.spy(() => Promise.reject(new Error('should not be called')));
        collection = new OutputDeviceCollection('foo', new Map(), onChange, false);
        const fakeDevice = { deviceId: 'lost' };
        collection._activeDevices.add(fakeDevice);

        const wasDeleted = collection.delete(fakeDevice);

        assert.equal(wasDeleted, true);
        assert.equal(collection.get().size, 0);
        assert.equal(onChange.callCount, 0);
      });
    });
  });

  context('when supported', () => {
    let availableDevices;
    const deviceDefault = { deviceId: 'default', kind: 'audiooutput' };
    const deviceFoo = { deviceId: 'foo', kind: 'audiooutput' };
    const deviceBar = { deviceId: 'bar', kind: 'audiooutput' };
    let onChange;

    beforeEach(() => {
      availableDevices = new Map([
        ['default', deviceDefault], 
        ['foo', deviceFoo], 
        ['bar', deviceBar]
      ]);

      onChange = sinon.spy();
      collection = new OutputDeviceCollection('foo', availableDevices, onChange, true);
    });

    describe('constructor', () => {
      it('should set ._isSupported to true', () => {
        assert.equal(collection._isSupported, true);
      });
    });

    describe('.get', () => {
      it('should return _activeDevices', () => {
        assert.equal(collection.get(), collection._activeDevices);
      });
    });

    describe('.set', () => {
      context('when all IDs are valid', () => {
        it('should update ._activeDevices', () => collection.set(['foo', 'bar']).then(() => {
          assert.deepEqual(Array.from(collection._activeDevices), [deviceFoo, deviceBar]);
        }));

        it('should call onChange with the collection name and passed deviceIds', () => collection.set(['foo', 'bar']).then(() => {
          assert.equal(onChange.args[0][0], 'foo');
          assert.deepEqual(onChange.args[0][1], ['foo', 'bar']);
        }));
      });

      context('when some IDs are invalid', () => {
        it('should return a rejected Promise', () => collection.set(['foo', 'nonexistant']).then(() => {
          throw new Error('Promise was unexpectedly fulfilled');
        }, () => { }));

        it('should not update ._activeDevices', () => collection.set(['foo', 'nonexistant']).catch(() => {
          assert.deepEqual(Array.from(collection._activeDevices), []);
        }));
      });

      context('when no IDs are passed', () => {
        it('should return a rejected Promise', () => collection.set().then(() => {
          throw new Error('Promise was unexpectedly fulfilled');
        }, () => { }));

        it('should not update ._activeDevices', () => collection.set().catch(() => {
          assert.deepEqual(Array.from(collection._activeDevices), []);
        }));
      });
    });

    describe('#test', () => {
      const oldAudio = global.Audio;

      let playSpy;
      let setSinkIdSpy;
      beforeEach(() => {
        playSpy = sinon.spy(() => Promise.resolve());
        setSinkIdSpy = sinon.spy(() => Promise.resolve());

        global.Audio = function() {
          this.setSinkId = setSinkIdSpy;
          this.play = playSpy;
          setTimeout(() => {
            if (typeof this.oncanplay === 'function') {
              this.oncanplay();
            }
          });
        };
      });

      after(() => {
        global.Audio = oldAudio;
      });

      it('should call Audio.setSinkId for each device with its deviceId', () => collection.set(['foo', 'bar'])
        .then(collection.test.bind(collection))
        .then(() => {
          assert.equal(setSinkIdSpy.args[0], 'foo');
          assert.equal(setSinkIdSpy.args[1], 'bar');
        }));

      it('should call Audio.play for each device', () => collection.set(['foo', 'bar'])
        .then(collection.test.bind(collection))
        .then(() => {
          assert.equal(setSinkIdSpy.callCount, 2);
        }));
    });

    describe('#delete', () => {
      it('should trigger _beforeChange with default when last active device is removed', () => {
        const fakeDevice = { deviceId: 'foo' };
        collection._activeDevices.add(fakeDevice);
        collection.delete(fakeDevice);
        assert.equal(onChange.args[0][1], 'default');
      });

      it('should trigger _beforeChange with remaining devices if last device is not removed', () => {
        const fakeDevices = [
          { deviceId: 'foo' },
          { deviceId: 'bar' },
          { deviceId: 'baz' }
        ];
        fakeDevices.forEach(collection._activeDevices.add, collection._activeDevices);
        collection.delete(fakeDevices[0]);
        assert.equal(onChange.args[0][1][0], 'bar');
        assert.equal(onChange.args[0][1][1], 'baz');
      });

      context('when there is no default device', () => {
        it('should return an empty Set after deleting the last device', () => {
          collection = new OutputDeviceCollection('foo', new Map(), onChange, true);
          const fakeDevice = { deviceId: 'foo' };
          collection._activeDevices.add(fakeDevice);
          collection.delete(fakeDevice);
          assert.equal(collection.get().size, 0);
        });

        it('should return the first item of the Set after deleting the last device', () => {
          const fakeDevice1 = { deviceId: 'foo' };
          const fakeDevice2 = { deviceId: 'bar' };
          const availableDevices = new Map();
          availableDevices.set('bar', fakeDevice2);
          collection = new OutputDeviceCollection('foo', availableDevices, onChange, true);
          collection._activeDevices.add(fakeDevice1);
          collection.delete(fakeDevice1);
          assert.equal(collection.get().size, 1);
          assert(collection.get().has(fakeDevice2));
        });
      });
    });
  });
});
