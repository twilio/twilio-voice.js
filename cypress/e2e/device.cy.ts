import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';

// (rrowland) The TwiML expected by these tests can be found in the README.md

describe('Device', function() {
  let device1: Device;
  let device2: Device;
  let identity1: string;
  let identity2: string;
  let token1: string;
  let token2: string;

  before(() => {
    identity1 = 'id1-' + Date.now();
    identity2 = 'id2-' + Date.now();
    token1 = generateAccessToken(identity1);
    token2 = generateAccessToken(identity2);
    device1 = new Device(token1);
    device2 = new Device(token2);

    return Promise.all([
      device1.register(),
      device2.register(),
    ]);
  });

  after(() => {
    if (device1) {
      device1.disconnectAll();
      device1.destroy();
    }

    if (device2) {
      device2.disconnectAll();
      device2.destroy();
    }
  });

  describe('tokenWillExpire event', () => {
    const setupDevice = (tokenTtl: number, tokenRefreshMs: number) => {
      const accessToken = generateAccessToken(`device-tokenWillExpire-${Date.now()}`, tokenTtl);
      const device = new Device(accessToken, { tokenRefreshMs });
      device.on(Device.EventName.Error, () => { /* no-op */ });
      return device;
    };

    it('should emit a "tokenWillExpire" event', (done) => {
      const device = setupDevice(5, 1000);
      device.on(Device.EventName.TokenWillExpire, () => {
        done();
      });
      device.register();
    });

    it('should not emit a "tokenWillExpire" event early', async () => {
      const device = setupDevice(10, 1000);
      await new Promise<void>(async (resolve, reject) => {
        let successTimeout: any = null;
        device.on(Device.EventName.TokenWillExpire, () => {
          if (successTimeout) {
            clearTimeout(successTimeout);
          }
          reject();
        });
        await device.register();
        // NOTE(csantos): Expected time before tokenWillExpire event is raised is about 9s
        // for a ttl: 10s and tokenRefreshMS: 1000, meaning we should resolve the test at less than 9s.
        // However, the ttl returned from signaling, which we use to calculate the timeout,
        // sometimes returns 1s less from the original ttl we provided. So let's account for that.
        // Instead of resolving the test before 9s, we should do it before 8s instead.
        successTimeout = setTimeout(resolve, 7500);
      });
    });

    it('should emit a "tokenWillExpire" event as soon as possible if the option is smaller than the ttl', async () => {
      const device = setupDevice(5, 10000);

      const eventPromises = Promise.all([
        Device.EventName.TokenWillExpire,
        Device.EventName.Registering,
      ].map((eventName: string) => new Promise<number>(res => {
        device.on(eventName, () => res(Date.now()));
      })));

      device.register();

      const [expireTime, registeringTime] = await eventPromises;
      const diff = Math.abs(expireTime - registeringTime);
      // ttl returned from signaling, which we use to calculate the timeout,
      // sometimes returns 1s less from the original ttl we provided. So let's account for that.
      assert(diff < 2000, `event time occurred too late; diff: ${diff}`);
    });
  });

  describe('device 1 calls device 2', () => {
    let call1: Call;
    let call2: Call;

    before(() => new Promise<void>(async resolve => {
      device2.once(Device.EventName.Incoming, (call: Call) => {
        call2 = call;
        resolve();
      });
      call1 = await (device1['connect'] as any)({
        params: { To: identity2, Custom1: 'foo + bar', Custom2: undefined, Custom3: '我不吃蛋' }
      });
    }));

    describe('and device 2 accepts', () => {
      beforeEach(() => {
        if (!call1 || !call2) {
          throw new Error(`Calls weren't both open at beforeEach`);
        }
      });

      it('should connect the call', (done) => {
        call2.once('accept', () => done());
        call2.accept();
      });

      it('should stay open 3 seconds', (done) => {
        function fail() {
          call1.removeListener('disconnect', fail);
          call2.removeListener('disconnect', fail);
          done(new Error('Expected the call to stay open for 3 seconds'));
        }

        call1.once('disconnect', fail);
        call2.once('disconnect', fail);

        setTimeout(() => {
          call1.removeListener('disconnect', fail);
          call2.removeListener('disconnect', fail);
          done();
        }, 3000);
      });

      it('should set callerInfo to null on both calls', () => {
        assert.equal(call1!.callerInfo, null);
        assert.equal(call2!.callerInfo, null);
      });

      it('should be using the PCMU codec for both calls', (done) => {
        let codec1: string | null | undefined = null;

        function setCodec(sample: any) {
          if (codec1 === null) {
            codec1 = sample.codecName;
          } else {
            if (codec1 === 'opus' || sample.codecName === 'opus') {
              done(new Error('Codec is opus'));
            } else {
              done();
            }
          }
        }

        const monitor1: any = call1['_monitor'];
        const monitor2: any = call2['_monitor'];
        if (!monitor1 || !monitor2) {
          done(new Error('Missing monitor'));
        }
        monitor1.once('sample', setCodec);
        monitor2.once('sample', setCodec);
      });

      it('should update network priority to high if supported', () => {
        if (!call2 || !call2['_mediaHandler'] || !call2['_mediaHandler']._sender) {
          throw new Error('Expected sender to be present');
        }
        const sender = call2['_mediaHandler']._sender;
        const params = sender.getParameters();
        const encoding = params.encodings && params.encodings[0];

        if (!params.priority && !encoding) {
          // Not supported by browser.
          return;
        }

        assert(params.priority === 'high'
          || (encoding && encoding.priority === 'high')
          || (encoding && encoding.networkPriority === 'high'));
      });

      it('should receive the correct custom parameters from the TwiML app', () => {
        const comparator =
          ([customParamKeyA]: string[], [customParamKeyB]: string[]) => {
            return customParamKeyA.localeCompare(customParamKeyB);
          };
        assert.deepEqual(
          Array.from(call2.customParameters.entries()).sort(comparator),
          [
            ['custom + param', '我不吃蛋'],
            ['custom1', 'foo + bar'],
            ['custom2', 'undefined'],
            ['custom3', '我不吃蛋'],
            ['duplicate', '123456'],
            ['foobar', 'some + value'],
          ],
        );
      });

      it('should post metrics', (done) => {
        const publisher = call1['_publisher'];
        (publisher as any)['_request'] = { post: (params: any, err: Function) => {
          if (/EndpointMetrics$/.test(params.url)) {
            done();
          }
        }};
      });

      it('should hang up', (done) => {
        call1.once('disconnect', () => done());
        call2.disconnect();
      });
    });
  });
});
