import * as loglevel from 'loglevel';
import CallType from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { GeneralErrors, InvalidArgumentError } from '../../lib/twilio/errors';
import {
  Edge,
  Region,
  regionShortcodes,
  regionToEdge,
} from '../../lib/twilio/regions';

import * as assert from 'assert';
import { EventEmitter } from 'events';
import { SinonFakeTimers, SinonSpy, SinonStubbedInstance } from 'sinon';
import * as sinon from 'sinon';
import AudioHelper from '../../lib/twilio/audiohelper';

const root = global as any;

const ClientCapability = require('twilio').jwt.ClientCapability;
const CallClass = require('../../lib/twilio/call').default;

// tslint:disable max-classes-per-file only-arrow-functions no-empty

describe('Device', function() {
  let activeCall: any;
  let audioHelper: any;
  let clock: SinonFakeTimers;
  let connectOptions: Record<string, any> | undefined;
  let device: Device;
  let enabledSounds: Record<Device.ToggleableSound, boolean>;
  let pstream: any;
  let publisher: any;
  let stub: SinonStubbedInstance<Device>;
  let token: string;
  let updateAvailableDevicesStub: any;
  let updateInputStream: Function;
  let updateSinkIds: Function;

  let setupStream: () => Promise<void>;

  const sounds: Partial<Record<Device.SoundName, any>> = { };

  const AudioHelper = (_updateSinkIds: Function, _updateInputStream: Function, getUserMedia: Function, options?: AudioHelper.Options) => {
    enabledSounds = options?.enabledSounds || {
      [Device.SoundName.Disconnect]: true,
      [Device.SoundName.Incoming]: true,
      [Device.SoundName.Outgoing]: true,
    };
    updateInputStream = _updateInputStream;
    updateSinkIds = _updateSinkIds;
    const audioHelper = createEmitterStub(require('../../lib/twilio/audiohelper').default);
    audioHelper._enabledSounds = enabledSounds;
    audioHelper._getEnabledSounds = () => enabledSounds;
    audioHelper._updateAvailableDevices = updateAvailableDevicesStub;
    audioHelper.disconnect = () => enabledSounds[Device.SoundName.Disconnect];
    audioHelper.incoming = () => enabledSounds[Device.SoundName.Incoming];
    audioHelper.outgoing = () => enabledSounds[Device.SoundName.Outgoing];
    return audioHelper;
  };
  const Call = (_?: any, _connectOptions?: Record<string, any>) => {
    connectOptions = _connectOptions;
    return activeCall = createEmitterStub(CallClass);
  };
  const PStream = sinon.spy((...args: any[]) =>
    pstream = createEmitterStub(require('../../lib/twilio/pstream').default));
  const Publisher = sinon.spy((...args: any[]) =>
    publisher = createEmitterStub(require('../../lib/twilio/eventpublisher').default));
  const Sound = (name: Device.SoundName) =>
    sounds[name] = sinon.createStubInstance(require('../../lib/twilio/sound').default);
  const setupOptions: any = { AudioHelper, Call, PStream, Publisher, Sound };

  afterEach(() => {
    clock.restore();
    root.resetEvents();

    PStream.resetHistory();
    Publisher.resetHistory();
  });

  beforeEach(() => {
    pstream = null;
    publisher = null;
    updateAvailableDevicesStub = sinon.stub().returns(Promise.reject());
    clock = sinon.useFakeTimers(Date.now());
    token = createToken('alice');
    device = new Device(token, setupOptions);
    device.on('error', () => { /* no-op */ });
    setupStream = async () => {
      const setupPromise = device['_setupStream']();
      pstream.emit('connected', { region: 'US_EAST_VIRGINIA' });
      await setupPromise;
    };
  });

  describe('constructor', () => {
    describe('should always call updateOptions', () => {
      it('when passed options', () => {
        stub = sinon.createStubInstance(Device);
        Device.prototype.constructor.call(stub, token, setupOptions);
        sinon.assert.calledOnce(stub.updateOptions);
      });

      it('when not passed options', () => {
        stub = sinon.createStubInstance(Device);
        Device.prototype.constructor.call(stub, token);
        sinon.assert.calledOnce(stub.updateOptions);
      });
    });

    it('should set preflight to false by default', () => {
      assert.equal(device['_options'].preflight, false);
    });

    it('should set preflight to false if passed in as false', () => {
      device = new Device(token, { ...setupOptions, preflight: false });
      assert.equal(device['_options'].preflight, false);
    });

    it('should set preflight to true if passed in as true', () => {
      device = new Device(token, { ...setupOptions, preflight: true });
      assert.equal(device['_options'].preflight, true);
    });

    it('should set forceAggressiveIceNomination to false by default', () => {
      assert.equal(device['_options'].forceAggressiveIceNomination, false);
    });

    it('should set forceAggressiveIceNomination to false if passed in as false', () => {
      device = new Device(token, { ...setupOptions, forceAggressiveIceNomination: false });
      assert.equal(device['_options'].forceAggressiveIceNomination, false);
    });

    it('should set forceAggressiveIceNomination to true if passed in as true', () => {
      device = new Device(token, { ...setupOptions, forceAggressiveIceNomination: true });
      assert.equal(device['_options'].forceAggressiveIceNomination, true);
    });

    it('should throw if the token is an invalid type', () => {
      assert.throws(() => new Device(null as any), /Parameter "token" must be of type "string"./);
    });

    it('should set MediaStream to undefined by default', () => {
      assert.equal(device['_options'].MediaStream, undefined);
    });

    it('should set MediaStream to "foo" if passed in as "foo"', () => {
      device = new Device(token, { ...setupOptions, MediaStream: 'foo' });
      assert.equal(device['_options'].MediaStream, 'foo');
    });
  });

  describe('after Device is constructed', () => {
    it('should create a publisher', () => {
      assert(device['_publisher']);
    });

    describe('after the Device has been connected to signaling', () => {
      let registerDevice: () => Promise<void>;
      let unregisterDevice: () => Promise<void>;

      const setup = async () => {
        await setupStream();
        registerDevice = async () => {
          const regPromise = device.register();
          await clock.tickAsync(0);
          pstream.emit('ready');
          await regPromise;
        };
        unregisterDevice = async () => {
          const regPromise = device.unregister();
          await clock.tickAsync(0);
          pstream.emit('offline');
          await regPromise;
        };
      };

      beforeEach(async () => {
        await setup();
      });

      describe('insights gateway', () => {
        describe('.setHost', () => {
          beforeEach(() => {
            publisher.setHost = sinon.stub();
          });

          it('should set default host address if home is not available', () => {
            pstream.emit('connected', {});
            sinon.assert.calledOnce(publisher.setHost);
            sinon.assert.calledWithExactly(publisher.setHost, 'eventgw.twilio.com');
          });

          Object.values(Region).forEach(region => {
            it(`should set host to eventgw.${region}.twilio.com when home is set to ${region}`, () => {
              pstream.emit('connected', { home: region });
              sinon.assert.calledOnce(publisher.setHost);
              sinon.assert.calledWithExactly(publisher.setHost, `eventgw.${region}.twilio.com`);
            });
          });
        });

        describe('defaultPayload', () => {
          it('should add default payload', () => {
            assert.deepStrictEqual(Publisher.args[0][2].defaultPayload(), {
              aggressive_nomination: false,
              browser_extension: false,
              dscp: true,
              ice_restart_enabled: true,
              platform: 'WebRTC',
              sdk_version: Device.version,
            });
          });

          it('should set aggressive_nomination to true', () => {
            device = new Device(token, { ...setupOptions, forceAggressiveIceNomination: true });
            assert.deepStrictEqual(Publisher.args[1][2].defaultPayload(), {
              aggressive_nomination: true,
              browser_extension: false,
              dscp: true,
              ice_restart_enabled: true,
              platform: 'WebRTC',
              sdk_version: Device.version,
            });
          });

          it('should set dscp to false', () => {
            device = new Device(token, { ...setupOptions, dscp: false });
            assert.deepStrictEqual(Publisher.args[1][2].defaultPayload(), {
              aggressive_nomination: false,
              browser_extension: false,
              dscp: false,
              ice_restart_enabled: true,
              platform: 'WebRTC',
              sdk_version: Device.version,
            });
          });

          it('should set browser_extension to true', () => {
            const root = globalThis as any;
            const origChrome = root.chrome;
            root.chrome = {runtime:{id: 'foo'}};
            device = new Device(token, setupOptions);
            assert.deepStrictEqual(Publisher.args[1][2].defaultPayload(), {
              aggressive_nomination: false,
              browser_extension: true,
              dscp: true,
              ice_restart_enabled: true,
              platform: 'WebRTC',
              sdk_version: Device.version,
            });
            root.chrome = origChrome;
          });
        });
      });

      describe('.connect()', () => {
        let customParameters: any;
        let parameters: any;
        let signalingReconnectToken: any;
        let rtcConfiguration: any;

        beforeEach(() => {
          customParameters = { To: 'foo', bar: '我不吃蛋' };
          parameters = { CallSid: 'CA123', From: 'foo', bar: '我不吃蛋' };
          signalingReconnectToken = 'foobarbaz';
          rtcConfiguration = { iceServers: ['foo', 'bar'] } as any;
        });

        it('should wait for the inputDevicePromise to resolve', async () => {
          const stub = sinon.stub();
          device.audio!._getInputDevicePromise = () => new Promise(res => res(stub()));
          await device.connect();
          sinon.assert.calledOnce(stub);
          assert(!!device['_activeCall']);
          assert(!device['_makeCallPromise']);
        });

        it('should reject if inputDevicePromise rejects', async () => {
          device.audio!._getInputDevicePromise = () => new Promise((resolve, reject) => reject());
          await assert.rejects(() => device.connect());
          assert(!device['_activeCall']);
          assert(!device['_makeCallPromise']);
        });

        it('should reject if there is already an active call', async () => {
          await device.connect();
          await assert.rejects(() => device.connect(), /A Call is already active/);
        });

        it('should call ignore on all existing calls', async () => {
          const calls: any[] = [];
          for (let i = 0; i < 10; i++) {
            calls.push({ ignore: sinon.spy() });
          }
          device['_calls'] = calls;
          await device.connect();
          calls.forEach((call: any) => sinon.assert.calledOnce(call.ignore));
          assert.equal(device.calls.length, 0);
        });

        it('should not set up a signaling connection if unnecessary', async () => {
          await device.connect();
          sinon.assert.calledOnce(PStream);
        });

        it('should stop playing the incoming sound', async () => {
          const spy: any = { stop: sinon.spy() };
          device['_soundcache'].set(Device.SoundName.Incoming, spy);
          await device.connect();
          sinon.assert.calledOnce(spy.stop);
        });

        it('should return a Call', async () => {
          assert.equal(await device.connect(), activeCall);
        });

        it('should set ._activeCall', async () => {
          assert.equal(await device.connect(), device['_activeCall']);
        });

        it('should set ._makeCallPromise', () => {
          device.connect();
          assert(device['_makeCallPromise']);
        })

        it('should play outgoing sound after accepted if enabled', async () => {
          const spy: any = { play: sinon.spy() };
          device['_soundcache'].set(Device.SoundName.Outgoing, spy);
          await device.connect();
          activeCall._direction = 'OUTGOING';
          activeCall.emit('accept');
          sinon.assert.calledOnce(spy.play);
        });

        it('should not play outgoing sound after accepted if disabled', async () => {
          enabledSounds[Device.SoundName.Outgoing] = false;
          const spy: any = { play: sinon.spy() };
          device['_soundcache'].set(Device.SoundName.Outgoing, spy);
          await device.connect();
          activeCall._direction = 'OUTGOING';
          activeCall.emit('accept');
          sinon.assert.notCalled(spy.play);
        });

        it('should not play outgoing sound after accepted if disabled after calling updateOptions', async () => {
          enabledSounds[Device.SoundName.Outgoing] = false;
          // Force a new audio-helper instance to be recreated
          // After updating the enabled sounds state
          device.updateOptions();
          const spy: any = { play: sinon.spy() };
          device['_soundcache'].set(Device.SoundName.Outgoing, spy);
          await device.connect();
          activeCall._direction = 'OUTGOING';
          activeCall.emit('accept');
          // should fail
          sinon.assert.notCalled(spy.play);
        });

        it('should not play outgoing sound if connectToken is provided', async () => {
          const spy: any = { play: sinon.spy() };
          device['_soundcache'].set(Device.SoundName.Outgoing, spy);
          await device.connect({ connectToken: btoa(encodeURIComponent(JSON.stringify({
            parameters,
            signalingReconnectToken,
          })))});
          activeCall._direction = 'OUTGOING';
          activeCall.emit('accept');
          sinon.assert.notCalled(spy.play);
        });

        describe('ConnectOptions', () => {
          let callSpy: any;

          beforeEach(async () => {
            callSpy = sinon.spy(() => createEmitterStub(CallClass));
            device = new Device(token, { ...setupOptions, Call: callSpy });
            await setup();
          });

          context('.rtcConfiguration', () => {
            it('should pass rtcConfiguration to the Call object', async () => {
              await device.connect({ rtcConfiguration });
              assert.deepEqual(callSpy.args[0][1].rtcConfiguration, rtcConfiguration);
            });
          });

          context('.params', () => {
            it('should pass twimlParams to the Call object', async () => {
              await device.connect({ params: customParameters });
              assert.deepEqual(callSpy.args[0][1].twimlParams, customParameters);
            });
          });

          context('.connectToken', () => {
            it('should throw for non base64', async () => {
              await assert.rejects(() => device.connect({ connectToken: 'foo' }), /Cannot parse connectToken/);
            });

            it('should throw for base64 but non-json', async () => {
              await assert.rejects(() => device.connect({ connectToken: btoa(encodeURIComponent('foo')) }), /Cannot parse connectToken/);
            });

            it('should throw if parameters is missing', async () => {
              await assert.rejects(() => device.connect({ connectToken: btoa(encodeURIComponent(JSON.stringify({
                customParameters,
                signalingReconnectToken,
              }))) }), /Invalid connectToken/);
            });

            it('should throw if CallSid is missing', async () => {
              await assert.rejects(() => device.connect({ connectToken: btoa(encodeURIComponent(JSON.stringify({
                parameters: {foo: 'foo'},
                customParameters,
                signalingReconnectToken,
              }))) }), /Invalid connectToken/);
            });

            it('should throw if signalingReconnectToken is missing', async () => {
              await assert.rejects(() => device.connect({ connectToken: btoa(encodeURIComponent(JSON.stringify({
                parameters,
                customParameters,
              }))) }), /Invalid connectToken/);
            });

            it('should pass connectToken info to the Call object', async () => {
              await device.connect({ connectToken: btoa(encodeURIComponent(JSON.stringify({
                parameters,
                customParameters,
                signalingReconnectToken,
              })))});

              assert.deepEqual(callSpy.args[0][1].callParameters, parameters);
              assert.deepEqual(callSpy.args[0][1].twimlParams, customParameters);
              assert.deepEqual(callSpy.args[0][1].reconnectToken, signalingReconnectToken);
              assert.deepEqual(callSpy.args[0][1].reconnectCallSid, parameters.CallSid);
            });

            it('should pass connectToken info to the Call object if customParameters is missing', async () => {
              await device.connect({ connectToken: btoa(encodeURIComponent(JSON.stringify({
                parameters,
                signalingReconnectToken,
              })))});

              assert.deepEqual(callSpy.args[0][1].callParameters, parameters);
              assert.deepEqual(callSpy.args[0][1].twimlParams, {});
              assert.deepEqual(callSpy.args[0][1].reconnectToken, signalingReconnectToken);
              assert.deepEqual(callSpy.args[0][1].reconnectCallSid, parameters.CallSid);
            });
          });
        });
      });

      describe('.destroy()', () => {
        it('should destroy .stream if one exists', () => {
          device.destroy();
          sinon.assert.calledOnce(pstream.destroy);
        });

        it('should destroy audio helper', () => {
          const stub = sinon.stub();
          device['_audio']!['_destroy'] = stub;
          device.destroy();
          sinon.assert.calledOnce(stub);
        });

        it('should destroy audioProcessorEventObserver', () => {
          const stub = sinon.stub();
          device['_audioProcessorEventObserver']!.destroy = stub;
          device.destroy();
          sinon.assert.calledOnce(stub);
        });

        it('should destroy the publisher after the audioProcessorEventObserver', () => {
          const observerStub =
            (device['_audioProcessorEventObserver']!.destroy = sinon.stub());
          const publisherStub =
            (device['_destroyPublisher'] = sinon.stub());
          device.destroy();
          assert(observerStub.calledBefore(publisherStub));
        });

        it('should stop sending registrations', () => {
          pstream.register.resetHistory();

          device.destroy();
          pstream.emit('connected', { region: 'US_EAST_VIRGINIA' });
          clock.tick(30000 + 1);
          sinon.assert.notCalled(pstream.register);
        });

        it('should disconnect and reject all calls', () => {
          const disconnect = sinon.spy();
          const reject = sinon.spy();
          (device as any)['_calls'] = [
            { disconnect, reject },
            { disconnect, reject },
          ];
          device.destroy();
          sinon.assert.calledTwice(disconnect);
          sinon.assert.calledTwice(reject);
        });

        it('should disconnect active call', async () => {
          const call: any = await device.connect();
          device.destroy();
          sinon.assert.calledOnce(call.disconnect);
        });
      });

      describe('.disconnectAll()', () => {
        it('should clear device._calls', () => {
          (device as any)['_calls'] = [
            { disconnect: () => { } },
            { disconnect: () => { } },
          ];
          device.disconnectAll();
          assert.equal(device.calls.length, 0);
        });

        it('should call disconnect on all calls', () => {
          const disconnect = sinon.spy();
          (device as any)['_calls'] = [
            { disconnect },
            { disconnect },
          ];
          device.disconnectAll();
          sinon.assert.calledTwice(disconnect);
        });

        it('should call disconnect on the active call', async () => {
          const call: any = await device.connect();
          device.disconnectAll();
          sinon.assert.calledOnce(call.disconnect);
        });
      });

      describe('.edge', () => {
        // these unit tests will need to be changed for Phase 2 Regional
        context('when the region is mapped to a known edge', () => {
          Object.entries(regionShortcodes).forEach(([fullName, region]: [string, string]) => {
            const preferredEdge = regionToEdge[region as Region];
            it(`should return ${preferredEdge} for ${region}`, () => {
              pstream.emit('connected', { region: fullName });
              assert.equal(device.edge, preferredEdge);
            });
          });
        });

        context('when the region is not mapped to a known edge', () => {
          ['FOO_BAR', ''].forEach((name: string) => {
            it(`should return the region string directly if it's '${name}'`, () => {
              pstream.emit('connected', { region: name });
              assert.equal(device['_region'], name);
            });
          });
        });
      });

      describe('.register()', () => {
        it('should not set up a signaling connection if unnecessary', async () => {
          await registerDevice();
          sinon.assert.calledOnce(PStream);
        });

        it('should send a register request with audio: true', async () => {
          await registerDevice();
          sinon.assert.calledOnce(pstream.register);
          sinon.assert.calledWith(pstream.register, { audio: true });
        });

        it('should start the registration timer', async () => {
          await registerDevice();
          sinon.assert.calledOnce(pstream.register);
          await clock.tickAsync(30000 + 1);
          sinon.assert.calledTwice(pstream.register);
        });

        it('should throw an error if the websocket is closed', async () => {
          device['_streamConnectedPromise'] = null;

          const _setupStream = device['_setupStream'].bind(device)
          device['_setupStream'] = sinon.spy(async () => {
            const setupPromise = _setupStream();
            pstream.emit('close');
            await setupPromise;
          });

          await assert.rejects(() => registerDevice());
        });

        it('should throw an error if the device failed to register because of the WebSocket being closed', async () => {
          device['_streamConnectedPromise'] = null;

          const _setupStream = device['_setupStream'].bind(device)
          device['_setupStream'] = sinon.spy(async () => {
            const setupPromise = _setupStream();
            pstream.emit('close');
            await setupPromise;
          });

          await assert.rejects(() => registerDevice());
        })
      });

      describe('._setupStream()', () => {
        it('should throw an error if the websocket is closed', async () => {
          setupStream = async () => {
            const setupPromise = device['_setupStream']();
            pstream.emit('close');
            await setupPromise;
          };
          await assert.rejects(() => setupStream());
        })
      });

      describe('._sendPresence(presence)', () => {
        beforeEach(() => setupStream());

        [true, false].forEach(presence => {
          describe(`when "presence=${presence}"`, () => {
            it(`should call pstream.register(${presence})`, async () => {
              device['_sendPresence'](presence);
              await clock.tickAsync(0);
              sinon.assert.calledOnceWithExactly(pstream.register, { audio: presence });
            });
          });
        });
      });

      describe('.state', () => {
        it('should return "registered" after registering', async () => {
          await registerDevice();
          assert.equal(device.state, Device.State.Registered);
        });
      });

      describe('.unregister()', () => {
        beforeEach(async () => {
          await registerDevice();
          pstream.register.resetHistory();
        });

        it('should send a register request with audio: false', async () => {
          await unregisterDevice();
          sinon.assert.calledOnce(pstream.register);
          sinon.assert.calledWith(pstream.register, { audio: false });
        });

        it('should stop the registration timer', async () => {
          await unregisterDevice();
          sinon.assert.calledOnce(pstream.register);
          await clock.tickAsync(30000 + 1);
          sinon.assert.calledOnce(pstream.register);
        });
      });

      describe('.updateOptions()', () => {
        it('should additively set options', () => {
          device.updateOptions({
            allowIncomingWhileBusy: true,
            appName: 'foobar',
          });
          assert.equal(device['_options'].allowIncomingWhileBusy, true);
          assert.equal(device['_options'].appName, 'foobar');

          device.updateOptions({
            appName: 'baz',
          });
          assert.equal(device['_options'].allowIncomingWhileBusy, true);
          assert.equal(device['_options'].appName, 'baz');
        });

        it('should re-initialize publisher with the correct host', () => {
          pstream.emit('connected', { home: 'foo'});
          device.updateOptions({ appName: 'bar' });
          assert.equal(Publisher.args[1][2].host, 'eventgw.foo.twilio.com');
        });

        it('should set up an audio helper', () => {
          const spy = device['_setupAudioHelper'] = sinon.spy(device['_setupAudioHelper']);
          device.updateOptions({});
          sinon.assert.calledOnce(spy);
        });

        it('should reconstruct an existing stream if necessary', async () => {
          await registerDevice();
          const setupStreamSpy = device['_setupStream'] = sinon.spy(device['_setupStream']);
          device.updateOptions({ edge: 'ashburn' });
          sinon.assert.calledOnce(setupStreamSpy);
        });

        it('should not throw during re-registration', async () => {
          await registerDevice();

          const regCalls: Array<Promise<any>> = [];

          device.register = () => {
            const regCall = Device.prototype.register.call(device);
            regCalls.push(regCall);
            return regCall;
          };

          device.updateOptions({ edge: 'sydney' });

          pstream.emit('offline');
          await clock.tickAsync(0);
          pstream.emit('connected', { region: 'EU_IRELAND' });
          await clock.tickAsync(0);
          pstream.emit('ready');
          await clock.tickAsync(0);
        });

        describe('log', () => {
          let setDefaultLevelStub: any;

          beforeEach(() => {
            setDefaultLevelStub = sinon.stub();
          });

          Object.entries(loglevel.levels).forEach(([level, number]) => {
            level = level.toLowerCase();

            it(`should set log level to '${number}'`, () => {
              device['_log'].setDefaultLevel = setDefaultLevelStub;
              device.updateOptions({ logLevel: number });
              sinon.assert.calledWith(setDefaultLevelStub, number);
            });

            it(`should set log level to '${level}'`, () => {
              device['_log'].setDefaultLevel = setDefaultLevelStub;
              device.updateOptions({ logLevel: level as any });
              sinon.assert.calledWith(setDefaultLevelStub, level);
            });
          });
        });
      });

      describe('.updateToken()', () => {
        it('should update the tokens for an existing stream and publisher', () => {
          const newToken = 'foobar-token';

          device.updateToken(newToken);

          sinon.assert.calledOnce(pstream.setToken);
          sinon.assert.calledWith(pstream.setToken, newToken);

          sinon.assert.calledOnce(publisher.setToken);
          sinon.assert.calledWith(publisher.setToken, newToken);
        });
      });

      describe('on device change', () => {
        it('should call _onInputDevicesChanges on the active Call', async () => {
          await device.connect();
          const spy: SinonSpy = sinon.spy();
          activeCall['_mediaHandler'] = { _onInputDevicesChanged: spy };
          device.audio?.emit('deviceChange', []);
          sinon.assert.calledOnce(spy);
        });
      });

      describe('on signaling.close', () => {
        it('should set stream to null', () => {
          pstream.emit('close');
          assert.equal(device['_stream'], null);
        });
      });

      describe('on signaling.connected', () => {
        it('should update region', () => {
          pstream.emit('connected', { region: 'EU_IRELAND' });
          assert.equal(device['_region'], regionShortcodes.EU_IRELAND);
        });

        it('should attempt a re-register if the device was registered', async () => {
          await registerDevice();

          const spy = device.register = sinon.spy(device.register);
          pstream.emit('offline');
          await clock.tickAsync(0);
          pstream.emit('connected', { region: 'EU_IRELAND' });
          await clock.tickAsync(0);

          sinon.assert.calledOnce(spy);
        });

        it('should not attempt a re-register twice', async () => {
          await registerDevice();

          const spy = device.register = sinon.spy(device.register);
          pstream.emit('offline');
          await clock.tickAsync(0);

          // Register manually. This is usually triggered when token is also updated
          await registerDevice();

          pstream.emit('connected', { region: 'EU_IRELAND' });
          await clock.tickAsync(0);

          sinon.assert.calledOnce(spy);
        });

        it('should update the preferred uri', () => {
          pstream.emit('connected', { region: 'EU_IRELAND', edge: Edge.Dublin });
          assert.equal(device['_preferredURI'], ['wss://voice-js.dublin.twilio.com/signal']);
        });

        it('should update the preferred uri from the first edge', () => {
          pstream.emit('connected', { region: 'EU_IRELAND', edge: [Edge.Dublin, Edge.Frankfurt] });
          assert.equal(device['_preferredURI'], ['wss://voice-js.dublin.twilio.com/signal']);
        });

        context('when chunderw is set', () => {
          it('should use chunderw as the preferred uri if it is a string', () => {
            device['_options'].chunderw = 'foo';
            pstream.emit('connected', { region: 'EU_IRELAND', edge: Edge.Dublin });
            assert.equal(device['_preferredURI'], ['wss://foo/signal']);
          });

          it('should use the first chunderw as the preferred uri if it is an array', () => {
            device['_options'].chunderw = ['foo', 'bar'];
            pstream.emit('connected', { region: 'EU_IRELAND', edge: Edge.Dublin });
            assert.equal(device['_preferredURI'], ['wss://foo/signal']);
          });
        });

        it('should set the identity', () => {
          pstream.emit('connected', { token: { identity: 'foobar' } });
          assert.equal(device['_identity'], 'foobar');
        });

        it('should set a token expiry timeout', () => {
          const ttlSeconds = 20;
          pstream.emit('connected', { token: { ttl: ttlSeconds } });
          assert.notEqual(device['_tokenWillExpireTimeout'], null);
        });

        describe('`tokenWillExpire` event', () => {
          it('should emit a token expiry', () => {
            const ttlSeconds = 20;
            const ttlMilliseconds = ttlSeconds * 1000;
            let expiredEventFired = false;

            pstream.emit('connected', { token: { ttl: ttlSeconds } });
            device.on('tokenWillExpire', () => {
              expiredEventFired = true;
            });

            clock.tick(ttlMilliseconds);
            assert(expiredEventFired);
          });

          it('should not emit a token expiry early', () => {
            const ttlSeconds = 20;
            const ttlMilliseconds = ttlSeconds * 1000;
            let expiredEventFired = false;

            pstream.emit('connected', { token: { ttl: ttlSeconds } });
            device.on('tokenWillExpire', () => {
              expiredEventFired = true;
            });

            clock.tick(ttlMilliseconds - 15000);
            assert.notEqual(expiredEventFired, true);
          });

          it('should emit the device with the `tokenWillExpire` event', () => {
            const ttlSeconds = 20;
            const ttlMilliseconds = ttlSeconds * 1000;
            let expiredEventDevice = false;

            pstream.emit('connected', { token: { ttl: ttlSeconds } });
            device.on('tokenWillExpire', (dev: Device) => {
              expiredEventDevice = (device === dev);
            });

            clock.tick(ttlMilliseconds);
            assert(expiredEventDevice);
          });
        });
      });

      describe('on signaling.error', () => {
        const twilioError = new GeneralErrors.UnknownError();

        it('should not emit Device.error if payload.error is missing', () => {
          device.emit = sinon.spy();
          pstream.emit('error', { });
          sinon.assert.notCalled(device.emit as any);
        });

        it('should emit Device.error without call if payload.callsid is missing', () => {
          device.emit = sinon.spy();
          pstream.emit('error', { error: { twilioError } });
          sinon.assert.calledOnce(device.emit as any);
          sinon.assert.calledWith(device.emit as any, 'error', twilioError);
        });

        it('should emit Device.error with call if payload.callsid is present', async () => {
          pstream.emit('invite', { callsid: 'foo', sdp: 'bar' });
          await clock.tickAsync(0);
          const call = device.calls[0];
          call.parameters = { CallSid: 'foo' };
          device.emit = sinon.spy();
          pstream.emit('error', { error: { twilioError }, callsid: 'foo' });
          sinon.assert.calledOnce(device.emit as any);
          sinon.assert.calledWith(device.emit as any, 'error', twilioError, call);
        });

        it('should not stop registrations if code is not 31205', async () => {
          await registerDevice();
          pstream.emit('error', { error: { } });
          pstream.register.reset();
          await clock.tickAsync(30000 + 1);
          sinon.assert.called(pstream.register);
        });

        it('should stop registrations if code is 31205', async () => {
          await registerDevice();
          pstream.emit('error', { error: { code: 31205 } });
          pstream.register.reset();
          await clock.tickAsync(30000 + 1);
          sinon.assert.notCalled(pstream.register);
        });

        it('should transform when enableImprovedSignalingErrorPrecision is true', async () => {
          device.updateOptions({ enableImprovedSignalingErrorPrecision: true });
          await registerDevice();
          device.emit = sinon.spy();
          pstream.emit('error', { error: { code: 31480 } });
          sinon.assert.calledOnce(device.emit as sinon.SinonSpy);
          sinon.assert.calledWith(device.emit as sinon.SinonSpy, 'error');
          const errorObject = (device.emit as sinon.SinonSpy).getCall(0).args[1];
          assert.equal('TemporarilyUnavailable', errorObject.name);
          assert.equal(31480, errorObject.code);
        });

        it('should default when enableImprovedSignalingErrorPrecision is false', async () => {
          device.updateOptions({ enableImprovedSignalingErrorPrecision: false });
          await registerDevice();
          device.emit = sinon.spy();
          pstream.emit('error', { error: { code: 31480 } });
          sinon.assert.calledOnce(device.emit as sinon.SinonSpy);
          sinon.assert.calledWith(device.emit as sinon.SinonSpy, 'error');
          const errorObject = (device.emit as sinon.SinonSpy).getCall(0).args[1];
          console.error(errorObject);
        });

        it('should emit Device.error if code is 31005', () => {
          device.emit = sinon.spy();
          pstream.emit('error', { error: { code: 31005 } });
          sinon.assert.calledOnce(device.emit as any);
          sinon.assert.calledWith(device.emit as any, 'error');
          const errorObject = (device.emit as sinon.SinonSpy).getCall(0).args[1];
          assert.equal(31005, errorObject.code);
        });

        it('should emit the proper error even if a twilioError is passed', () => {
          const spy = device.emit = sinon.spy();
          pstream.emit('error', { error: { code: 31005, twilioError: new GeneralErrors.UnknownError() } });
          sinon.assert.calledOnce(spy);
          sinon.assert.calledWith(spy, 'error');
          const errorObject = spy.getCall(0).args[1];
          assert.equal(31005, errorObject.code);
        });

        it('should not emit error if a voiceeventsid is passed', () => {
          const spy = device.emit = sinon.spy();
          pstream.emit('error', { error: { code: 31005, twilioError: new GeneralErrors.UnknownError() }, voiceeventsid: 'foo' });
          sinon.assert.notCalled(spy);
        });

        it('should emit the proper error message', () => {
          const spy = device.emit = sinon.spy();
          pstream.emit('error', { error: { code: 31005, message: 'foobar', twilioError: new GeneralErrors.UnknownError() } });
          sinon.assert.calledOnce(spy);
          sinon.assert.calledWith(spy, 'error');
          const errorObject = spy.getCall(0).args[1];
          assert.equal(31005, errorObject.code);
          assert.equal('ConnectionError (31005): A connection error occurred during the call', errorObject.message);
        });
      });

      describe('on signaling.invite', () => {
        it('should not create a new call if already on an active call', async () => {
          await device.connect();
          pstream.emit('invite', { callsid: 'foo', sdp: 'bar' });
          await clock.tickAsync(0);
          assert.equal(device.calls.length, 0);
        });

        it('should emit an error and not create a new call if payload is missing callsid', () => {
          device.emit = sinon.spy();
          pstream.emit('invite', { sdp: 'bar' });
          assert.equal(device.calls.length, 0);
          sinon.assert.calledOnce(device.emit as any);
          sinon.assert.calledWith(device.emit as any, 'error');
        });

        it('should emit an error and not create a new call if payload is missing sdp', () => {
          device.emit = sinon.spy();
          pstream.emit('invite', { sdp: 'bar' });
          assert.equal(device.calls.length, 0);
          sinon.assert.calledOnce(device.emit as any);
          sinon.assert.calledWith(device.emit as any, 'error');
        });

        context('if not on an active call and payload is valid', () => {
          beforeEach(async () => {
            pstream.emit('invite', { callsid: 'foo', sdp: 'bar', parameters: { Params: 'foo=bar' } });
            await clock.tickAsync(0);
          });

          it('should not create a new call if not on an active call and payload is valid', () => {
            assert.equal(device.calls.length, 1);
          });

          it('should pass the custom parameters to the new call', () => {
            assert.deepEqual(connectOptions && connectOptions.twimlParams, { foo: 'bar' });
          });
        });

        it('should play the incoming sound if enabled', async () => {
          const spy = { play: sinon.spy() };
          device['_soundcache'].set(Device.SoundName.Incoming, spy);
          pstream.emit('invite', { callsid: 'foo', sdp: 'bar' });
          await clock.tickAsync(0);
          sinon.assert.calledOnce(spy.play);
        });

        it('should not play the incoming sound if disabled', async () => {
          enabledSounds[Device.SoundName.Incoming] = false;
          const spy = { play: sinon.spy() };
          device['_soundcache'].set(Device.SoundName.Incoming, spy);
          pstream.emit('invite', { callsid: 'foo', sdp: 'bar' });
          await clock.tickAsync(0);
          sinon.assert.notCalled(spy.play);
        });

        context('when allowIncomingWhileBusy is true', () => {
          beforeEach(async () => {
            device = new Device(token, { ...setupOptions, allowIncomingWhileBusy: true });
            await setupStream();
            await device.connect();
          });

          it('should create a new call', async () => {
            pstream.emit('invite', { callsid: 'foo', sdp: 'bar' });
            await clock.tickAsync(0);
            assert.equal(device.calls.length, 1);
            assert.notEqual(device.calls[0], device['_activeCall']);
          });

          it('should not play the incoming sound', async () => {
            const spy = { play: sinon.spy() };
            device['_soundcache'].set(Device.SoundName.Incoming, spy);
            pstream.emit('invite', { callsid: 'foo', sdp: 'bar' });
            await clock.tickAsync(0);
            sinon.assert.notCalled(spy.play);
          });
        });
      });

      describe('on signaling.offline', () => {
        it('should set "Device.state" to "Device.State.Unregistered"', () => {
          pstream.emit('offline');
          assert.equal(device.state, Device.State.Unregistered);
        });

        it(`should set Device edge to 'null'`, () => {
          pstream.emit('offline');
          assert.equal(device.edge, null);
        });

        it('should emit Device.EventName.Unregistered', () => {
          device['_state'] = Device.State.Registered;
          device.emit = sinon.spy();
          pstream.emit('offline');
          sinon.assert.calledOnce(device.emit as any);
          sinon.assert.calledWith(device.emit as any, Device.EventName.Unregistered);
        });
      });

      describe('on signaling.ready', () => {
        it('should emit Device.registered', () => {
          device.emit = sinon.spy();
          pstream.emit('ready');
          sinon.assert.calledOnce(device.emit as any);
          sinon.assert.calledWith(device.emit as any, 'registered');
        });
      });

      describe('with a pending incoming call', () => {
        let spyIncomingSound: any;
        beforeEach(async () => {
          spyIncomingSound = { play: sinon.spy(), stop: sinon.spy() };
          device['_soundcache'].set(Device.SoundName.Incoming, spyIncomingSound);

          const incomingPromise = new Promise<void>(resolve =>
            device.once(Device.EventName.Incoming, () => {
              device.emit = sinon.spy();
              device.calls[0].parameters = { };
              resolve();
            }),
          );

          pstream.emit('invite', {
            callsid: 'CA1234',
            sdp: 'foobar',
          });

          await incomingPromise;
        });

        describe('on call.accept', () => {
          it('should set the active call', () => {
            const call = device.calls[0];
            call.emit('accept');
            assert.equal(call, device['_activeCall']);
            assert(!device['_makeCallPromise']);
          });

          it('should remove the call', () => {
            device.calls[0].emit('accept');
            assert.equal(device.calls.length, 0);
          });

          it('should not play outgoing sound', () => {
            sinon.assert.calledOnce(spyIncomingSound.play);
            const spy: any = { play: sinon.spy() };
            device['_soundcache'].set(Device.SoundName.Outgoing, spy);
            device.calls[0].emit('accept');
            sinon.assert.notCalled(spy.play);
            sinon.assert.calledOnce(spyIncomingSound.stop);
          });

          it('should update the preferred uri', () => {
            sinon.assert.calledOnce(spyIncomingSound.play);
            pstream.emit('connected', { edge: 'sydney' });
            const spy: any = device['_stream'].updatePreferredURI =
              sinon.spy(device['_stream'].updatePreferredURI);
            const call = device.calls[0];
            call.emit('accept');
            sinon.assert.calledOnce(spy);
            sinon.assert.calledOnce(spyIncomingSound.stop);
          });

          it('should stop playing incoming sound', () => {
            sinon.assert.calledOnce(spyIncomingSound.play);
            device.calls[0].emit("disconnect");
            sinon.assert.calledOnce(spyIncomingSound.stop);
          });

          it('should emit audio processor enabled event if a localProcessedStream exists', async () => {
            device['_audio']!['_localProcessedStream'] = 'foo' as any;
            const callback = sinon.stub();
            device['_audioProcessorEventObserver']!.on('enabled', callback);
            const call = device.calls[0];
            call.emit('accept');
            sinon.assert.calledOnce(callback);
            sinon.assert.calledWithExactly(callback, false);
          });

          it('should not emit audio processor enabled event if a localProcessedStream does not exists', async () => {
            const callback = sinon.stub();
            device['_audioProcessorEventObserver']!.on('enabled', callback);
            const call = device.calls[0];
            call.emit('accept');
            sinon.assert.notCalled(callback);
          });

          it('should emit audio processor enabled event if a remoteProcessedStream exists', async () => {
            device['_audio']!['_remoteProcessedStream'] = 'foo' as any;
            const callback = sinon.stub();
            device['_audioProcessorEventObserver']!.on('enabled', callback);
            const call = device.calls[0];
            call.emit('accept');
            sinon.assert.calledOnce(callback);
            sinon.assert.calledWithExactly(callback, true);
          });

          it('should not emit audio processor enabled event if a remoteProcessedStream does not exists', async () => {
            const callback = sinon.stub();
            device['_audioProcessorEventObserver']!.on('enabled', callback);
            const call = device.calls[0];
            call.emit('accept');
            sinon.assert.notCalled(callback);
          });
        });

        describe('on call.error', () => {
          it('should remove the call if closed', () => {
            device.calls[0].status = () => CallType.State.Closed;
            device.calls[0].emit('error');
            assert.equal(device.calls.length, 0);
          });

          it('should unset the preferred uri if the call was closed', () => {
            const spy: any = device['_stream'].updatePreferredURI =
              sinon.spy(device['_stream'].updatePreferredURI);
            device.calls[0].status = () => CallType.State.Closed;
            device.calls[0].emit('error');
            sinon.assert.calledOnceWithExactly(spy, null);
          });

          it('should stop playing incoming sound', () => {
            sinon.assert.calledOnce(spyIncomingSound.play);
            device.calls[0].status = () => CallType.State.Closed;
            device.calls[0].emit('error');
            sinon.assert.calledOnce(spyIncomingSound.stop);
          });

          it('should not unset the preferred uri if stream is null', () => {
            const spy: any = device['_stream'].updatePreferredURI =
              sinon.spy(device['_stream'].updatePreferredURI);

            device['_stream'] = null;
            device.calls[0].status = () => CallType.State.Closed;
            device.calls[0].emit('error');
            sinon.assert.notCalled(spy);
          });
        });

        describe('on call.transportClose', () => {
          it('should remove the call if the call was pending', () => {
            device.calls[0].status = () => CallType.State.Pending;
            device.calls[0].emit('transportClose');
            assert.equal(device.calls.length, 0);
          });
          it('should not remove the call if the call was open', () => {
            device.calls[0].status = () => CallType.State.Open;
            device.calls[0].emit('transportClose');
            assert.equal(device.calls.length, 1);
          });
          it('should stop playing incoming sound', () => {
            sinon.assert.calledOnce(spyIncomingSound.play);
            device.calls[0].status = () => CallType.State.Pending;
            device.calls[0].emit('transportClose');
            sinon.assert.calledOnce(spyIncomingSound.stop);
          });
        });

        describe('on call.disconnect', () => {
          it('should remove call from activeDevice', () => {
            const call = device.calls[0];
            call.emit('accept');
            assert.equal(typeof call, 'object');
            assert.equal(call, device['_activeCall']);
            assert(!device['_makeCallPromise']);

            call.emit('disconnect');
            assert.equal(device['_activeCall'], null);
            assert.equal(device['_makeCallPromise'], null);
          });

          it('should unset the preferred uri', () => {
            const spy: any = device['_stream'].updatePreferredURI =
              sinon.spy(device['_stream'].updatePreferredURI);
            device.calls[0].emit('disconnect');
            sinon.assert.calledOnceWithExactly(spy, null);
          });

          it('should stop playing incoming sound', () => {
            sinon.assert.calledOnce(spyIncomingSound.play);
            device.calls[0].emit('disconnect');
            sinon.assert.calledOnce(spyIncomingSound.stop);
          });
        });

        describe('on call.reject', () => {
          it('should remove the call', () => {
            device.calls[0].emit('reject');
            assert.equal(device.calls.length, 0);
          });

          it('should unset the preferred uri', () => {
            const spy: any = device['_stream'].updatePreferredURI =
              sinon.spy(device['_stream'].updatePreferredURI);
            device.calls[0].emit('reject');
            sinon.assert.calledOnceWithExactly(spy, null);
          });

          it('should stop playing incoming sound', () => {
            sinon.assert.calledOnce(spyIncomingSound.play);
            device.calls[0].emit('reject');
            sinon.assert.calledOnce(spyIncomingSound.stop);
          });
        });
      });

      describe('with multiple calls', () => {
        let call1: any;
        let call2: any;

        beforeEach(async () => {
          device = new Device(token, {
            ...setupOptions,
            allowIncomingWhileBusy: true,
          });
          await setupStream();

          const nextCallPromise = () => new Promise<any>(resolve => {
            device.once(Device.EventName.Incoming, c => {
              resolve(c);
            });
          });

          const call1Promise = nextCallPromise();
          pstream.emit('invite', {
            callsid: 'CA1234',
            sdp: 'foobar',
          });
          call1 = await call1Promise;
          call1.emit('accept');
          await clock.tickAsync(0);

          const call2Promise = nextCallPromise();
          pstream.emit('invite', {
            callsid: 'CA5678',
            sdp: 'biffbazz',
          });
          call2 = await call2Promise;

          assert(device.calls.length === 1);
        });

        describe('on call.error', () => {
          it('should not unset the preferred uri even if the call was closed', () => {
            const spy: any = device['_stream'].updatePreferredURI =
              sinon.spy(device['_stream'].updatePreferredURI);
            call1.status = () => CallType.State.Closed;
            call1.emit('error');
            sinon.assert.notCalled(spy);
          });
        });

        describe('on call.disconnect', () => {
          it('should not unset the preferred uri', () => {
            const spy: any = device['_stream'].updatePreferredURI =
              sinon.spy(device['_stream'].updatePreferredURI);
            call1.emit('disconnect');
            sinon.assert.notCalled(spy);
          });
        });

        describe('on call.reject', () => {
          it('should not unset the preferred uri', () => {
            const spy: any = device['_stream'].updatePreferredURI =
              sinon.spy(device['_stream'].updatePreferredURI);
            call1.parameters = { CallSid: 'foobar' };
            call1.emit('reject');
            sinon.assert.notCalled(spy);
          });
        });
      });

      describe('Device.audio hooks', () => {
        describe('updateInputStream', () => {
          it('should reject if a call is active and input stream is null', async () => {
            await device.connect();

            return updateInputStream(null).then(
              () => { throw new Error('Expected rejection'); },
              () => { });
          });

          it('should return a resolved Promise if there is no active call', () => {
            return updateInputStream(null);
          });

          it('should call the call._setInputTracksFromStream', async () => {
            const info = { id: 'default', label: 'default' };
            await device.connect();
            activeCall._setInputTracksFromStream = sinon.spy(() => Promise.resolve());
            return updateInputStream(info).then(() => {
              sinon.assert.calledOnce(activeCall._setInputTracksFromStream);
              sinon.assert.calledWith(activeCall._setInputTracksFromStream, info);
            });
          });
        });

        describe('updateSinkIds', () => {
          context(`when type is 'speaker'`, () => {
            it('should call setSinkIds on all sounds except incoming', () => {
              const sinkIds = ['default'];
              updateSinkIds('speaker', sinkIds);
              Object.values(Device.SoundName)
                .filter((name: Device.SoundName) => name !== Device.SoundName.Incoming)
                .forEach((name: Device.SoundName) => {
                  sinon.assert.calledOnce(sounds[name].setSinkIds);
                  sinon.assert.calledWith(sounds[name].setSinkIds, sinkIds);
                });
            });

            it('should call _setSinkIds on the active call', async () => {
              await device.connect();
              const sinkIds = ['default'];
              activeCall._setSinkIds = sinon.spy(() => Promise.resolve());
              updateSinkIds('speaker', sinkIds);
              sinon.assert.calledOnce(activeCall._setSinkIds);
              sinon.assert.calledWith(activeCall._setSinkIds, sinkIds);
            });

            context('if successful', () => {
              let sinkIds: string[];
              beforeEach(async () => {
                await device.connect();
                sinkIds = ['default'];
                activeCall._setSinkIds = sinon.spy(() => Promise.resolve());
                return updateSinkIds('speaker', sinkIds);
              });

              it('should publish a speaker-devices-set event', () => {
                sinon.assert.calledTwice(publisher.info);
                sinon.assert.calledWith(publisher.info, 'audio', 'speaker-devices-set',
                  { audio_device_ids: sinkIds });
              });
            });

            context('if unsuccessful', () => {
              let sinkIds: string[];
              beforeEach(async () => {
                await device.connect();
                sinkIds = ['default'];
                activeCall._setSinkIds = sinon.spy(() => Promise.reject(new Error('foo')));
                return updateSinkIds('speaker', sinkIds).then(
                  () => { throw Error('Expected a rejection'); },
                  () => Promise.resolve());
              });

              it('should publish a speaker-devices-set event', () => {
                sinon.assert.calledOnce(publisher.error);
                sinon.assert.calledWith(publisher.error, 'audio', 'speaker-devices-set-failed',
                  { audio_device_ids: sinkIds, message: 'foo' });
              });
            });
          });

          context(`when type is 'ringtone'`, () => {
            it('should call setSinkIds on incoming', () => {
              const sinkIds = ['default'];
              updateSinkIds('ringtone', sinkIds);
              sinon.assert.calledOnce(sounds[Device.SoundName.Incoming].setSinkIds);
              sinon.assert.calledWith(sounds[Device.SoundName.Incoming].setSinkIds, sinkIds);
            });

            context('if successful', () => {
              let sinkIds: string[];
              beforeEach(async () => {
                await device.connect();
                sinkIds = ['default'];
                activeCall._setSinkIds = sinon.spy(() => Promise.resolve());
                return updateSinkIds('ringtone', sinkIds);
              });

              it('should publish a ringtone-devices-set event', () => {
                sinon.assert.calledTwice(publisher.info);
                sinon.assert.calledWith(publisher.info, 'audio', 'ringtone-devices-set',
                  { audio_device_ids: sinkIds });
              });
            });
          });
        });
      });
    });

    describe('before the Device has been connected to signaling', () => {
      it('should lazy create a signaling call', () => {
        assert.equal(device['_stream'], null);
      });

      describe('insights gateway', () => {
        beforeEach(() => {
          publisher.setHost = sinon.stub();
        });

        it('should not set host address before signaling is connected', () => {
          sinon.assert.notCalled(publisher.setHost);
        });
      });

      describe('.connect()', () => {
        it('should set up a signaling call if necessary', () => {
          device.connect();
          sinon.assert.calledOnce(PStream);
          sinon.assert.calledWith(PStream, token);
        });

        it('should not set the active call until the stream resolves', async () => {
          const connectPromise = device.connect();
          assert.equal(device['_activeCall'], null);
          assert(device['_makeCallPromise']);
          pstream.emit('connected', { region: 'US_EAST_VIRGINIA' });
          await connectPromise;
          assert(device['_activeCall']);
          assert(!device['_makeCallPromise']);
        });
      });

      describe('.edge', () => {
        it(`should return 'null' if not connected`, () => {
          assert.equal(device.edge, null);
        });
      });

      describe('.register()', () => {
        it('should set up a signaling connection if necessary', () => {
          device.register();
          sinon.assert.calledOnce(PStream);
          sinon.assert.calledWith(PStream, token);
        });

        it('should set state to "registering" until the stream resolves', () => {
          device.register();
          assert.equal(device.state, Device.State.Registering);
        });

        it('should set state to "registered" after the stream resolves', async () => {
          const regPromise = device.register();
          await clock.tickAsync(0);

          pstream.emit('connected', { region: 'US_EAST_VIRGINIA' });
          await clock.tickAsync(0);

          pstream.emit('ready');
          await clock.tickAsync(0);

          await regPromise;

          assert.equal(device.state, Device.State.Registered);
        });
      });

      describe('.updateOptions()', () => {
        it('should not create a stream', async () => {
          const setupSpy = device['_setupStream'] = sinon.spy(device['_setupStream']);
          device.updateOptions();
          await new Promise<void>(resolve => {
            sinon.assert.notCalled(setupSpy);
            resolve();
          });
        });
      });

      describe('.updateToken()', () => {
        it('should set the token', () => {
          const newToken = 'foobar-token';
          device.updateToken(newToken);
          assert.equal(device.token, newToken);
        });
      });
    });

    describe('when creating a signaling connection', () => {
      const testWithOptions = async (options: Record<any, any>) => {
        device = new Device(token, { ...setupOptions, ...options });
        await setupStream();
      };

      describe('should use chunderw regardless', () => {
        it('when it is a string', async () => {
          await testWithOptions({ chunderw: 'foo' });
          sinon.assert.calledOnceWithExactly(
            PStream,
            token,
            ['wss://foo/signal'],
            {
              backoffMaxMs: undefined,
              maxPreferredDurationMs: 0,
            },
          );
        });

        it('when it is an array', async () => {
          await testWithOptions({ chunderw: ['foo', 'bar'] });
          sinon.assert.calledOnceWithExactly(
            PStream,
            token,
            ['wss://foo/signal', 'wss://bar/signal'],
            {
              backoffMaxMs: undefined,
              maxPreferredDurationMs: 0,
            },
          );
        });
      });

      it('should use default chunder uri if no region or edge is passed in', async () => {
        await setupStream();
        sinon.assert.calledOnceWithExactly(
          PStream,
          token,
          ['wss://voice-js.roaming.twilio.com/signal'],
          {
            backoffMaxMs: undefined,
            maxPreferredDurationMs: 0,
          },
        );
      });

      it('should use correct edge if only one is supplied', async () => {
        await testWithOptions({ edge: 'singapore' });
        sinon.assert.calledOnceWithExactly(
          PStream,
          token,
          ['wss://voice-js.singapore.twilio.com/signal'],
          {
            backoffMaxMs: undefined,
            maxPreferredDurationMs: 0,
          },
        );
      });

      it('should use correct edges if more than one is supplied', async () => {
        await testWithOptions({ edge: ['singapore', 'sydney'] });
        sinon.assert.calledOnceWithExactly(
          PStream,
          token,
          [
            'wss://voice-js.singapore.twilio.com/signal',
            'wss://voice-js.sydney.twilio.com/signal',
          ],
          {
            backoffMaxMs: undefined,
            maxPreferredDurationMs: 0,
          },
        );
      });

      it('should propagate the signaling reconnection limit', async () => {
        await testWithOptions({ maxCallSignalingTimeoutMs: 5 });
        sinon.assert.calledOnceWithExactly(
          PStream,
          token,
          ['wss://voice-js.roaming.twilio.com/signal'],
          {
            backoffMaxMs: undefined,
            maxPreferredDurationMs: 5,
          },
        );
      });
    });

    describe('signaling agnostic', () => {
      [{
        afterEachHook: () => async () => {
          sinon.assert.calledOnce(PStream);
        },
        beforeEachHook: () => setupStream(),
        title: 'signaling connected',
      }, {
        afterEachHook: async () => {},
        beforeEachHook: async () => {},
        title: 'signaling not connected',
      }].forEach(({ afterEachHook, beforeEachHook, title }) => {
        describe(title, () => {
          beforeEach(beforeEachHook);

          afterEach(afterEachHook);

          describe('.connect()', () => {
            it('should throw if the device is destroyed', () => {
              device.destroy();
              assert.rejects(() => device.connect());
            });
          });

          describe('.destroy()', () => {
            it('should set the state to destroyed', () => {
              device.destroy();
              assert.equal(device.state, Device.State.Destroyed);
            });

            it('should emit an event', () => {
              const destroyListener = sinon.stub();
              device.on(Device.EventName.Destroyed, destroyListener);
              device.destroy();
              sinon.assert.calledOnce(destroyListener);
            });
          });

          describe('.register()', () => {
            it('should throw if the device is destroyed', () => {
              device.destroy();
              assert.rejects(() => device.register());
            });
          });

          describe('.unregister()', () => {
            it('should throw if the device is destroyed', () => {
              device.destroy();
              assert.rejects(() => device.unregister());
            });
          });

          describe('.updateOptions()', () => {
            it('should throw if the device is destroyed', () => {
              device.destroy();
              assert.throws(() => device.updateOptions());
            });
          });

          describe('.updateToken()', () => {
            it('should throw if the device is destroyed', () => {
              device.destroy();
              assert.throws(() => device.updateToken(''));
            });
          });

          describe('._setState(state?)', () => {
            const eventStates: Array<[Device.EventName, Device.State, Device.State]> = [
              [Device.EventName.Unregistered, Device.State.Registered, Device.State.Unregistered],
              [Device.EventName.Registering, Device.State.Unregistered, Device.State.Registering],
              [Device.EventName.Registered, Device.State.Registering, Device.State.Registered],
            ];

            eventStates.forEach(([event, preState, postState]) => {
              it(`should emit "${event}" when transitioning from "${preState}" to "${postState}"`, () => {
                device['_state'] = preState;

                const spy = device.emit = sinon.spy(device.emit);
                device['_setState'](postState);
                sinon.assert.calledOnceWithExactly(spy, event);
              });
            });
          });

          describe('._setupAudioHelper()', () => {
            it('should create audioProcessorEventObserver once', () => {
              const audioProcessorEventObserver = device['_audioProcessorEventObserver'];
              device['_setupAudioHelper']();
              assert.strictEqual(device['_audioProcessorEventObserver'], audioProcessorEventObserver);
            });

            it('should create audioHelper once', () => {
              const audio = device['_audio'];
              device['_setupAudioHelper']();
              assert.strictEqual(device['_audio'], audio);
            });

            it('should update audioHelper options', () => {
              const stub = sinon.stub();
              device['_audio']!['_updateUserOptions'] = stub;
              device['_options'].enumerateDevices = 'foo';
              device['_options'].getUserMedia = 'bar';
              device['_setupAudioHelper']();
              assert.deepEqual(stub.getCall(0).args[0].audioContext, Device.audioContext);
              assert.deepEqual(stub.getCall(0).args[0].audioProcessorEventObserver, device['_audioProcessorEventObserver']);
              assert.deepEqual(stub.getCall(0).args[0].enumerateDevices, 'foo');
              assert.deepEqual(stub.getCall(0).args[0].getUserMedia, 'bar');
            });

            it(`should wait for makeCallPromise if there's an active call`, async () => {
              const stub = sinon.stub();
              device['_audio']!['_updateUserOptions'] = stub;
              device['_setupAudioHelper']();
              device.connect();
              assert.deepEqual(stub.getCall(0).args[0].beforeSetInputDevice(), device['_makeCallPromise']);
            });

            it(`should use a default Promise if there's no active call`, async () => {
              const stub = sinon.stub();
              device['_audio']!['_updateUserOptions'] = stub;
              device['_setupAudioHelper']();
              assert.deepEqual(stub.getCall(0).args[0].beforeSetInputDevice(), Promise.resolve());
            });
          });

          describe('.state', () => {
            it('should return "unregistered" before registering', () => {
              assert.equal(device.state, Device.State.Unregistered);
            });
          });

          describe('on device change', () => {
            it('should publish a device-change event', () => {
              device.audio?.emit('deviceChange', [{ deviceId: 'foo' }]);
              sinon.assert.calledOnce(publisher.info);
              sinon.assert.calledWith(publisher.info, 'audio', 'device-change', {
                lost_active_device_ids: ['foo'],
              });
            });
          });

          describe('createDefaultPayload', () => {
            xit('should be tested', () => {
              // This should be moved somewhere that it can be tested. This is currently:
              // A) Internal to Device where it can't easily be tested and
              // B) Reaching into Call, causing a weird coupling.
            });
          });

          describe('on unload or pagehide', () => {
            it('should call destroy once on pagehide', () => {
              stub = sinon.createStubInstance(Device);
              Device.prototype.constructor.call(stub, token);
              root.window.dispatchEvent('pagehide');
              sinon.assert.calledOnce(stub.destroy);
            });

            it('should call destroy once on unload', () => {
              stub = sinon.createStubInstance(Device);
              Device.prototype.constructor.call(stub, token);
              root.window.dispatchEvent('unload');
              sinon.assert.calledOnce(stub.destroy);
            });
          });
        });
      });
    });
  });
});

/**
 * Create a stub and mixin the EventEmitter functions. All methods are replaced with stubs,
 * except the EventEmitter functionality, which works as expected.
 * @param BaseClass - The base class to stub.
 * @returns A stubbed instance with EventEmitter mixed in.
 */
function createEmitterStub(BaseClass: any): SinonStubbedInstance<any> {
  const stub: SinonStubbedInstance<any> = sinon.createStubInstance(BaseClass);

  Object.getOwnPropertyNames(EventEmitter.prototype).forEach((name: string) => {
    const property = (EventEmitter.prototype as any)[name];
    if (typeof property !== 'function') { return; }
    stub[name] = property.bind(stub);
  });

  EventEmitter.constructor.call(stub);
  return stub;
}

/**
 * Create a Capability Token.
 * @param identity
 * @returns A Cap Token JWT.
 */
function createToken(identity: string): string {
  const token = new ClientCapability({
    accountSid: 'AC1234567890123456789012',
    authToken: 'authToken',
  });

  token.addScope(new ClientCapability.OutgoingClientScope({
    applicationSid: 'AP123',
    clientName: identity,
  }));

  token.addScope(new ClientCapability.IncomingClientScope(identity));
  return token.toJwt();
}
