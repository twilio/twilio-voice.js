const assert = require('assert');
const sinon = require('sinon');
const AudioHelper = require('../lib/twilio/audiohelper').default;
const { AudioProcessorEventObserver } = require('../lib/twilio/audioprocessoreventobserver');

function getUserMedia() {
  return Promise.resolve({ id: 'default', getTracks: () => [] });
}

describe('AudioHelper', () => {
  context('when enumerateDevices is not supported', () => {
    const noop = () => {};

    let audio;
    let oldHTMLAudioElement;
    let oldNavigator;

    beforeEach(() => {
      audio = new AudioHelper(noop, noop, {
        getUserMedia,
        mediaDevices: {
          enumerateDevices: function(){
            return Promise.resolve();
          }
        }
      });
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
  });

  context('when enumerateDevices is supported', () => {
    let audio;
    let eventObserver;
    let createProcessedStream;
    let destroyProcessedStream;
    let processedStreamStopStub;
    let processor;
    let onActiveOutputsChanged;
    let onActiveInputChanged;
    const deviceDefault = { deviceId: 'default', kind: 'audiooutput' };
    const deviceFoo = { deviceId: 'foo', kind: 'audiooutput' };
    const deviceBar = { deviceId: 'bar', kind: 'audiooutput' };
    const deviceInput = { deviceId: 'input', kind: 'audioinput' };
    let availableDevices;
    let handlers;
    let mediaDevices;

    beforeEach(() => {
      eventObserver = new AudioProcessorEventObserver();
      processedStreamStopStub = sinon.stub();
      createProcessedStream = sinon.stub().returns(new Promise(res => res({
        id: 'processedstream', getTracks: () => [{ stop: processedStreamStopStub }]
      })));
      destroyProcessedStream = sinon.stub();
      processor = { createProcessedStream, destroyProcessedStream };

      handlers = new Map();
      availableDevices = [ deviceDefault, deviceFoo, deviceBar, deviceInput ];

      mediaDevices = {
        addEventListener: sinon.spy((event, handler) => {
          handlers.set(event, handler);
        }),
        enumerateDevices: sinon.spy(() => Promise.resolve(availableDevices)),
        removeEventListener: sinon.stub(),
      };

      onActiveOutputsChanged = sinon.spy(stream => Promise.resolve());
      onActiveInputChanged = sinon.spy(stream => Promise.resolve());

      audio = new AudioHelper(onActiveOutputsChanged, onActiveInputChanged, {
        audioProcessorEventObserver: eventObserver,
        getUserMedia,
        mediaDevices,
        setSinkId: () => {}
      });
    });

    describe('constructor', () => {
      it('should set .isOutputSelectionSupported to true', () => {
        assert.equal(audio.isOutputSelectionSupported, true);
      });

      it('should use default enumerateDevices', async () => {
        audio = new AudioHelper(onActiveOutputsChanged, onActiveInputChanged, {});
        const result = await audio._enumerateDevices();
        assert.deepStrictEqual(result, []);
      });

      it('should use enumerateDevices override', async () => {
        audio = new AudioHelper(onActiveOutputsChanged, onActiveInputChanged, { enumerateDevices: () => Promise.resolve(['foo']) });
        const result = await audio._enumerateDevices();
        assert.deepStrictEqual(result, ['foo']);
      });

      it('should use getUserMedia override', async () => {
        audio = new AudioHelper(onActiveOutputsChanged, onActiveInputChanged, { getUserMedia: () => Promise.resolve(['bar']) });
        const result = await audio._getUserMedia();
        assert.deepStrictEqual(result, ['bar']);
      });
    });

    describe('._destroy', () => {
      it('should properly dispose the audio instance', () => {
        audio._stopDefaultInputDeviceStream = sinon.stub();
        audio._stopSelectedInputDeviceStream = sinon.stub();
        audio._destroyProcessedStream = sinon.stub();
        audio._maybeStopPollingVolume = sinon.stub();
        audio._destroy();
        assert.strictEqual(audio.eventNames().length, 0);
        sinon.assert.calledOnce(audio._stopDefaultInputDeviceStream);
        sinon.assert.calledOnce(audio._stopSelectedInputDeviceStream);
        sinon.assert.calledOnce(audio._destroyProcessedStream);
        sinon.assert.calledOnce(audio._maybeStopPollingVolume);
        sinon.assert.calledOnce(mediaDevices.removeEventListener);

      });
    });

    describe('._updateUserOptions', () => {
      it('should update enumerateDevices', async () => {
        audio._updateUserOptions({ enumerateDevices: () => Promise.resolve(['foo']) });
        const result = await audio._enumerateDevices();
        assert.deepStrictEqual(result, ['foo']);
      });

      it('should update getUserMedia', async () => {
        audio._updateUserOptions({ getUserMedia: () => Promise.resolve(['bar']) });
        const result = await audio._getUserMedia();
        assert.deepStrictEqual(result, ['bar']);
      });
    });

    describe('adding and removing audio processors', () => {
      let getUserMedia;
      let stopStub;

      beforeEach(() => {
        stopStub = sinon.stub();
        getUserMedia = sinon.stub().returns(new Promise(res => res({id: 'default',getTracks: () => [{stop: stopStub}]})));
        audio = new AudioHelper(onActiveOutputsChanged, onActiveInputChanged, {
          audioProcessorEventObserver: eventObserver,
          getUserMedia,
          mediaDevices,
          setSinkId: () => {}
        });
      });

      describe('.addProcessor', () => {
        [
          undefined,
          null,
          true,
          false,
          '',
          1,
          0,
          {},
          { createProcessedStream: () => {} },
          { destroyProcessedStream: () => {} },
        ].forEach(param => {
          it(`should reject if parameter is ${param}`, () => {
            assert.rejects(async () => await audio.addProcessor(param));
          });
        });

        it('should add one processor', async () => {
          await audio.addProcessor(processor);
        });

        it('should not allow adding more than one processor', async () => {
          await audio.addProcessor(processor);
          assert.rejects(async () => await audio.addProcessor(processor));
        });

        it('should emit add insights event', async () => {
          const stub = sinon.stub();
          eventObserver.on('event', stub);
          await audio.addProcessor(processor);
          sinon.assert.calledWithExactly(stub, { group: 'audio-processor', name: 'add' });
        });

        it('should not restart any device streams if none exists', async () => {
          await audio.addProcessor(processor);
          sinon.assert.notCalled(getUserMedia);
        });

        it('should restart default device if default stream exists', async () => {
          await audio._openDefaultDeviceWithConstraints();
          sinon.assert.calledOnce(getUserMedia);
          await audio.addProcessor(processor);
          sinon.assert.calledTwice(getUserMedia);
          assert.equal(audio._getUserMedia.args[1][0].audio.deviceId.exact, 'input');
          sinon.assert.calledOnce(createProcessedStream);
        });

        it('should restart default device if a selected stream exists', async () => {
          await audio.setInputDevice('input');
          sinon.assert.calledOnce(getUserMedia);
          await audio.addProcessor(processor);
          sinon.assert.calledTwice(getUserMedia);
          assert.equal(audio._getUserMedia.args[1][0].audio.deviceId.exact, 'input');
          sinon.assert.calledOnce(createProcessedStream);
        });
      });

      describe('.removeProcessor', () => {
        beforeEach(async () => {
          await audio.addProcessor(processor);
        });

        [
          undefined,
          null,
          true,
          false,
          '',
          1,
          0,
          {},
        ].forEach(param => {
          it(`should reject if parameter is ${param}`, () => {
            assert.rejects(async () => await audio.removeProcessor(param));
          });
        });

        it('should emit remove insights event', async () => {
          const stub = sinon.stub();
          eventObserver.on('event', stub);
          await audio.removeProcessor(processor);
          sinon.assert.calledWithExactly(stub, { group: 'audio-processor', name: 'remove' });
        });

        it('should be able to add a new processor after removing the old one', async () => {
          await audio.removeProcessor(processor);
          await audio.addProcessor(processor);
        });

        it('should not restart any device streams if none exists', async () => {
          await audio.removeProcessor(processor);
          sinon.assert.notCalled(getUserMedia);
        });

        it('should restart default device if default stream exists', async () => {
          await audio._openDefaultDeviceWithConstraints();
          sinon.assert.calledOnce(getUserMedia);
          await audio.removeProcessor(processor);
          sinon.assert.calledTwice(getUserMedia);
          assert.equal(audio._getUserMedia.args[1][0].audio.deviceId.exact, 'input');
          sinon.assert.calledOnce(createProcessedStream);
        });

        it('should restart default device if a selected stream exists', async () => {
          await audio.setInputDevice('input');
          sinon.assert.calledOnce(getUserMedia);
          await audio.removeProcessor(processor);
          sinon.assert.calledTwice(getUserMedia);
          assert.equal(audio._getUserMedia.args[1][0].audio.deviceId.exact, 'input');
          sinon.assert.calledOnce(createProcessedStream);
        });

        it('should destroy and stop processed tracks', async () => {
          await audio._openDefaultDeviceWithConstraints();
          await audio.removeProcessor(processor);
          sinon.assert.calledOnce(processedStreamStopStub);
          sinon.assert.calledOnce(destroyProcessedStream);
        });

        it('should be noop when stopping and processed track does not exists', async () => {
          await audio.removeProcessor(processor);
          sinon.assert.notCalled(processedStreamStopStub);
          sinon.assert.notCalled(destroyProcessedStream);
        });
      });
    });

    describe('default device', () => {
      let enumerateDevices;
      let getUserMedia;
      let stopStub;

      beforeEach(() => {
        stopStub = sinon.stub();
        enumerateDevices = sinon.stub().returns(new Promise(res => res([])));
        getUserMedia = sinon.stub().returns(new Promise(res => res({id: 'default', getTracks: () => [{stop: stopStub}]})));
        audio = new AudioHelper(onActiveOutputsChanged, onActiveInputChanged, {
          audioProcessorEventObserver: eventObserver,
          enumerateDevices,
          getUserMedia,
          mediaDevices,
          setSinkId: () => {}
        });
      });

      it('should use constraints parameter', async () => {
        await audio._openDefaultDeviceWithConstraints({ audio: 'foo' });
        sinon.assert.calledWithExactly(getUserMedia, { audio: 'foo' });
      });

      it('should update device list', async () => {
        await audio._openDefaultDeviceWithConstraints();
        sinon.assert.called(getUserMedia);
        sinon.assert.called(enumerateDevices);
        sinon.assert.callOrder(getUserMedia, enumerateDevices);
      });

      it('should not create a processed stream if a audio processor does not exists', async () => {
        sinon.assert.notCalled(createProcessedStream);
        await audio._openDefaultDeviceWithConstraints();
        sinon.assert.notCalled(createProcessedStream);
      });

      it('should create a processed stream if a audio processor exists', async () => {
        await audio.addProcessor(processor);
        sinon.assert.notCalled(createProcessedStream);
        await audio._openDefaultDeviceWithConstraints();
        sinon.assert.calledOnce(createProcessedStream);
      });

      it('should emit create insights event', async () => {
        const stub = sinon.stub();
        eventObserver.on('event', stub);
        await audio.addProcessor(processor);
        await audio._openDefaultDeviceWithConstraints();
        sinon.assert.calledWithExactly(stub, { group: 'audio-processor', name: 'create-processed-stream' });
      });

      it('should stop default tracks', async () => {
        await audio._openDefaultDeviceWithConstraints();
        sinon.assert.notCalled(stopStub);
        audio._stopDefaultInputDeviceStream();
        sinon.assert.calledOnce(stopStub);
      });

      it('should be noop when stopping and default track does not exists', async () => {
        audio._stopDefaultInputDeviceStream();
        sinon.assert.notCalled(stopStub);
      });

      it('should destroy stop processed tracks', async () => {
        await audio.addProcessor(processor);
        await audio._openDefaultDeviceWithConstraints();
        audio._stopDefaultInputDeviceStream();
        sinon.assert.calledOnce(processedStreamStopStub);
        sinon.assert.calledOnce(destroyProcessedStream);
      });

      it('should emit destroy insights event', async () => {
        const stub = sinon.stub();
        eventObserver.on('event', stub);
        await audio.addProcessor(processor);
        await audio._openDefaultDeviceWithConstraints();
        audio._stopDefaultInputDeviceStream();
        sinon.assert.calledWithExactly(stub, { group: 'audio-processor', name: 'destroy-processed-stream' });
      });

      it('should be noop when stopping and processed track does not exists', async () => {
        await audio._openDefaultDeviceWithConstraints();
        audio._stopDefaultInputDeviceStream();
        sinon.assert.notCalled(processedStreamStopStub);
        sinon.assert.notCalled(destroyProcessedStream);
      });
    });

    describe('device labels', () => {
      const deviceLabeled = { deviceId: '123', kind: 'audiooutput', label: 'foo' };
      const deviceUnlabeled = { deviceId: '456', kind: 'audiooutput' };
      let getUserMedia;
      let fakeStream;
      let stopStub;

      beforeEach(done => {
        let isDone = false;
        stopStub = sinon.stub();
        fakeStream = {id: 'fakestream', getTracks: () => [{stop: stopStub}]};
        getUserMedia = sinon.stub().returns(new Promise(res => res(fakeStream)));

        onActiveOutputsChanged = sinon.spy(() => {
          if (!isDone) {
            isDone = true;
            done();
          }
        });

        onActiveInputChanged = sinon.spy(stream => Promise.resolve());

        audio = new AudioHelper(onActiveOutputsChanged, onActiveInputChanged, {
          audioProcessorEventObserver: eventObserver,
          getUserMedia,
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
          audio._selectedInputDeviceStream = true;
          audio._inputDevice = deviceInput;
          return audio.setInputDevice('input');
        });

        it('should call _getUserMedia if ID passed is already active but forceGetUserMedia is true', () => {
          audio._selectedInputDeviceStream = { getTracks() { return []; } };
          audio._inputDevice = deviceInput;
          return audio._setInputDevice('input', true).then(() => {
            sinon.assert.calledOnce(audio._getUserMedia);
          });
        });

        describe('inputDevicePromise', () => {
          [0, null, undefined, {}, false, true, 'non-existent'].forEach((id) => {
            it(`should reject if id is ${id} and set the internal promise to null`, async () => {
              audio.setInputDevice(id);
              const promise = audio._getInputDevicePromise();
              assert(!!promise);
              const stub = sinon.stub();
              try {
                await promise;
              } catch {
                stub();
              }
              sinon.assert.calledOnce(stub);
              assert.strictEqual(audio._getInputDevicePromise(), null);
            });
          });

          it('should resolve and set the internal promise to null', async () => {
            audio.setInputDevice('input');
            const promise = audio._getInputDevicePromise();
            assert(!!promise);
            await promise;
            assert.strictEqual(audio._getInputDevicePromise(), null);
          });

          it('should resolve and set the internal promise to null when called multiple times with the same id', async () => {
            for(let i = 0; i < 5; i++) {
              audio.setInputDevice('input');
              const promise = audio._getInputDevicePromise();
              assert(!!promise);
              await promise;
              assert.strictEqual(audio._getInputDevicePromise(), null);
            }
          });
        });

        context('when the ID passed is new and valid', () => {
          it('should return a resolved Promise', () => audio.setInputDevice('input'));

          it('should call getUserMedia with the passed ID', () => {
            audio.setInputDevice('input');
            assert.equal(audio._getUserMedia.args[0][0].audio.deviceId.exact, 'input');
          });

          it('should call _onActiveInputChanged with stream from getUserMedia', () => audio.setInputDevice('input').then(() => {
            sinon.assert.calledWith(onActiveInputChanged, fakeStream);
          }));

          it('should update _selectedInputDeviceStream with stream from getUserMedia', () => audio.setInputDevice('input').then(() => {
            assert.equal(audio._selectedInputDeviceStream.id, 'fakestream');
          }));

          it('should create a processed stream if an audio processor exists', async () => {
            await audio.addProcessor(processor);
            await audio.setInputDevice('input');
            sinon.assert.calledOnce(createProcessedStream);
          });

          it('should emit create insights event', async () => {
            const stub = sinon.stub();
            eventObserver.on('event', stub);
            await audio.addProcessor(processor);
            await audio.setInputDevice('input');
            sinon.assert.calledWithExactly(stub, { group: 'audio-processor', name: 'create-processed-stream' });
          });

          it('should stop default tracks if it exists', async () => {
            await audio._openDefaultDeviceWithConstraints();
            await audio.setInputDevice('input');
            sinon.assert.calledOnce(stopStub);
          });

          it('should destroy stop processed tracks if it exists', async () => {
            await audio.addProcessor(processor);
            await audio._openDefaultDeviceWithConstraints();
            await audio.setInputDevice('input');
            sinon.assert.calledOnce(processedStreamStopStub);
            sinon.assert.calledOnce(destroyProcessedStream);
          });

          it('should emit destroy insights event', async () => {
            const stub = sinon.stub();
            eventObserver.on('event', stub);
            await audio.addProcessor(processor);
            await audio._openDefaultDeviceWithConstraints();
            await audio.setInputDevice('input');
            sinon.assert.calledWithExactly(stub, { group: 'audio-processor', name: 'destroy-processed-stream' });
          });
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
          beforeEach(async () => {
            spy = sinon.spy();

            const fakeStream = {
              spy,
              getTracks() { return [
                { stop: spy },
                { stop: spy },
              ]; }
            };

            await audio.addProcessor(processor);
            return audio.setInputDevice('input').then(() => {
              audio._selectedInputDeviceStream = fakeStream;
              return audio.unsetInputDevice();
            });
          });

          it('should call _onActiveInputChanged with null', () => {
            assert(onActiveInputChanged.calledWith(null));
          });

          it('should set _inputDevice to null', () => {
            assert.equal(audio._inputDevice, null);
          });

          it('should set _selectedInputDeviceStream to null', () => {
            assert.equal(audio._selectedInputDeviceStream, null);
          });

          it('should stop all tracks if _selectedInputDeviceStream was set', () => {
            assert(spy.calledTwice);
          });

          it('should stop processed tracks', async () => {
            sinon.assert.calledOnce(processedStreamStopStub);
            sinon.assert.calledOnce(destroyProcessedStream);
          });
        });
      });
    });

    describe('.inputStream', () => {
      it('should return the selected input stream', async () => {
        await audio.setInputDevice('input');
        assert.strictEqual(audio.inputStream.id, 'default');
      });

      it('should return the processed stream', async () => {
        await audio.addProcessor(processor);
        await audio.setInputDevice('input');
        assert.strictEqual(audio.inputStream.id, 'processedstream');
      });
    });

    describe('.processedStream', () => {
      it('should return the processed stream', async () => {
        await audio.addProcessor(processor);
        await audio.setInputDevice('input');
        assert.strictEqual(audio.processedStream.id, 'processedstream');
      });

      it('should return null', async () => {
        await audio.setInputDevice('input');
        assert.strictEqual(audio.processedStream, null);
      });
    });

    ['disconnect', 'incoming', 'outgoing'].forEach(soundName => {
      describe(`.${soundName}`, () => {
        let testFn;

        beforeEach(() => {
          testFn = audio[soundName].bind(audio);
        });

        it('should return true as default', () => {
          assert.strictEqual(testFn(), true);
        });

        it('should return false after setting to false', () => {
          assert.strictEqual(testFn(false), false);
          assert.strictEqual(testFn(), false);
        });

        it('should return true after setting to true', () => {
          assert.strictEqual(testFn(false), false);
          assert.strictEqual(testFn(), false);
          assert.strictEqual(testFn(true), true);
          assert.strictEqual(testFn(), true);
        });
      });
    });

    describe('.setAudioConstraints', () => {
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

    describe('.unsetAudioConstraints', () => {
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

        audio = new AudioHelper(onActiveOutputsChanged, null, {
          getUserMedia,
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

        describe('and the active device is the default device', () => {
          let clock;

          beforeEach(() => {
            clock = sinon.useFakeTimers();
            audio.availableInputDevices.set('default', {});
            audio._setInputDevice = sinon.stub();
            availableDevices[2].label = 'abc';
          });

          afterEach(() => {
            clock.restore();
            audio.availableInputDevices.delete('default');
          });

          context('and the input device was selected manually', () => {
            it('should update the active device to the new default device in a setTimeout', (done) => {
              audio.on('deviceChange', () => {
                sinon.assert.notCalled(audio._setInputDevice);
                clock.tick(1);
                sinon.assert.calledWithExactly(audio._setInputDevice, 'default', true);
                done();
              });
              audio._inputDevice = { deviceId: 'default' };
              handlers.get('devicechange')();
            });
          });

          context('and the input device was not selected manually (uses default)', () => {
            it('should update the active device to the new default device in a setTimeout', (done) => {
              audio.on('deviceChange', () => {
                sinon.assert.notCalled(audio._setInputDevice);
                clock.tick(1);
                sinon.assert.calledWithExactly(audio._setInputDevice, 'default', true);
                done();
              });
              audio._defaultInputDeviceStream = { id: 'foo' };
              handlers.get('devicechange')();
            });
          });
        });
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
  });
});
