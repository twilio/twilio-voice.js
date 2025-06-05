import * as assert from 'assert';
import { Logger } from '../../lib/twilio';

describe('Logger', () => {
  it('the exposed logger should be defined', () => {
    assert(Logger);
  });
});
