const PACKAGE_NAME = '$packageName';
const RELEASE_VERSION = '$version';
const SOUNDS_BASE_URL = 'https://sdk.twilio.com/js/client/sounds/releases/1.0.0';
const COWBELL_AUDIO_URL = `${SOUNDS_BASE_URL}/cowbell.mp3?cache=${RELEASE_VERSION}`;
const ECHO_TEST_DURATION = 20000;

export {
  COWBELL_AUDIO_URL,
  ECHO_TEST_DURATION,
  PACKAGE_NAME,
  RELEASE_VERSION,
  SOUNDS_BASE_URL,
};
