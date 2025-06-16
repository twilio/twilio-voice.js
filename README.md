## Migration from twilio-client.js 1.x
This product, Twilio's JavaScript Voice SDK, is the next version of Twilio's Javascript Client SDK. It is
now in GA and we recommend all customers migrate in order to continue receiving future feature additions.
For help on migrating from 1.x, see our [migration guide](https://www.twilio.com/docs/voice/client/migrating-to-js-voice-sdk-20).

@twilio/voice-sdk
=================

[![NPM](https://img.shields.io/npm/v/%40twilio/voice-sdk.svg)](https://www.npmjs.com/package/%40twilio/voice-sdk) [![CircleCI](https://dl.circleci.com/status-badge/img/gh/twilio/twilio-voice.js/tree/master.svg?style=shield)](https://circleci.com/gh/twilio/twilio-voice.js/tree/master)

Twilio's Voice SDK allows you to add real-time voice and PSTN calling to your web apps.

* [API Docs](https://twilio.github.io/twilio-voice.js/index.html)
* [More Docs](https://www.twilio.com/docs/voice/sdks/javascript)
* [Quickstart](https://www.twilio.com/docs/voice/client/javascript/quickstart)
* [Reference Components](https://www.twilio.com/docs/voice/sdks/javascript/reference-components)
* [Changelog](https://github.com/twilio/twilio-voice.js/blob/master/CHANGELOG.md)

### Issues and Support
Please check out our [common issues](COMMON_ISSUES.md) page or file any issues you find here on Github. For general inquiries related to the Voice SDK you can file a support ticket. Please ensure that you are not sharing any [Personally Identifiable Information(PII)](https://www.twilio.com/docs/glossary/what-is-personally-identifiable-information-pii) or sensitive account information (API keys, credentials, etc.) when reporting an issue.

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

### GitHub

Although we recommend using `npm` to add the Voice SDK as a dependency, you can also get the Twilio Voice SDK code
from GitHub and include it in your project directly. To do so, navigate to
["Tags"](https://github.com/twilio/twilio-voice.js/tags) and find the most recent release, or
the particular release version you'd like to use.

> **Note:** releases tagged with "-rc" are "Release Candidate" versions
> and are still being tested. Unless you specifically know that you want to use a release candidate
> version, you should not use a release with "-rc" in the name.

Download either the `zip` or the `tar.gz` and then extract the files. For example, if you downloaded the
tarball for the `2.0.0` release, you could then extract the files with the `tar` command:

```
tar -xvzf twilio-voice.js-2.0.0.tar.gz
cd twilio-voice.js-2.0.0
```

Once you've extracted the folder, the `twilio.js` and `twilio.min.js` files that
you can include in your project will be in the `/dist` directory. `twilio.min.js` is the
minified version of the code.

You can copy either the `twilio.js` or the `twilio.min.js` file into your project and
then provide a link to it in your html. For example:

```
<script type="text/javascript" src="twilio.min.js"></script>
```

Using this method, you can access the SDK through the browser global:

```
const Device = Twilio.Device;
```

Testing
-------

Running unit tests requires no setup aside from installation (above). You can run unit tests via:

```
npm run test:unit
```

Integration tests require some set up:

1. Create a TwiML App with the friendly name `Integration Tests`, using the TwiML code below.

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

2. Create a second TwiML App with the friendly name `STIR/SHAKEN`, using the TwiML code below. Be sure to use your Twilio number for the `Dial` verb. 

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="{{CallerId}}">xxxxxxxxxxxxxxxx</Dial>
</Response>
```

3. Cypress requires `env` `vars` to be prefixed with `CYPRESS_`. Make a copy the `example.env` file with the name `.env` and populate the file with your credentials.

4. Start the relay server

```
npm run test:relay-server
```

5. Integration tests run via Cypress, and can be run via:

```
npm run test:integration:chrome
npm run test:integration:firefox
```

Content Security Policy (CSP)
----------------------------

Use the following policy directives to enable [CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) that is compatible with twilio-voice.js.

```
script-src https://media.twiliocdn.com https://sdk.twilio.com
media-src mediastream: https://media.twiliocdn.com https://sdk.twilio.com
connect-src https://eventgw.twilio.com wss://voice-js.roaming.twilio.com https://media.twiliocdn.com https://sdk.twilio.com
```

If you are providing a non-default value for `Device.ConnectOptions.edge` parameter, you need to add the Signaling URI `wss://voice-js.{edgeId}.twilio.com` in your `connect-src` directive where `edgeId` is the `Edge ID` as defined in this [page](https://www.twilio.com/docs/global-infrastructure/edge-locations). See examples below.

**If `Device.ConnectOptions.edge` is `ashburn`**

```
connect-src https://eventgw.twilio.com https://media.twiliocdn.com https://sdk.twilio.com wss://voice-js.ashburn.twilio.com
```

**If `Device.ConnectOptions.edge` is `['ashburn', 'sydney', 'roaming']`**

```
connect-src https://eventgw.twilio.com https://media.twiliocdn.com https://sdk.twilio.com wss://voice-js.ashburn.twilio.com wss://voice-js.sydney.twilio.com wss://voice-js.roaming.twilio.com
```

If you are providing a home region grant into your [Twilio access token](https://www.twilio.com/docs/iam/access-tokens), you need to add the insights endpoint in your `connect-src` directive using `eventgw.{homeRegion}.twilio.com` format. Below is an example if your home region grant is `sg1`.

```
connect-src https://eventgw.sg1.twilio.com wss://voice-js.roaming.twilio.com https://media.twiliocdn.com https://sdk.twilio.com
```

License
-------

See [LICENSE.md](https://github.com/twilio/twilio-voice.js/blob/master/LICENSE.md)
