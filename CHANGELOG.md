2.6.0 (June 20, 2023)
=====================

Changes
-------

- The SDK now builds on NodeJS versions 16 and above without the `--legacy-peer-deps` flag.
- Removed usage of NodeJS modules from the SDK and some dependencies. With this change, the SDK should now work with some of the latest frameworks that use the latest versions of bundlers such as Vite and Webpack.
- The AudioPlayer dependency has been incorporated into the SDK as part of a migration. This change fixes an issue where source maps are not properly loaded.
- Removed unnecessary files from the generated npm package.
- Links to source maps are now included in the generated npm package.
- The `ws` package has been moved to `devDependencies`.
- The SDK no longer depends on the `xmlhttprequest` npm package.

2.5.0 (May 9, 2023)
===================

New Features
------------

### WebRTC API Overrides (Beta)

The SDK now allows you to override WebRTC APIs using the following options and events. If your environment supports WebRTC redirection, such as [Citrix HDX](https://www.citrix.com/solutions/vdi-and-daas/hdx/what-is-hdx.html)'s WebRTC [redirection technologies](https://www.citrix.com/blogs/2019/01/15/hdx-a-webrtc-manifesto/), your application can use this new *beta* feature for improved audio quality in those environments.

- [Device.Options.enumerateDevices](https://twilio.github.io/twilio-voice.js/interfaces/voice.device.options.html#enumeratedevices)
- [Device.Options.getUserMedia](https://twilio.github.io/twilio-voice.js/interfaces/voice.device.options.html#getusermedia)
- [Device.Options.RTCPeerConnection](https://twilio.github.io/twilio-voice.js/interfaces/voice.device.options.html#rtcpeerconnection)
- [call.on('audio', handler(remoteAudio))](https://twilio.github.io/twilio-voice.js/classes/voice.call.html#audioevent)

2.4.0 (April 6, 2023)
===================

Changes
-------

- Updated the description of [Device.updateToken](https://twilio.github.io/twilio-voice.js/classes/voice.device.html#updatetoken) API. It is recommended to call this API after [Device.tokenWillExpireEvent](https://twilio.github.io/twilio-voice.js/classes/voice.device.html#tokenwillexpireevent) is emitted, and before or after a call to prevent a potential ~1s audio loss during the update process.

- Updated stats reporting to stop using deprecated `RTCIceCandidateStats` - `ip` and `deleted`.

Bug Fixes
---------

- Fixed an [issue](https://github.com/twilio/twilio-voice.js/issues/100) where a `TypeError` is thrown after rejecting a call then invoking `updateToken`.

- Fixed an issue (https://github.com/twilio/twilio-voice.js/issues/87, https://github.com/twilio/twilio-voice.js/issues/145) where the `PeerConnection` object is not properly disposed.

- Fixed an [issue](https://github.com/twilio/twilio-voice.js/issues/14) where `device.audio.disconnect`, `device.audio.incoming` and `device.audio.outgoing` do not have the correct type definitions.

- Fixed an [issue](https://github.com/twilio/twilio-voice.js/issues/126) where the internal `deviceinfochange` event is being emitted indefinitely, causing high cpu usage.

2.3.2 (February 27, 2023)
===================

Bug Fixes
---------

- Fixed an [issue](https://github.com/twilio/twilio-voice.js/issues/95) where a Twilio error is not returned when microphone access is blocked. Thank you @SiimMardus and @ostap0207 for your [contribution](https://github.com/twilio/twilio-voice.js/pull/143).

2.3.1 (February 3, 2023)
===================

Bug Fixes
---------

- Fixed an [issue](https://github.com/twilio/twilio-voice.js/issues/133) where incoming sound will not stop playing after the call is disconnected. Thank you @kamalbennani for your [contribution](https://github.com/twilio/twilio-voice.js/pull/134).

2.3.0 (January 23, 2023)
===================

Changes
-------

This release includes updated DNS names for [Twilio Edge Locations](https://www.twilio.com/docs/global-infrastructure/edge-locations). The Voice JS SDK uses these Edge Locations to connect to Twilio’s infrastructure via the parameter `Device.Options.edge`. The current usage of this parameter does not change as the SDK automatically maps the edge value to the new DNS names.

Additionally, you need to update your [Content Security Policies (CSP)](README.md#content-security-policy-csp) if you have it enabled for your application. You also need to update your network configuration such as firewalls, if necessary, to allow connections to the new [DNS names and IP addresses](https://www.twilio.com/docs/voice/sdks/network-connectivity-requirements).

2.2.0 (December 5, 2022)
===================

New Features
------------

### Call Message Events (Beta)

The SDK can now send and receive custom messages to and from Twilio's backend via the following new `Call` APIs.

- [sendMessage](https://twilio.github.io/twilio-voice.js/classes/voice.call.html#sendmessage)
- [messageReceivedEvent](https://twilio.github.io/twilio-voice.js/classes/voice.call.html#messagereceivedevent)
- [messageSentEvent](https://twilio.github.io/twilio-voice.js/classes/voice.call.html#messagesentevent)

Please visit this [page](https://www.twilio.com/docs/voice/sdks/call-message-events) for more details about this feature. Additionally, please see the following for more information on how to send and receive messages on the server.

- [UserDefinedMessage](https://www.twilio.com/docs/voice/api/userdefinedmessage-resource)
- [UserDefinedMessageSubscription](https://www.twilio.com/docs/voice/api/userdefinedmessagesubscription-resource)

**NOTE:** This feature should not be used with [PII](https://www.twilio.com/docs/glossary/what-is-personally-identifiable-information-pii).

**Example**

```js
const device = new Device(token, options);

const setupCallHandlers = call => {
  call.on('messageReceived', message => messageReceivedHandler(message));
  call.on('messageSent', message => messageSentHandler(message));
};

// For outgoing calls
const call = await device.connect();
setupCallHandlers(call);

// For incoming calls
device.on('incoming', call => setupCallHandlers(call));
await device.register();

// For sending a message
const eventSid = call.sendMessage({
  content: { foo: 'foo' },
  messageType: Call.MessageType.UserDefinedMessage,
});
```

2.1.2 (October 26, 2022)
========================

Bug Fixes
---------

- Fixed an issue where insights data stops getting published after calling `device.updateOptions`.

2.1.1 (February 18, 2022)
=========================

Bug Fixes
---------

- Ignoring a call will now properly stop the ringing sound
- NPM versioning has been fixed to specify >=12 rather than exactly 12
- Use DOMException instead of DOMError, which has been deprecated
- Removed npm util from the package, instead favoring native functions

2.1.0 (December 16, 2021)
=========================

New Features
------------

### Signaling Reconnection Support

The SDK now fully supports Call reconnection. Previously, the SDK only truly supported media reconnection -- if the
media connection was lost but the signaling websocket recovered (generally within 10-15 seconds), reconnecting
the Call was possible. However, if the websocket was lost, the Call was lost. Now, the SDK is able to reconnect
a Call even if the websocket is lost. This means that a Call can potentially be recovered up to 30 seconds or
in a network handover event, in which a user switches networks during a call.

When a call has encountered a network error and signaling reconnection has succeeded, the `Call` object will emit the
`reconnected` event.

```ts
const call = await device.connect(...);
call.on('reconnected', () => { ... });
```

There exists a limitation such that Signaling Reconnection and Edge Fallback are mutually exclusive. To opt-in to the Signaling Reconnection feature, a new option can be passed to the SDK: `maxCallSignalingTimeoutMs`. If this value is not present in the options object passed to the `Device` constructor, the default value will be `0`.

Using a value of `30000` as an example: while a `Call` exists, the `Device` will attempt to reconnect to the edge that the `Call` was established on for approximately 30 seconds. After the next failure to connect, the Device will use edge-fallback.

```ts
const token = ...;
const options = {
  ...,
  edge: ['ashburn', 'sydney'],
  maxCallSignalingTimeoutMs: 30000,
};
const device = new Device(token, options);

const call = device.connect(...);

// As an example, the device has connected to the `ashburn` edge.

call.on('accept', () => {
  // Starting here, the device will only attempt to connect to `ashburn` if a
  // network loss occurs.
  // If it cannot connect within `maxCallSignalingTimeoutMs` (in this case 30
  // seconds), then it will resort to Edge Fallback.
  // The first Edge Fallback attempt will be the next `edge`, in this case
  // `sydney`, as specified by the `edge` option passed to the `Device`.
});
```

In order to ensure automatic reconnection is possible at any time, we've also added `Device.Event.TokenWillExpire`,
which should prompt the application to obtain a new token and call `Device.updateToken()`.

### Device.Event.TokenWillExpire

By default, this new event will fire 10 seconds prior to the AccessToken's expiration, prompting the application
to provide a new token. This can be changed by setting `Device.Options.tokenRefreshMs` to something other than the
default of `10000` ms.

```ts
const device = new Device(token, {
  tokenRefreshMs: 30000,
});

device.on('tokenWillExpire', () => {
  return getTokenViaAjax().then(token => dev.updateToken(token));
});
```

### Twilio Regional Support

The Twilio Voice JS SDK now supports Twilio Regional. To use a home region, please specify the desired home region in the access token before passing the token to the Twilio `Device`. This home region parameter should be matched with the appropriate `edge` parameter when instantiating a Twilio `Device`. The home region determines the location of your Insights data, as opposed to the `edge` that your call connects to Twilio through.

If you are using the `twilio-node` helper library to mint access tokens within your backend, you can specify the `au1` home region like so:

```ts
const accessToken = new twilio.jwt.AccessToken(
  credentials.accountSid,
  credentials.apiKeySid,
  credentials.apiKeySecret, {
    identity,
    ttl,
    region: 'au1',
  },
);

const grant = new VoiceGrant({
  outgoingApplicationSid: credentials.twimlAppSid,
  incomingAllow: true,
});

accessToken.addGrant(grant);

const device = new Device(accessToken, {
  edge: 'sydney',
});
```

Note that the API Key and Secret and TwiML App above must be created within the `au1` region.

The current home region can be retrieved from the read-only string `Device.home`, which contains the currently
connected home region after a successful registration.

### Device.identity

After successfully registering, the Device will now have a read-only string, `Device.identity`, which exposes
the identity passed via token.

Fixes
-----

- Updated `ws` version to fix a potential security vulnerability.
- We now properly clean up all event listeners after `Device.destroy()`
- We now log a warning rather than an throwing an uncaught promise rejection when Insights
  fails to post an event.


2.0.1 (July 9, 2021)
====================

This patch increment was necessary because the 2.0.0 pilot artifact was erroneously published to npm. It is
now removed from npm so that it is not mistakenly used. The first npm artifact will be 2.0.1.


2.0.0 (July 7, 2021)
====================

## Migration from twilio-client.js 1.x
This product, Twilio's JavaScript Voice SDK, is the next version of Twilio's Javascript Client SDK. It is
now in GA and we recommend all customers migrate in order to continue receiving future feature additions.
For help on migrating from 1.x, see our [migration guide](https://www.twilio.com/docs/voice/client/migrating-to-js-voice-sdk-20).

**Note:**: These changes are cumulative with the 2.0.0-preview.1 changes below. If you are looking to
upgrade from twilio-client.js 1.x, see the 2.0.0-preview.1 section below for the full 2.0 changelog.

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

2.0.0-preview.1 (Apr 30, 2021) - Pilot
======================================

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
