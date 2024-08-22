Preflight Test
==============

The SDK supports a preflight test API which can help determine Voice calling readiness. The API creates a test call and will provide information to help troubleshoot call related issues. This new API is a static member of the [Device](https://www.twilio.com/docs/voice/sdks/javascript/twiliodevice) class and can be used by calling `Device.runPreflight(token, options)`. For example:

```ts
import { Device, PreflightTest } from '@twilio/voice-sdk';

const preflightTest = Device.runPreflight(token, options);

preflightTest.on(PreflightTest.Events.Completed, (report) => {
  console.log(report);
});

preflightTest.on(PreflightTest.Events.Failed, (error) => {
  console.log(error);
});
```

## Parameters

### Token
`Device.runPreflight(token, options)` requires a [Twilio Access Token](https://www.twilio.com/docs/iam/access-tokens) to initiate the test call. This access token will be passed directly to the [Device's constructor](https://www.twilio.com/docs/voice/sdks/javascript/twiliodevice#instantiate-a-device) and will be used to connect to a TwiML app that you associated with your [Twilio Access Token](https://www.twilio.com/docs/iam/access-tokens). In order to get better results, the TwiML app should be able to record audio from a microphone and play it back to the browser. Please see [Preflight Test TwiML App](#twiml-app---record-and-play) for details.

### Options
The `PreflightTest.Options` parameter is a JavaScript object containing configuration settings. Available settings are listed below:

| Property | Default | Description |
|:---------|:--------|:------------|
| `codecPreferences` | `['pcmu', 'opus']` | An ordered list of preferred codecs. |
| `debug` | `false` | Can be `true` or `false`. Set this property to true to enable debug logging in your browser console. |
| `edge` | `roaming` | Specifies which Twilio `edge` to use when initiating the test call. Please see documentation on [edges](https://www.twilio.com/docs/voice/sdks/javascript/edges). |
| `fakeMicInput` | `false` | If set to `true`, the test call will ignore microphone input and will use a default audio file. If set to `false`, the test call will capture the audio from the microphone. |
| `iceServers` | `null` | An array of custom ICE servers to use to connect media. If you provide both STUN and TURN server configurations, the test will detect whether a TURN server is required to establish a connection. See [Using Twilio NTS for Generating STUN/TURN Credentials](#using-twilio-nts-for-generating-stunturn-credentials) |
| `signalingTimeoutMs` | `10000` | Ammount of time to wait for setting up signaling connection. |

### Using Twilio NTS for Generating STUN/TURN Credentials
The following example demonstrates how to use [Twilio's Network Traversal Service](https://www.twilio.com/stun-turn) to generate STUN/TURN credentials and how to specify a specific [edge location](https://www.twilio.com/docs/global-infrastructure/edge-locations).

```ts
import Client from 'twilio';
import { Device } from '@twilio/voice-sdk';

// Generate the STUN and TURN server credentials with a ttl of 120 seconds
const client = Client(twilioAccountSid, authToken);
const token = await client.tokens.create({ ttl: 120 });

let iceServers = token.iceServers;

// By default, global will be used as the default edge location.
// You can replace global with a specific edge name for each of the iceServer configuration.
iceServers = iceServers.map(config => {
  let { url, urls, ...rest } = config;
  url = url.replace('global', 'ashburn');
  urls = urls.replace('global', 'ashburn');

  return { url, urls, ...rest };
});

// Use the TURN credentials using the iceServers parameter
const preflightTest = Device.runPreflight(token, { iceServers });

// Read from the report object to determine whether TURN is required to connect to media
preflightTest.on('completed', (report) => {
  console.log(report.isTurnRequired);
});
```

Events
------

The `PreflightTest` object that is returned by `Device.runPreflight(token, options)` is an [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter), and as such its events can be subscribed to via `preflightTest.on(eventName, handler)`. The following is a list of all supported events that might get emitted throughout the duration of the test.

#### .on('completed', handler(report))
Raised when `PreflightTest.status` has transitioned to `PreflightTest.Status.Completed`. During this time, the `report` is available and ready to be inspected. This will not trigger if a fatal error is encountered during the test. Example report:

```js
{
  "callSid": "CAa6a7a187a9cba2714d6fdccf472cc7b1",

  /**
   * The quality of the call, determined by the MOS (Mean Opinion Score) of the audio stream. Possible values include
   * PreflightTest.CallQuality.Excellent - If the average mos is over 4.2
   * PreflightTest.CallQuality.Great - If the average mos is between 4.1 and 4.2 both inclusive
   * PreflightTest.CallQuality.Good - If the average mos is between 3.7 and 4.0 both inclusive
   * PreflightTest.CallQuality.Fair - If the average mos is between 3.1 and 3.6 both inclusive
   * PreflightTest.CallQuality.Degraded - If the average mos is 3.0 or below
   */
  "callQuality": "excellent",

  /**
   * An array of WebRTC stats for the ICE candidates gathered when connecting to media.
   * Each item is an RTCIceCandidateStats object which provides information related to an ICE candidate.
   * See RTCIceCandidateStats for more details https://developer.mozilla.org/en-US/docs/Web/API/RTCIceCandidateStats
   */
  "iceCandidateStats": [...]

  /**
   * A WebRTC stats for the ICE candidate pair used to connect to media, if candidates were selected.
   * Each item is an RTCIceCandidateStats object which provides information related to an ICE candidate.
   * See RTCIceCandidateStats for more details https://developer.mozilla.org/en-US/docs/Web/API/RTCIceCandidateStats
   */
  "selectedIceCandidatePairStats": {
    "localCandidate": {...},
    "remoteCandidate": {...}
  }

  /**
   * Whether a TURN server is required to connect to media.
   * This is dependent on the selected ICE candidates, and will be true if either is of type "relay",
   * false if both are of another type, or undefined if there are no selected ICE candidates.
   * See `PreflightTest.Options.iceServers` for more details.
   */
  "isTurnRequired": false,

  /**
   * Network related time measurements which includes millisecond timestamps
   * and duration for each type of connection.
   */
  "networkTiming": {
    /**
     * Measurements for establishing DTLS connection.
     * This is measured from RTCDtlsTransport `connecting` to `connected` state.
     * See RTCDtlsTransport state
     * https://developer.mozilla.org/en-US/docs/Web/API/RTCDtlsTransport/state.
     */
    "dtls": {
      "start": 1584573229981,
      "end": 1584573230166,
      "duration": 185
    },

    /**
     * Measurements for establishing ICE connection.
     * This is measured from ICE connection `checking` to `connected` state.
     * See RTCPeerConnection.iceConnectionState
     * https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/iceConnectionState.
     */
    "ice": {
      "start": 1584573229898,
      "end": 1584573229982,
      "duration": 84
    },

    /**
     * Measurements for establishing a PeerConnection.
     * This is measured from PeerConnection `connecting` to `connected` state.
     * See RTCPeerConnection.connectionState
     * https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/connectionState.
     */
    "peerConnection": {
      "start": 1584573229902,
      "end": 1584573230167,
      "duration": 265
    },

    /**
     * Measurements for establishing Signaling connection.
     * This is measured from initiating a connection using `device.connect()`,
     * up to when RTCPeerConnection.signalingState transitions to `stable` state.
     * See RTCPeerConnection.signalingState
     * https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/signalingState
     */
    "signaling": {
      "start": 1595885835227,
      "end": 1595885835573,
      "duration": 346
    }
  },

  /**
   * RTC related stats that are extracted from WebRTC samples.
   * This information includes maximum, minimum, and average values calculated for each stat.
   */
  "stats": {
    "jitter": {
      "average": 35,
      "max": 35,
      "min": 35
    },
    "mos": {
      "average": 2,
      "max": 2,
      "min": 2
    },
    "rtt": {
      "average": 80.33,
      "max": 88,
      "min": 77
    }
  },

  /**
   * Timing measurement related to the test.
   * Includes millisecond timestamps and duration.
   */
  "testTiming": {
    "start": 1584573229085,
    "end": 1584573242279,
    "duration": 13194
  },

  /**
   * Calculated totals in RTC statistics samples.
   */
  "totals": {
    "bytesReceived": 62720,
    "bytesSent": 93760,
    "packetsLost": 0,
    "packetsLostFraction": 0,
    "packetsReceived": 392,
    "packetsSent": 586
  },

  /**
   * Array of samples collected during the test.
   * See sample object format here
   * https://www.twilio.com/docs/voice/sdks/javascript/twiliocall#sample-event
   */
  "samples": [...],

  /**
   * The edge passed to `Device.runPreflight`.
   */
  "selectedEdge": "roaming",

  /**
   * The edge that the test call was connected to.
   */
  "edge": "ashburn",

  /**
   * PreflightTest.Warnings detected during the test.
   */
  "warnings": [...]
}
```

#### .on('connected', handler())
Raised when `PreflightTest.status` has transitioned to `PreflightTest.Status.Connected`. This means, the connection to Twilio has been established.

#### .on('failed', handler(error))
Raised when `PreflightTest.status` has transitioned to `PreflightTest.Status.Failed`. This happens when establishing a connection to Twilio has failed or when a test call has encountered a fatal error. This is also raised if `PreflightTest.stop` is called while the test is in progress. The error emitted from this event is coming from [Device.on('error)](https://www.twilio.com/docs/voice/sdks/javascript/twiliodevice#error-event) and uses the same error format.

#### .on('sample', handler(sample))
This event is published every second and is raised when the [Call](https://www.twilio.com/docs/voice/sdks/javascript/twiliocall) gets a webrtc sample object. The `sample` object is coming from [Call.on('sample')](https://www.twilio.com/docs/voice/sdks/javascript/twiliocall#sample-event) and uses the same `sample` format.

#### .on('warning', handler(warning))
Raised whenever the test encounters a warning. Example warning data:

```ts
{
  /**
   * Name of the warning.
   * See https://www.twilio.com/docs/voice/voice-insights/api/call/details-sdk-call-quality-events
   */
  name: 'insights-connection-error',

  /**
   * Description of the Warning.
   */
  description: 'Received an error when attempting to connect to Insights gateway',

  /**
   * Optional RTCWarning data coming from Call.on('warning')
   * See https://www.twilio.com/docs/voice/sdks/javascript/twiliocall#warning-event
   */
  rtcWarning: {...}
}
```

Properties
----------
You can access the following properties on the `PreflightTest` object:

* `callSid` - The callsid generated for the test call. This is set when the client has finished connecting to Twilio.
* `endTime` - A timestamp in milliseconds of when the test ended. This is set when the test has completed and raised the `completed` event.
* `latestSample` - The latest WebRTC sample collected. This is set whenever the connection emits a `sample`. Please see [Call.on('sample')](https://www.twilio.com/docs/voice/sdks/javascript/twiliocall#sample-event) API for more details.
* `report` - The report for this test. This is set when the test has completed and raised the `completed` event.
* `startTime` - A timestamp in milliseconds of when the test started. This is set right after calling `Device.runPreflight(token, options)`.
* `status` - The status of the test. Below are the possible values for this property.

  | Value | Description |
  |:------|:------------|
  | Completed | The connection to Twilio has been disconnected and the test call has completed. |
  | Connected | The connection to Twilio has been established. |
  | Connecting | Connecting to Twilio has started. |
  | Failed | The test has stopped and failed. |

Methods
-------

#### .stop()

Calling this method from the `PreflightTest` object will stop the existing test and will raise a `failed` event with an error code `31008` indicating that the call has been cancelled.

TwiML App - Record and Play
===========================

If `PreflightTest.Options.fakeMicInput` is set to `false`, `Device.runPreflight(token, options)` API requires a [token](https://www.twilio.com/docs/iam/access-tokens) with a TwiML app that can record an audio from a microphone and the ability to play the recorded audio back to the browser. In order to achieve this, we need two TwiML endpoints: one to capture and record the audio, and another one to play the recorded audio.

TwiML Bins
----------

In this example, we will use TwiML Bins for our TwiML app. Start by going to the [TwiML Bin](https://www.twilio.com/console/twiml-bins) page in the Twilio Console.

### TwiML App - Playback
Create a new TwiML Bin with the plus button on that screen and use `Playback` as the friendly name. Then use the following template under the TwiML section.

```xml
<?xml version="1.0" encoding="UTF-8"?>

<Response>
  <Say>You said:</Say>
  <Play loop="1">{{RecordingUrl}}</Play>
  <Say>Now waiting for a few seconds to gather audio performance metrics.</Say>
  <Pause length="3"/>
  <Say>Hanging up now.</Say>
</Response>
```

Go ahead and click the **Create** button and copy the TwiML Bin's url located at the top of the screen.

### TwiML App - Record
Using the [TwiML Bin](https://www.twilio.com/console/twiml-bins) page, let's create another TwiML Bin by clicking the plus button on that screen and use `Record` as the friendly name. Then replace the action url in the following template with your **TwiML Bin's Playback** url that you created previously. Let's use this template under the TwiML section.

```xml
<?xml version="1.0" encoding="UTF-8"?>

<Response>
  <Say>Record a message in 3, 2, 1</Say>
  <Record maxLength="5" action="https://my-record-twiml-url"></Record>
  <Say>Did not detect a message to record</Say>
</Response>
```

Go ahead and click the **Create** button and copy the TwiML Bin's url located at the top of the screen.

Creating the TwiML App
-----------------------

Now that we have created our TwiML Bins, let's create our TwiML app by going to the [TwiML Apps](https://www.twilio.com/console/voice/twiml/apps) page. Click the plus button on that screen and enter a friendly name that you prefer. Under Voice request url, enter the **TwiML Bin's Record** url that you created in the previous section, and then click the **Create** button.

On that same page, open the TwiML app that you just created by clicking on it and make note of the `SID`. You can now use this TwiML app to generate your [token](https://www.twilio.com/docs/iam/access-tokens) when calling `Device.runPreflight(token, options)` API.


TwiML App - Echo
================

If `PreflightTest.Options.fakeMicInput` is set to `true`, `Device.runPreflight(token, options)` API requires a [token](https://www.twilio.com/docs/iam/access-tokens) with a single TwiML app that can capture and play an audio. Following the [previous steps](#twiml-bins), create a TwiML Bin using the following template, and name it `Echo`.

```xml
<?xml version="1.0" encoding="UTF-8"?>

<Response>
  <Echo/>
</Response>
```

Now that we have our `Echo` TwiML Bin, [create your TwiML App](#creating-the-twiml-app) and use the `echo` TwiML Bin's url under Voice request url. Make note of the TwiML App `SID` and use it to generate the [token](https://www.twilio.com/docs/iam/access-tokens).
