import * as assert from 'assert';

// Plain CommonJS module (scripts/ is not part of the TS build); require avoids
// the esModuleInterop dance for a default-less module.exports.
// tslint:disable-next-line
const { compare, isForward, parse } = require('../../scripts/check-version-bump');

describe('check-version-bump', () => {
  describe('parse', () => {
    it('splits a final version', () => {
      assert.deepStrictEqual(parse('2.18.4'), { numbers: [2, 18, 4], prerelease: [] });
    });

    it('splits a dotted prerelease', () => {
      assert.deepStrictEqual(parse('2.18.4-rc.1'), { numbers: [2, 18, 4], prerelease: ['rc', '1'] });
    });

    it('splits the dotless prerelease this repo tags with', () => {
      assert.deepStrictEqual(parse('2.18.2-rc2'), { numbers: [2, 18, 2], prerelease: ['rc2'] });
    });

    [' 2.18.4', '2.18', 'v2.18.4', '2.18.4.1', 'patch', '2.18.4\n2.18.4', ''].forEach(version => {
      it(`returns null for ${JSON.stringify(version)}`, () => {
        assert.strictEqual(parse(version), null);
      });
    });
  });

  describe('compare', () => {
    it('orders a final version above its own prerelease', () => {
      assert.strictEqual(compare('2.18.0', '2.18.0-rc1'), 1);
    });

    it('treats identical versions as equal', () => {
      assert.strictEqual(compare('2.18.1', '2.18.1'), 0);
    });

    it('orders numeric prerelease identifiers numerically, not lexically', () => {
      assert.strictEqual(compare('2.18.0-rc.10', '2.18.0-rc.9'), 1);
    });

    it('orders a numeric identifier below an alphanumeric one', () => {
      assert.strictEqual(compare('2.18.0-1', '2.18.0-alpha'), -1);
    });

    it('orders a longer identifier set above its own prefix', () => {
      assert.strictEqual(compare('2.18.0-rc.1', '2.18.0-rc'), 1);
    });

    it('throws on a version it cannot parse', () => {
      assert.throws(() => compare('2.18.4', 'patch'), /not an exact version/);
    });
  });

  // Every case below is a transition taken from this repo's git tag history.
  describe('isForward', () => {
    describe('allows the final release, which the branch always cuts from X.Y.Z-dev', () => {
      [
        ['2.18.4-dev', '2.18.4'],
        ['2.18.1-dev', '2.18.1'],
        ['2.18.0-dev', '2.18.0'],
        ['2.17.0-dev', '2.17.0'],
        ['2.18.2-rc2', '2.18.2'],
        ['2.18.1-rc1', '2.18.1']
      ].forEach(([current, next]) => {
        it(`${current} -> ${next}`, () => {
          assert.strictEqual(isForward(current, next), true);
        });
      });
    });

    describe('allows a release candidate', () => {
      [
        ['2.18.2-dev', '2.18.2-rc1'],
        ['2.18.2-rc1', '2.18.2-rc2'],
        ['2.18.4-dev', '2.19.0-rc1']
      ].forEach(([current, next]) => {
        it(`${current} -> ${next}`, () => {
          assert.strictEqual(isForward(current, next), true);
        });
      });
    });

    describe('rejects a version that does not move forward', () => {
      [
        // A transposed minor: 2.1.4 in place of 2.18.4.
        ['2.18.4-dev', '2.1.4'],
        ['2.18.1', '2.18.1'],
        ['2.18.4-dev', '2.18.3'],
        ['2.18.2-rc2', '2.18.2-rc1'],
        ['2.18.2', '2.18.2-rc3']
      ].forEach(([current, next]) => {
        it(`${current} -> ${next}`, () => {
          assert.strictEqual(isForward(current, next), false);
        });
      });
    });
  });
});
