import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';

// (rrowland) The TwiML expected by these tests can be found in the README.md

describe('Opus', function() {
  this.timeout(10000);

  let device1: Device;
  let device2: Device;
  let identity1: string;
  let identity2: string;
  let options: any;
  let token1: string;
  let token2: string;

  before(() => {
    identity1 = 'id1-' + Date.now();
    identity2 = 'id2-' + Date.now();
    token1 = generateAccessToken(identity1);
    token2 = generateAccessToken(identity2);
    options = {
      codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
    };
    device1 = new Device(token1, options);
    device2 = new Device(token2, options);

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
        device2.calls[0].once('accept', () => done());
        device2.calls[0].accept();
      });

      it('should stay open 3 seconds', (done) => {
        function fail() {
          call1.removeListener('disconnect', fail);
          call2.removeListener('disconnect', fail);
          done(new Error('Expected the call to stay open for 5 seconds'));
        }

        call1.once('disconnect', fail);
        call2.once('disconnect', fail);

        setTimeout(() => {
          call1.removeListener('disconnect', fail);
          call2.removeListener('disconnect', fail);
          done();
        }, 3000);
      });

      it('should be using the opus codec for both calls', (done) => {
        let codec1: string | null | undefined = null;

        function setCodec(sample: any) {
          if (codec1 === null) {
            codec1 = sample.codecName;
          } else {
            if (codec1 === 'PCMU' || sample.codecName === 'PCMU') {
              done(new Error('Codec is PCMU'));
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
