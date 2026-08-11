import * as assert from 'assert';
import * as sinon from 'sinon';
import { Web } from 'sip.js';
import Log from '../../lib/twilio/log';
import { installCloseCodeHook } from '../../lib/twilio/signaling/sipclosecodehook';

function createLogStub(): any {
  return { debug: sinon.stub(), error: sinon.stub(), info: sinon.stub(), warn: sinon.stub() };
}

function createTransportStub(base?: any) {
  return { onWebSocketClose: base || sinon.stub() };
}

describe('installCloseCodeHook', () => {
  // Canary for a sip.js upgrade. The close code is captured by wrapping a
  // method that is private to sip.js, so if it is renamed or removed the
  // adapter silently loses close codes. Fail loudly here instead.
  it('relies on a Web.Transport.prototype.onWebSocketClose that still exists', () => {
    assert.strictEqual(
      typeof (Web.Transport.prototype as any).onWebSocketClose,
      'function',
      'sip.js no longer defines Web.Transport.prototype.onWebSocketClose; ' +
      'the hook in sipclosecodehook.ts needs updating',
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
    const ws = {};
    transport.onWebSocketClose(event, ws);

    assert.strictEqual(recorder.lastCloseCode, 1006);
    assert.strictEqual(base.callCount, 1);
    assert.strictEqual(base.firstCall.args[0], event);
    assert.strictEqual(base.firstCall.args[1], ws);
    assert.strictEqual(base.firstCall.thisValue, transport, 'base must run with the transport as `this`');
  });

  it('records the code BEFORE the base handler runs', () => {
    // Ordering is the whole point: sip.js dispatches onDisconnect from inside
    // the base handler, so the code must already be recorded by then.
    let codeSeenByBase: number | undefined;
    const transport = createTransportStub(() => { codeSeenByBase = recorder.lastCloseCode; });
    const recorder = installCloseCodeHook(transport, createLogStub() as Log);

    transport.onWebSocketClose({ code: 1015 }, {});

    assert.strictEqual(codeSeenByBase, 1015);
  });

  it('overwrites the code on each subsequent close', () => {
    const transport = createTransportStub();
    const recorder = installCloseCodeHook(transport, createLogStub() as Log);

    transport.onWebSocketClose({ code: 1006 }, {});
    assert.strictEqual(recorder.lastCloseCode, 1006);

    transport.onWebSocketClose({ code: 1000 }, {});
    assert.strictEqual(recorder.lastCloseCode, 1000);
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
