import * as assert from 'assert';
import * as errors from '../../lib/twilio/errors';

describe('Errors', () => {
  describe('constructor', () => {
    it('should use message', () => {
      const error = new errors.MediaErrors.ConnectionError('foobar');
      assert(error instanceof Error);
      assert(error instanceof errors.TwilioError);
      assert(error instanceof errors.MediaErrors.ConnectionError);
      assert.equal(error.code, 53405);
      assert.equal(error.message, 'ConnectionError (53405): foobar');
      assert.equal(error.originalError, undefined);
    });

    it('should use originalError', () => {
      const originalError = new Error('foobar');
      const error = new errors.MediaErrors.ConnectionError(originalError);
      assert(error instanceof Error);
      assert(error instanceof errors.TwilioError);
      assert(error instanceof errors.MediaErrors.ConnectionError);
      assert.equal(error.code, 53405);
      assert.equal(error.message, 'ConnectionError (53405): Raised by the Client or Server whenever a media connection fails.');
      assert.equal(error.originalError, originalError);
    });

    it('should use both message and originalError', () => {
      const originalError = new Error('foobar');
      const error = new errors.MediaErrors.ConnectionError('foobar', originalError);
      assert(error instanceof Error);
      assert(error instanceof errors.TwilioError);
      assert(error instanceof errors.MediaErrors.ConnectionError);
      assert.equal(error.code, 53405);
      assert.equal(error.message, 'ConnectionError (53405): foobar');
      assert.equal(error.originalError, originalError);
    });

    it('should allow no params', () => {
      const error = new errors.MediaErrors.ConnectionError();
      assert(error instanceof Error);
      assert(error instanceof errors.TwilioError);
      assert(error instanceof errors.MediaErrors.ConnectionError);
      assert.equal(error.code, 53405);
      assert.equal(error.message, 'ConnectionError (53405): Raised by the Client or Server whenever a media connection fails.');
      assert.equal(error.originalError, undefined);
    });
  });

  describe('getErrorByCode', () => {
    it('should throw if code is not found', () => {
      assert.throws(() => errors.getErrorByCode(123456));
    });

    it('should return the TwilioError if code is found', () => {
      const twilioError: any = errors.getErrorByCode(53405);
      const error = new twilioError();
      assert(error instanceof Error);
      assert(error instanceof errors.TwilioError);
      assert(error instanceof errors.MediaErrors.ConnectionError);
      assert.equal(error.code, 53405);
    });
  });

  it('generated error map matches subset of errors in scripts', () => {
    const USED_ERRORS: string = require('../../scripts/errors').USED_ERRORS;
    for (const errorFullName of USED_ERRORS) {
      const [namespace, name] = errorFullName.split('.');
      const errorConstructor = (errors as any)[namespace][name];
      assert(typeof errorConstructor === 'function');
    }
  })
});
