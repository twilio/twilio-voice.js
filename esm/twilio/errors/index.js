import { errorsByCode } from './generated.js';
export { AuthorizationErrors, ClientErrors, GeneralErrors, MalformedRequestErrors, MediaErrors, SIPServerErrors, SignalingErrors, SignatureValidationErrors, UserMediaErrors } from './generated.js';
export { default as TwilioError } from './twilioError.js';

/* tslint:disable max-classes-per-file */
// TODO: Consider refactoring this export (VBLOCKS-4589)
/**
 * NOTE(mhuynh): Replacing generic error codes with new (more specific) codes,
 * is a breaking change. If an error code is found in this set, we only perform
 * the transformation if the feature flag is enabled.
 *
 * With every major version bump, such that we are allowed to introduce breaking
 * changes as per semver specification, this array should be cleared.
 *
 * TODO: [VBLOCKS-2295] Remove this in 3.x
 */
const PRECISE_SIGNALING_ERROR_CODES = new Set([
    /**
     * 310XX Errors
     */
    31001,
    31002,
    31003,
    /**
     * 311XX Errors
     */
    31101,
    31102,
    31103,
    31104,
    31105,
    31107,
    /**
     * 312XX Errors
     */
    31201,
    31202,
    31203,
    31204,
    31205,
    31207,
    /**
     * 314XX Errors
     */
    31404,
    31480,
    31486,
    /**
     * 316XX Errors
     */
    31603,
]);
/**
 * Get an error constructor using the [[PRECISE_SIGNALING_ERROR_CODES]] set.
 * @internal
 * @param enableImprovedSignalingErrorPrecision - A boolean representing the
 * optional flag whether or not to use more precise error codes.
 * @param errorCode - The error code.
 * @returns This function returns `undefined` if the passed error code does not
 * correlate to an error or should not be constructed with a more precise error
 * constructor. A sub-class of {@link TwilioError} if the code does correlate to
 * an error.
 */
function getPreciseSignalingErrorByCode(enableImprovedSignalingErrorPrecision, errorCode) {
    if (typeof errorCode !== 'number') {
        return;
    }
    if (!hasErrorByCode(errorCode)) {
        return;
    }
    const shouldTransform = enableImprovedSignalingErrorPrecision
        ? true
        : !PRECISE_SIGNALING_ERROR_CODES.has(errorCode);
    if (!shouldTransform) {
        return;
    }
    return getErrorByCode(errorCode);
}
/**
 * The error that is thrown when an invalid argument is passed to a library API.
 */
class InvalidArgumentError extends Error {
    /**
     * @internal
     */
    constructor(message) {
        super(message);
        this.name = 'InvalidArgumentError';
    }
}
/**
 * The error that is thrown when the library has entered an invalid state.
 */
class InvalidStateError extends Error {
    /**
     * @internal
     */
    constructor(message) {
        super(message);
        this.name = 'InvalidStateError';
    }
}
/**
 * The error that is thrown when an attempt is made to use an API that is not
 * supported on the current platform.
 */
class NotSupportedError extends Error {
    /**
     * @internal
     */
    constructor(message) {
        super(message);
        this.name = 'NotSupportedError';
    }
}
/**
 * This should only be used to look up error codes returned by a server
 * using the same repo of error codes.
 * @internal
 */
function getErrorByCode(code) {
    const error = errorsByCode.get(code);
    if (!error) {
        throw new InvalidArgumentError(`Error code ${code} not found`);
    }
    return error;
}
/**
 * This should only be used to look up error codes returned by a server
 * using the same repo of error codes.
 * @internal
 */
function hasErrorByCode(code) {
    return errorsByCode.has(code);
}

export { InvalidArgumentError, InvalidStateError, NotSupportedError, getErrorByCode, getPreciseSignalingErrorByCode, hasErrorByCode };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi90d2lsaW8vZXJyb3JzL2luZGV4LnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7QUFBQTtBQUVBO0FBZ0JBOzs7Ozs7Ozs7QUFTRztBQUNILE1BQU0sNkJBQTZCLEdBQWdCLElBQUksR0FBRyxDQUFDO0FBQ3pEOztBQUVHO0lBQ0gsS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO0FBQ0w7O0FBRUc7SUFDSCxLQUFLO0lBQ0wsS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO0lBQ0wsS0FBSztJQUNMLEtBQUs7QUFDTDs7QUFFRztJQUNILEtBQUs7SUFDTCxLQUFLO0lBQ0wsS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO0lBQ0wsS0FBSztBQUNMOztBQUVHO0lBQ0gsS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO0FBQ0w7O0FBRUc7SUFDSCxLQUFLO0FBQ04sQ0FBQSxDQUFDO0FBRUY7Ozs7Ozs7Ozs7QUFVRztBQUNHLFNBQVUsOEJBQThCLENBQzVDLHFDQUE4QyxFQUM5QyxTQUFpQixFQUFBO0FBRWpCLElBQUEsSUFBSSxPQUFPLFNBQVMsS0FBSyxRQUFRLEVBQUU7UUFDakM7SUFDRjtBQUVBLElBQUEsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsRUFBRTtRQUM5QjtJQUNGO0lBRUEsTUFBTSxlQUFlLEdBQUc7QUFDdEIsVUFBRTtVQUNBLENBQUMsNkJBQTZCLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQztJQUNqRCxJQUFJLENBQUMsZUFBZSxFQUFFO1FBQ3BCO0lBQ0Y7QUFFQSxJQUFBLE9BQU8sY0FBYyxDQUFDLFNBQVMsQ0FBQztBQUNsQztBQUVBOztBQUVHO0FBQ0csTUFBTyxvQkFBcUIsU0FBUSxLQUFLLENBQUE7QUFDN0M7O0FBRUc7QUFDSCxJQUFBLFdBQUEsQ0FBWSxPQUFnQixFQUFBO1FBQzFCLEtBQUssQ0FBQyxPQUFPLENBQUM7QUFDZCxRQUFBLElBQUksQ0FBQyxJQUFJLEdBQUcsc0JBQXNCO0lBQ3BDO0FBQ0Q7QUFFRDs7QUFFRztBQUNHLE1BQU8saUJBQWtCLFNBQVEsS0FBSyxDQUFBO0FBQzFDOztBQUVHO0FBQ0gsSUFBQSxXQUFBLENBQVksT0FBZ0IsRUFBQTtRQUMxQixLQUFLLENBQUMsT0FBTyxDQUFDO0FBQ2QsUUFBQSxJQUFJLENBQUMsSUFBSSxHQUFHLG1CQUFtQjtJQUNqQztBQUNEO0FBRUQ7OztBQUdHO0FBQ0csTUFBTyxpQkFBa0IsU0FBUSxLQUFLLENBQUE7QUFDMUM7O0FBRUc7QUFDSCxJQUFBLFdBQUEsQ0FBWSxPQUFnQixFQUFBO1FBQzFCLEtBQUssQ0FBQyxPQUFPLENBQUM7QUFDZCxRQUFBLElBQUksQ0FBQyxJQUFJLEdBQUcsbUJBQW1CO0lBQ2pDO0FBQ0Q7QUFFRDs7OztBQUlHO0FBQ0csU0FBVSxjQUFjLENBQUMsSUFBWSxFQUFBO0lBQ3pDLE1BQU0sS0FBSyxHQUFxQyxZQUFZLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQztJQUN0RSxJQUFJLENBQUMsS0FBSyxFQUFFO0FBQ1YsUUFBQSxNQUFNLElBQUksb0JBQW9CLENBQUMsY0FBYyxJQUFJLENBQUEsVUFBQSxDQUFZLENBQUM7SUFDaEU7QUFDQSxJQUFBLE9BQU8sS0FBSztBQUNkO0FBRUE7Ozs7QUFJRztBQUNHLFNBQVUsY0FBYyxDQUFDLElBQVksRUFBQTtBQUN6QyxJQUFBLE9BQU8sWUFBWSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUM7QUFDL0I7Ozs7In0=
