import * as assert from 'assert';
import { EventEmitter } from 'events';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import * as env from '../../tests/env';
import { generateAccessToken } from '../../tests/lib/token';

describe('SHAKEN/STIR', function() {
  this.timeout(10000);

  let device1: Device;
  let device2: Device;
  let identity1: string;
  let identity2: string;
  let token1: string;
  let token2: string;

  before(() => {
    identity1 = 'id1-' + Date.now();
    identity2 = 'aliceStir';
    token1 = generateAccessToken(identity1, undefined, (env as any).appSidStir);
    token2 = generateAccessToken(identity2, undefined, (env as any).appSidStir);
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

  describe('device 1 calls device 2', () => {

    describe('with pstream sending additional params', () => {
      let call1: Call;
      let call2: Call;

      before(() => new Promise<void>(async resolve => {
        device2.once(Device.EventName.Incoming, (call: Call) => {
          resolve();
          call2 = call;
        });
        const devShim = device2 as any;
        devShim._stream.transport.__onSocketMessage = devShim._stream.transport._onSocketMessage;
        devShim._stream.transport._onSocketMessage = (message: any) => {
          if (message && message.data && typeof message.data === 'string') {
            const data = JSON.parse(message.data);
            const text = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
            data.payload.parameters.displayName = text;
            data.payload.parameters.DisplayName = text;
            data.payload.parameters.foo = text;
            data.payload.parameters.longProp = Array(100).fill(text).join(',');
            message.data = JSON.stringify(data);
          }
          return devShim._stream.transport.__onSocketMessage(message);
        };

        call1 = await (device1['connect'] as any)({
          params: { CallerId: (env as any).callerId },
        });
      }));

      describe('and device 2 accepts', () => {
        beforeEach(() => {
          if (!call1 || !call2) {
            throw new Error(`Calls weren't both open at beforeEach`);
          }
        });

        it('should set callerInfo to null on origin call', () => {
          assert.equal(call1!.callerInfo, null);
        });

        it('should show isVerified on aliceStir call', () => {
          assert.equal(call2!.callerInfo!.isVerified, true);
        });

        xit('should reject the call', (done) => {
          call1.once('disconnect', () => done());
          call2.reject();
        });
      });
    });
  });
});
