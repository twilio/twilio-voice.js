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

module.exports = { generateAccessToken };
