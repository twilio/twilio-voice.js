const sinon = require('sinon');
const WSTransport = require('../../lib/twilio/wstransport').default;

/**
 * Mock a {@link WSTransport}.
 * @returns {Sinon.SinonStubbedInstance<WSTransport>}
 * @constructor
 */
function MockWSTransport() {
  const stub = sinon.createStubInstance(WSTransport);
  stub.emit.callThrough();
  stub.on.callThrough();
  stub.removeListener.callThrough();

  stub._uris = ['foo'];
  stub._uriIndex = 0;
  stub._connectedUri = stub._uris[0];
  return stub;
}

module.exports = MockWSTransport;
