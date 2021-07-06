2.1.0 (In Progress) - Release
===================

Fixes
-----

### Error updating `edge` parameter with `Device.updateOptions`

An error surrounding re-registration was fixed that occurred when updating the
`edge` option.

Breaking API Changes
--------------------

### Active call no longer accessible through the Device object.

`Device.activeCall` is no longer available. Instead, the application should keep
a reference to any call that is made using connect or accepted.

```ts
const token = '...';
const options = { ... };
const device = new Device(token, options);

await device.register();

const call = await device.connect();
```

2.0.0 (Apr 30, 2021) - Pilot
===================

#### This version is currently in the Pilot phase!
This product, Twilio's JavaScript Voice SDK, is the next version of Twilio's Javascript Client SDK. It
is currently in the Pilot phase while we gather customer feedback. In this phase, it is possible that some
aspects of the API may change before GA. If you'd prefer, you can use the
[stable version of the SDK](https://github.com/twilio/twilio-client.js).

If you're interested in testing out the 2.0 pilot, see our [migration guide](https://www.twilio.com/docs/voice/client/migrating-to-js-voice-sdk-20).

Breaking API Changes
--------------------

### Device singleton behavior removed
Device must now be instantiated before it can be used. Calling `Device.setup()` will no longer
work; instead, a new `Device` must be instantiated via `new Device(token, options?)`.

### Connection renamed to Call
As Connection is an overloaded and ambiguous term, the class has been renamed Call to better
indicate what the object represents and be more consistent with Mobile SDKs and our REST APIs.

### Signaling connection now lazy loaded
`Device.setup()` has been removed, and `new Device(...)` will not automatically begin
connecting to signaling. There is no need to listen for `Device.on('ready')`. Instead,
the signaling connection will automatically be acquired in one of two scenarios:

1. The application calls `Device.connect()`, creating an outbound Call. In this case,
the state of the signaling connection will be represented in the Call.
2. The application calls `Device.register()`, which will register the SDK to listen
for incoming calls at the identity specified in the AccessToken.

#### Note on token expiration
As long as outgoing calls are expected to be made, or incoming calls are expected to be received,
the token supplied to `Device` should be fresh and not expired. This can be done by setting a
timer in the application to call `updateToken` with the new token shortly before the prior
token expires. This is important, because signaling connection is lazy loaded and will fail if
the token is not valid at the time of creation.

Example:
```ts
const TTL = 600000; // Assuming our endpoint issues tokens for 600 seconds (10 minutes)
const REFRESH_TIMER = TTL - 30000; // We update our token 30 seconds before expiration;
const interval = setInterval(async () => {
  const newToken = await getNewTokenViaAjax();
  device.updateToken(newToken);
}, REFRESH_TIMER);
```

### Device states changed

The Device states have changed. The states were: `[Ready, Busy, Offline]`. These
have been changed to more accurately and clearly represent the states of the
Device. There are two changes to Device state:
1. The states themselves have changed to `[Registered, Registering, Unregistered, Destroyed]`. This
removes the idea of "Busy" from the state, as technically the Device can have an active
Call whether it is registered or not, depending on the use case. The Device will always
starty as `Unregistered`. In this state, it can still make outbound Calls. Once `Device.register()`
has been called, this state will change to `Registering` and finally `Registered`. If
`Device.unregister()` is called the state will revert to `Unregistered`. If the signaling
connection is lost, the state will transition to `Registering` or `Unregistered' depending
on whether or not the connection can be re-established.

The `destroyed` state represents a `Device` that has been "destroyed" by calling
`Device.destroy`. The device should be considered unusable at this point and a
new one should be constructed for further use.

2. The busy state has been moved to a boolean, `Device.isBusy`. This is a very basic
shortcut for the logic `return !!device.activeConnection`.

### Device events changed

The events emitted by the `Device` are represented by the `Device.EventName`
enum and represent the new Device states:

```ts
export enum EventName {
  Destroyed = 'destroyed',
  Error = 'error',
  Incoming = 'incoming',
  Unregistered = 'unregistered',
  Registering = 'registering',
  Registered = 'registered',
}
```

Note that `unregistered`, `registering`, and `registered` have replaced
`offline` and `ready`. Although frequently used to represent connected or disconnected,
`ready` and `offline` actually were meant to represent `registered` and `unregistered`,
which was quite ambiguous and a primary reason for the change.

When the device is destroyed using `Device.destroy`, a `"destroyed"` event will
be emitted.

### Device usage changes

The construction signature and usage of `Device` has changed. These are the new API signatures:

```ts
/**
 * Create a new Device. This is synchronous and will not open a signaling socket immediately.
 */
new Device(token: string, options?: Device.Options): Device;

/**
 * Promise resolves when the Device has successfully registered.
 * Replaces Device.registerPresence()
 * Can reject if the Device is unusable, i.e. "destroyed".
 */
async Device.register(): Promise<void>;
/**
 * Promise resolves when the Device has successfully unregistered.
 * Replaces Device.unregisterPresence()
 * Can reject if the Device is unusable, i.e. "destroyed".
 */
async Device.unregister(): Promise<void>;
/**
 * Promise resolves when signaling is established and a Call has been created.
 * Can reject if the Device is unusable, i.e. "destroyed".
 */
async Device.connect(options?: Device.ConnectOptions): Promise<Call>;
```

#### Listening for incoming calls:
```ts
const device = new Device(token, { edge: 'ashburn' });

device.on(Device.EventName.Incoming, call => { /* use `call` here */ });
await device.register();
```

#### Making an outgoing call:
```ts
const device = new Device(token, { edge: 'ashburn' });
const call = await device.connect({ To: 'alice' });
```

### Device#CallOptions and Call#AcceptOptions standardized
The arguments for `Device.connect()` and `Call.accept()` have been standardized
to the following options objects:

```ts
interface Call.AcceptOptions {
  /**
   * An RTCConfiguration to pass to the RTCPeerConnection constructor.
   */
  rtcConfiguration?: RTCConfiguration;

  /**
   * MediaStreamConstraints to pass to getUserMedia when making or accepting a Call.
   */
  rtcConstraints?: MediaStreamConstraints;
}
```

```ts
interface Device.ConnectOptions extends Call.AcceptOptions {
 /**
  * A flat object containing key:value pairs to be sent to the TwiML app.
  */
  params?: Record<string, string>;
}
```

Note that these now take a [MediaStreamConstraints](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamConstraints) rather than just the audio constraints. For example:
```ts
device.connect({ To: 'client:alice' }, { deviceId: 'default' });
```

might be re-written as:
```ts
device.connect({
  params: { To: 'client:alice' },
  rtcConstraints: { audio: { deviceId: 'default' } },
});
```

### Moved to new Error format
For backward compatibility, the new error format was attached to the old format under `error.twilioError`:
```ts
class oldError extends Error {
  //...
  code: number;
  message: string;
  twilioError: TwilioError;
}
```

The new Error format is:
```ts
class TwilioError extends Error {
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
   * The original Error received from the external system, if any.
   */
  originalError?: Error;

  /**
   * A list of potential solutions for the Error.
   */
  solutions: string[];
}
```

#### Affected Error Codes
With the transition, the following error codes have changed:
- 31003 -> 53405 | When ICE connection fails
- 31201 -> 31402 | When getting user media fails
- 31208 -> 31401 | When user denies access to user media
- 31901 -> 53000 | When websocket times out in preflight

New Features
------------

### Device Options

Previously, `Device.setup()` could only be used the set options once. Now, we've added
`Device.updateOptions(options: Device.Options)` which will allow changing
the Device options without instantiating a new Device. Note that the `edge` cannot be changed
during an active Call.

Example usage:

```ts
const options = { edge: 'ashburn' };
const device = new Device(token, options);

// Later...

device.updateOptions({ allowIncomingWhileBusy: true });
```

The resulting (non-default) options would now be:
```ts
{
  allowIncomingWhileBusy: true,
  edge: 'ashburn',
}
```

This function will throw with an `InvalidStateError` if the Device has been
destroyed beforehand.

### LogLevel Module

The SDK now uses the [`loglevel`](https://github.com/pimterry/loglevel) module. This exposes
several new features for the SDK, including the ability to intercept log messages with custom
handlers and the ability to set logging levels after instantiating a `Device`. To get an instance
of the `loglevel` `Logger` class used internally by the SDK:

```ts
import { Logger } from '@twilio/voice-sdk';
...
Logger.setLogLevel('DEBUG');
```

Please see the original [`loglevel`](https://github.com/pimterry/loglevel) project for more
documentation on usage.


Deprecations
------------

### Connection Deprecations

- Removed `Connection.mediaStream`. To access the MediaStreams, use `Connection.getRemoteStream()` and `Connection.getLocalStream()`
- Removed `Connection.message` in favor of the newer `Connection.customParameters`. Where `.message` was an Object, `.customParameters` is a `Map`.
- Removed the following private members from the public interface:
   - `Connection.options`
   - `Connection.pstream`
   - `Connection.sendHangup`
- Fixed `Connection.on('cancel')` logic so that we no longer emit `cancel` in response to `Connection.ignore()`.

### Device Option Deprecations

Some deprecated `Device` options have been removed. This includes:

* `enableIceRestart`
* `enableRingingState`
* `fakeLocalDtmf`

The above three removed options are now assumed `true`. The new `Device.Options` interface is now:

```ts
export interface Options {
  allowIncomingWhileBusy?: boolean;
  appName?: string;
  appVersion?: string;
  audioConstraints?: MediaTrackConstraints | boolean;
  closeProtection?: boolean | string;
  codecPreferences?: Connection.Codec[];
  disableAudioContextSounds?: boolean;
  dscp?: boolean;
  edge?: string[] | string;
  forceAggressiveIceNomination?: boolean;
  maxAverageBitrate?: number;
  rtcConfiguration?: RTCConfiguration;
  sounds?: Partial<Record<Device.SoundName, string>>;
}
```

Fixes
-----

### MOS Calculation Formula

The formula used to calculate the mean-opinion score (MOS) has been fixed for
extreme network conditions. These fixes will not affect scores for nominal
network conditions.
