import Log from './log';

const REGISTRATION_INTERVAL = 30000;

/**
 * Manages device registration lifecycle with the signaling server.
 * @private
 */
class RegistrationManager {
  private _regTimer: NodeJS.Timeout | null = null;
  private _log: Log = new Log('RegistrationManager');

  shouldReRegister: boolean = false;

  /**
   * Register or unregister with the signaling server.
   * @param presence - Whether to register (true) or unregister (false).
   * @param streamConnectedPromise - Promise resolving to the connected stream.
   */
  async sendPresence(
    presence: boolean,
    streamConnectedPromise: Promise<any> | null,
  ): Promise<void> {
    const stream = await streamConnectedPromise;

    if (!stream) { return; }

    stream.register({ audio: presence });
    if (presence) {
      this.startTimer(streamConnectedPromise);
    } else {
      this.stopTimer();
    }
  }

  /**
   * Start a timeout to periodically re-register.
   */
  startTimer(streamConnectedPromise: Promise<any> | null): void {
    this.stopTimer();
    this._regTimer = setTimeout(() => {
      this.sendPresence(true, streamConnectedPromise);
    }, REGISTRATION_INTERVAL);
  }

  /**
   * Stop the registration timer.
   */
  stopTimer(): void {
    if (this._regTimer) {
      clearTimeout(this._regTimer);
      this._regTimer = null;
    }
  }
}

export default RegistrationManager;
