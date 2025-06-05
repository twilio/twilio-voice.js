import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import * as assert from 'assert';
import { EventEmitter } from 'events';
import { PreflightTest } from '../../lib/twilio/preflight/preflight';
import Call from '../../lib/twilio/call';
import { TwilioError } from '../../lib/twilio/errors';

const DURATION_PADDING = 3000;
const EVENT_TIMEOUT = 30000;
const MAX_TIMEOUT = 300000;

describe('Preflight Test', function() {
  this.timeout(MAX_TIMEOUT);
  Cypress.config('defaultCommandTimeout', MAX_TIMEOUT);

  let callerIdentity: string;
  let callerToken: string;
  let callerDevice: Device;
  let callerCall: Call;
  let receiverIdentity: string;
  let receiverDevice: Device;
  let preflight: PreflightTest;

  const expectEvent = <T>(eventName: string, emitter: EventEmitter) => {
    return new Promise<T>((resolve) => emitter.once(eventName, (res) => resolve(res)));
  };

  const waitFor = (promiseOrArray: Promise<any> | Promise<any>[], timeoutMS: number) => {
    let timer: NodeJS.Timeout;
    const promise = Array.isArray(promiseOrArray) ? Promise.all(promiseOrArray) : promiseOrArray;
    const timeoutPromise = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out`)), timeoutMS);
    });

    return Promise.race([promise, timeoutPromise]).then(() => clearTimeout(timer));
  };

  const setupDevices = async () => {
    receiverIdentity = 'id1-' + Date.now();
    callerIdentity = 'id2-' + Date.now();

    const receiverToken = generateAccessToken(receiverIdentity);
    callerToken = generateAccessToken(callerIdentity);
    receiverDevice = new Device(receiverToken);
    receiverDevice.on('error', () => { });
    await receiverDevice.register();
  };

  const destroyDevices = () => {
    if (callerDevice) {
      callerDevice.disconnectAll();
      callerDevice.destroy();
    }

    if (receiverDevice) {
      receiverDevice.disconnectAll();
      receiverDevice.destroy();
    }
  };

  describe('when test finishes', function() {
    before(async () => {
      await setupDevices();
      receiverDevice.on('incoming', (call: Call) => {
        call.accept();
      });
      preflight = Device.runPreflight(callerToken);
      callerDevice = preflight['_device'];

      (callerDevice as any).connectOverride = callerDevice.connect;
      callerDevice.connect = () => {
        return (callerDevice as any).connectOverride({ params: { To: receiverIdentity } });
      };
    });

    after(() => {
      destroyDevices();
    });

    it('should set status to connecting', () => {
      assert.equal(preflight.status, PreflightTest.Status.Connecting);
    });

    it('should emit connected event', () => {
      return waitFor(expectEvent('connected', preflight).then(() => {
        callerCall = preflight['_call'];
      }), EVENT_TIMEOUT);
    });

    it('should set status to connected', () => {
      assert.equal(preflight.status, PreflightTest.Status.Connected);
    });

    it('should set default codePreferences', () => {
      assert.deepEqual(callerDevice['_options'].codecPreferences, [Call.Codec.PCMU, Call.Codec.Opus]);
    });

    it('should emit warning event', () => {
      const name = 'constant-audio-input-level';
      const rtcWarning = {
        name: 'audioInputLevel',
        threshold: { name: 'maxDuration' }
      }
      setTimeout(() => {
        callerCall['_monitor'].emit('warning', rtcWarning);
      }, 5);

      return waitFor(expectEvent('warning', preflight).then((warning: any) => {
        assert.equal(warning.name, name);
        assert.equal(warning.rtcWarning, rtcWarning);
      }), EVENT_TIMEOUT);
    });

    it('should emit sample event', () => {
      return waitFor(expectEvent('sample', preflight), EVENT_TIMEOUT);
    });

    it('should emit completed event', () => {
      setTimeout(() => receiverDevice.disconnectAll(), 20000);
      return waitFor(
        expectEvent<PreflightTest.Report>('completed', preflight)
          .then((report: PreflightTest.Report) => {
            assert(!!report);
            assert(!!report.callSid);
            assert(!!report.callQuality);
            assert(!!report.edge);
            assert(!!report.networkTiming);
            assert(!!report.stats);
            assert(!!report.testTiming);
            assert(!!report.totals);
            assert(!!report.samples.length);
            assert(!!report.warnings.length);
            assert.deepEqual(report, preflight.report);
          }),
        EVENT_TIMEOUT);
    });

    it('should set status to completed', () => {
      assert.equal(preflight.status, PreflightTest.Status.Completed);
    });
  });

  describe('when using non-default codec options', () => {
    before(async () => {
      await setupDevices();
      receiverDevice.on('incoming', (call: Call) => {
        call.accept();
      });
      preflight = Device.runPreflight(callerToken, {
        codecPreferences: [Call.Codec.PCMU],
      });
      callerDevice = preflight['_device'];

      (callerDevice as any).connectOverride = callerDevice.connect;
      callerDevice.connect = () => {
        return (callerDevice as any).connectOverride({
          params: { To: receiverIdentity }
        });
      };
    });

    after(() => {
      destroyDevices();
    });

    it('should use codecPreferences passed in', () => {
      assert.deepEqual(callerDevice['_options'].codecPreferences, [Call.Codec.PCMU]);
    });
  });

  describe('when using non-default edge options', () => {
    [
      ['roaming', 'ashburn'],
      ['ashburn', 'ashburn'],
      ['dublin', 'dublin'],
    ].forEach(([selectedEdge, edge]) => {
      describe(selectedEdge, () => {
        let report: PreflightTest.Report | undefined;

        before(async () => {
          await setupDevices();
          receiverDevice.on('incoming', (call: Call) => {
            call.accept();
          });
          preflight = Device.runPreflight(callerToken, {
            edge: selectedEdge,
          });
          const waitForReport: Promise<PreflightTest.Report> =
            new Promise(resolve => {
              preflight.on(PreflightTest.Events.Completed, resolve);
            });
          callerDevice = preflight['_device'];

          (callerDevice as any).connectOverride = callerDevice.connect;
          callerDevice.connect = () => {
            return (callerDevice as any).connectOverride({ params: { To: receiverIdentity } });
          };

          setTimeout(() => receiverDevice.disconnectAll(), 5000);
          report = await waitForReport;
        });

        after(() => {
          destroyDevices();
        });

        it('should use edge passed in', () => {
          assert.equal(report?.selectedEdge, selectedEdge);
          assert.equal(report?.edge, edge);
        });
      });
    });
  });

  describe('when test is cancelled', function() {
    const FAIL_DELAY = 1000;
    before(async () => {
      await setupDevices();
      receiverDevice.on('incoming', (call: Call) => {
        call.accept();
      });
      preflight = Device.runPreflight(callerToken);
      callerDevice = preflight['_device'];

      (callerDevice as any).connectOverride = callerDevice.connect;
      callerDevice.connect = () => {
        return (callerDevice as any).connectOverride({ params: { To: receiverIdentity } });
      };
    });

    after(() => {
      destroyDevices();
    });

    it('should emit connected event', () => {
      return waitFor(expectEvent('connected', preflight), EVENT_TIMEOUT);
    });

    it('should emit failed event on cancelled', () => {
      setTimeout(() => {
        preflight.stop();
      }, FAIL_DELAY);
      return waitFor(expectEvent('failed', preflight).then(error => {
        assert.equal((error as TwilioError).code, 31008);
      }), EVENT_TIMEOUT);
    });

    it('should populate call duration correctly', () => {
      const delta = preflight.endTime! - preflight.startTime;
      console.log(preflight.endTime, preflight.startTime);
      assert(delta >= FAIL_DELAY && delta <= FAIL_DELAY + DURATION_PADDING);
    });
  });

  describe('when fatal error happens', function() {
    const FAIL_DELAY = 500;
    [{
      code: 31000,
      message: 'Signaling disconnected',
    },{
      code: 31003,
      message: 'Ice connection failed'
    }].forEach(error => {
      describe(`code: ${error.code}`, () => {
        before(async () => {
          await setupDevices();
          receiverDevice.on('incoming', (call: Call) => {
            call.accept();
          });
          preflight = Device.runPreflight(callerToken);
          callerDevice = preflight['_device'];

          (callerDevice as any).connectOverride = callerDevice.connect;
          callerDevice.connect = () => {
            return (callerDevice as any).connectOverride({ params: { To: receiverIdentity } });
          };
        });

        after(() => {
          destroyDevices();
        });

        it('should emit connected event', () => {
          return waitFor(expectEvent('connected', preflight), EVENT_TIMEOUT);
        });

        it('should emit failed event on fatal error', () => {
          setTimeout(() => {
            callerDevice.emit('error', error);
          }, FAIL_DELAY);
          return waitFor(expectEvent('failed', preflight).then(emittedError => {
            assert.equal(emittedError, error);
          }), EVENT_TIMEOUT);
        });

        it('should populate call duration correctly', () => {
          const delta = preflight.endTime! - preflight.startTime;
          assert(delta >= FAIL_DELAY && delta <= FAIL_DELAY + DURATION_PADDING);
        });
      });
    });
  });
});
