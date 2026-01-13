import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';

describe('Edges', function() {
  ['roaming', 'sydney', 'sao-paulo', 'dublin', 'frankfurt', 'tokyo', 'singapore', 'ashburn', 'umatilla'].forEach(edge => {
    describe(`in edge: ${edge}`, () => {
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
        device1 = new Device(token1, { edge });
        device2 = new Device(token2, { edge });

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

          it('should hang up', (done) => {
            call1.once('disconnect', () => done());
            call2.disconnect();
          });
        });
      });
    });
  });
});
