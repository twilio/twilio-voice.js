//@ts-nocheck
import * as assert from 'assert';
import * as sinon from 'sinon';
import Backoff from '../../lib/twilio/backoff';

describe('Backoff', () => {
  let clock;
  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
  });

  describe('Default Options', () => {
    let options = {};
    let backoff;
    let onBackoff;
    let onReady;

    beforeEach(() => {
      onBackoff = sinon.stub();
      onReady = sinon.stub();
      backoff = new Backoff(options);
      backoff.on('backoff', onBackoff);
      backoff.on('ready', onReady);
    });

    it('should raise backoff and ready events on start', () => {
      backoff.backoff();
      clock.tick(100);
      backoff.reset();
      sinon.assert.calledOnce(onBackoff);
      sinon.assert.calledOnce(onReady);
      sinon.assert.callOrder(onBackoff, onReady);
    });

    it('should increase the duration exponentially', () => {
      backoff.backoff();
      clock.tick(110);
      sinon.assert.calledOnce(onReady);
      backoff.backoff();
      clock.tick(210);
      sinon.assert.calledTwice(onReady);
      backoff.backoff();
      clock.tick(410);
      sinon.assert.calledThrice(onReady);
    });

    it('should reset the duration', () => {
      backoff.backoff();
      clock.tick(110);
      sinon.assert.calledOnce(onReady);
      backoff.reset();
      clock.tick(210);
      clock.tick(410);
      sinon.assert.calledOnce(onReady);
    });
    
    it('should reset the duration once', () => {
      backoff.backoff();
      clock.tick(110);
      sinon.assert.calledOnce(onReady);
      backoff.reset();
      backoff.reset();
      clock.tick(210);
      clock.tick(410);
      sinon.assert.calledOnce(onReady);
    });

    it('should provide number of attempts and duration in the backoff and ready event', () => {
      const attempts = [];
      const durations = [];
      backoff = new Backoff({ max: 5000 });
      backoff.on('ready', (a, d) => {
        attempts.push(a);
        durations.push(d);
        backoff.backoff();
      });
      backoff.backoff();
      clock.tick(2000);
      assert.deepStrictEqual(attempts, [0,1,2,3,4]);
      assert.deepStrictEqual(durations, [100,100,200,400,800]);
    });
  });

  describe('Custom Options', () => {
    [
      {
        tickCount: 1550,
        testName: 'with max 400',
        options: { max: 400 },
        numberCallbackExpected: 5
      },
      {
        tickCount: 1550,
        testName: 'with max 400',
        options: { max: 400, jitter: 0.1 },
        numberCallbackExpected: 5
      },
      {
        tickCount: 10000,
        testName: 'with min 600',
        options: { min: 600 },
        numberCallbackExpected: 5
      },
      {
        tickCount: 10000,
        testName: 'with factor 3',
        options: { factor: 3 },
        numberCallbackExpected: 5
      },
      {
        tickCount: 25000,
        testName: 'with min 200, max 20000',
        options: { min: 200, max: 20000 },
        numberCallbackExpected: 7
      },
      {
        tickCount: 25000,
        testName: 'with min 200, max 20000, factor 3',
        options: { min: 200, max: 20000, factor: 3 },
        numberCallbackExpected: 6
      },
    ].forEach(testCase => {
      it(testCase.testName, () => {
        const backoff = new Backoff(testCase.options);

        let callbacks = 0;
        backoff.on('ready', () => {
          backoff.backoff();
          callbacks++;
        });

        backoff.backoff();
        clock.tick(testCase.tickCount);

        assert.strictEqual(callbacks, testCase.numberCallbackExpected);
      });
    });
  });
});
