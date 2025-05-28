'use strict';

// NOTE(mroberts): We need to do this for envify.
const processEnv = {
  ACCOUNT_SID: Cypress.env('ACCOUNT_SID'),
  APPLICATION_SID: Cypress.env('APPLICATION_SID'),
  APPLICATION_SID_STIR: Cypress.env('APPLICATION_SID_STIR'),
  CALLER_ID: Cypress.env('CALLER_ID'),
  API_KEY_SID: Cypress.env('API_KEY_SID'),
  API_KEY_SECRET: Cypress.env('API_KEY_SECRET'),
  AUTH_TOKEN: Cypress.env('AUTH_TOKEN'),
};

// Copy environment variables
const env = [
  ['ACCOUNT_SID', 'accountSid'],
  ['APPLICATION_SID', 'appSid'],
  ['APPLICATION_SID_STIR', 'appSidStir'],
  ['CALLER_ID', 'callerId'],
  ['API_KEY_SECRET', 'apiKeySecret'],
  ['API_KEY_SID', 'apiKeySid'],
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
  'appSidStir',
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
