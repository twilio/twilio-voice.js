import * as assert from 'assert';
import * as sinon from 'sinon';
import { Web } from 'sip.js';
import Log from '../../lib/twilio/log';
import { installCloseCodeHook } from '../../lib/twilio/signaling/sipclosecodehook';

function createLogStub(): any {
  return { debug: sinon.stub(), error: sinon.stub(), info: sinon.stub(), warn: sinon.stub() };
}

// `ws` mirrors SIP.js's getter for the currently active socket.
function createTransportStub(base?: any) {
  return { ws: { id: 'active-socket' } as any, onWebSocketClose: base || sinon.stub() };
}

describe('installCloseCodeHook', () => {
  // Canary for a sip.js upgrade: the hook wraps a private method, so a rename
  // would silently cost us close codes. Fail loudly here instead.
  it('relies on a Web.Transport.prototype.onWebSocketClose that still exists', () => {
    assert.strictEqual(
      typeof (Web.Transport.prototype as any).onWebSocketClose,
      'function',
      'sip.js no longer defines Web.Transport.prototype.onWebSocketClose; ' +
      'the hook in sipclosecodehook.ts needs updating',
    );
  });

  // Second canary for the same upgrade risk. The hook decides whether a close
  // belongs to the live socket by comparing against `transport.ws`, so a `ws`
  // that was removed, or that computed a fresh value per access, would make
  // every comparison fail and drop all close codes silently.
  it('relies on a Web.Transport.ws that is a stable accessor', () => {
    const descriptor = Object.getOwnPropertyDescriptor(Web.Transport.prototype, 'ws');
    assert.strictEqual(
      typeof descriptor?.get,
      'function',
      'sip.js no longer defines Web.Transport.prototype.ws; the stale-socket ' +
      'guard in sipclosecodehook.ts needs updating',
    );

    const log: any = {
      debug: sinon.stub(), error: sinon.stub(), log: sinon.stub(), warn: sinon.stub(),
    };
    const transport = new Web.Transport(log, { server: 'wss://example.invalid' });
    assert.strictEqual(
      transport.ws,
      transport.ws,
      'Web.Transport.ws no longer returns a stable reference; the stale-socket ' +
      'guard would silently drop every close code',
    );
  });

  it('starts with no close code', () => {
    const recorder = installCloseCodeHook(createTransportStub(), createLogStub() as Log);
    assert.strictEqual(recorder.lastCloseCode, undefined);
  });

  it('records the close code and delegates to the base handler', () => {
    const base = sinon.stub();
    const transport = createTransportStub(base);
    const recorder = installCloseCodeHook(transport, createLogStub() as Log);

    const event = { code: 1006 };
    const ws = transport.ws;
    transport.onWebSocketClose(event, ws);

    assert.strictEqual(recorder.lastCloseCode, 1006);
    assert.strictEqual(base.callCount, 1);
    assert.strictEqual(base.firstCall.args[0], event);
    assert.strictEqual(base.firstCall.args[1], ws);
    assert.strictEqual(base.firstCall.thisValue, transport, 'base must run with the transport as `this`');
  });

  it('records the code BEFORE the base handler runs', () => {
    // sip.js dispatches onDisconnect from inside the base handler, so the code
    // must already be recorded by then.
    let codeSeenByBase: number | undefined;
    const transport = createTransportStub(() => { codeSeenByBase = recorder.lastCloseCode; });
    const recorder = installCloseCodeHook(transport, createLogStub() as Log);

    transport.onWebSocketClose({ code: 1015 }, transport.ws);

    assert.strictEqual(codeSeenByBase, 1015);
  });

  it('overwrites the code on each subsequent close', () => {
    const transport = createTransportStub();
    const recorder = installCloseCodeHook(transport, createLogStub() as Log);

    transport.onWebSocketClose({ code: 1006 }, transport.ws);
    assert.strictEqual(recorder.lastCloseCode, 1006);

    transport.onWebSocketClose({ code: 1000 }, transport.ws);
    assert.strictEqual(recorder.lastCloseCode, 1000);
  });

  it('ignores a close from a socket sip.js has already replaced', () => {
    // sip.js drops these itself, so a stale 1000 must not mask a real 1006.
    const base = sinon.stub();
    const transport = createTransportStub(base);
    const recorder = installCloseCodeHook(transport, createLogStub() as Log);

    transport.onWebSocketClose({ code: 1006 }, transport.ws);
    transport.onWebSocketClose({ code: 1000 }, { id: 'replaced-socket' });

    assert.strictEqual(recorder.lastCloseCode, 1006, 'the stale close must not overwrite');
    assert.strictEqual(base.callCount, 2, 'the base handler still sees both, and drops the stale one itself');
  });

  it('degrades instead of throwing when the base handler is missing', () => {
    const log = createLogStub();
    const transport: any = {};

    let recorder: any;
    assert.doesNotThrow(() => {
      recorder = installCloseCodeHook(transport, log as Log);
    }, 'a sip.js rename must not break calling outright');

    assert.strictEqual(recorder.lastCloseCode, undefined);
    assert.strictEqual(log.error.callCount, 1, 'the failed install must be logged');
    assert.strictEqual(transport.onWebSocketClose, undefined, 'no hook installed');
  });

  it('degrades when the transport itself is missing', () => {
    const log = createLogStub();
    assert.doesNotThrow(() => installCloseCodeHook(undefined, log as Log));
    assert.strictEqual(log.error.callCount, 1);
  });
});
