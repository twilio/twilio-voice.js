import Device from '../../lib/twilio/device';
import Call from '../../lib/twilio/call';
import { generateAccessToken } from '../../tests/lib/token';

describe('Device', function () {
  this.timeout(10000);

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

    return Promise.all([device1.register(), device2.register()]);
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

    before(
      () =>
        new Promise(async (resolve) => {
          device2.once(Device.EventName.Incoming, (call: Call) => {
            call2 = call;
            cy.task('log', `(before)call2: ${JSON.stringify(call.parameters)}`);
            resolve();
          });
          call1 = await (device1['connect'] as any)({
            params: {
              To: identity2,
              Custom1: 'foo + bar',
              Custom2: undefined,
              Custom3: '我不吃蛋',
            },
          });
          cy.task('log', `(before)call1: ${JSON.stringify(call1.parameters)}`);
        })
    );

    describe('and device 2 accepts', () => {
      beforeEach(() => {
        cy.task('log', `call1: ${JSON.stringify(call1.parameters)}`);
        cy.task('log', `call2: ${JSON.stringify(call2.parameters)}`);
        if (!call1 || !call2) {
          throw new Error(`Calls weren't both open at beforeEach`);
        }
      });

      it('should connect the call', (done) => {
        call2.once('accept', () => done());
        call2.accept();
      });
    });
  });
});
