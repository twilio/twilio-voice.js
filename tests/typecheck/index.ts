import checkAudioHelper from './audiohelper';
import checkCall from './call';
import checkDevice from './device';
import checkPreflight from './preflight';
import checkTwilioError from './twilioerror';

(async () => {
  await checkAudioHelper();
  await checkCall();
  await checkDevice();
  await checkPreflight();
  await checkTwilioError();
})();
