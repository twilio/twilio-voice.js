import * as assert from 'assert';
import { md5 } from '../../lib/twilio/md5';

const { createHash, randomUUID } = require('node:crypto');

const TEST_CASES: Record<string, string> = {
  'the empty string': '',
  '"a"': 'a',
  '"abc"': 'abc',
  '"message digest"': 'message digest',
  'an alphabetical message': 'abcdefghijklmnopqrstuvwxyz',
  'an alphanumeric message':
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  'a numeric message':
    '123456789012345678901234567890123456789012345678901234567890123456789' +
    '01234567890',

  /**
   * Test case for when the SDK uses `getRandomValues`.
   */
  'a getRandomValues string': '953937369,4068875374,2818832814,3938225005,' +
    '2055066145,2046794509,3658262943,3857519838,1147610754,4168198302,' +
    '2363568900,2141542597,4124574290,2226527359,2541387230,3706534936,' +
    '902333653,1962217214,1324733323,3907680330,1252413911,3641459374,' +
    '1707404729,3056088815,1353646205,3940131683,830240267,3047020072,' +
    '3531940597,2687728539,2141763326,3274618989',

  /**
   * Test case when `getRandomValues` returns a max-length string such that
   * all values are exactly 2**32.
   */
  'the max getRandomValues string': new Uint32Array(32)
    .fill(2**32 - 1)
    .toString(),

  /**
   * Browser generated value for `randomUUID`.
   */
  'a chrome generated randomUUID': 'e33e3b6f-2310-4171-a34a-9db529297bbf',

  /**
   * NodeJS generated value for `randomUUID`.
   */
  'a nodejs generated randomUUID': randomUUID(),
};

describe.only('md5', () => {
  Object.entries(TEST_CASES).forEach(([title, input]) => {
    it(`hashes ${title}`, () => {
      const actualOutput = md5(input);
      const expectedOutput = createHash('md5')
        .update(input)
        .digest('hex')
        .toString();
      assert(actualOutput === expectedOutput);
    });
  });
});
