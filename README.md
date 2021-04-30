## This version is currently in the Pilot phase!
This product, Twilio's JavaScript Voice SDK, is the next version of Twilio's Javascript Client SDK. It
is currently in the Pilot phase while we gather customer feedback. In this phase, it is possible that some
aspects of the API may change before GA. If you'd prefer, you can use the 
[stable version of the SDK](https://github.com/twilio/twilio-client.js).

If you're interested in testing out the 2.0 pilot, see our [migration guide](https://www.twilio.com/docs/voice/client/migrating-to-js-voice-sdk-20).

For help
@twilio/voice-sdk
====================



[![Travis Build Status](https://travis-ci.org/twilio/twilio.js.svg?branch=master)](https://travis-ci.org/twilio/twilio-voice.js) [![NPM](https://img.shields.io/npm/v/twilio-voice.svg)](https://www.npmjs.com/package/twilio-voice)

Twilio's Voice SDK allows you to add real-time voice and PSTN calling to your web apps.

* [API Docs](https://twilio.github.io/twilio-voice.js/index.html)
* [More Docs](https://www.twilio.com/docs/voice/client/javascript/overview)
* [Quickstart](https://www.twilio.com/docs/voice/client/javascript/quickstart)
* [Changelog](https://github.com/twilio/twilio-voice.js/blob/master/CHANGELOG.md)

### Technical Support
If you need technical support, contact
[help@twilio.com](mailto:help@twilio.com).

Installation
------------

### NPM

We recommend using `npm` to add the Voice SDK as a dependency.

```
npm install @twilio/voice-sdk --save
```

Using this method, you can `import` the Voice SDK using ES Module or TypeScript syntax:

```js
import { Device } from '@twilio/voice-sdk';

```

Or using CommonJS:

```js
const Device = require('@twilio/voice-sdk').Device;
```

### CDN
As of 2.0, the Twilio Voice SDK is no longer hosted via CDN.

Testing
-------

Running unit tests requires no setup aside from installation (above). You can run unit tests via:

```
npm run test:unit
```

Integration tests require some set up:

1. If the account you want to use doesn't already have a TwiML app set up, create one using the
   TwiML code below.
2. Copy config.example.yaml to config.yaml, replacing the placeholder information with valid credentials.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Client>
      <Identity>{{To}}</Identity>
      <Parameter name="duplicate" value="12345" />
      <Parameter name="duplicate" value="123456" />
      <Parameter name="custom + param" value="我不吃蛋" />
      <Parameter name="foobar" value="some + value" />
      <Parameter name="custom1" value="{{Custom1}}" />
      <Parameter name="custom2" value="{{Custom2}}" />
      <Parameter name="custom3" value="{{Custom3}}" />
    </Client>
  </Dial>
</Response>
```

Integration tests can be run via:

```
npm run test:integration
```

These tests will run via karma, one at a time, in your system's default Chrome and then Firefox.

Content Security Policy (CSP)
----------------------------

Use the following policy directives to enable [CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) that is compatible with twilio-voice.js.

```
script-src https://media.twiliocdn.com https://sdk.twilio.com
media-src mediastream https://media.twiliocdn.com https://sdk.twilio.com
connect-src https://eventgw.twilio.com wss://chunderw-vpc-gll.twilio.com https://media.twiliocdn.com https://sdk.twilio.com
```

If you are providing a non-default value for `Device.ConnectOptions.edge` parameter, you need to add the Signaling URI `wss://chunderw-vpc-gll-{regionId}.twilio.com` in your `connect-src` directive where `regionId` is the `Region ID` as defined in this [page](https://www.twilio.com/docs/global-infrastructure/edge-locations/legacy-regions). See examples below.

**If `Device.ConnectOptions.edge` is `ashburn`**

```
connect-src https://eventgw.twilio.com https://media.twiliocdn.com https://sdk.twilio.com wss://chunderw-vpc-gll-us1.twilio.com
```

**If `Device.ConnectOptions.edge` is `['ashburn', 'sydney', 'roaming']`**

```
connect-src https://eventgw.twilio.com https://media.twiliocdn.com https://sdk.twilio.com wss://chunderw-vpc-gll-us1.twilio.com wss://chunderw-vpc-gll-au1.twilio.com wss://chunderw-vpc-gll.twilio.com
```

License
-------

See [LICENSE.md](https://github.com/twilio/twilio-voice.js/blob/master/LICENSE.md)
