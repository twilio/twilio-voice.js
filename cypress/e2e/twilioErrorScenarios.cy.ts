import * as assert from 'assert';
import { TwilioError } from '../../lib/twilio';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent } from '../../tests/lib/util';

describe('TwilioError Scenarios', function() {
  this.timeout(30000);
  Cypress.config('defaultCommandTimeout', 30000);

  it('the exposed errors should be defined', () => {
    assert(TwilioError);
  });

  it('should have AuthorizationErrors defined', () => {
    assert(TwilioError.AuthorizationErrors);
    assert(TwilioError.AuthorizationErrors.AccessTokenExpired);
    assert(TwilioError.AuthorizationErrors.AccessTokenInvalid);
    assert(TwilioError.AuthorizationErrors.AuthenticationFailed);
  });

  it('should have GeneralErrors defined', () => {
    assert(TwilioError.GeneralErrors);
    assert(TwilioError.GeneralErrors.UnknownError);
    assert(TwilioError.GeneralErrors.ConnectionError);
    assert(TwilioError.GeneralErrors.TransportError);
  });

  it('should have ClientErrors defined', () => {
    assert(TwilioError.ClientErrors);
    assert(TwilioError.ClientErrors.BadRequest);
    assert(TwilioError.ClientErrors.NotFound);
  });

  it('should have MediaErrors defined', () => {
    assert(TwilioError.MediaErrors);
    assert(TwilioError.MediaErrors.ConnectionError);
    assert(TwilioError.MediaErrors.ClientLocalDescFailed);
  });

  it('should have SignalingErrors defined', () => {
    assert(TwilioError.SignalingErrors);
    assert(TwilioError.SignalingErrors.ConnectionError);
    assert(TwilioError.SignalingErrors.ConnectionDisconnected);
  });

  it('should have UserMediaErrors defined', () => {
    assert(TwilioError.UserMediaErrors);
    assert(TwilioError.UserMediaErrors.PermissionDeniedError);
    assert(TwilioError.UserMediaErrors.AcquisitionFailedError);
  });

  it('should have MalformedRequestErrors defined', () => {
    assert(TwilioError.MalformedRequestErrors);
    assert(TwilioError.MalformedRequestErrors.MalformedRequestError);
  });

  it('should create error instances with correct code and message', () => {
    const error = new TwilioError.AuthorizationErrors.AccessTokenExpired();
    assert(typeof error.code === 'number', 'Error should have a numeric code');
    assert(typeof error.message === 'string', 'Error should have a string message');
    assert(error instanceof Error, 'Error should extend Error');
  });

  it('should emit an error event on the device for an invalid token', async () => {
    const device = new Device('invalid-token');
    try {
      const errorPromise = expectEvent(Device.EventName.Error, device);
      device.register().catch(() => { /* expected */ });
      const error: any = await errorPromise;
      assert(error, 'Error should be emitted');
      assert(typeof error.code === 'number', 'Error should have a code');
    } finally {
      device.destroy();
    }
  });

  it('should emit an error event for an expired token', async () => {
    // Generate a token with 1 second TTL
    const identity = 'id-expired-' + Date.now();
    const token = generateAccessToken(identity, 1);
    const device = new Device(token);

    // Wait for the token to expire before trying to register
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const errorPromise = expectEvent(Device.EventName.Error, device);
      device.register().catch(() => { /* expected */ });
      const error: any = await errorPromise;
      assert(error, 'Error should be emitted');
    } finally {
      device.destroy();
    }
  });
});
