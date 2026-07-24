'use strict';

// NOTE(mroberts): We need to do this for envify.
const processEnv = {
  ACCOUNT_SID: Cypress.env('ACCOUNT_SID'),
  APPLICATION_SID: Cypress.env('APPLICATION_SID'),
  AUTH_TOKEN: Cypress.env('AUTH_TOKEN'),
};

// Copy environment variables
const env = [
  ['ACCOUNT_SID', 'accountSid'],
  ['APPLICATION_SID', 'appSid'],
  ['AUTH_TOKEN', 'authToken'],
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
  'authToken',
].forEach(function forEachRequiredKey(key) {
  if (!(key in env)) {
    throw new Error('Missing ' + key);
  }
});

module.exports = env;
