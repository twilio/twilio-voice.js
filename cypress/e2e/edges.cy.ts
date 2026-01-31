import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import {
  attemptCallWithRetry,
  cleanupDevices,
  registerDevices,
  SETUP_TIMEOUT,
  CALL_SETUP_TIMEOUT,
} from '../utils/call';
import { getEndpoints, isStage } from '../utils/endpoints';

const prodEdges = ['roaming', 'sydney', 'sao-paulo', 'dublin', 'frankfurt', 'tokyo', 'singapore', 'ashburn', 'umatilla'];
const stageEdges = ['roaming', 'sydney', 'ashburn', 'umatilla'];

describe('Edges', function() {
  this.timeout(60000);

  (isStage ? stageEdges : prodEdges).forEach(edge => {
    describe(`in edge: ${edge}`, () => {
      let device1: Device;
      let device2: Device;
      let identity1: string;
      let identity2: string;
      let token1: string;
      let token2: string;

      before(async function() {
        this.timeout(SETUP_TIMEOUT);

        identity1 = 'id1-' + Date.now();
        identity2 = 'id2-' + Date.now();
        token1 = generateAccessToken(identity1);
        token2 = generateAccessToken(identity2);
        const options = isStage ? getEndpoints(edge) : { edge };
        device1 = new Device(token1, options as any);
        device2 = new Device(token2, options as any);

        await registerDevices(device1, device2);
      });

      after(() => {
        cleanupDevices(device1, device2);
      });

      describe('device 1 calls device 2', () => {
        let call1: Call;
        let call2: Call;

        before(async function() {
          this.timeout(CALL_SETUP_TIMEOUT);

          const result = await attemptCallWithRetry(device1, device2, identity2);
          call1 = result.call1;
          call2 = result.call2;
        });

        describe('and device 2 accepts', () => {
          beforeEach(function() {
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
