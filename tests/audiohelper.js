const assert = require('assert');
const sinon = require('sinon');
const EventTarget = require('./eventtarget');
const AudioHelper = require('../lib/twilio/audiohelper').default;
const { AudioProcessorEventObserver } = require('../lib/twilio/audioprocessoreventobserver');

function getUserMedia() {
  return Promise.resolve({ id: 'default', getTracks: () => [] });
}

describe('AudioHelper', () => {
  const wait = () => new Promise(res => res());

  context('when enumerateDevices is not supported', () => {
    const noop = () => {};

    let audio;
    let oldHTMLAudioElement;
    let oldMediaDevices;

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
      HTMLAudioElement = undefined;

      oldMediaDevices = navigator.mediaDevices;
      navigator.mediaDevices = undefined;
    });

    after(() => {
      HTMLAudioElement = oldHTMLAudioElement;
      navigator.mediaDevices = oldMediaDevices;
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
    let localProcessedStreamStopStub;
    let remoteProcessedStreamStopStub;
    let localProcessor;
    let remoteProcessor;
    let onActiveOutputsChanged;
    let onActiveInputChanged;
    const deviceDefault = { deviceId: 'default', kind: 'audiooutput' };
    const deviceFoo = { deviceId: 'foo', kind: 'audiooutput' };
    const deviceBar = { deviceId: 'bar', kind: 'audiooutput' };
    const deviceInput = { deviceId: 'input', kind: 'audioinput' };
    let availableDevices;
    let handlers;
    let mediaDevices;
    let oldMediaDevices;

    beforeEach(() => {
      eventObserver = new AudioProcessorEventObserver();
      localProcessedStreamStopStub = sinon.stub();
      createProcessedStream = sinon.stub().returns(new Promise(res => res({
        id: 'processedstream', getTracks: () => [{ stop: localProcessedStreamStopStub }]
      })));
      destroyProcessedStream = sinon.stub();
      localProcessor = { createProcessedStream, destroyProcessedStream };
      remoteProcessor = { createProcessedStream, destroyProcessedStream };

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
      
      oldMediaDevices = navigator.mediaDevices;
      navigator.mediaDevices = {
        enumerateDevices() { return Promise.resolve([]) },
      };
    });

    afterEach(() => {
      navigator.mediaDevices = oldMediaDevices;
    })

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

    describe('navigator.permissions', () => {
      let oldMicPerm;
      let mockMicPerm;
      let mockEventTarget;
      let enumerateDevices;

      beforeEach(() => {
        enumerateDevices = sinon.stub().returns(new Promise(res => res([])));
        oldMicPerm = navigator.permissions;
        mockEventTarget = new EventTarget();
        mockMicPerm = {
          query: function() {
            return Promise.resolve(mockEventTarget);
          }
        };
        navigator.permissions = mockMicPerm;
      });

      afterEach(() => {
        navigator.permissions = oldMicPerm;
      });

      it('should update list of devices when microphone state is not granted', async () => {
        audio = new AudioHelper(onActiveOutputsChanged, onActiveInputChanged, { enumerateDevices });
        await wait();
        mockEventTarget.dispatchEvent({ type: 'change' });
        sinon.assert.calledTwice(enumerateDevices);
      });

      it('should update list of devices only once', async () => {
        audio = new AudioHelper(onActiveOutputsChanged, onActiveInputChanged, { enumerateDevices });
        await wait();
        mockEventTarget.dispatchEvent({ type: 'change' });
        mockEventTarget.dispatchEvent({ type: 'change' });
        sinon.assert.calledTwice(enumerateDevices);
      });

      it('should not update list of devices when microphone state is granted', async () => {
        mockEventTarget.state = 'granted';
        audio = new AudioHelper(onActiveOutputsChanged, onActiveInputChanged, { enumerateDevices });
        await wait();
        mockEventTarget.dispatchEvent({ type: 'change' });
        sinon.assert.calledOnce(enumerateDevices);
      });

      it('should remove the onchange handler on destroy', async () => {
        audio = new AudioHelper(onActiveOutputsChanged, onActiveInputChanged, { enumerateDevices });
        await wait();
        audio._destroy();
        mockEventTarget.dispatchEvent({ type: 'change' });
        sinon.assert.calledOnce(enumerateDevices);
      });

      it('should not update list of devices if navigator permissions is undefined', async () => {
        navigator.permissions = undefined
        audio = new AudioHelper(onActiveOutputsChanged, onActiveInputChanged, { enumerateDevices });
        await wait();
        mockEventTarget.dispatchEvent({ type: 'change' });
        sinon.assert.calledOnce(enumerateDevices);
      })
    });

    describe('._destroy', () => {
      it('should properly dispose the audio instance', () => {
        audio._stopDefaultInputDeviceStream = sinon.stub();
        audio._stopSelectedInputDeviceStream = sinon.stub();
        audio._destroyLocalProcessedStream = sinon.stub();
        audio._destroyRemoteProcessedStream = sinon.stub();
        audio._maybeStopPollingVolume = sinon.stub();
        audio._destroy();
        assert.strictEqual(audio.eventNames().length, 0);
        sinon.assert.calledOnce(audio._stopDefaultInputDeviceStream);
        sinon.assert.calledOnce(audio._stopSelectedInputDeviceStream);
        sinon.assert.calledOnce(audio._destroyLocalProcessedStream);
        sinon.assert.calledOnce(audio._destroyRemoteProcessedStream);
        sinon.assert.calledOnce(audio._maybeStopPollingVolume);
        sinon.assert.calledOnce(mediaDevices.removeEventListener);
      });

      it('should allow enumerateDevices and mediaDevices to be undefined', () => {
        navigator.enumerateDevices = undefined;
        navigator.mediaDevices = undefined;
        audio = new AudioHelper(onActiveOutputsChanged, onActiveInputChanged);
        audio._stopDefaultInputDeviceStream = sinon.stub();
        audio._stopSelectedInputDeviceStream = sinon.stub();
        audio._destroyLocalProcessedStream = sinon.stub();
        audio._destroyRemoteProcessedStream = sinon.stub();
        audio._maybeStopPollingVolume = sinon.stub();
        audio._destroy();
        assert.strictEqual(audio.eventNames().length, 0);
        sinon.assert.calledOnce(audio._stopDefaultInputDeviceStream);
        sinon.assert.calledOnce(audio._stopSelectedInputDeviceStream);
        sinon.assert.calledOnce(audio._destroyLocalProcessedStream);
        sinon.assert.calledOnce(audio._destroyRemoteProcessedStream);
        sinon.assert.calledOnce(audio._maybeStopPollingVolume);
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

      describe('.addProcessor isRemote=false', () => {
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
          await audio.addProcessor(localProcessor);
        });

        it('should not allow adding more than one processor', async () => {
          await audio.addProcessor(localProcessor);
          assert.rejects(async () => await audio.addProcessor(localProcessor));
        });

        it('should emit add insights event', async () => {
          const stub = sinon.stub();
          eventObserver.on('event', stub);
          await audio.addProcessor(localProcessor);
          sinon.assert.calledWithExactly(stub, { group: 'audio-processor', name: 'add', isRemote: false });
        });

        it('should not restart any device streams if none exists', async () => {
          await audio.addProcessor(localProcessor);
          sinon.assert.notCalled(getUserMedia);
        });

        it('should restart default device if default stream exists', async () => {
          await audio._openDefaultDeviceWithConstraints();
          sinon.assert.calledOnce(getUserMedia);
          await audio.addProcessor(localProcessor);
          sinon.assert.calledTwice(getUserMedia);
          assert.equal(audio._getUserMedia.args[1][0].audio.deviceId.exact, 'input');
          sinon.assert.calledOnce(createProcessedStream);
        });

        it('should restart default device if a selected stream exists', async () => {
          await audio.setInputDevice('input');
          sinon.assert.calledOnce(getUserMedia);
          await audio.addProcessor(localProcessor);
          sinon.assert.calledTwice(getUserMedia);
          assert.equal(audio._getUserMedia.args[1][0].audio.deviceId.exact, 'input');
          sinon.assert.calledOnce(createProcessedStream);
        });

        it('should be able to add a local and remote processor', async () => {
          await audio.addProcessor(localProcessor, false);
          await audio.addProcessor(remoteProcessor, true);          
        });
      });

      describe('.addProcessor isRemote=true', () => {
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
            assert.rejects(async () => await audio.addProcessor(param, true));
          });
        });

        it('should add one processor', async () => {
          await audio.addProcessor(remoteProcessor, true);
        });

        it('should not allow adding more than one processor', async () => {
          await audio.addProcessor(remoteProcessor, true);
          assert.rejects(async () => await audio.addProcessor(remoteProcessor, true));
        });

        it('should emit add insights event', async () => {
          const stub = sinon.stub();
          eventObserver.on('event', stub);
          await audio.addProcessor(remoteProcessor, true);
          sinon.assert.calledWithExactly(stub, { group: 'audio-processor', name: 'add', isRemote: true });
        });

        it('should not restart any device streams if none exists', async () => {
          await audio.addProcessor(remoteProcessor, true);
          sinon.assert.notCalled(getUserMedia);
        });
      });

      describe('.removeProcessor isRemote=false', () => {
        beforeEach(async () => {
          await audio.addProcessor(localProcessor);
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
          await audio.removeProcessor(localProcessor);
          sinon.assert.calledWithExactly(stub, { group: 'audio-processor', name: 'remove', isRemote: false });
        });

        it('should be able to add a new processor after removing the old one', async () => {
          await audio.removeProcessor(localProcessor);
          await audio.addProcessor(localProcessor);
        });

        it('should not restart any device streams if none exists', async () => {
          await audio.removeProcessor(localProcessor);
          sinon.assert.notCalled(getUserMedia);
        });

        it('should restart default device if default stream exists', async () => {
          await audio._openDefaultDeviceWithConstraints();
          sinon.assert.calledOnce(getUserMedia);
          await audio.removeProcessor(localProcessor);
          sinon.assert.calledTwice(getUserMedia);
          assert.equal(audio._getUserMedia.args[1][0].audio.deviceId.exact, 'input');
          sinon.assert.calledOnce(createProcessedStream);
        });

        it('should restart default device if a selected stream exists', async () => {
          await audio.setInputDevice('input');
          sinon.assert.calledOnce(getUserMedia);
          await audio.removeProcessor(localProcessor);
          sinon.assert.calledTwice(getUserMedia);
          assert.equal(audio._getUserMedia.args[1][0].audio.deviceId.exact, 'input');
          sinon.assert.calledOnce(createProcessedStream);
        });

        it('should destroy and stop processed tracks', async () => {
          await audio._openDefaultDeviceWithConstraints();
          await audio.removeProcessor(localProcessor);
          sinon.assert.calledOnce(localProcessedStreamStopStub);
          sinon.assert.calledOnce(destroyProcessedStream);
        });

        it('should be noop when stopping and processed track does not exists', async () => {
          await audio.removeProcessor(localProcessor);
          sinon.assert.notCalled(localProcessedStreamStopStub);
          sinon.assert.notCalled(destroyProcessedStream);
        });

        it('should only remove local processor', async () => {
          remoteProcessedStreamStopStub = sinon.stub();
          audio._remoteProcessedStream = {id: 'remoteStream', getTracks: () => [{ stop: remoteProcessedStreamStopStub }]};
          await audio._openDefaultDeviceWithConstraints();
          await audio.removeProcessor(localProcessor);
          sinon.assert.calledOnce(localProcessedStreamStopStub);
          sinon.assert.calledOnce(destroyProcessedStream);
          sinon.assert.notCalled(remoteProcessedStreamStopStub);
        });
      });

      describe('.removeProcessor isRemote=true', () => {
        beforeEach(async () => {
          remoteProcessedStreamStopStub = sinon.stub();
          await audio.addProcessor(remoteProcessor, true);
          audio._remoteProcessedStream = {id: 'remoteStream', getTracks: () => [{ stop: remoteProcessedStreamStopStub }]};
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
            assert.rejects(async () => await audio.removeProcessor(param, true));
          });
        });

        it('should emit remove insights event', async () => {
          const stub = sinon.stub();
          eventObserver.on('event', stub);
          await audio.removeProcessor(remoteProcessor, true);
          sinon.assert.calledWithExactly(stub, { group: 'audio-processor', name: 'remove', isRemote: true });
        });

        it('should be able to add a new processor after removing the old one', async () => {
          await audio.removeProcessor(remoteProcessor, true);
          await audio.addProcessor(remoteProcessor, true);
        });

        it('should destroy and stop remote processed tracks', async () => {
          await audio._openDefaultDeviceWithConstraints();
          await audio.removeProcessor(remoteProcessor, true);
          sinon.assert.calledOnce(remoteProcessedStreamStopStub);
          sinon.assert.calledOnce(destroyProcessedStream);
        });
        
        it('should be noop when stopping and remote processed track does not exists', async () => {
          audio._remoteProcessedStream = null;
          await audio.removeProcessor(remoteProcessor, true);
          sinon.assert.notCalled(remoteProcessedStreamStopStub);
          sinon.assert.notCalled(destroyProcessedStream);
        });
        
        it('should only remove remote processor', async () => {
          await audio._openDefaultDeviceWithConstraints();
          await audio.removeProcessor(remoteProcessor, true);
          sinon.assert.calledOnce(remoteProcessedStreamStopStub);
          sinon.assert.calledOnce(destroyProcessedStream);
          sinon.assert.notCalled(localProcessedStreamStopStub);
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
        await audio.addProcessor(localProcessor);
        sinon.assert.notCalled(createProcessedStream);
        await audio._openDefaultDeviceWithConstraints();
        sinon.assert.calledOnce(createProcessedStream);
      });

      it('should emit create insights event', async () => {
        const stub = sinon.stub();
        eventObserver.on('event', stub);
        await audio.addProcessor(localProcessor);
        await audio._openDefaultDeviceWithConstraints();
        sinon.assert.calledWithExactly(stub, { group: 'audio-processor', name: 'create-processed-stream', isRemote: false });
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
        await audio.addProcessor(localProcessor);
        await audio._openDefaultDeviceWithConstraints();
        audio._stopDefaultInputDeviceStream();
        sinon.assert.calledOnce(localProcessedStreamStopStub);
        sinon.assert.calledOnce(destroyProcessedStream);
      });

      it('should emit destroy insights event', async () => {
        const stub = sinon.stub();
        eventObserver.on('event', stub);
        await audio.addProcessor(localProcessor);
        await audio._openDefaultDeviceWithConstraints();
        audio._stopDefaultInputDeviceStream();
        sinon.assert.calledWithExactly(stub, { group: 'audio-processor', name: 'destroy-processed-stream', isRemote: false });
      });

      it('should be noop when stopping and processed track does not exists', async () => {
        await audio._openDefaultDeviceWithConstraints();
        audio._stopDefaultInputDeviceStream();
        sinon.assert.notCalled(localProcessedStreamStopStub);
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
        it('should wait for the beforeSetInputDevice to resolve', async () => {
          const stub = sinon.stub();
          audio = new AudioHelper(onActiveOutputsChanged, onActiveInputChanged, {
            audioProcessorEventObserver: eventObserver,
            beforeSetInputDevice: () => new Promise(res => res(stub())),
            getUserMedia,
            mediaDevices,
            setSinkId: () => {}
          });
          await audio.setInputDevice('input');
          sinon.assert.calledOnce(stub);
        });
        
        it('should reject if beforeSetInputDevice rejects', async () => {
          audio = new AudioHelper(onActiveOutputsChanged, onActiveInputChanged, {
            audioProcessorEventObserver: eventObserver,
            beforeSetInputDevice: () => new Promise((resolve, reject) => reject()),
            getUserMedia,
            mediaDevices,
            setSinkId: () => {}
          });
          await assert.rejects(() => audio.setInputDevice('input'));
        });

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

          it('should call getUserMedia with the passed ID', async () => {
            await audio.setInputDevice('input');
            assert.equal(audio._getUserMedia.args[0][0].audio.deviceId.exact, 'input');
          });

          it('should call _onActiveInputChanged with stream from getUserMedia', () => audio.setInputDevice('input').then(() => {
            sinon.assert.calledWith(onActiveInputChanged, fakeStream);
          }));

          it('should update _selectedInputDeviceStream with stream from getUserMedia', () => audio.setInputDevice('input').then(() => {
            assert.equal(audio._selectedInputDeviceStream.id, 'fakestream');
          }));

          it('should create a processed stream if an audio processor exists', async () => {
            await audio.addProcessor(localProcessor);
            await audio.setInputDevice('input');
            sinon.assert.calledOnce(createProcessedStream);
          });

          it('should emit create insights event', async () => {
            const stub = sinon.stub();
            eventObserver.on('event', stub);
            await audio.addProcessor(localProcessor);
            await audio.setInputDevice('input');
            sinon.assert.calledWithExactly(stub, { group: 'audio-processor', name: 'create-processed-stream', isRemote: false });
          });

          it('should stop default tracks if it exists', async () => {
            await audio._openDefaultDeviceWithConstraints();
            await audio.setInputDevice('input');
            sinon.assert.calledOnce(stopStub);
          });

          it('should destroy stop processed tracks if it exists', async () => {
            await audio.addProcessor(localProcessor);
            await audio._openDefaultDeviceWithConstraints();
            await audio.setInputDevice('input');
            sinon.assert.calledOnce(localProcessedStreamStopStub);
            sinon.assert.calledOnce(destroyProcessedStream);
          });

          it('should emit destroy insights event', async () => {
            const stub = sinon.stub();
            eventObserver.on('event', stub);
            await audio.addProcessor(localProcessor);
            await audio._openDefaultDeviceWithConstraints();
            await audio.setInputDevice('input');
            sinon.assert.calledWithExactly(stub, { group: 'audio-processor', name: 'destroy-processed-stream', isRemote: false });
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

            await audio.addProcessor(localProcessor);
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
            sinon.assert.calledOnce(localProcessedStreamStopStub);
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
        await audio.addProcessor(localProcessor);
        await audio.setInputDevice('input');
        assert.strictEqual(audio.inputStream.id, 'processedstream');
      });
    });

    describe('.localProcessedStream', () => {
      it('should return the processed stream', async () => {
        await audio.addProcessor(localProcessor);
        await audio.setInputDevice('input');
        assert.strictEqual(audio.localProcessedStream.id, 'processedstream');
      });

      it('should return null', async () => {
        await audio.setInputDevice('input');
        assert.strictEqual(audio.localProcessedStream, null);
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

    describe('_destroyRemoteProcessedStream', () => {
      it('should destroy and stop remote processed tracks', async () => {
        remoteProcessedStreamStopStub = sinon.stub();
        audio._remoteProcessor = remoteProcessor;
        audio._remoteProcessedStream = {id: 'remoteStream', getTracks: () => [{ stop: remoteProcessedStreamStopStub }]};
        await audio._destroyRemoteProcessedStream();
        sinon.assert.calledOnce(remoteProcessedStreamStopStub);
        sinon.assert.calledOnce(destroyProcessedStream);
        assert.strictEqual(audio._remoteProcessedStream, null);
      });
      
      it('should be noop when stopping and remote processed track does not exists', async () => {
        audio._remoteProcessedStream = null;
        audio._remoteProcessor = remoteProcessor;
        await audio._destroyRemoteProcessedStream();
        sinon.assert.notCalled(destroyProcessedStream);
      });

      it('should be noop when remote processor does not exists', async () => {
        remoteProcessedStreamStopStub = sinon.stub();
        audio._remoteProcessedStream = {id: 'remoteStream', getTracks: () => [{ stop: remoteProcessedStreamStopStub }]};
        audio._remoteProcessor = null;
        await audio._destroyRemoteProcessedStream();
        sinon.assert.notCalled(remoteProcessedStreamStopStub);
        sinon.assert.notCalled(destroyProcessedStream);
      });
    });

    describe('_maybeCreateRemoteProcessedStream', () => {
      it('should create a remote processed stream', async () => {
        audio._remoteProcessor = remoteProcessor;
        const stream = await audio._maybeCreateRemoteProcessedStream('foo');
        sinon.assert.calledOnce(createProcessedStream);
        assert.strictEqual(audio._remoteProcessedStream.id, 'processedstream');
        assert.strictEqual(stream.id, 'processedstream');
        assert.notStrictEqual(stream, 'foo');
      });
      
      it('should be noop if remoteProcessor does not exists', async () => {
        audio._remoteProcessor = null;
        const stream = await audio._maybeCreateRemoteProcessedStream('foo');
        sinon.assert.notCalled(createProcessedStream);
        assert.strictEqual(stream, 'foo')
      });

      it('should emit create insights event', async () => {
        const stub = sinon.stub();
        eventObserver.on('event', stub);
        audio._remoteProcessor = remoteProcessor;
        await audio._maybeCreateRemoteProcessedStream();
        sinon.assert.calledWithExactly(stub, { group: 'audio-processor', name: 'create-processed-stream', isRemote: true });
      });
    });
  });
});
