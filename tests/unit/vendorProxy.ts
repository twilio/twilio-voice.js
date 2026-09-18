import * as assert from 'assert';

// Plain CommonJS module (tests/lib is not part of the TS build); require avoids
// the esModuleInterop dance for a default-less module.exports.
const VendorProxy = require('../lib/vendorProxy');

const ACCOUNT_SID = 'AC' + '0'.repeat(32);
const API_KEY_SID = 'SK' + '1'.repeat(32);
const APPLICATION_SID = 'AP' + '2'.repeat(32);
const APPLICATION_SID_STIR = 'AP' + '3'.repeat(32);
const CALLER_ID = '+15005550006';

const CREDENTIAL_KEYS = [
  'ACCOUNT_SID',
  'API_KEY_SID',
  'API_KEY_SECRET',
  'APPLICATION_SID',
  'APPLICATION_SID_STIR',
  'CALLER_ID',
  'VENDOR_URL',
];

function decodePayload(jwt: string) {
  return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
}

describe('vendorProxy', () => {
  let proxy: any;
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    CREDENTIAL_KEYS.forEach(key => {
      saved[key] = process.env[key];
      delete process.env[key];
    });
    proxy = new VendorProxy();
  });

  afterEach(() => {
    CREDENTIAL_KEYS.forEach(key => {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    });
  });

  function setCredentials() {
    process.env.ACCOUNT_SID = ACCOUNT_SID;
    process.env.API_KEY_SID = API_KEY_SID;
    process.env.API_KEY_SECRET = 'api-key-secret';
    process.env.APPLICATION_SID = APPLICATION_SID;
  }

  function setStirCredentials() {
    process.env.APPLICATION_SID_STIR = APPLICATION_SID_STIR;
    process.env.CALLER_ID = CALLER_ID;
  }

  function vend(request: any) {
    return proxy._vend(JSON.stringify(request));
  }

  function mintVoiceToken(params: any = {}) {
    return vend(Object.assign({ action: 'mint-voice-token', identity: 'alice' }, params));
  }

  describe('when VENDOR_URL is set', () => {
    it('forwards the raw body to the vendor', async () => {
      process.env.VENDOR_URL = 'https://vendor.example/vend';
      const forwarded: string[] = [];
      proxy._forward = (body: string) => {
        forwarded.push(body);
        return Promise.resolve({ status: 200, text: '{"token":"from-vendor"}' });
      };

      const response = await mintVoiceToken();

      assert.strictEqual(response.text, '{"token":"from-vendor"}');
      assert.strictEqual(forwarded.length, 1);
      assert.strictEqual(JSON.parse(forwarded[0]).identity, 'alice');
    });
  });

  describe('when VENDOR_URL is not set', () => {
    it('leaves the vendor auth token cache untouched', async () => {
      setCredentials();
      await mintVoiceToken();
      assert.strictEqual(proxy._cachedToken, null);
      assert.strictEqual(proxy._cachedTokenPromise, null);
    });

    it('mints a voice token from the local credentials', async () => {
      setCredentials();

      const response = await mintVoiceToken();
      const payload = decodePayload(JSON.parse(response.text).token);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(payload.iss, API_KEY_SID);
      assert.strictEqual(payload.sub, ACCOUNT_SID);
      assert.strictEqual(payload.grants.identity, 'alice');
      assert.strictEqual(payload.grants.voice.incoming.allow, true);
      assert.strictEqual(payload.grants.voice.outgoing.application_sid, APPLICATION_SID);
    });

    it('honors the requested ttl', async () => {
      setCredentials();
      const payload = decodePayload(JSON.parse((await mintVoiceToken({ ttl: 123 })).text).token);
      assert.strictEqual(payload.exp - payload.iat, 123);
    });

    it('defaults the ttl to 300 seconds', async () => {
      setCredentials();
      const payload = decodePayload(JSON.parse((await mintVoiceToken()).text).token);
      assert.strictEqual(payload.exp - payload.iat, 300);
    });

    it('prefers an explicitly requested application sid', async () => {
      setCredentials();
      const appSid = 'AP' + '9'.repeat(32);
      const response = await mintVoiceToken({ outgoingApplicationSid: appSid });
      const payload = decodePayload(JSON.parse(response.text).token);
      assert.strictEqual(payload.grants.voice.outgoing.application_sid, appSid);
    });

    it('uses the STIR/SHAKEN application for the stir variant', async () => {
      setCredentials();
      setStirCredentials();
      const response = await mintVoiceToken({ variant: 'stir' });
      const payload = decodePayload(JSON.parse(response.text).token);
      assert.strictEqual(payload.grants.voice.outgoing.application_sid, APPLICATION_SID_STIR);
    });

    it('passes the caller id to the STIR/SHAKEN application', async () => {
      setCredentials();
      setStirCredentials();
      const response = await mintVoiceToken({ variant: 'stir' });
      const payload = decodePayload(JSON.parse(response.text).token);
      assert.deepStrictEqual(payload.grants.voice.outgoing.params, { CallerId: CALLER_ID });
    });

    it('sends no application params without the stir variant', async () => {
      setCredentials();
      process.env.CALLER_ID = CALLER_ID;
      const response = await mintVoiceToken();
      const payload = decodePayload(JSON.parse(response.text).token);
      assert.strictEqual(payload.grants.voice.outgoing.params, undefined);
    });

    it('names every missing credential and the remote alternative', async () => {
      const response = await mintVoiceToken();
      assert.strictEqual(response.status, 500);
      assert.strictEqual(
        JSON.parse(response.text).error,
        'vendorProxy: cannot mint a voice token locally; set ACCOUNT_SID, API_KEY_SID, ' +
        'API_KEY_SECRET, APPLICATION_SID in .env, or set VENDOR_URL to vend credentials remotely',
      );
    });

    it('requires the STIR/SHAKEN credentials only for the stir variant', async () => {
      setCredentials();

      assert.strictEqual((await mintVoiceToken()).status, 200);

      const response = await mintVoiceToken({ variant: 'stir' });
      assert.strictEqual(response.status, 500);
      assert.match(
        JSON.parse(response.text).error,
        /set APPLICATION_SID_STIR, CALLER_ID in \.env/,
      );
    });

    it('rejects an unsupported action', async () => {
      setCredentials();
      const response = await vend({ action: 'revoke-voice-token' });
      assert.strictEqual(response.status, 400);
      assert.match(JSON.parse(response.text).error, /action "revoke-voice-token" is not supported/);
    });

    it('rejects an unknown variant', async () => {
      setCredentials();
      const response = await mintVoiceToken({ variant: 'shaken' });
      assert.strictEqual(response.status, 400);
      assert.match(JSON.parse(response.text).error, /unknown variant "shaken"/);
    });

    it('rejects a non-JSON body', async () => {
      setCredentials();
      const response = await proxy._vend('not json');
      assert.strictEqual(response.status, 400);
      assert.match(JSON.parse(response.text).error, /not JSON/);
    });
  });
});
