import * as assert from 'assert';
import { TwilioError } from '../../lib/twilio';

describe('TwilioError', () => {
  it('the exposed errors should be defined', () => {
    assert(TwilioError);
  });
});
