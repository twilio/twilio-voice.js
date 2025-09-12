import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { TwilioError } from '../../lib/twilio/errors';
import { PreflightTest } from '../../lib/twilio/preflight/preflight';
import { EventEmitter } from 'events';
import { SinonFakeTimers } from 'sinon';
import * as assert from 'assert';
import * as sinon from 'sinon';
import { inherits } from 'util';
import RTCSample from '../../lib/twilio/rtc/sample';

describe('PreflightTest', () => {
  const CALL_SID = 'foo-bar';

  let clock: SinonFakeTimers;
  let call: any;
  let callContext: any;
  let device: any;
  let deviceFactory: any;
  let deviceContext: any;
  let rtcIceCandidateStatsReport: any;
  let options: any;
  let monitor: any;
  let publisher: any;
  let testSamples: any;
  let edgeStub: any;
  let wait: any;

  const getDeviceFactory = (context: any) => {
    const factory = function(
      this: any,
      token: string,
      options: PreflightTest.Options,
    ) {
      Object.assign(this, context);
      this.updateToken(token);
      this.updateOptions(options);
      device = this;
    };
    inherits(factory, EventEmitter);
    return factory;
  };

  const getTestSamples = () => {
    const totalSampleCount = 15;
    const samples: any[] = [];
    let total = 0;

    for (let i = 0; i < totalSampleCount; i++) {
      const val = i+1;
      total += val;
      samples.push({
        mos: val,
        jitter: val,
        rtt: val,
        totals: {
          foo: total
        }
      });
    }

    return samples;
  };

  beforeEach(() => {
    clock = sinon.useFakeTimers();

    wait = () => new Promise(r => {
      setTimeout(r, 1);
      clock.tick(1);
    });

    monitor = new EventEmitter();
    monitor._thresholds = {
      audioInputLevel: { maxDuration: 10 },
      audioOutputLevel: { maxDuration: 10 }
    };

    publisher = new EventEmitter();

    const outputs = new Map();
    outputs.set('default', { audio: {} });
    outputs.set('foo', { audio: {} });
    callContext = {
      _mediaHandler: {
        callSid: CALL_SID,
        version: { pc: {} },
        onpcconnectionstatechange: sinon.stub(),
        oniceconnectionstatechange: sinon.stub(),
        ondtlstransportstatechange: sinon.stub(),
        onsignalingstatechange: sinon.stub(),
        outputs,
      },
      _monitor: monitor,
      _publisher: publisher,
    };
    call = new EventEmitter();
    Object.assign(call, callContext);

    deviceContext = {
      audio: {
        disconnect: sinon.stub(),
        outgoing: sinon.stub(),
      },
      connect: sinon.stub().returns(Promise.resolve(call)),
      destroy: sinon.stub(),
      disconnectAll: sinon.stub(),
      edge: null,
      region: sinon.stub().returns('foobar-region'),
      register: sinon.stub().returns(Promise.resolve()),
      updateOptions: sinon.stub(),
      updateToken: sinon.stub(),
    };
    edgeStub = sinon.stub().returns('foobar-edge');
    sinon.stub(deviceContext, 'edge').get(edgeStub);
    deviceFactory = getDeviceFactory(deviceContext);
    rtcIceCandidateStatsReport = {
      iceCandidateStats: ['foo', 'bar'],
      selectedIceCandidatePairStats: {
        localCandidate: { candidateType: 'host' },
        remoteCandidate: { candidateType: 'host' },
      }
    };

    options = {
      deviceFactory,
      getRTCIceCandidateStatsReport: () => Promise.resolve(rtcIceCandidateStatsReport),
    };

    testSamples = getTestSamples();
  });

  afterEach(() => {
    clock.restore();
  });

  describe('constructor', () => {
    it('should pass defaults to device', () => {
      const preflight = new PreflightTest('foo', options);
      sinon.assert.calledOnceWithExactly(deviceContext.updateOptions, {
        chunderw: undefined,
        codecPreferences: [Call.Codec.PCMU, Call.Codec.Opus],
        edge: 'roaming',
        eventgw: undefined,
        fileInputStream: undefined,
        logLevel: 'error',
        preflight: true,
      });
    });

    it('should pass codecPreferences to device', () => {
      options.codecPreferences = [Call.Codec.PCMU];
      const preflight = new PreflightTest('foo', options);
      sinon.assert.calledOnceWithExactly(deviceContext.updateOptions, {
        chunderw: undefined,
        codecPreferences: options.codecPreferences,
        edge: 'roaming',
        eventgw: undefined,
        fileInputStream: undefined,
        logLevel: 'error',
        preflight: true,
      });
    });

    it('should pass logLevel to device', () => {
      options.logLevel = 'debug';
      const preflight = new PreflightTest('foo', options);
      sinon.assert.calledOnceWithExactly(deviceContext.updateOptions, {
        chunderw: undefined,
        codecPreferences: [Call.Codec.PCMU, Call.Codec.Opus],
        edge: 'roaming',
        eventgw: undefined,
        fileInputStream: undefined,
        logLevel: options.logLevel,
        preflight: true,
      });
    });

    it('should pass edge to device', () => {
      options.edge = 'ashburn';
      const preflight = new PreflightTest('foo', options);
      sinon.assert.calledOnceWithExactly(deviceContext.updateOptions, {
        chunderw: undefined,
        codecPreferences: [Call.Codec.PCMU, Call.Codec.Opus],
        edge: options.edge,
        eventgw: undefined,
        fileInputStream: undefined,
        logLevel: 'error',
        preflight: true,
      });
      sinon.assert.calledOnce(edgeStub);
    });

    it('should pass rtcConfiguration to device', () => {
      options.rtcConfiguration = {foo: 'foo', iceServers: 'bar'};
      const preflight = new PreflightTest('foo', options);
      sinon.assert.calledWith(deviceContext.updateOptions, {
        chunderw: undefined,
        codecPreferences: [Call.Codec.PCMU, Call.Codec.Opus],
        edge: 'roaming',
        eventgw: undefined,
        fileInputStream: undefined,
        logLevel: 'error',
        preflight: true,
      });
    });

    it('should pass chunderw to device', () => {
      options.chunderw = 'foobar';
      new PreflightTest('token', options);
      sinon.assert.calledWith(deviceContext.updateOptions, {
        chunderw: 'foobar',
        codecPreferences: [Call.Codec.PCMU, Call.Codec.Opus],
        edge: 'roaming',
        eventgw: undefined,
        fileInputStream: undefined,
        logLevel: 'error',
        preflight: true,
      });
    });

    it('should pass eventgw to device', () => {
      options.eventgw = 'foobar';
      new PreflightTest('token', options);
      sinon.assert.calledWith(deviceContext.updateOptions, {
        chunderw: undefined,
        codecPreferences: [Call.Codec.PCMU, Call.Codec.Opus],
        edge: 'roaming',
        eventgw: 'foobar',
        fileInputStream: undefined,
        logLevel: 'error',
        preflight: true,
      });
    });
  });

  describe('fakeMicInput', () => {
    let preflight: PreflightTest;
    let originalAudio: any;
    let audioInstance: any;
    let stream: any;
    const root = global as any;

    beforeEach(() => {
      originalAudio = root.Audio;
      stream = { name: 'foo' };
      root.Audio = function() {
        this.addEventListener = (name: string, handler: Function) => {
          handler();
        };
        this.play = sinon.stub();
        this.setAttribute = sinon.stub();
        audioInstance = this;
      };
      options.audioContext = {
        createMediaElementSource: () => ({connect: sinon.stub()}),
        createMediaStreamDestination: () => ({stream}),
      };
    });

    afterEach(() => {
      root.Audio = originalAudio;
    });

    it('should throw if no AudioContext is found', () => {
      options.audioContext = null;
      assert.throws(() => { new PreflightTest('foo', {...options, fakeMicInput: true }) });
    });

    it('should set fakeMicInput to false by default', () => {
      preflight = new PreflightTest('foo', options);
      sinon.assert.calledOnceWithExactly(deviceContext.updateOptions, {
        chunderw: undefined,
        codecPreferences: [Call.Codec.PCMU, Call.Codec.Opus],
        edge: 'roaming',
        eventgw: undefined,
        fileInputStream: undefined,
        logLevel: 'error',
        preflight: true,
      });
      sinon.assert.calledOnceWithExactly(deviceContext.register);
    });

    it('should pass file input if fakeMicInput is true', async () => {
      preflight = new PreflightTest('foo', {...options, fakeMicInput: true });
      await clock.tickAsync(1000);
      sinon.assert.calledOnceWithExactly(deviceContext.updateOptions, {
        chunderw: undefined,
        codecPreferences: [Call.Codec.PCMU, Call.Codec.Opus],
        edge: 'roaming',
        eventgw: undefined,
        fileInputStream: stream,
        logLevel: 'error',
        preflight: true,
      });
      sinon.assert.calledOnceWithExactly(deviceContext.register);
    });

    it('should call play', () => {
      preflight = new PreflightTest('foo', {...options, fakeMicInput: true });
      sinon.assert.calledOnce(audioInstance.play);
    });

    it('should set cross origin', () => {
      preflight = new PreflightTest('foo', {...options, fakeMicInput: true });
      sinon.assert.calledOnce(audioInstance.setAttribute);
      sinon.assert.calledWithExactly(audioInstance.setAttribute, 'crossorigin', 'anonymous');
    });

    it('should mute device sounds', async () => {
      preflight = new PreflightTest('foo', {...options, fakeMicInput: true });
      device.emit(Device.EventName.Registered);
      await clock.tickAsync(1000);
      sinon.assert.calledOnce(deviceContext.audio.disconnect);
      sinon.assert.calledOnce(deviceContext.audio.outgoing);
      sinon.assert.calledWithExactly(deviceContext.audio.disconnect, false);
      sinon.assert.calledWithExactly(deviceContext.audio.outgoing, false);
    });

    it('should end test after echo duration', async () => {
      preflight = new PreflightTest('foo', {...options, fakeMicInput: true });
      device.emit(Device.EventName.Registered);
      await clock.tickAsync(19000);
      sinon.assert.notCalled(deviceContext.disconnectAll);
      await clock.tickAsync(1000);
      sinon.assert.calledOnce(deviceContext.disconnectAll);
    });

    it('should not start timer if fakeMicInput is false', async () => {
      preflight = new PreflightTest('foo', options);
      device.emit(Device.EventName.Registered);
      await clock.tickAsync(19000);
      sinon.assert.notCalled(deviceContext.disconnectAll);
      await clock.tickAsync(20000);
      sinon.assert.notCalled(deviceContext.disconnectAll);
    });

    it('should clear echo timer on completed', async () => {
      preflight = new PreflightTest('foo', {...options, fakeMicInput: true });

      device.emit(Device.EventName.Registered);
      await clock.tickAsync(1000);
      call.emit('sample', testSamples[0]);
      await clock.tickAsync(1000);

      await clock.tickAsync(5000);
      call.emit('disconnect');
      await clock.tickAsync(1000);
      device.emit(Device.EventName.Unregistered);

      await clock.tickAsync(20000);
      sinon.assert.notCalled(deviceContext.disconnectAll);
    });

    it('should clear echo timer on failed', async () => {
      preflight = new PreflightTest('foo', {...options, fakeMicInput: true });

      device.emit(Device.EventName.Registered);
      await clock.tickAsync(5000);
      preflight.stop();
      device.emit(Device.EventName.Unregistered);
      await clock.tickAsync(20000);
      sinon.assert.notCalled(deviceContext.disconnectAll);
    });

    it('should not mute media stream if fakeMicInput is false', async () => {
      preflight = new PreflightTest('foo', options);

      device.emit(Device.EventName.Registered);
      await clock.tickAsync(1000);
      call.emit('volume');
      await clock.tickAsync(1000);
      assert(!callContext['_mediaHandler'].outputs.get('default').audio.muted);
      assert(!callContext['_mediaHandler'].outputs.get('foo').audio.muted);
    });

    it('should mute media stream if fakeMicInput is true', async () => {
      preflight = new PreflightTest('foo', {...options, fakeMicInput: true });

      device.emit(Device.EventName.Registered);
      await clock.tickAsync(1000);
      call.emit('volume');
      await clock.tickAsync(1000);
      assert(callContext['_mediaHandler'].outputs.get('default').audio.muted);
      assert(callContext['_mediaHandler'].outputs.get('foo').audio.muted);
    });
  });

  describe('on sample', () => {
    it('should emit samples', async () => {
      const onSample = sinon.stub();
      const preflight = new PreflightTest('foo', options);
      preflight.on('sample', onSample);
      device.emit(Device.EventName.Registered);
      await clock.tickAsync(1000);

      const count = 10;
      const sample = {foo: 'foo', bar: 'bar', mos: 1};
      for (let i = 1; i <= count; i++) {
        const data = {...sample, count: i};
        call.emit('sample', data);
        await clock.tickAsync(1000);
        sinon.assert.callCount(onSample, i);
        sinon.assert.calledWithExactly(onSample, data);
        assert.deepEqual(preflight.latestSample, data)
      }
    });
  });

  describe('on warning', () => {
    let preflight: PreflightTest;
    beforeEach(() => {
      preflight = new PreflightTest('foo', options);
    });

    it('should emit warning', async () => {
      const onWarning = sinon.stub();
      preflight.on('warning', onWarning);
      device.emit(Device.EventName.Registered);
      await clock.tickAsync(1000);

      const data = {foo: 'foo', bar: 'bar'};

      call.emit('warning', 'foo', data);
      await clock.tickAsync(1000);

      sinon.assert.calledOnce(onWarning);
      sinon.assert.calledWithExactly(onWarning, {
        description: 'Received an RTCWarning. See .rtcWarning for the RTCWarning',
        name: 'foo',
        rtcWarning: { bar: 'bar', foo: 'foo' },
      });
    });

    it('should emit a warning the first time Insights fails to publish', async () => {
      const onWarning = sinon.stub();
      preflight.on('warning', onWarning);
      device.emit(Device.EventName.Registered);
      await clock.tickAsync(1000);

      publisher.emit('error');
      await clock.tickAsync(1000);
      sinon.assert.calledOnce(onWarning);
      sinon.assert.calledWithExactly(onWarning, {
        description: 'Received an error when attempting to connect to Insights gateway',
        name: 'insights-connection-error',
      });

      publisher.emit('error');
      await clock.tickAsync(1000);
      sinon.assert.calledOnce(onWarning);
    });
  });

  describe('on connected', () => {
    it('should emit connected', async () => {
      const onConnected = sinon.stub();
      const preflight = new PreflightTest('foo', options);

      preflight.on('connected', onConnected);
      device.emit(Device.EventName.Registered);
      await clock.tickAsync(1000);

      call.emit('accept');
      await clock.tickAsync(1000);
      assert.equal(preflight.status, PreflightTest.Status.Connected);
      sinon.assert.calledOnce(onConnected);
    });

    it('should populate callsid', async () => {
      const preflight = new PreflightTest('foo', options);
      device.emit(Device.EventName.Registered);
      await clock.tickAsync(1000);
      call.emit('accept');
      await clock.tickAsync(1000);

      assert.equal(preflight.callSid, CALL_SID);
    });

    it('should clear singaling timeout timer', async () => {
      const onFailed = sinon.stub();
      const preflight = new PreflightTest('foo', options);

      preflight.on('failed', onFailed);
      device.emit(Device.EventName.Registered);
      await clock.tickAsync(15000);

      sinon.assert.notCalled(onFailed);
    });
  });

  describe('on completed and destroy device', () => {
    let preflight: PreflightTest;

    beforeEach(() => {
      preflight = new PreflightTest('foo', options);
      preflight['_rtcIceCandidateStatsReport'] = rtcIceCandidateStatsReport;
    });

    it('should clear signaling timeout timer', async () => {
      const onFailed = sinon.stub();
      preflight.on('failed', onFailed);

      device.emit(Device.EventName.Registered);
      await clock.tickAsync(5000);
      call.emit('disconnect');
      await clock.tickAsync(1000);
      device.emit(Device.EventName.Unregistered);

      await clock.tickAsync(15000);
      sinon.assert.notCalled(onFailed);
    });

    it('should end call after device disconnects', async () => {
      const onCompleted = sinon.stub();
      preflight.on('completed', onCompleted);
      device.emit(Device.EventName.Registered);
      await clock.tickAsync(14000);
      call.emit('disconnect');
      await clock.tickAsync(1000);
      device.emit(Device.EventName.Unregistered);
      await clock.tickAsync(10);

      // endTime - startTime = duration. Should be equal to the total clock ticks
      assert(preflight.endTime! - preflight.startTime === 15010);
      sinon.assert.calledOnce(deviceContext.destroy);
      sinon.assert.called(onCompleted);
    });

    it('should release all handlers', async () => {
      const onCompleted = sinon.stub();
      preflight.on('completed', onCompleted);
      device.emit(Device.EventName.Registered);
      await clock.tickAsync(14000);
      call.emit('disconnect');
      await clock.tickAsync(1000);
      device.emit(Device.EventName.Unregistered);
      await clock.tickAsync(1000);
      assert.equal(device.eventNames().length, 0);
      assert.equal(call.eventNames().length, 0);
    });

    it('should provide report', () => {
      return new Promise<void>(async (resolve) => {
        clock.reset();
        const warningData = {foo: 'foo', bar: 'bar'};

        assert.equal(preflight.status, PreflightTest.Status.Connecting);

        const onCompleted = (results: PreflightTest.Report) => {
          // This is derived from testSamples
          const expected = {
            callSid: CALL_SID,
            edge: 'foobar-edge',
            iceCandidateStats: [ 'foo', 'bar' ],
            isTurnRequired: false,
            networkTiming: {
              // pc, ice, and dtls starts after 15ms because of wait calls below.
              // The duration are calculated base on the clock.ticks calls below.
              // See "// Populate samples"
              peerConnection: {
                start: 15,
                end: 1015,
                duration: 1000,
              },
              dtls: {
                start: 15,
                end: 1015,
                duration: 1000,
              },
              ice: {
                start: 15,
                end: 1015,
                duration: 1000,
              },
              signaling: {
                start: 0,
                end: 1015,
                duration: 1015,
              }
            },
            samples: testSamples,
            selectedEdge: 'roaming',
            selectedIceCandidatePairStats: {
              localCandidate: { candidateType: 'host' },
              remoteCandidate: { candidateType: 'host' }
            },
            stats: {
              jitter: {
                average: 8,
                max: 15,
                min: 1
              },
              mos: {
                average: 8,
                max: 15,
                min: 1
              },
              rtt: {
                average: 8,
                max: 15,
                min: 1
              }
            },
            testTiming: {
              start: 0,
              end: 15025,
              duration: 15025
            },
            totals: testSamples[testSamples.length - 1].totals,
            warnings: [{
              description: 'Received an RTCWarning. See .rtcWarning for the RTCWarning',
              name: 'foo',
              rtcWarning: warningData,
            }],
            callQuality: 'excellent',
          };
          assert.equal(preflight.status, PreflightTest.Status.Completed);
          assert.deepEqual(results, expected);
          assert.deepEqual(preflight.report, expected);
          resolve();
        };

        preflight.on('completed', onCompleted);
        device.emit(Device.EventName.Registered);
        await clock.tickAsync(0);

        // Populate samples
        for (let i = 0; i < testSamples.length; i++) {
          const sample = testSamples[i];
          const data = {...sample};
          call.emit('sample', data);
          await clock.tickAsync(1);
        }
        // Populate warnings
        call.emit('warning', 'foo', warningData);
        // Populate callsid
        call.emit('accept');

        // Populate network timings
        call['_mediaHandler'].onpcconnectionstatechange('connecting');
        call['_mediaHandler'].ondtlstransportstatechange('connecting');
        call['_mediaHandler'].oniceconnectionstatechange('checking');
        await clock.tickAsync(1000);

        call['_mediaHandler'].onpcconnectionstatechange('connected');
        call['_mediaHandler'].ondtlstransportstatechange('connected');
        call['_mediaHandler'].oniceconnectionstatechange('connected');
        call['_mediaHandler'].onsignalingstatechange('stable');

        await clock.tickAsync(13000);
        call.emit('disconnect');

        await clock.tickAsync(1000);
        device.emit(Device.EventName.Unregistered);
        await clock.tickAsync(1000);
      });
    });

    describe('call quality', () => {
      it('should not include callQuality if stats are missing', async () => {
        const completePromise = new Promise<void>(resolve => {
          preflight.on('completed', (results: PreflightTest.Report) => {
            assert(!results.callQuality);
            resolve();
          });
        });

        device.emit(Device.EventName.Registered);

        await clock.tickAsync(13000);
        call.emit('disconnect');
        await clock.tickAsync(1000);
        device.emit(Device.EventName.Unregistered);
        await clock.tickAsync(1000);

        await completePromise;
      });

      // Test data for different mos and expected quality
      [
        [4.900, PreflightTest.CallQuality.Excellent],
        [4.300, PreflightTest.CallQuality.Excellent],
        [4.200, PreflightTest.CallQuality.Great],
        [4.100, PreflightTest.CallQuality.Great],
        [4.000, PreflightTest.CallQuality.Good],
        [3.900, PreflightTest.CallQuality.Good],
        [3.800, PreflightTest.CallQuality.Good],
        [3.700, PreflightTest.CallQuality.Good],
        [3.600, PreflightTest.CallQuality.Fair],
        [3.500, PreflightTest.CallQuality.Fair],
        [3.200, PreflightTest.CallQuality.Fair],
        [3.100, PreflightTest.CallQuality.Fair],
        [3.000, PreflightTest.CallQuality.Degraded],
        [2.900, PreflightTest.CallQuality.Degraded],
      ].forEach(([averageMos, callQuality]) => {
        it(`should report quality as ${callQuality} if average mos is ${averageMos}`, async () => {
          const completePromise = new Promise<void>(resolve => {
            preflight.on('completed', (results: PreflightTest.Report) => {
              assert.equal(results.callQuality, callQuality);
              resolve();
            });
          });

          device.emit(Device.EventName.Registered);
          await clock.tickAsync(0);

          for (let i = 0; i < 10; i++) {
            call.emit('sample', {
              rtt: 1,
              jitter: 1,
              mos: averageMos,
            });
            await clock.tickAsync(1);
          }

          await clock.tickAsync(13000);
          call.emit('disconnect');
          await clock.tickAsync(5000);
          device.emit(Device.EventName.Unregistered);
          await clock.tickAsync(5000);

          await completePromise;
        });
      })
    });

    describe('ice candidates', () => {
      const passPreflight = async () => {
        device.emit(Device.EventName.Registered);
        await clock.tickAsync(0);

        call.emit('sample', testSamples[0]);
        await clock.tickAsync(25000);
        call.emit('disconnect');
        await clock.tickAsync(1000);
        device.emit(Device.EventName.Unregistered);
        await clock.tickAsync(1000);
      };

      let candidateInfo: any;

      beforeEach(() => {
        candidateInfo = {
          iceCandidateStats: ['foo', 'bar'],
          selectedIceCandidatePairStats: {
            localCandidate: { candidateType: 'host' },
            remoteCandidate: { candidateType: 'host' },
          }
        };
      });

      it('should not include selectedIceCandidatePairStats if no candidates are selected', () => {
        candidateInfo.selectedIceCandidatePairStats = undefined;
        preflight = new PreflightTest('foo', {
          ...options,
          getRTCIceCandidateStatsReport: () => Promise.resolve(candidateInfo),
        });

        return new Promise<void>(async (resolve) => {
          const onCompleted = (results: PreflightTest.Report) => {
            assert.deepEqual(results.iceCandidateStats, ['foo', 'bar']);
            assert(!results.selectedIceCandidatePairStats);
            resolve();
          };

          preflight.on('completed', onCompleted);
          passPreflight();
        });
      });

      it('should not include isTurnRequired if no candidates are selected', () => {
        candidateInfo.selectedIceCandidatePairStats = undefined;
        preflight = new PreflightTest('foo', {
          ...options,
          getRTCIceCandidateStatsReport: () => Promise.resolve(candidateInfo),
        });

        return new Promise<void>(async (resolve) => {
          const onCompleted = (results: PreflightTest.Report) => {
            assert(typeof results.isTurnRequired === 'undefined');
            resolve();
          };

          preflight.on('completed', onCompleted);
          passPreflight();
        });
      });

      it('should provide selectedIceCandidatePairStats and iceCandidateStats in the report', () => {
        preflight = new PreflightTest('foo', {
          ...options,
          getRTCIceCandidateStatsReport: () => Promise.resolve(candidateInfo),
        });

        return new Promise<void>(async (resolve) => {
          const onCompleted = (results: PreflightTest.Report) => {
            assert.deepEqual(results.iceCandidateStats, ['foo', 'bar']);
            assert.deepEqual(results.selectedIceCandidatePairStats, {
              localCandidate: { candidateType: 'host' },
              remoteCandidate: { candidateType: 'host' },
            });
            resolve();
          };

          preflight.on('completed', onCompleted);
          passPreflight();
        });
      });

      context('when RTCIceCandidateStatsReport is not available', () => {
        it('should not provide selectedIceCandidatePairStats and iceCandidateStats in the report', () => {
          preflight = new PreflightTest('foo', {
            ...options,
            getRTCIceCandidateStatsReport: () => Promise.resolve(),
          });

          return new Promise<void>(async (resolve) => {
            const onCompleted = (results: PreflightTest.Report) => {
              assert.deepStrictEqual(results.iceCandidateStats, []);
              assert.strictEqual(results.selectedIceCandidatePairStats, undefined);
              resolve();
            };

            preflight.on('completed', onCompleted);
            passPreflight();
          });
        });
      });

      [
        ['relay', 'relay', true],
        ['relay', 'host', true],
        ['host', 'relay', true],
        ['host', 'host', false],
      ].forEach(([remoteCandidateType, localCandidateType, isTurnRequired]) => {
        it(`should set isTurnRequired to ${isTurnRequired} if remote candidate is a ${remoteCandidateType} and local candidate is ${localCandidateType}`, () => {
          candidateInfo.selectedIceCandidatePairStats.remoteCandidate.candidateType = remoteCandidateType;
          candidateInfo.selectedIceCandidatePairStats.localCandidate.candidateType = localCandidateType;
          preflight = new PreflightTest('foo', {
            ...options,
            getRTCIceCandidateStatsReport: () => Promise.resolve(candidateInfo),
          });

          return new Promise<void>(async (resolve) => {
            const onCompleted = (results: PreflightTest.Report) => {
              assert.equal(results.isTurnRequired, isTurnRequired);
              resolve();
            };

            preflight.on('completed', onCompleted);
            passPreflight();
          });
        });
      });
    });
  });

  describe('on failed', () => {
    it('should clear signaling timeout timer', async () => {
      const onFailed = sinon.stub();
      const preflight = new PreflightTest('foo', options);

      preflight.on('failed', onFailed);
      device.emit(Device.EventName.Registered);
      await clock.tickAsync(5000);

      preflight.stop();
      device.emit(Device.EventName.Unregistered);

      await clock.tickAsync(15000);

      sinon.assert.calledOnce(onFailed);
    });

    it('should timeout after 10s by default', async () => {
      const onFailed = sinon.stub();
      const preflight = new PreflightTest('foo', options);
      preflight.on('failed', onFailed);

      await clock.tickAsync(9999);
      sinon.assert.notCalled(onFailed);
      await clock.tickAsync(1);
      sinon.assert.calledOnce(onFailed);
      assert.equal((onFailed.args[0][0] as TwilioError).code, 53000);
    });

    it('should use timeout param', async () => {
      const onFailed = sinon.stub();
      const preflight = new PreflightTest('foo', Object.assign({ signalingTimeoutMs: 3000 }, options));
      preflight.on('failed', onFailed);

      await clock.tickAsync(2999);
      sinon.assert.notCalled(onFailed);
      await clock.tickAsync(1);
      sinon.assert.calledOnce(onFailed);
      assert.equal((onFailed.args[0][0] as TwilioError).code, 53000);
    });

    it('should emit failed if Device failed to initialized', async () => {
      deviceContext.updateOptions = () => {
        throw 'foo';
      };

      const onFailed = sinon.stub();
      const preflight = new PreflightTest('foo', options);
      preflight.on('failed', onFailed);
      await clock.tickAsync(1);
      assert.equal(preflight.status, PreflightTest.Status.Failed);
      sinon.assert.calledOnce(onFailed);
      sinon.assert.calledWithExactly(onFailed, 'foo');
    });

    it('should emit failed when test is stopped and destroy device', async () => {
      const onFailed = sinon.stub();
      const preflight = new PreflightTest('foo', options);
      preflight.on('failed', onFailed);
      device.emit(Device.EventName.Registered);
      await clock.tickAsync(0);

      preflight.stop();
      device.emit(Device.EventName.Unregistered);
      await clock.tickAsync(1000);

      assert.equal(preflight.status, PreflightTest.Status.Failed);
      sinon.assert.calledOnce(deviceContext.destroy);
      sinon.assert.calledOnce(onFailed);
      assert.equal((onFailed.args[0][0] as TwilioError).code, 31008);
    });

    it(`should emit failed on fatal device errors and destroy device`, async () => {
      const onFailed = sinon.stub();
      const preflight = new PreflightTest('foo', options);
      preflight.on('failed', onFailed);
      device.emit(Device.EventName.Registered);
      await clock.tickAsync(0);

      device.emit('error', { code: 123 });
      await clock.tickAsync(0);

      assert.equal(preflight.status, PreflightTest.Status.Failed);
      sinon.assert.calledOnce(deviceContext.destroy);
      sinon.assert.calledOnce(onFailed);
      sinon.assert.calledWithExactly(onFailed, { code: 123 });
    });

    it('should listen to device error once', async () => {
      const onFailed = sinon.stub();
      const preflight = new PreflightTest('foo', options);
      preflight.on('failed', onFailed);

      // Remove cleanup routine to test we are only subscribing once
      preflight['_releaseHandlers'] = sinon.stub();
      // Add stub listener so device won't crash if there are no error handlers
      // This is a default behavior of an EventEmitter
      device.on('error', sinon.stub());

      // Triggers the test
      device.emit(Device.EventName.Registered);
      await clock.tickAsync(0);

      device.emit('error', { code: 123 });
      await clock.tickAsync(0);

      device.emit('error', { code: 123 });
      await clock.tickAsync(0);

      assert.equal(preflight.status, PreflightTest.Status.Failed);
      sinon.assert.calledOnce(deviceContext.destroy);
      sinon.assert.calledOnce(onFailed);
      sinon.assert.calledWithExactly(onFailed, { code: 123 });
    });

    it('should stop test', async () => {
      const onCompleted = sinon.stub();
      const preflight = new PreflightTest('foo', options);
      preflight.on('completed', onCompleted);
      device.emit(Device.EventName.Registered);

      await clock.tickAsync(5000);
      preflight.stop();
      device.emit(Device.EventName.Unregistered);

      await clock.tickAsync(15000);
      device.emit(Device.EventName.Unregistered);
      await clock.tickAsync(1000);
      assert.equal(preflight.status, PreflightTest.Status.Failed);
      sinon.assert.notCalled(onCompleted);
    });

    it('should release all handlers', async () => {
      const preflight = new PreflightTest('foo', options);
      device.emit(Device.EventName.Registered);
      await clock.tickAsync(0);

      preflight.stop();
      device.emit(Device.EventName.Unregistered);
      await clock.tickAsync(1000);

      assert.equal(device.eventNames().length, 0);
      assert.equal(call.eventNames().length, 0);
    });

    it('should not emit completed event', async () => {
      const onCompleted = sinon.stub();
      const onFailed = sinon.stub();
      const preflight = new PreflightTest('foo', options);

      preflight.on(PreflightTest.Events.Completed, onCompleted);
      preflight.on(PreflightTest.Events.Failed, onFailed);

      device.emit(Device.EventName.Registered);
      await clock.tickAsync(1000);
      call.emit('disconnect');
      await clock.tickAsync(1000);
      device.emit(Device.EventName.Unregistered);
      await clock.tickAsync(1);
      device.emit('error', { code: 123 });
      await clock.tickAsync(1000);

      return wait().then(() => {
        sinon.assert.notCalled(onCompleted);
        sinon.assert.calledOnce(onFailed);
      });
    });
  });

  describe('_getRTCStats', () => {
    describe('should trim leading null mos valued samples', () => {
      const createSample = ({
        jitter,
        mos,
        rtt,
      }: {
        jitter: any,
        mos: any,
        rtt: any,
      }): RTCSample => ({
        audioInputLevel: 0,
        audioOutputLevel: 0,
        bytesReceived: 0,
        bytesSent: 0,
        codecName: 'foobar-codec',
        jitter,
        mos,
        packetsLost: 0,
        packetsLostFraction: 0,
        packetsReceived: 0,
        packetsSent: 0,
        rtt,
        timestamp: 0,
        totals: {
          bytesReceived: 0,
          bytesSent: 0,
          packetsLost: 0,
          packetsLostFraction: 0,
          packetsReceived: 0,
          packetsSent: 0,
        },
      });

      it('should return an object if there are mos samples', async () => {
        const preflight = new PreflightTest('foo', options);

        device.emit(Device.EventName.Registered);
        await clock.tickAsync(0);

        for (const sample of [{
          jitter: 100, mos: null, rtt: 1,
        }, {
          jitter: 0, mos: null, rtt: 0,
        }, {
          jitter: 0, mos: null, rtt: 0,
        }, {
          jitter: 1, mos: 5, rtt: 0.01,
        }, {
          jitter: 2, mos: 4, rtt: 0.03,
        }, {
          jitter: 3, mos: 3, rtt: 0.02,
        }].map(createSample)) {
          call.emit('sample', sample);
          await clock.tickAsync(0);
        }

        const rtcStats = preflight['_getRTCStats']();
        assert.deepEqual(rtcStats, {
          jitter: {
            average: 2,
            max: 3,
            min: 1,
          },
          mos: {
            average: 4,
            max: 5,
            min: 3,
          },
          rtt: {
            average: 0.02,
            max: 0.03,
            min: 0.01,
          },
        });
      });

      it('should return undefined if there are no mos samples', async () => {
        const preflight = new PreflightTest('foo', options);

        device.emit(Device.EventName.Registered);
        await clock.tickAsync(0);

        [{
          jitter: 100, mos: null, rtt: 1,
        }, {
          jitter: 0, mos: null, rtt: 0,
        }, {
          jitter: 0, mos: null, rtt: 0,
        }].map(createSample).forEach(
          (sample: RTCSample) => call.emit('sample', sample),
        );

        await clock.tickAsync(0);

        const rtcStats = preflight['_getRTCStats']();
        assert.equal(rtcStats, undefined);
      });
    });
  });
});
