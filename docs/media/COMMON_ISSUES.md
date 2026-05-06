Common Issues
=============

Having an issue with twilio.js?  Review this list of common issues to determine whether
or not your issue is known or a workaround is available. Please also take a look at the
[CHANGELOG.md](CHANGELOG.md) to see if your issue is known for a particular
release. If your issue hasn't been reported, consider submitting
[a new issue](https://github.com/twilio/twilio-voice.js/issues/new).

Working around the browsers' autoplay policy
--------------------------------------------

Chrome, Firefox and Safari enforce the autoplay policy, which blocks automatically
playing audio if the user has not interacted with your application
(ex: clicking a button to log in). You can find more details about the autoplay
policies here:

- [Chrome Autoplay Policy](https://developers.google.com/web/updates/2017/09/autoplay-policy-changes)
- [Firefox Autoplay Policy](https://hacks.mozilla.org/2019/02/firefox-66-to-block-automatically-playing-audible-video-and-audio/)
- [Safari Autoplay Policy](https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/)

One of the most troublesome side effects this behavior can cause for your application is
missed calls. If the autoplay policy blocks the incoming call sound from playing in the
browser, a user expecting a call may miss it because the sound won't play.

We recommend ensuring that your end user must interact with the page **before**
setting up the Device. If the user is not logged in, asking them to log in on the same page
will qualify. If the user is already logged in, we recommend adding a button to indicate that
they are ready to receive calls. For example:

```js
  document.getElementById('ready_button').addEventListener('click', () => {
    device = new Twilio.Device(token);
  });
```

Missing Input or Output Device Labels
-------------------------------------

In standard browsers, after making a `getUserMedia` request, the window will populate the
labels for all available input and output devices. Some browsers are slowly catching up
but not yet fully implemented, and won't supply labels for input or output devices.

Audio Stream Not Closing After Hanging Up Call
----------------------------------------------

When calling `Device.audio.setInputDevice()`, the input device will not be unset until
`Device.audio.unsetInputDevice()` is called. This means that if `.setInputDevice()` is called
during a call, and the call is hung up, the microphone will continue capturing until
`.unsetInputDevice()` is called.

Aggressive Browser Extensions and Plugins
-----------------------------------------

Some browser extensions and plugins will disable WebRTC APIs, causing
twilio-voice.js to fail. Examples of such plugins include

* uBlockOrigin-Extra
* WebRTC Leak Prevent
* Easy WebRTC Block

These are unsupported and likely to break twilio-voice.js. If you are having
trouble with twilio-voice.js, ensure these are not running.

Build warnings with Angular
---------------------------
Angular webapps that use the Twilio Voice JS SDK may generate the following
warning upon building the webapp:

```
CommonJS or AMD dependencies can cause optimization bailouts.
```

This is expected. The Twilio Voice JS SDK will continue to behave normally. To
learn more about this warning and to silence it, please see this official
documentation from the Angular website:
https://angular.dev/tools/cli/build#configuring-commonjs-dependencies
