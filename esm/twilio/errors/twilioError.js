/**
 * Base class for all possible errors that the library can receive from the
 * Twilio backend.
 */
class TwilioError extends Error {
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

export { TwilioError as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHdpbGlvRXJyb3IuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi90d2lsaW8vZXJyb3JzL3R3aWxpb0Vycm9yLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUFHRztBQUNXLE1BQU8sV0FBWSxTQUFRLEtBQUssQ0FBQTtBQXlDNUM7O0FBRUc7SUFDSCxXQUFBLENBQVksY0FBd0MsRUFBRSxLQUFzQixFQUFBO0FBQzFFLFFBQUEsS0FBSyxFQUFFO1FBQ1AsTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLFNBQVMsQ0FBQztBQUVsRCxRQUFBLE1BQU0sT0FBTyxHQUFXLE9BQU8sY0FBYyxLQUFLO0FBQ2hELGNBQUU7QUFDRixjQUFFLElBQUksQ0FBQyxXQUFXO0FBRXBCLFFBQUEsTUFBTSxhQUFhLEdBQStCLE9BQU8sY0FBYyxLQUFLO0FBQzFFLGNBQUU7Y0FDQSxLQUFLO0FBRVQsUUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLENBQUEsRUFBRyxJQUFJLENBQUMsSUFBSSxDQUFBLEVBQUEsRUFBSyxJQUFJLENBQUMsSUFBSSxDQUFBLEdBQUEsRUFBTSxPQUFPLEVBQUU7QUFDeEQsUUFBQSxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWE7SUFDcEM7QUFDRDs7OzsifQ==
