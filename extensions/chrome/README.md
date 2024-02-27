## Twilio Voice JS SDK Chrome Extension Manifest V3 Example Application
This project demonstrates how to use the Twilio Voice JS SDK in a Chrome Extension Manifest V3 (MV3) application. If you are not familiar with MV3, please check out the official [documentation](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3) for more details.

This project has a server component that provides the Voice Access Token and the URL for the TwiML app. Also, the server accepts WebSocket connections to help the extension service worker active, and to assists with incoming calls. See the following diagrams for a high level view of the different components.

### Incoming Call
![incoming](https://github.com/twilio/twilio-voice.js/assets/22135968/104a9c8c-1fa3-45ab-b691-2da758e6420d)

### Outgoing Call
![outgoing](https://github.com/twilio/twilio-voice.js/assets/22135968/d555378e-6789-48d0-a92b-3e08f1b992b1)
