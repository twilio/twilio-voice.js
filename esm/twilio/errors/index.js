/* tslint:disable max-classes-per-file */
// TODO: Consider refactoring this export (VBLOCKS-4589)
import { AuthorizationErrors, ClientErrors, errorsByCode, GeneralErrors, MalformedRequestErrors, MediaErrors, SignalingErrors, SignatureValidationErrors, SIPServerErrors, TwilioError, UserMediaErrors, } from './generated';
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
export function getPreciseSignalingErrorByCode(enableImprovedSignalingErrorPrecision, errorCode) {
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
export class InvalidArgumentError extends Error {
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
export class InvalidStateError extends Error {
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
export class NotSupportedError extends Error {
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
export function getErrorByCode(code) {
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
export function hasErrorByCode(code) {
    return errorsByCode.has(code);
}
/**
 * @privateRemarks
 *
 * All errors we want to throw or emit locally in the SDK need to be passed
 * through here.
 *
 * They need to first be defined in the `USED_ERRORS` list. See:
 * ```
 * scripts/errors.js
 * ```
 */
export { AuthorizationErrors, ClientErrors, GeneralErrors, MalformedRequestErrors, MediaErrors, SignalingErrors, SignatureValidationErrors, SIPServerErrors, TwilioError, UserMediaErrors, };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL2Vycm9ycy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSx5Q0FBeUM7QUFFekMsd0RBQXdEO0FBRXhELE9BQU8sRUFDTCxtQkFBbUIsRUFDbkIsWUFBWSxFQUNaLFlBQVksRUFDWixhQUFhLEVBQ2Isc0JBQXNCLEVBQ3RCLFdBQVcsRUFDWCxlQUFlLEVBQ2YseUJBQXlCLEVBQ3pCLGVBQWUsRUFDZixXQUFXLEVBQ1gsZUFBZSxHQUNoQixNQUFNLGFBQWEsQ0FBQztBQUVyQjs7Ozs7Ozs7O0dBU0c7QUFDSCxNQUFNLDZCQUE2QixHQUFnQixJQUFJLEdBQUcsQ0FBQztJQUN6RDs7T0FFRztJQUNILEtBQUs7SUFDTCxLQUFLO0lBQ0wsS0FBSztJQUNMOztPQUVHO0lBQ0gsS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO0lBQ0wsS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO0lBQ0w7O09BRUc7SUFDSCxLQUFLO0lBQ0wsS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO0lBQ0wsS0FBSztJQUNMLEtBQUs7SUFDTDs7T0FFRztJQUNILEtBQUs7SUFDTCxLQUFLO0lBQ0wsS0FBSztJQUNMOztPQUVHO0lBQ0gsS0FBSztDQUNOLENBQUMsQ0FBQztBQUVIOzs7Ozs7Ozs7O0dBVUc7QUFDSCxNQUFNLFVBQVUsOEJBQThCLENBQzVDLHFDQUE4QyxFQUM5QyxTQUFpQjtJQUVqQixJQUFJLE9BQU8sU0FBUyxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQ2xDLE9BQU87SUFDVCxDQUFDO0lBRUQsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO1FBQy9CLE9BQU87SUFDVCxDQUFDO0lBRUQsTUFBTSxlQUFlLEdBQUcscUNBQXFDO1FBQzNELENBQUMsQ0FBQyxJQUFJO1FBQ04sQ0FBQyxDQUFDLENBQUMsNkJBQTZCLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ2xELElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUNyQixPQUFPO0lBQ1QsQ0FBQztJQUVELE9BQU8sY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ25DLENBQUM7QUFFRDs7R0FFRztBQUNILE1BQU0sT0FBTyxvQkFBcUIsU0FBUSxLQUFLO0lBQzdDOztPQUVHO0lBQ0gsWUFBWSxPQUFnQjtRQUMxQixLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDZixJQUFJLENBQUMsSUFBSSxHQUFHLHNCQUFzQixDQUFDO0lBQ3JDLENBQUM7Q0FDRjtBQUVEOztHQUVHO0FBQ0gsTUFBTSxPQUFPLGlCQUFrQixTQUFRLEtBQUs7SUFDMUM7O09BRUc7SUFDSCxZQUFZLE9BQWdCO1FBQzFCLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNmLElBQUksQ0FBQyxJQUFJLEdBQUcsbUJBQW1CLENBQUM7SUFDbEMsQ0FBQztDQUNGO0FBRUQ7OztHQUdHO0FBQ0gsTUFBTSxPQUFPLGlCQUFrQixTQUFRLEtBQUs7SUFDMUM7O09BRUc7SUFDSCxZQUFZLE9BQWdCO1FBQzFCLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNmLElBQUksQ0FBQyxJQUFJLEdBQUcsbUJBQW1CLENBQUM7SUFDbEMsQ0FBQztDQUNGO0FBRUQ7Ozs7R0FJRztBQUNILE1BQU0sVUFBVSxjQUFjLENBQUMsSUFBWTtJQUN6QyxNQUFNLEtBQUssR0FBcUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN2RSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDWCxNQUFNLElBQUksb0JBQW9CLENBQUMsY0FBYyxJQUFJLFlBQVksQ0FBQyxDQUFDO0lBQ2pFLENBQUM7SUFDRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUM7QUFFRDs7OztHQUlHO0FBQ0gsTUFBTSxVQUFVLGNBQWMsQ0FBQyxJQUFZO0lBQ3pDLE9BQU8sWUFBWSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNoQyxDQUFDO0FBRUQ7Ozs7Ozs7Ozs7R0FVRztBQUNILE9BQU8sRUFDTCxtQkFBbUIsRUFDbkIsWUFBWSxFQUNaLGFBQWEsRUFDYixzQkFBc0IsRUFDdEIsV0FBVyxFQUNYLGVBQWUsRUFDZix5QkFBeUIsRUFDekIsZUFBZSxFQUNmLFdBQVcsRUFDWCxlQUFlLEdBQ2hCLENBQUMifQ==