/**
 * @packageDocumentation
 * @internalapi
 */
/* tslint:disable max-classes-per-file */
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
// Application errors that can be avoided by good app logic
export class InvalidArgumentError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InvalidArgumentError';
    }
}
export class InvalidStateError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InvalidStateError';
    }
}
export class NotSupportedError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NotSupportedError';
    }
}
// This should only be used to look up error codes returned by a server
// using the same repo of error codes.
export function getErrorByCode(code) {
    const error = errorsByCode.get(code);
    if (!error) {
        throw new InvalidArgumentError(`Error code ${code} not found`);
    }
    return error;
}
// This should only be used to look up error codes returned by a server
// using the same repo of error codes.
export function hasErrorByCode(code) {
    return errorsByCode.has(code);
}
/**
 * All errors we want to throw or emit locally in the SDK need to be passed
 * through here.
 *
 * They need to first be defined in the `USED_ERRORS` list. See:
 * ```
 * scripts/errors.js
 * ```
 */
export { AuthorizationErrors, ClientErrors, GeneralErrors, MalformedRequestErrors, MediaErrors, SignalingErrors, SignatureValidationErrors, SIPServerErrors, TwilioError, UserMediaErrors, };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL2Vycm9ycy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O0dBR0c7QUFDSCx5Q0FBeUM7QUFDekMsT0FBTyxFQUNMLG1CQUFtQixFQUNuQixZQUFZLEVBQ1osWUFBWSxFQUNaLGFBQWEsRUFDYixzQkFBc0IsRUFDdEIsV0FBVyxFQUNYLGVBQWUsRUFDZix5QkFBeUIsRUFDekIsZUFBZSxFQUNmLFdBQVcsRUFDWCxlQUFlLEdBQ2hCLE1BQU0sYUFBYSxDQUFDO0FBRXJCOzs7Ozs7Ozs7R0FTRztBQUNILE1BQU0sNkJBQTZCLEdBQWdCLElBQUksR0FBRyxDQUFDO0lBQ3pEOztPQUVHO0lBQ0gsS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO0lBQ0w7O09BRUc7SUFDSCxLQUFLO0lBQ0wsS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO0lBQ0wsS0FBSztJQUNMLEtBQUs7SUFDTDs7T0FFRztJQUNILEtBQUs7SUFDTCxLQUFLO0lBQ0wsS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO0lBQ0wsS0FBSztJQUNMOztPQUVHO0lBQ0gsS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO0lBQ0w7O09BRUc7SUFDSCxLQUFLO0NBQ04sQ0FBQyxDQUFDO0FBQ0gsTUFBTSxVQUFVLDhCQUE4QixDQUM1QyxxQ0FBOEMsRUFDOUMsU0FBaUI7SUFFakIsSUFBSSxPQUFPLFNBQVMsS0FBSyxRQUFRLEVBQUU7UUFDakMsT0FBTztLQUNSO0lBRUQsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsRUFBRTtRQUM5QixPQUFPO0tBQ1I7SUFFRCxNQUFNLGVBQWUsR0FBRyxxQ0FBcUM7UUFDM0QsQ0FBQyxDQUFDLElBQUk7UUFDTixDQUFDLENBQUMsQ0FBQyw2QkFBNkIsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDbEQsSUFBSSxDQUFDLGVBQWUsRUFBRTtRQUNwQixPQUFPO0tBQ1I7SUFFRCxPQUFPLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUNuQyxDQUFDO0FBRUQsMkRBQTJEO0FBQzNELE1BQU0sT0FBTyxvQkFBcUIsU0FBUSxLQUFLO0lBQzdDLFlBQVksT0FBZ0I7UUFDMUIsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2YsSUFBSSxDQUFDLElBQUksR0FBRyxzQkFBc0IsQ0FBQztJQUNyQyxDQUFDO0NBQ0Y7QUFDRCxNQUFNLE9BQU8saUJBQWtCLFNBQVEsS0FBSztJQUMxQyxZQUFZLE9BQWdCO1FBQzFCLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNmLElBQUksQ0FBQyxJQUFJLEdBQUcsbUJBQW1CLENBQUM7SUFDbEMsQ0FBQztDQUNGO0FBQ0QsTUFBTSxPQUFPLGlCQUFrQixTQUFRLEtBQUs7SUFDMUMsWUFBWSxPQUFnQjtRQUMxQixLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDZixJQUFJLENBQUMsSUFBSSxHQUFHLG1CQUFtQixDQUFDO0lBQ2xDLENBQUM7Q0FDRjtBQUVELHVFQUF1RTtBQUN2RSxzQ0FBc0M7QUFDdEMsTUFBTSxVQUFVLGNBQWMsQ0FBQyxJQUFZO0lBQ3pDLE1BQU0sS0FBSyxHQUFxQyxZQUFZLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3ZFLElBQUksQ0FBQyxLQUFLLEVBQUU7UUFDVixNQUFNLElBQUksb0JBQW9CLENBQUMsY0FBYyxJQUFJLFlBQVksQ0FBQyxDQUFDO0tBQ2hFO0lBQ0QsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDO0FBRUQsdUVBQXVFO0FBQ3ZFLHNDQUFzQztBQUN0QyxNQUFNLFVBQVUsY0FBYyxDQUFDLElBQVk7SUFDekMsT0FBTyxZQUFZLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2hDLENBQUM7QUFFRDs7Ozs7Ozs7R0FRRztBQUNILE9BQU8sRUFDTCxtQkFBbUIsRUFDbkIsWUFBWSxFQUNaLGFBQWEsRUFDYixzQkFBc0IsRUFDdEIsV0FBVyxFQUNYLGVBQWUsRUFDZix5QkFBeUIsRUFDekIsZUFBZSxFQUNmLFdBQVcsRUFDWCxlQUFlLEdBQ2hCLENBQUMifQ==