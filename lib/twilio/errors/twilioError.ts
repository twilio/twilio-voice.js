/**
 * Base class for all possible errors that the library can receive from the
 * Twilio backend.
 */
export default class TwilioError extends Error {
  /**
   * A list of possible causes for the Error.
   */
  causes: string[];

  /**
   * The numerical code associated with this Error.
   */
  code: number;

  /**
   * A description of what the Error means.
   */
  description: string;

  /**
   * An explanation of when the Error may be observed.
   */
  explanation: string;

  /**
   * Any further information discovered and passed along at run-time.
   */
  message: string;

  /**
   * The name of this Error.
   */
  name: string;

  /**
   * The original error object received from the external system, if any.
   */
  originalError?: object;

  /**
   * A list of potential solutions for the Error.
   */
  solutions: string[];

  /**
   * @internal
   */
  constructor(messageOrError?: string | Error | object, error?: Error | object) {
    super();
    Object.setPrototypeOf(this, TwilioError.prototype);

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
