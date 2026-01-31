import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';

// Timeout for device registration and call setup (ms)
export const SETUP_TIMEOUT = 30000;
export const CALL_SETUP_TIMEOUT = 30000;
// Time to wait after registration before making calls (ms)
export const POST_REGISTRATION_DELAY = 2000;
// Number of times to retry the call if it fails
export const CALL_RETRY_ATTEMPTS = 3;
// Delay between retry attempts (ms)
export const CALL_RETRY_DELAY = 2000;

// Default call params used in tests
export const DEFAULT_CALL_PARAMS = {
  Custom1: 'foo + bar',
  Custom2: undefined,
  Custom3: '我不吃蛋',
};

// Helper to wait for a specified duration
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface CallConnectParams {
  [key: string]: string | undefined;
}

export interface AttemptCallOptions {
  /** Parameters to pass to the connect call */
  params?: CallConnectParams;
}

// Helper to attempt a call with retry logic
export async function attemptCallWithRetry(
  device1: Device,
  device2: Device,
  identity2: string,
  maxAttempts: number = CALL_RETRY_ATTEMPTS,
  attemptTimeout: number = 8000,
  options: AttemptCallOptions = {}
): Promise<{ call1: Call; call2: Call }> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Verify devices are still registered before attempting
      if (device1.state !== Device.State.Registered) {
        console.log(`Attempt ${attempt}: device1 not registered, re-registering...`);
        await device1.register();
        await wait(POST_REGISTRATION_DELAY);
      }
      if (device2.state !== Device.State.Registered) {
        console.log(`Attempt ${attempt}: device2 not registered, re-registering...`);
        await device2.register();
        await wait(POST_REGISTRATION_DELAY);
      }

      const result = await attemptCall(device1, device2, identity2, attemptTimeout, options);
      return result;
    } catch (err) {
      lastError = err as Error;
      console.log(`Call attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`);
      if (attempt < maxAttempts) {
        await wait(CALL_RETRY_DELAY);
      }
    }
  }

  throw new Error(`All ${maxAttempts} call attempts failed. Last error: ${lastError?.message}`);
}

// Helper to attempt a single call
export function attemptCall(
  device1: Device,
  device2: Device,
  identity2: string,
  timeoutMs: number,
  options: AttemptCallOptions = {}
): Promise<{ call1: Call; call2: Call }> {
  const params = {
    To: identity2,
    ...DEFAULT_CALL_PARAMS,
    ...options.params,
  };

  return new Promise((resolve, reject) => {
    let call1: Call | null = null;
    let call2: Call | null = null;
    let resolved = false;

    const cleanup = () => {
      device2.removeListener(Device.EventName.Incoming, incomingHandler);
    };

    const tryResolve = () => {
      if (!resolved && call1 && call2) {
        resolved = true;
        clearTimeout(timeout);
        cleanup();
        resolve({ call1, call2 });
      }
    };

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        // Clean up if call1 was established but call2 never received
        if (call1) {
          try { call1.disconnect(); } catch (e) { /* ignore */ }
        }
        reject(new Error(`Timed out waiting for incoming call on device2`));
      }
    }, timeoutMs);

    const incomingHandler = (call: Call) => {
      if (resolved) return;
      call2 = call;
      tryResolve();
    };

    // Set up listener BEFORE initiating the call
    device2.once(Device.EventName.Incoming, incomingHandler);

    // Initiate the call
    (device1['connect'] as any)({ params }).then((call: Call) => {
      if (resolved) return;
      call1 = call;
      tryResolve();
    }).catch((err: Error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        cleanup();
        reject(new Error(`Failed to initiate call: ${err.message}`));
      }
    });
  });
}

// Helper to register devices and wait for them to be ready
export async function registerDevices(
  device1: Device,
  device2: Device,
  postRegistrationDelay: number = POST_REGISTRATION_DELAY
): Promise<void> {
  await Promise.all([
    device1.register(),
    device2.register(),
  ]);

  // Wait for devices to be fully ready after registration
  await wait(postRegistrationDelay);
}

// Helper to clean up devices
export function cleanupDevices(device1?: Device, device2?: Device): void {
  if (device1) {
    device1.disconnectAll();
    device1.destroy();
  }

  if (device2) {
    device2.disconnectAll();
    device2.destroy();
  }
}
