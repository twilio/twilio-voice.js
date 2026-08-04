import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent } from '../../tests/lib/util';

describe('Call sendDigits', function() {
  this.timeout(30000);
  Cypress.config('defaultCommandTimeout', 30000);

  let device1: Device;
  let device2: Device;
  let identity1: string;
  let identity2: string;
  let call1: Call;
  let call2: Call;

  before(async () => {
    identity1 = 'id1-' + Date.now();
    identity2 = 'id2-' + Date.now();
    const token1 = generateAccessToken(identity1);
    const token2 = generateAccessToken(identity2);
    device1 = new Device(token1);
    device2 = new Device(token2);

    await Promise.all([device1.register(), device2.register()]);

    const incomingPromise: Promise<Call> = expectEvent(Device.EventName.Incoming, device2);
    call1 = await device1.connect({ params: { To: identity2 } });
    call2 = await incomingPromise;

    const acceptPromise = expectEvent('accept', call1);
    call2.accept();
    await acceptPromise;
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

  it('should send a single digit without throwing', () => {
    assert.doesNotThrow(() => call1.sendDigits('1'));
  });

  it('should send multiple digits without throwing', () => {
    assert.doesNotThrow(() => call1.sendDigits('123'));
  });

  it('should send special characters * and #', () => {
    assert.doesNotThrow(() => call1.sendDigits('*#'));
  });

  it('should send w for pause', () => {
    assert.doesNotThrow(() => call1.sendDigits('1w2'));
  });

  it('should keep local DTMF playback for "w" in sync with the wire', () => {
    // VBLOCKS-6989: the wire sends the run after a pause 500ms after the run
    // before it, so '8' must play ~500ms after '7' locally too. Digits 7 and 8
    // are unique to this test so other tests' pending timers cannot skew it.
    const dialtonePlayer = (call1 as any)._options.dialtonePlayer;
    if (!dialtonePlayer) {
      // No AudioContext-backed dialtone player in this environment; nothing to measure.
      return;
    }

    const start = Date.now();
    const first: { [sound: string]: number } = {};
    cy.stub(dialtonePlayer, 'play').callsFake((sound: string) => {
      if (!(sound in first)) {
        first[sound] = Date.now() - start;
      }
    });

    call1.sendDigits('7w8');

    // Wait past the full sequence (~500ms) with a buffer, then assert timing.
    cy.wait(1500).then(() => {
      assert.ok(first.dtmf7 !== undefined, 'dtmf7 should have played');
      assert.ok(first.dtmf8 !== undefined, 'dtmf8 should have played');
      const gap = first.dtmf8 - first.dtmf7;
      // ~500ms to match the wire; allow jitter from real timers.
      assert.ok(gap >= 400 && gap <= 650, `expected pause gap ~500ms but was ${gap}ms`);
    });
  });

  it('should not drift local DTMF playback as digits precede a "w"', () => {
    // VBLOCKS-6989: two tones precede the pause here instead of one, and '6'
    // must still start ~500ms in, proving the pause does not stack on top of
    // the tones. Before the fix '6' landed at ~900ms. Two tones is the longest
    // run that still fits inside the 500ms pause. Digits 4, 5 and 6 are unique
    // to this test so other tests' pending timers cannot skew it.
    const dialtonePlayer = (call1 as any)._options.dialtonePlayer;
    if (!dialtonePlayer) {
      // No AudioContext-backed dialtone player in this environment; nothing to measure.
      return;
    }

    const start = Date.now();
    const first: { [sound: string]: number } = {};
    cy.stub(dialtonePlayer, 'play').callsFake((sound: string) => {
      if (!(sound in first)) {
        first[sound] = Date.now() - start;
      }
    });

    call1.sendDigits('45w6');

    // Wait past the full sequence (~500ms) with a buffer, then assert timing.
    cy.wait(1500).then(() => {
      assert.ok(first.dtmf4 !== undefined, 'dtmf4 should have played');
      assert.ok(first.dtmf6 !== undefined, 'dtmf6 should have played');
      // '6' run starts relative to the '45' run start. ~500ms means the pause
      // did not stack on the two leading tones; allow jitter from real timers.
      const runGap = first.dtmf6 - first.dtmf4;
      assert.ok(runGap >= 400 && runGap <= 650, `expected run gap ~500ms but was ${runGap}ms`);
    });
  });

  it('should throw on invalid characters', () => {
    assert.throws(() => call1.sendDigits('abc'), (err: any) => {
      return err.name === 'InvalidArgumentError';
    });
  });

  it('should hang up', (done) => {
    call1.once('disconnect', () => done());
    call2.disconnect();
  });
});
