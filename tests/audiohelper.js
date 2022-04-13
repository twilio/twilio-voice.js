const assert = require('assert');
const sinon = require('sinon');
const AudioHelper = require('../lib/twilio/audiohelper').default;

function getUserMedia() {
  return Promise.resolve();
}

describe('AudioHelper', () => {
  context('when enumerateDevices is not supported', () => {
    const noop = () => {};

    let audio;
    let oldHTMLAudioElement;
    let oldNavigator;

    beforeEach(() => {
      audio = new AudioHelper(noop, noop, getUserMedia, { mediaDevices: {} });
    });

    before(() => {
      oldHTMLAudioElement = typeof HTMLAudioElement !== 'undefined'
        ? HTMLAudioElement
        : undefined;
      oldNavigator = typeof navigator !== 'undefined'
        ? navigator
        : undefined;
      HTMLAudioElement = undefined;
      navigator = { };
    });

    after(() => {
      HTMLAudioElement = oldHTMLAudioElement;
      navigator = oldNavigator;
    });

    describe('constructor', () => {
      it('should set .isOutputSelectionSupported to false', () => {
        assert.equal(audio.isOutputSelectionSupported, false);
      });
      it('should set availableDevices to an empty Map', () => {
        assert.equal(audio.availableOutputDevices.size, 0);
      });
    });

    // NOTE(mroberts): The following three tests may not hold. console.warn
    // may not be called a second time if AudioContext is available. I think
    // the tests should actually read something like,
    //
    //   when enumerateDevices and output selection are supported, but not
    //   volume indication, ...
    //
    describe.skip('when adding listeners', () => {
      let sandbox;
      before(() => {
        sandbox = sinon.sandbox.create();
      });

      beforeEach(() => {
        sandbox.stub(console, 'warn');
      });

      afterEach(() => {
        sandbox.restore();
      });


      it('#on should log a console warning when invoked', () => {
        audio.on('foo', () => { });
        console.log(console.warn);
        assert(console.warn.calledTwice);
      });

      it('#once should log a console warning when invoked', () => {
        audio.once('foo', () => { });
        assert(console.warn.calledTwice);
      });

      it('#addListener should log a console warning when invoked', () => {
        audio.addListener('foo', () => { });
        assert(console.warn.calledTwice);
      });
    });
  });

  context('when enumerateDevices is supported', () => {
    let audio;
    let onActiveOutputsChanged = () => {};
    let onActiveInputChanged = () => {};
    const deviceDefault = { deviceId: 'default', kind: 'audiooutput' };
    const deviceFoo = { deviceId: 'foo', kind: 'audiooutput' };
    const deviceBar = { deviceId: 'bar', kind: 'audiooutput' };
    const deviceInput = { deviceId: 'input', kind: 'audioinput' };
    let availableDevices;
    let handlers;
    let mediaDevices;

    beforeEach(() => {
      handlers = new Map();
      availableDevices = [ deviceDefault, deviceFoo, deviceBar, deviceInput ];

      mediaDevices = {
        addEventListener: sinon.spy((event, handler) => {
          handlers.set(event, handler);
        }),
        enumerateDevices: sinon.spy(() => Promise.resolve(availableDevices))
      };

      audio = new AudioHelper(onActiveOutputsChanged, onActiveInputChanged, getUserMedia, {
        mediaDevices,
        setSinkId: () => {}
      });
    });

    describe('constructor', () => {
      it('should set .isOutputSelectionSupported to true', () => {
        assert.equal(audio.isOutputSelectionSupported, true);
      });
    });

    // NOTE(mroberts): The following three tests may not hold. console.warn
    // could be called if AudioContext is unavailable. I think the tests
    // should actually read something like,
    //
    //   when enumerateDevices is supported, as well as output selection and
    //   volume indication, ...
    //
    describe.skip('when adding listeners', () => {
      let sandbox;
      before(() => {
        sandbox = sinon.sandbox.create();
      });

      beforeEach(() => {
        sandbox.stub(console, 'warn');
      });

      afterEach(() => {
        sandbox.restore();
      });

      it.skip('#on should not log a console warning when invoked', () => {
        audio.on('foo', () => { });
        assert.equal(console.warn.callCount, 0);
      });

      it.skip('#once should not log a console warning when invoked', () => {
        audio.once('foo', () => { });
        assert.equal(console.warn.callCount, 0);
      });

      it.skip('#addListener should not log a console warning when invoked', () => {
        audio.addListener('foo', () => { });
        assert.equal(console.warn.callCount, 0);
      });
    });

    describe('device labels', () => {
      const deviceLabeled = { deviceId: '123', kind: 'audiooutput', label: 'foo' };
      const deviceUnlabeled = { deviceId: '456', kind: 'audiooutput' };
      let gUM;

      beforeEach(done => {
        let isDone = false;
        gUM = sinon.spy(() => Promise.resolve('fakestream'));

        onActiveOutputsChanged = sinon.spy(() => {
          if (!isDone) {
            isDone = true;
            done();
          }
        });

        onActiveInputChanged = sinon.spy(stream => Promise.resolve());

        audio = new AudioHelper(onActiveOutputsChanged, onActiveInputChanged, gUM, {
          mediaDevices,
          setSinkId: () => {}
        });
      });

      context('when a new audiooutput device with a label is available', () => {
        it('should should contain its own label', () => new Promise((resolve, reject) => {
          audio.on('deviceChange', lostActiveDevices => {
            resolve(lostActiveDevices);
          });

          availableDevices.push(deviceLabeled);
          handlers.get('devicechange')();
        }).then(() => {
          const device = audio.availableOutputDevices.get('123');
          assert.equal(device.label, 'foo');
          assert.equal(device.deviceId, '123');
          assert.equal(device.kind, 'audiooutput');
        }));
      });

      context('when a new audiooutput device without a label is available', () => {
        it('should should contain a non-empty label', () => new Promise(resolve => {
          audio.on('deviceChange', () => {
            resolve();
          });

          availableDevices.push(deviceUnlabeled);
          handlers.get('devicechange')();
        }).then(() => {
          const device = audio.availableOutputDevices.get('456');
          assert(device.label.length > 0);
          assert.equal(device.deviceId, '456');
          assert.equal(device.kind, 'audiooutput');
        }));
      });

      describe('setInputDevice', () => {
        it('should return a rejected Promise if no deviceId is passed', () => audio.setInputDevice().then(() => {
          throw new Error('Expected a rejection, got resolved');
        }, () => { }));

        it('should return a rejected Promise if an unfound deviceId is passed', () => audio.setInputDevice('nonexistant').then(() => {
          throw new Error('Expected a rejection, got resolved');
        }, () => { }));

        it('should return a resolved Promise if the ID passed is already active', () => {
          audio._inputStream = true;
          audio._inputDevice = deviceInput;
          return audio.setInputDevice('input');
        });

        it('should call _getUserMedia if ID passed is already active but forceGetUserMedia is true', () => {
          audio._inputStream = { getTracks() { return []; } };
          audio._inputDevice = deviceInput;
          return audio._setInputDevice('input', true).then(() => {
            sinon.assert.calledOnce(audio._getUserMedia);
          });
        });

        context('when the ID passed is new and valid', () => {
          it('should return a resolved Promise', () => audio.setInputDevice('input'));

          it('should call getUserMedia with the passed ID', () => {
            audio.setInputDevice('input');
            assert.equal(audio._getUserMedia.args[0][0].audio.deviceId.exact, 'input');
          });

          it('should call _onActiveInputChanged with stream from getUserMedia', () => audio.setInputDevice('input').then(() => {
            assert(onActiveInputChanged.calledWith('fakestream'));
          }));

          it('should update _inputStream with stream from getUserMedia', () => audio.setInputDevice('input').then(() => {
            assert.equal(audio._inputStream, 'fakestream');
          }));
        });
      });

      describe('unsetInputDevice', () => {
        context('when no input device is set', () => {
          it('should resolve immediately', () => audio.unsetInputDevice().then(() => {
            assert.equal(onActiveInputChanged.callCount, 0);
          }));
        });

        context('when an input device is set', () => {
          let spy;
          beforeEach(() => {
            spy = sinon.spy();

            const fakeStream = {
              spy,
              getTracks() { return [
                { stop: spy },
                { stop: spy },
              ]; }
            };

            return audio.setInputDevice('input').then(() => {
              audio._inputStream = fakeStream;
              return audio.unsetInputDevice();
            });
          });

          it('should call _onActiveInputChanged with null', () => {
            assert(onActiveInputChanged.calledWith(null));
          });

          it('should set _inputDevice to null', () => {
            assert.equal(audio._inputDevice, null);
          });

          it('should set _inputStream to null', () => {
            assert.equal(audio._inputStream, null);
          });

          it('should stop all tracks if _inputStream was set', () => {
            assert(spy.calledTwice);
          });
        });
      });
    });

    describe('setAudioConstraints', () => {
      context('when no input device is active', () => {
        it('should set .audioConstraints', () => {
          audio.setAudioConstraints({ foo: 'bar' });
          assert.deepEqual(audio.audioConstraints, { foo: 'bar' });
        });

        it('should return a resolved promise', () => {
          return audio.setAudioConstraints({ foo: 'bar' });
        });
      });

      context('when an input device is active', () => {
        beforeEach(() => {
          return audio.setInputDevice('input');
        });

        it('should set .audioConstraints', () => {
          audio.setAudioConstraints({ foo: 'bar' });
          assert.deepEqual(audio.audioConstraints, { foo: 'bar' });
        });

        it('should return the result of _setInputDevice', () => {
          audio._setInputDevice = sinon.spy(() => Promise.resolve('success'));
          return audio.setAudioConstraints({ foo: 'bar' }).then(res => {
            assert.equal(res, 'success');
          });
        });
      });
    });

    describe('unsetAudioConstraints', () => {
      beforeEach(() => {
        audio.setAudioConstraints({ foo: 'bar' });
      });

      context('when no input device is active', () => {
        it('should set .audioConstraints to null', () => {
          audio.unsetAudioConstraints();
          assert.equal(audio.audioConstraints, null);
        });

        it('should return a resolved promise', () => {
          return audio.unsetAudioConstraints();
        });
      });

      context('when an input device is active', () => {
        beforeEach(() => {
          return audio.setInputDevice('input');
        });

        it('should set .audioConstraints to null', () => {
          audio.unsetAudioConstraints();
          assert.equal(audio.audioConstraints, null);
        });

        it('should return the result of _setInputDevice', () => {
          audio._setInputDevice = sinon.spy(() => Promise.resolve('success'));
          return audio.unsetAudioConstraints().then(res => {
            assert.equal(res, 'success');
          });
        });
      });
    });

    describe('event:deviceChange', () => {
      const deviceBaz = { deviceId: 'baz', kind: 'audiooutput' };
      const deviceQux = { deviceId: 'qux', kind: 'audioinput' };
      const deviceQuux = { deviceId: 'quux', kind: 'whoknows' };

      beforeEach(done => {
        let isDone = false;

        onActiveOutputsChanged = sinon.spy(() => {
          if (!isDone) {
            isDone = true;
            done();
          }
        });

        audio = new AudioHelper(onActiveOutputsChanged, null, getUserMedia, {
          mediaDevices,
          setSinkId: () => {}
        });
      });

      context('when a new audiooutput device is available', () => {
        it('should be fired with an empty array', () => new Promise((resolve, reject) => {
          audio.on('deviceChange', lostActiveDevices => {
            resolve(lostActiveDevices);
          });

          availableDevices.push(deviceBaz);
          handlers.get('devicechange')();
        }).then(lostActiveDevices => {
          assert.deepEqual(lostActiveDevices, []);
        }));
      });

      context('when a new audioinput device is available', () => {
        it('should be fired with an empty array', () => new Promise((resolve, reject) => {
          audio.on('deviceChange', lostActiveDevices => {
            resolve(lostActiveDevices);
          });

          availableDevices.push(deviceQux);
          handlers.get('devicechange')();
        }).then(lostActiveDevices => {
          assert.deepEqual(lostActiveDevices, []);
        }));
      });

      context('when a new device of a different kind is available', () => {
        it('should not be fired', () => new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            resolve();
          }, 10);

          audio.on('deviceChange', foundDevice => {
            clearTimeout(timeout);
            reject(new Error('Event was fired unexpectedly'));
          });

          availableDevices.push(deviceQuux);
          handlers.get('devicechange')();
        }));
      });

      context('when an existing audiooutput device changes labels', () => {
        it('should be fired with an empty array', () => new Promise((resolve, reject) => {
          audio.on('deviceChange', lostActiveDevices => {
            resolve(lostActiveDevices);
          });

          availableDevices[1].label = 'abc';
          handlers.get('devicechange')();
        }).then(lostActiveDevices => {
          assert.deepEqual(lostActiveDevices, []);
        }));
      });

      context('when an existing audioinput device changes labels', () => {
        it('should be fired with an empty array', () => new Promise((resolve, reject) => {
          audio.on('deviceChange', lostActiveDevices => {
            resolve(lostActiveDevices);
          });

          availableDevices[2].label = 'abc';
          handlers.get('devicechange')();
        }).then(lostActiveDevices => {
          assert.deepEqual(lostActiveDevices, []);
        }));
      });

      context('when an existing active device is lost', () => {
        it('should be fired with the lost deviceInfo', () => audio.speakerDevices.set(['foo', 'bar']).then(() => new Promise((resolve, reject) => {
          audio.on('deviceChange', lostActiveDevices => {
            resolve(lostActiveDevices);
          });

          availableDevices.splice(1, 1);
          handlers.get('devicechange')();
        }).then(result => {
          assert.equal(result.length, 1);
          assert.equal(result[0].deviceId, deviceFoo.deviceId);
        })));
      });

      context('when an existing non-active device is lost', () => {
        it('should be fired with the lost deviceInfo and false', () => audio.speakerDevices.set(['bar']).then(() => new Promise((resolve, reject) => {
          audio.on('deviceChange', lostActiveDevices => {
            resolve(lostActiveDevices);
          });

          availableDevices.splice(1, 1);
          handlers.get('devicechange')();
        }).then(result => {
          assert.deepEqual(result, []);
        })));
      });
    });

    describe('mediaDevices:deviceinfochange', () => {
      let audio;
      const wait = () => new Promise(r => setTimeout(r, 0));
      const noop = () => {};

      beforeEach(() => {
        audio = new AudioHelper(noop, noop, getUserMedia, {
          mediaDevices,
          setSinkId: () => {}
        });
        audio.speakerDevices = {};
        audio.ringtoneDevices = {
          get: () => ({ size: 1 }),
          set: sinon.stub(),
        };
        audio.speakerDevices = {
          get: () => ({ size: 0 }),
          set: sinon.stub().rejects('foobar'),
        };
        audio._log.warn = sinon.stub();
        audio.isOutputSelectionSupported = true;
      });

      it('should set output devices', () => {
        handlers.get('deviceinfochange')();
        wait().then(() => sinon.assert.called(audio.speakerDevices.set));
      });

      it('should catch error when setting output devices', () => {
        handlers.get('deviceinfochange')();
        wait().then(() => sinon.assert.called(audio._log.warn));
      });

      it('should not set device when isSupported is false', () => {
        audio.isOutputSelectionSupported = false;
        handlers.get('deviceinfochange')();
        wait().then(() => sinon.assert.notCalled(audio.speakerDevices.set));
      });
    });
  });
});
