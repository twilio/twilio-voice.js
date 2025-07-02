/**
 * Base class for all possible errors that the library can receive from the
 * Twilio backend.
 */
export default class TwilioError extends Error {
    /**
     * @internal
     */
    constructor(messageOrError, error) {
        super();
        Object.setPrototypeOf(this, TwilioError.prototype);
        const message = typeof messageOrError === 'string'
            ? messageOrError
            : this.explanation;
        const originalError = typeof messageOrError === 'object'
            ? messageOrError
            : error;
        this.message = `${this.name} (${this.code}): ${message}`;
        this.originalError = originalError;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHdpbGlvRXJyb3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL2Vycm9ycy90d2lsaW9FcnJvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O0dBR0c7QUFDSCxNQUFNLENBQUMsT0FBTyxPQUFPLFdBQVksU0FBUSxLQUFLO0lBeUM1Qzs7T0FFRztJQUNILFlBQVksY0FBd0MsRUFBRSxLQUFzQjtRQUMxRSxLQUFLLEVBQUUsQ0FBQztRQUNSLE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUVuRCxNQUFNLE9BQU8sR0FBVyxPQUFPLGNBQWMsS0FBSyxRQUFRO1lBQ3hELENBQUMsQ0FBQyxjQUFjO1lBQ2hCLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDO1FBRXJCLE1BQU0sYUFBYSxHQUErQixPQUFPLGNBQWMsS0FBSyxRQUFRO1lBQ2xGLENBQUMsQ0FBQyxjQUFjO1lBQ2hCLENBQUMsQ0FBQyxLQUFLLENBQUM7UUFFVixJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsSUFBSSxNQUFNLE9BQU8sRUFBRSxDQUFDO1FBQ3pELElBQUksQ0FBQyxhQUFhLEdBQUcsYUFBYSxDQUFDO0lBQ3JDLENBQUM7Q0FDRiJ9