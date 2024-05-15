'use strict';

// NOTE(mroberts): We need to do this for envify.
const processEnv = {
  ACCOUNT_SID: process.env.ACCOUNT_SID,
  APPLICATION_SID: process.env.APPLICATION_SID,
  APPLICATION_SID_STIR: process.env.APPLICATION_SID_STIR,
  EVENTING_TWIML_APP_SID: process.env.EVENTING_TWIML_APP_SID,
  CALLER_ID: process.env.CALLER_ID,
  API_KEY_SID: process.env.API_KEY_SID,
  API_KEY_SECRET: process.env.API_KEY_SECRET,
  AUTH_TOKEN: process.env.AUTH_TOKEN,
};

// Copy environment variables
const env = [
  ['ACCOUNT_SID',     'accountSid'],
  ['APPLICATION_SID', 'appSid'],
  ['APPLICATION_SID_STIR', 'appSidStir'],
  ['EVENTING_TWIML_APP_SID', 'eventingTwimlAppSid'],
  ['CALLER_ID', 'callerId'],
  ['API_KEY_SECRET',  'apiKeySecret'],
  ['API_KEY_SID',     'apiKeySid'],
  ['AUTH_TOKEN',      'authToken'],
].reduce((env, [processEnvKey, envKey]) => {
  if (processEnvKey in processEnv) {
    env[envKey] = processEnv[processEnvKey];
  }
  return env;
}, {});

// Ensure required variables are present
[
  'accountSid',
  'appSid',
  'appSidStir',
  'eventingTwimlAppSid',
  'callerId',
  'apiKeySid',
  'apiKeySecret',
  'authToken',
].forEach(function forEachRequiredKey(key) {
  if (!(key in env)) {
    throw new Error('Missing ' + key);
  }
});

module.exports = env;
