const fs = require('fs');
const VoiceErrors = require('@twilio/voice-errors');

const USED_ERRORS = [
  'AuthorizationErrors.AccessTokenExpired',
  'AuthorizationErrors.AccessTokenInvalid',
  'AuthorizationErrors.AuthenticationFailed',
  'AuthorizationErrors.PayloadSizeExceededError',
  'AuthorizationErrors.RateExceededError',
  'ClientErrors.BadRequest',
  'GeneralErrors.CallCancelledError',
  'GeneralErrors.ConnectionError',
  'GeneralErrors.TransportError',
  'GeneralErrors.UnknownError',
  'MalformedRequestErrors.MalformedRequestError',
  'MediaErrors.ClientLocalDescFailed',
  'MediaErrors.ClientRemoteDescFailed',
  'MediaErrors.ConnectionError',
  'SignalingErrors.ConnectionDisconnected',
  'SignalingErrors.ConnectionError',
  'UserMediaErrors.PermissionDeniedError',
  'UserMediaErrors.AcquisitionFailedError',
];

let output = `/* tslint:disable max-classes-per-file max-line-length */
/**
 * @packageDocumentation
 * @module Voice
 * @publicapi
 * @internal
 */

/**
 * This is a generated file. Any modifications here will be overwritten. See scripts/errors.js.
 */
import TwilioError from './twilioError';
export { TwilioError };
\n`;

const escapeQuotes = str => str.replace("'", "\\'");
const generateStringArray = arr => arr ? `[
      ${arr.map(value => `'${escapeQuotes(value)}'`).join(',\n      ')},
    ]` : '[]';

const generateDefinition = (code, subclassName, errorName, error) => `\
  export class ${errorName} extends TwilioError {
    causes: string[] = ${generateStringArray(error.causes)};
    code: number = ${code};
    description: string = '${escapeQuotes(error.description)}';
    explanation: string = '${escapeQuotes(error.explanation)}';
    name: string = '${escapeQuotes(errorName)}';
    solutions: string[] = ${generateStringArray(error.solutions)};

    constructor();
    constructor(message: string);
    constructor(error: Error | object);
    constructor(message: string, error: Error | object);
    constructor(messageOrError?: string | Error | object, error?: Error | object) {
      super(messageOrError, error);
      Object.setPrototypeOf(this, ${subclassName}Errors.${errorName}.prototype);

      const message: string = typeof messageOrError === 'string'
        ? messageOrError
        : this.explanation;

      const originalError: Error | object | undefined = typeof messageOrError === 'object'
        ? messageOrError
        : error;

      this.message = \`\${this.name} (\${this.code}): \${message}\`;
      this.originalError = originalError;
    }
  }`;

const generateNamespace = (name, contents) => `export namespace ${name}Errors {
${contents}
}\n\n`;

let mapEntries = [];
for (const topClass of VoiceErrors) {
  for (const subclass of topClass.subclasses) {
    const subclassName = subclass.class.replace(' ', '');
    const definitions = [];
    for (const error of subclass.errors) {
      const code = (topClass.code * 1000) + ((subclass.code || 0) * 100) + error.code;
      const errorName = error.name.replace(' ', '');

      const fullName = `${subclassName}Errors.${errorName}`;
      if (USED_ERRORS.includes(fullName)) {
        const definition = generateDefinition(code, subclassName, errorName, error);
        definitions.push(definition);
        mapEntries.push(`[ ${code}, ${fullName} ]`);
      }
    }
    if (mapEntries.length && definitions.length) {
      output += generateNamespace(subclassName, definitions.join('\n\n'));
    }
  }
}

output += `/**
 * @private
 */
export const errorsByCode: ReadonlyMap<number, any> = new Map([
  ${mapEntries.join(',\n  ')},
]);

Object.freeze(errorsByCode);\n`;

fs.writeFileSync('./lib/twilio/errors/generated.ts', output, 'utf8');
