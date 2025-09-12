import * as assert from 'assert';
import mos from '../lib/twilio/rtc/mos';

describe('MOS', () => {
  describe('.isNonNegativeNumber', () => {
    describe('should return false when passed', () => {
      [null, NaN, Infinity, -1].forEach(v => it(`${v}`, () => {
        assert.equal(mos.isNonNegativeNumber(v), false);
      }));
    });
    it('should return true for a non negative number', () => {
      for (const v of [0, 0.5, 1, 10, 100]) {
        assert.equal(mos.isNonNegativeNumber(v), true);
      }
    });
  });

  describe('.calculate', () => {
    it('should return null when passed bad values', () => {
      assert.equal((mos.calculate as any)(), null);
      assert.equal((mos.calculate as any)(), null);
      assert.equal((mos.calculate as any)(undefined, undefined, 1), null);
      assert.equal((mos.calculate as any)(1, 1), null);
      assert.equal((mos.calculate as any)(1), null);
      assert.equal((mos.calculate as any)(undefined, 1), null);
      assert.equal(mos.calculate(1, null, 1), null);
      assert.equal(mos.calculate(null, 1, 1), null);
      assert.equal(mos.calculate(1, -1, 1), null);
      assert.equal(mos.calculate(-1, 1, 1), null);
    });

    it('should return a non-null value when passed good values', () => {
      assert.notEqual(mos.calculate(5, 0, 0), null);
    });

    describe('should always generate monotonically decreasing values', () => {
      let rtt: any;
      let jitter: any;
      let fractionLost: any;
      let prevMos: number | null;

      beforeEach(() => {
        rtt = 0;
        jitter = 0;
        fractionLost = 0;
        prevMos = null;
      });

      const checkMos = (r: any, j: number, f: number) => {
        const curMos = mos.calculate(r, j, f);
        assert(typeof curMos === 'number');
        assert((curMos as number) >= 1);
        assert((curMos as number) <= 4.5);
        if (prevMos) {
          assert(prevMos >= (curMos as number));
        }
        prevMos = curMos;
      };

      it('as rtt increases', () => {
        for (; rtt < 3000; rtt++) {
          checkMos(rtt, jitter, fractionLost);
        }
      });

      it('as jitter increases', () => {
        for (; jitter < 1500; jitter++) {
          checkMos(rtt, jitter, fractionLost);
        }
      });

      it('as fractionLost increases', () => {
        for (; fractionLost < 100; fractionLost++) {
          checkMos(rtt, jitter, fractionLost);
        }
      });
    });
  });
});
