/* tslint:disable max-classes-per-file max-line-length */
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */

/**
 * This is a generated file. Any modifications here will be overwritten. See scripts/errors.js.
 */
import TwilioError from './twilioError';
export { TwilioError };

export namespace AuthorizationErrors {
  export class AccessTokenInvalid extends TwilioError {
    causes: string[] = [];
    code: number = 20101;
    description: string = 'Invalid access token';
    explanation: string = 'Twilio was unable to validate your Access Token';
    name: string = 'AccessTokenInvalid';
    solutions: string[] = [];

    constructor();
    constructor(message: string);
    constructor(error: Error | object);
    constructor(message: string, error: Error | object);
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

  export class AccessTokenExpired extends TwilioError {
    causes: string[] = [];
    code: number = 20104;
    description: string = 'Access token expired or expiration date invalid';
    explanation: string = 'The Access Token provided to the Twilio API has expired, the expiration time specified in the token was invalid, or the expiration time specified was too far in the future';
    name: string = 'AccessTokenExpired';
    solutions: string[] = [];

    constructor();
    constructor(message: string);
    constructor(error: Error | object);
    constructor(message: string, error: Error | object);
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

  export class AuthenticationFailed extends TwilioError {
    causes: string[] = [];
    code: number = 20151;
    description: string = 'Authentication Failed';
    explanation: string = 'The Authentication with the provided JWT failed';
    name: string = 'AuthenticationFailed';
    solutions: string[] = [];

    constructor();
    constructor(message: string);
    constructor(error: Error | object);
    constructor(message: string, error: Error | object);
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

export namespace ClientErrors {
  export class BadRequest extends TwilioError {
    causes: string[] = [];
    code: number = 31400;
    description: string = 'Bad Request (HTTP/SIP)';
    explanation: string = 'The request could not be understood due to malformed syntax.';
    name: string = 'BadRequest';
    solutions: string[] = [];

    constructor();
    constructor(message: string);
    constructor(error: Error | object);
    constructor(message: string, error: Error | object);
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
}

export namespace GeneralErrors {
  export class UnknownError extends TwilioError {
    causes: string[] = [];
    code: number = 31000;
    description: string = 'Unknown Error';
    explanation: string = 'An unknown error has occurred. See error details for more information.';
    name: string = 'UnknownError';
    solutions: string[] = [];

    constructor();
    constructor(message: string);
    constructor(error: Error | object);
    constructor(message: string, error: Error | object);
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

  export class ConnectionError extends TwilioError {
    causes: string[] = [];
    code: number = 31005;
    description: string = 'Connection error';
    explanation: string = 'A connection error occurred during the call';
    name: string = 'ConnectionError';
    solutions: string[] = [];

    constructor();
    constructor(message: string);
    constructor(error: Error | object);
    constructor(message: string, error: Error | object);
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

  export class CallCancelledError extends TwilioError {
    causes: string[] = [
      'The incoming call was cancelled because it was not answered in time or it was accepted/rejected by another application instance registered with the same identity.',
    ];
    code: number = 31008;
    description: string = 'Call cancelled';
    explanation: string = 'Unable to answer because the call has ended';
    name: string = 'CallCancelledError';
    solutions: string[] = [];

    constructor();
    constructor(message: string);
    constructor(error: Error | object);
    constructor(message: string, error: Error | object);
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

  export class TransportError extends TwilioError {
    causes: string[] = [];
    code: number = 31009;
    description: string = 'Transport error';
    explanation: string = 'No transport available to send or receive messages';
    name: string = 'TransportError';
    solutions: string[] = [];

    constructor();
    constructor(message: string);
    constructor(error: Error | object);
    constructor(message: string, error: Error | object);
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

    constructor();
    constructor(message: string);
    constructor(error: Error | object);
    constructor(message: string, error: Error | object);
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
}

export namespace AuthorizationErrors {
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

    constructor();
    constructor(message: string);
    constructor(error: Error | object);
    constructor(message: string, error: Error | object);
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

  export class PayloadSizeExceededError extends TwilioError {
    causes: string[] = [
      'The payload size of Call Message Event exceeds the authorized limit.',
    ];
    code: number = 31209;
    description: string = 'Call Message Event Payload size exceeded authorized limit.';
    explanation: string = 'The request performed to send a Call Message Event exceeds the payload size authorized limit';
    name: string = 'PayloadSizeExceededError';
    solutions: string[] = [
      'Reduce payload size of Call Message Event to be within the authorized limit and try again.',
    ];

    constructor();
    constructor(message: string);
    constructor(error: Error | object);
    constructor(message: string, error: Error | object);
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

    constructor();
    constructor(message: string);
    constructor(error: Error | object);
    constructor(message: string, error: Error | object);
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

    constructor();
    constructor(message: string);
    constructor(error: Error | object);
    constructor(message: string, error: Error | object);
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
  export class ConnectionError extends TwilioError {
    causes: string[] = [];
    code: number = 53000;
    description: string = 'Signaling connection error';
    explanation: string = 'Raised whenever a signaling connection error occurs that is not covered by a more specific error code.';
    name: string = 'ConnectionError';
    solutions: string[] = [];

    constructor();
    constructor(message: string);
    constructor(error: Error | object);
    constructor(message: string, error: Error | object);
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

    constructor();
    constructor(message: string);
    constructor(error: Error | object);
    constructor(message: string, error: Error | object);
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

    constructor();
    constructor(message: string);
    constructor(error: Error | object);
    constructor(message: string, error: Error | object);
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

    constructor();
    constructor(message: string);
    constructor(error: Error | object);
    constructor(message: string, error: Error | object);
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

    constructor();
    constructor(message: string);
    constructor(error: Error | object);
    constructor(message: string, error: Error | object);
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
  [ 31400, ClientErrors.BadRequest ],
  [ 31000, GeneralErrors.UnknownError ],
  [ 31005, GeneralErrors.ConnectionError ],
  [ 31008, GeneralErrors.CallCancelledError ],
  [ 31009, GeneralErrors.TransportError ],
  [ 31100, MalformedRequestErrors.MalformedRequestError ],
  [ 31206, AuthorizationErrors.RateExceededError ],
  [ 31209, AuthorizationErrors.PayloadSizeExceededError ],
  [ 31401, UserMediaErrors.PermissionDeniedError ],
  [ 31402, UserMediaErrors.AcquisitionFailedError ],
  [ 53000, SignalingErrors.ConnectionError ],
  [ 53001, SignalingErrors.ConnectionDisconnected ],
  [ 53400, MediaErrors.ClientLocalDescFailed ],
  [ 53402, MediaErrors.ClientRemoteDescFailed ],
  [ 53405, MediaErrors.ConnectionError ],
]);

Object.freeze(errorsByCode);
