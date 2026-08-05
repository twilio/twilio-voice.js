const Twilio = require('twilio');
const env = require('../env.js');
const callVendor = require('./vendor');

async function generateAccessToken(identity, ttl, appSid, variant) {
  const { token } = await callVendor('mint-voice-token', {
    identity,
    ttl: ttl || 300,
    outgoingApplicationSid: appSid,
    variant,
  });
  return token;
}

function generateCapabilityToken() {
  const outgoingScope = new Twilio.jwt.ClientCapability.OutgoingClientScope({
    applicationSid: env.appSid
  });

  const token = new Twilio.jwt.ClientCapability({
    accountSid: env.accountSid,
    authToken: env.authToken,
  });

  token.addScope(outgoingScope);
  return token.toJwt();
}

module.exports = { generateAccessToken, generateCapabilityToken };
