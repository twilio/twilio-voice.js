/**
 * @packageDocumentation
 * @internalapi
 */
/* tslint:disable max-classes-per-file */
import { AuthorizationErrors, ClientErrors, errorsByCode, GeneralErrors, MediaErrors, SignalingErrors, TwilioError, UserMediaErrors, } from './generated';
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
// All errors we want to throw or emit locally in the SDK need to be passed through here.
export { AuthorizationErrors, ClientErrors, GeneralErrors, MediaErrors, SignalingErrors, TwilioError, UserMediaErrors, };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL2Vycm9ycy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O0dBR0c7QUFDSCx5Q0FBeUM7QUFDekMsT0FBTyxFQUNMLG1CQUFtQixFQUNuQixZQUFZLEVBQ1osWUFBWSxFQUNaLGFBQWEsRUFDYixXQUFXLEVBQ1gsZUFBZSxFQUNmLFdBQVcsRUFDWCxlQUFlLEdBQ2hCLE1BQU0sYUFBYSxDQUFDO0FBRXJCLDJEQUEyRDtBQUMzRCxNQUFNLE9BQU8sb0JBQXFCLFNBQVEsS0FBSztJQUM3QyxZQUFZLE9BQWdCO1FBQzFCLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNmLElBQUksQ0FBQyxJQUFJLEdBQUcsc0JBQXNCLENBQUM7SUFDckMsQ0FBQztDQUNGO0FBQ0QsTUFBTSxPQUFPLGlCQUFrQixTQUFRLEtBQUs7SUFDMUMsWUFBWSxPQUFnQjtRQUMxQixLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDZixJQUFJLENBQUMsSUFBSSxHQUFHLG1CQUFtQixDQUFDO0lBQ2xDLENBQUM7Q0FDRjtBQUNELE1BQU0sT0FBTyxpQkFBa0IsU0FBUSxLQUFLO0lBQzFDLFlBQVksT0FBZ0I7UUFDMUIsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2YsSUFBSSxDQUFDLElBQUksR0FBRyxtQkFBbUIsQ0FBQztJQUNsQyxDQUFDO0NBQ0Y7QUFFRCx1RUFBdUU7QUFDdkUsc0NBQXNDO0FBQ3RDLE1BQU0sVUFBVSxjQUFjLENBQUMsSUFBWTtJQUN6QyxNQUFNLEtBQUssR0FBcUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN2RSxJQUFJLENBQUMsS0FBSyxFQUFFO1FBQ1YsTUFBTSxJQUFJLG9CQUFvQixDQUFDLGNBQWMsSUFBSSxZQUFZLENBQUMsQ0FBQztLQUNoRTtJQUNELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQztBQUVELHVFQUF1RTtBQUN2RSxzQ0FBc0M7QUFDdEMsTUFBTSxVQUFVLGNBQWMsQ0FBQyxJQUFZO0lBQ3pDLE9BQU8sWUFBWSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNoQyxDQUFDO0FBRUQseUZBQXlGO0FBQ3pGLE9BQU8sRUFDTCxtQkFBbUIsRUFDbkIsWUFBWSxFQUNaLGFBQWEsRUFDYixXQUFXLEVBQ1gsZUFBZSxFQUNmLFdBQVcsRUFDWCxlQUFlLEdBQ2hCLENBQUMifQ==