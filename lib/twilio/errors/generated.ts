/* tslint:disable max-classes-per-file max-line-length */
/**
 * This is a generated file. Any modifications here will be overwritten. See scripts/errors.js.
 */
import TwilioError from './twilioError';
export { TwilioError };

export namespace AuthorizationErrors {
  /**
   * Error received from the Twilio backend.
   */
  export class AccessTokenInvalid extends TwilioError {
    causes: string[] = [];
    code: number = 20101;
    description: string = 'Invalid access token';
    explanation: string = 'Twilio was unable to validate your Access Token';
    name: string = 'AccessTokenInvalid';
    solutions: string[] = [];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, AuthorizationErrors.AccessTokenInvalid.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class AccessTokenExpired extends TwilioError {
    causes: string[] = [];
    code: number = 20104;
    description: string = 'Access token expired or expiration date invalid';
    explanation: string = 'The Access Token provided to the Twilio API has expired, the expiration time specified in the token was invalid, or the expiration time specified was too far in the future';
    name: string = 'AccessTokenExpired';
    solutions: string[] = [];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, AuthorizationErrors.AccessTokenExpired.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class AuthenticationFailed extends TwilioError {
    causes: string[] = [];
    code: number = 20151;
    description: string = 'Authentication Failed';
    explanation: string = 'The Authentication with the provided JWT failed';
    name: string = 'AuthenticationFailed';
    solutions: string[] = [];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, AuthorizationErrors.AuthenticationFailed.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }
}

export namespace SignatureValidationErrors {
  /**
   * Error received from the Twilio backend.
   */
  export class AccessTokenSignatureValidationFailed extends TwilioError {
    causes: string[] = [
      'The access token has an invalid Account SID, API Key, or API Key Secret.',
    ];
    code: number = 31202;
    description: string = 'Signature validation failed.';
    explanation: string = 'The provided access token failed signature validation.';
    name: string = 'AccessTokenSignatureValidationFailed';
    solutions: string[] = [
      'Ensure the Account SID, API Key, and API Key Secret are valid when generating your access token.',
    ];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, SignatureValidationErrors.AccessTokenSignatureValidationFailed.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }
}

export namespace ClientErrors {
  /**
   * Error received from the Twilio backend.
   */
  export class BadRequest extends TwilioError {
    causes: string[] = [];
    code: number = 31400;
    description: string = 'Bad Request (HTTP/SIP)';
    explanation: string = 'The request could not be understood due to malformed syntax.';
    name: string = 'BadRequest';
    solutions: string[] = [];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, ClientErrors.BadRequest.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class NotFound extends TwilioError {
    causes: string[] = [
      'The outbound call was made to an invalid phone number.',
      'The TwiML application sid is missing a Voice URL.',
    ];
    code: number = 31404;
    description: string = 'Not Found (HTTP/SIP)';
    explanation: string = 'The server has not found anything matching the request.';
    name: string = 'NotFound';
    solutions: string[] = [
      'Ensure the phone number dialed is valid.',
      'Ensure the TwiML application is configured correctly with a Voice URL link.',
    ];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, ClientErrors.NotFound.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class TemporarilyUnavailable extends TwilioError {
    causes: string[] = [];
    code: number = 31480;
    description: string = 'Temporarily Unavailable (SIP)';
    explanation: string = 'The callee is currently unavailable.';
    name: string = 'TemporarilyUnavailable';
    solutions: string[] = [];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, ClientErrors.TemporarilyUnavailable.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class BusyHere extends TwilioError {
    causes: string[] = [];
    code: number = 31486;
    description: string = 'Busy Here (SIP)';
    explanation: string = 'The callee is busy.';
    name: string = 'BusyHere';
    solutions: string[] = [];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, ClientErrors.BusyHere.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }
}

export namespace SIPServerErrors {
  /**
   * Error received from the Twilio backend.
   */
  export class Decline extends TwilioError {
    causes: string[] = [];
    code: number = 31603;
    description: string = 'Decline (SIP)';
    explanation: string = 'The callee does not wish to participate in the call.';
    name: string = 'Decline';
    solutions: string[] = [];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, SIPServerErrors.Decline.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }
}

export namespace GeneralErrors {
  /**
   * Error received from the Twilio backend.
   */
  export class UnknownError extends TwilioError {
    causes: string[] = [];
    code: number = 31000;
    description: string = 'Unknown Error';
    explanation: string = 'An unknown error has occurred. See error details for more information.';
    name: string = 'UnknownError';
    solutions: string[] = [];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, GeneralErrors.UnknownError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class ApplicationNotFoundError extends TwilioError {
    causes: string[] = [];
    code: number = 31001;
    description: string = 'Application Not Found';
    explanation: string = '';
    name: string = 'ApplicationNotFoundError';
    solutions: string[] = [];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, GeneralErrors.ApplicationNotFoundError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class ConnectionDeclinedError extends TwilioError {
    causes: string[] = [];
    code: number = 31002;
    description: string = 'Connection Declined';
    explanation: string = '';
    name: string = 'ConnectionDeclinedError';
    solutions: string[] = [];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, GeneralErrors.ConnectionDeclinedError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class ConnectionTimeoutError extends TwilioError {
    causes: string[] = [];
    code: number = 31003;
    description: string = 'Connection Timeout';
    explanation: string = 'The server could not produce a response within a suitable amount of time.';
    name: string = 'ConnectionTimeoutError';
    solutions: string[] = [];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, GeneralErrors.ConnectionTimeoutError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class ConnectionError extends TwilioError {
    causes: string[] = [];
    code: number = 31005;
    description: string = 'Connection error';
    explanation: string = 'A connection error occurred during the call';
    name: string = 'ConnectionError';
    solutions: string[] = [];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, GeneralErrors.ConnectionError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class CallCancelledError extends TwilioError {
    causes: string[] = [
      'The incoming call was cancelled because it was not answered in time or it was accepted/rejected by another application instance registered with the same identity.',
    ];
    code: number = 31008;
    description: string = 'Call cancelled';
    explanation: string = 'Unable to answer because the call has ended';
    name: string = 'CallCancelledError';
    solutions: string[] = [];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, GeneralErrors.CallCancelledError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class TransportError extends TwilioError {
    causes: string[] = [];
    code: number = 31009;
    description: string = 'Transport error';
    explanation: string = 'No transport available to send or receive messages';
    name: string = 'TransportError';
    solutions: string[] = [];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, GeneralErrors.TransportError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }
}

export namespace MalformedRequestErrors {
  /**
   * Error received from the Twilio backend.
   */
  export class MalformedRequestError extends TwilioError {
    causes: string[] = [
      'Invalid content or MessageType passed to sendMessage method.',
    ];
    code: number = 31100;
    description: string = 'The request had malformed syntax.';
    explanation: string = 'The request could not be understood due to malformed syntax.';
    name: string = 'MalformedRequestError';
    solutions: string[] = [
      'Ensure content and MessageType passed to sendMessage method are valid.',
    ];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, MalformedRequestErrors.MalformedRequestError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class MissingParameterArrayError extends TwilioError {
    causes: string[] = [];
    code: number = 31101;
    description: string = 'Missing parameter array in request';
    explanation: string = '';
    name: string = 'MissingParameterArrayError';
    solutions: string[] = [];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, MalformedRequestErrors.MissingParameterArrayError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class AuthorizationTokenMissingError extends TwilioError {
    causes: string[] = [];
    code: number = 31102;
    description: string = 'Authorization token missing in request.';
    explanation: string = '';
    name: string = 'AuthorizationTokenMissingError';
    solutions: string[] = [];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, MalformedRequestErrors.AuthorizationTokenMissingError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class MaxParameterLengthExceededError extends TwilioError {
    causes: string[] = [];
    code: number = 31103;
    description: string = 'Maximum parameter length has been exceeded.';
    explanation: string = 'Length of parameters cannot exceed MAX_PARAM_LENGTH.';
    name: string = 'MaxParameterLengthExceededError';
    solutions: string[] = [];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, MalformedRequestErrors.MaxParameterLengthExceededError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class InvalidBridgeTokenError extends TwilioError {
    causes: string[] = [];
    code: number = 31104;
    description: string = 'Invalid bridge token';
    explanation: string = '';
    name: string = 'InvalidBridgeTokenError';
    solutions: string[] = [];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, MalformedRequestErrors.InvalidBridgeTokenError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class InvalidClientNameError extends TwilioError {
    causes: string[] = [
      'Client name contains invalid characters.',
    ];
    code: number = 31105;
    description: string = 'Invalid client name';
    explanation: string = 'Client name should not contain control, space, delims, or unwise characters.';
    name: string = 'InvalidClientNameError';
    solutions: string[] = [
      'Make sure that client name does not contain any of the invalid characters.',
    ];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, MalformedRequestErrors.InvalidClientNameError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class ReconnectParameterInvalidError extends TwilioError {
    causes: string[] = [];
    code: number = 31107;
    description: string = 'The reconnect parameter is invalid';
    explanation: string = '';
    name: string = 'ReconnectParameterInvalidError';
    solutions: string[] = [];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, MalformedRequestErrors.ReconnectParameterInvalidError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }
}

export namespace AuthorizationErrors {
  /**
   * Error received from the Twilio backend.
   */
  export class AuthorizationError extends TwilioError {
    causes: string[] = [];
    code: number = 31201;
    description: string = 'Authorization error';
    explanation: string = 'The request requires user authentication. The server understood the request, but is refusing to fulfill it.';
    name: string = 'AuthorizationError';
    solutions: string[] = [];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, AuthorizationErrors.AuthorizationError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class NoValidAccountError extends TwilioError {
    causes: string[] = [];
    code: number = 31203;
    description: string = 'No valid account';
    explanation: string = '';
    name: string = 'NoValidAccountError';
    solutions: string[] = [];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, AuthorizationErrors.NoValidAccountError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class InvalidJWTTokenError extends TwilioError {
    causes: string[] = [];
    code: number = 31204;
    description: string = 'Invalid JWT token';
    explanation: string = '';
    name: string = 'InvalidJWTTokenError';
    solutions: string[] = [];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, AuthorizationErrors.InvalidJWTTokenError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class JWTTokenExpiredError extends TwilioError {
    causes: string[] = [];
    code: number = 31205;
    description: string = 'JWT token expired';
    explanation: string = '';
    name: string = 'JWTTokenExpiredError';
    solutions: string[] = [];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, AuthorizationErrors.JWTTokenExpiredError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class RateExceededError extends TwilioError {
    causes: string[] = [
      'Rate limit exceeded.',
    ];
    code: number = 31206;
    description: string = 'Rate exceeded authorized limit.';
    explanation: string = 'The request performed exceeds the authorized limit.';
    name: string = 'RateExceededError';
    solutions: string[] = [
      'Ensure message send rate does not exceed authorized limits.',
    ];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, AuthorizationErrors.RateExceededError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class JWTTokenExpirationTooLongError extends TwilioError {
    causes: string[] = [];
    code: number = 31207;
    description: string = 'JWT token expiration too long';
    explanation: string = '';
    name: string = 'JWTTokenExpirationTooLongError';
    solutions: string[] = [];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, AuthorizationErrors.JWTTokenExpirationTooLongError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class ReconnectAttemptError extends TwilioError {
    causes: string[] = [];
    code: number = 31209;
    description: string = 'Reconnect attempt is not authorized.';
    explanation: string = '';
    name: string = 'ReconnectAttemptError';
    solutions: string[] = [];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, AuthorizationErrors.ReconnectAttemptError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class CallMessageEventTypeInvalidError extends TwilioError {
    causes: string[] = [
      'The Call Message Event Type is invalid and is not understood by Twilio Voice.',
    ];
    code: number = 31210;
    description: string = 'Call Message Event Type is invalid.';
    explanation: string = 'The Call Message Event Type is invalid and is not understood by Twilio Voice.';
    name: string = 'CallMessageEventTypeInvalidError';
    solutions: string[] = [
      'Ensure the Call Message Event Type is Valid and understood by Twilio Voice and try again.',
    ];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, AuthorizationErrors.CallMessageEventTypeInvalidError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class PayloadSizeExceededError extends TwilioError {
    causes: string[] = [
      'The payload size of Call Message Event exceeds the authorized limit.',
    ];
    code: number = 31212;
    description: string = 'Call Message Event Payload size exceeded authorized limit.';
    explanation: string = 'The request performed to send a Call Message Event exceeds the payload size authorized limit';
    name: string = 'PayloadSizeExceededError';
    solutions: string[] = [
      'Reduce payload size of Call Message Event to be within the authorized limit and try again.',
    ];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, AuthorizationErrors.PayloadSizeExceededError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }
}

export namespace UserMediaErrors {
  /**
   * Error received from the Twilio backend.
   */
  export class PermissionDeniedError extends TwilioError {
    causes: string[] = [
      'The user denied the getUserMedia request.',
      'The browser denied the getUserMedia request.',
    ];
    code: number = 31401;
    description: string = 'UserMedia Permission Denied Error';
    explanation: string = 'The browser or end-user denied permissions to user media. Therefore we were unable to acquire input audio.';
    name: string = 'PermissionDeniedError';
    solutions: string[] = [
      'The user should accept the request next time prompted. If the browser saved the deny, the user should change that permission in their browser.',
      'The user should to verify that the browser has permission to access the microphone at this address.',
    ];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, UserMediaErrors.PermissionDeniedError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class AcquisitionFailedError extends TwilioError {
    causes: string[] = [
      'NotFoundError - The deviceID specified was not found.',
      'The getUserMedia constraints were overconstrained and no devices matched.',
    ];
    code: number = 31402;
    description: string = 'UserMedia Acquisition Failed Error';
    explanation: string = 'The browser and end-user allowed permissions, however getting the media failed. Usually this is due to bad constraints, but can sometimes fail due to browser, OS or hardware issues.';
    name: string = 'AcquisitionFailedError';
    solutions: string[] = [
      'Ensure the deviceID being specified exists.',
      'Try acquiring media with fewer constraints.',
    ];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, UserMediaErrors.AcquisitionFailedError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }
}

export namespace SignalingErrors {
  /**
   * Error received from the Twilio backend.
   */
  export class ConnectionError extends TwilioError {
    causes: string[] = [];
    code: number = 53000;
    description: string = 'Signaling connection error';
    explanation: string = 'Raised whenever a signaling connection error occurs that is not covered by a more specific error code.';
    name: string = 'ConnectionError';
    solutions: string[] = [];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, SignalingErrors.ConnectionError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class ConnectionDisconnected extends TwilioError {
    causes: string[] = [
      'The device running your application lost its Internet connection.',
    ];
    code: number = 53001;
    description: string = 'Signaling connection disconnected';
    explanation: string = 'Raised whenever the signaling connection is unexpectedly disconnected.';
    name: string = 'ConnectionDisconnected';
    solutions: string[] = [
      'Ensure the device running your application has access to a stable Internet connection.',
    ];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, SignalingErrors.ConnectionDisconnected.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }
}

export namespace MediaErrors {
  /**
   * Error received from the Twilio backend.
   */
  export class ClientLocalDescFailed extends TwilioError {
    causes: string[] = [
      'The Client may not be using a supported WebRTC implementation.',
      'The Client may not have the necessary resources to create or apply a new media description.',
    ];
    code: number = 53400;
    description: string = 'Client is unable to create or apply a local media description';
    explanation: string = 'Raised whenever a Client is unable to create or apply a local media description.';
    name: string = 'ClientLocalDescFailed';
    solutions: string[] = [
      'If you are experiencing this error using the JavaScript SDK, ensure you are running it with a supported WebRTC implementation.',
    ];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, MediaErrors.ClientLocalDescFailed.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class ClientRemoteDescFailed extends TwilioError {
    causes: string[] = [
      'The Client may not be using a supported WebRTC implementation.',
      'The Client may be connecting peer-to-peer with another Participant that is not using a supported WebRTC implementation.',
      'The Client may not have the necessary resources to apply a new media description.',
    ];
    code: number = 53402;
    description: string = 'Client is unable to apply a remote media description';
    explanation: string = 'Raised whenever the Client receives a remote media description but is unable to apply it.';
    name: string = 'ClientRemoteDescFailed';
    solutions: string[] = [
      'If you are experiencing this error using the JavaScript SDK, ensure you are running it with a supported WebRTC implementation.',
    ];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, MediaErrors.ClientRemoteDescFailed.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }

  /**
   * Error received from the Twilio backend.
   */
  export class ConnectionError extends TwilioError {
    causes: string[] = [
      'The Client was unable to establish a media connection.',
      'A media connection which was active failed liveliness checks.',
    ];
    code: number = 53405;
    description: string = 'Media connection failed';
    explanation: string = 'Raised by the Client or Server whenever a media connection fails.';
    name: string = 'ConnectionError';
    solutions: string[] = [
      'If the problem persists, try connecting to another region.',
      'Check your Client\'s network connectivity.',
      'If you\'ve provided custom ICE Servers then ensure that the URLs and credentials are valid.',
    ];

    /**
     * @internal
     */
    constructor();
    /**
     * @internal
     */
    constructor(message: string);
    /**
     * @internal
     */
    constructor(error: Error | object);
    /**
     * @internal
     */
    constructor(message: string, error: Error | object);
    /**
     * @internal
     */
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, MediaErrors.ConnectionError.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = `${this.name} (${this.code}): ${message}`;
      this.originalError = originalError;
    }
  }
}

/**
 * @private
 */
export const errorsByCode: ReadonlyMap<number, any> = new Map([
  [ 20101, AuthorizationErrors.AccessTokenInvalid ],
  [ 20104, AuthorizationErrors.AccessTokenExpired ],
  [ 20151, AuthorizationErrors.AuthenticationFailed ],
  [ 31202, SignatureValidationErrors.AccessTokenSignatureValidationFailed ],
  [ 31400, ClientErrors.BadRequest ],
  [ 31404, ClientErrors.NotFound ],
  [ 31480, ClientErrors.TemporarilyUnavailable ],
  [ 31486, ClientErrors.BusyHere ],
  [ 31603, SIPServerErrors.Decline ],
  [ 31000, GeneralErrors.UnknownError ],
  [ 31001, GeneralErrors.ApplicationNotFoundError ],
  [ 31002, GeneralErrors.ConnectionDeclinedError ],
  [ 31003, GeneralErrors.ConnectionTimeoutError ],
  [ 31005, GeneralErrors.ConnectionError ],
  [ 31008, GeneralErrors.CallCancelledError ],
  [ 31009, GeneralErrors.TransportError ],
  [ 31100, MalformedRequestErrors.MalformedRequestError ],
  [ 31101, MalformedRequestErrors.MissingParameterArrayError ],
  [ 31102, MalformedRequestErrors.AuthorizationTokenMissingError ],
  [ 31103, MalformedRequestErrors.MaxParameterLengthExceededError ],
  [ 31104, MalformedRequestErrors.InvalidBridgeTokenError ],
  [ 31105, MalformedRequestErrors.InvalidClientNameError ],
  [ 31107, MalformedRequestErrors.ReconnectParameterInvalidError ],
  [ 31201, AuthorizationErrors.AuthorizationError ],
  [ 31203, AuthorizationErrors.NoValidAccountError ],
  [ 31204, AuthorizationErrors.InvalidJWTTokenError ],
  [ 31205, AuthorizationErrors.JWTTokenExpiredError ],
  [ 31206, AuthorizationErrors.RateExceededError ],
  [ 31207, AuthorizationErrors.JWTTokenExpirationTooLongError ],
  [ 31209, AuthorizationErrors.ReconnectAttemptError ],
  [ 31210, AuthorizationErrors.CallMessageEventTypeInvalidError ],
  [ 31212, AuthorizationErrors.PayloadSizeExceededError ],
  [ 31401, UserMediaErrors.PermissionDeniedError ],
  [ 31402, UserMediaErrors.AcquisitionFailedError ],
  [ 53000, SignalingErrors.ConnectionError ],
  [ 53001, SignalingErrors.ConnectionDisconnected ],
  [ 53400, MediaErrors.ClientLocalDescFailed ],
  [ 53402, MediaErrors.ClientRemoteDescFailed ],
  [ 53405, MediaErrors.ConnectionError ],
]);

Object.freeze(errorsByCode);
