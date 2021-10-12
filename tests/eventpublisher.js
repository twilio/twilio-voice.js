const assert = require('assert');
const sinon = require('sinon');
const EventPublisher = require('../lib/twilio/eventpublisher');

describe('EventPublisher', () => {
  let publisher;

  before(() => {
    const options = {
      defaultPayload: createDefaultFakePayload,
      host: 'foo',
      log: {
        warn: function() { }
      },
      request: fakeRequest,
      metadata: {
        app_name: 'foo',
        app_version: '1.2.3'
      }
    };

    publisher = new EventPublisher('test', 'sometoken', options);
  });

  describe('constructor', () => {
    it('should return an EventPublisher', () => {
      assert(publisher instanceof EventPublisher);
    });

    it('should set the correct properties', () => {
      assert.equal(publisher._defaultPayload, createDefaultFakePayload);
      assert.equal(publisher._isEnabled, true);
      assert.equal(publisher._host, 'foo');
      assert.equal(publisher._request, fakeRequest);
      assert.equal(publisher.isEnabled, true);
      assert.equal(publisher.productName, 'test');
      assert.equal(publisher.token, 'sometoken');
      assert.equal(publisher.metadata.app_name, 'foo');
      assert.equal(publisher.metadata.app_version, '1.2.3');
    });
  });

  describe('#post', () => {
    let connection;
    let mock;
    let params;

    beforeEach(() => {
      connection = new FakeConnection();
      mock = {
        _defaultPayload() { return { }; },
        _host: 'foo',
        _post: EventPublisher.prototype._post,
        _request: { post: sinon.spy((a, cb) => { cb(); }) },
        token: 'abc123'
      };

      params = ['debug', 'group', 'name', { abc: 'xyz' }, connection, true];
    });

    it('should use the current value of .token', () => {
      return EventPublisher.prototype.post.apply(mock, params).then(() => {
        assert(mock._request.post.calledOnce);
        assert.equal(mock._request.post.args[0][0].headers['X-Twilio-Token'], 'abc123');
      });
    });

    it('should emit error', (done) => {
      mock.emit = sinon.stub();
      mock._request.post = (a, cb) => cb('foo');
      EventPublisher.prototype.post.apply(mock, params).catch(() => {
        sinon.assert.calledWith(mock.emit, 'error', 'foo');
        done()
      });
    });

    describe('setHost', () => {
      beforeEach(() => {
        mock = {
          _defaultPayload() { return { }; },
          _post: EventPublisher.prototype._post,
          _request: { post: sinon.spy((a, cb) => { cb(); }) },
          token: 'abc123'
        };
      });

      it('should not post a request if host is empty', () => {
        return EventPublisher.prototype.post.apply(mock, params).then(() => {
          sinon.assert.notCalled(mock._request.post);
        });
      });

      it('should post a request after setting the host', () => {
        EventPublisher.prototype.setHost.call(mock, 'foo');
        return EventPublisher.prototype.post.apply(mock, params).then(() => {
          sinon.assert.calledOnce(mock._request.post);
          assert.equal(mock._request.post.args[0][0].url, 'https://foo/v4/EndpointEvents');
        });
      });
    });

    describe('when a Connection is publishing the event', () => {
      const connection = new FakeConnection();

      context('when the Connection does not have either a call sid or a temp call sid', () => {
        it('should publish the event payload along with the default payload without call sid or temp call sid', () => {
          publisher.post('debug', 'group', 'name', { abc: 'xyz' }, connection);
          checkPostParams(0, publisher, connection);
        });
      });

      context('when the Connection has a temp call sid but no call sid', () => {
        it('should publish the event payload along with the default payload and the temp call sid', () => {
          connection.outboundConnectionId = 'TJ1234';
          publisher.post('debug', 'group', 'name', { abc: 'xyz' }, connection);
          checkPostParams(1, publisher, connection);
        });
      });

      context('when the Connection has a call sid but no temp call sid', () => {
        it('should publish the event payload along with the default payload and the call sid', () => {
          connection.parameters = {CallSid: 'CA1234'};
          publisher.post('debug', 'group', 'name', { abc: 'xyz' }, connection);
          checkPostParams(2, publisher, connection);
        });
      });

      context('when the Connection has a temp call sid and a call sid', () => {
        it('should publish the event payload along with the default payload, the temp call sid and the call sid', () => {
          connection.outboundConnectionId = 'TJ5678';
          connection.parameters = {CallSid: 'CA5678'};
          publisher.post('debug', 'group', 'name', { abc: 'xyz' }, connection);
          checkPostParams(3, publisher, connection);
        });
      });

      afterEach(() => {
        connection.parameters = { CallSid: null };
        connection.outboundConnectionId = null;
      });
    });
  });

  describe('setToken', () => {
    it('should change .token to the passed value', () => {
      publisher.setToken('abc123');
      assert.equal(publisher.token, 'abc123');
    });
  });

  ['debug', 'info', 'warn', 'error'].forEach((level, i) => {
    const publisher = new EventPublisher('test', 'token', {
      defaultPayload: createDefaultFakePayload,
      host: 'foo',
      request: fakeRequest
    });
    const publishLevel = `${level.toUpperCase()}${level === 'warn' ? 'ING' : ''}`

    describe(`#${level}`, () => {
      it(`should publish event with log level ${publishLevel}`, () => {
        const connection = new FakeConnection();
        publisher[level]('group', 'name', undefined, connection);
        const params = fakeRequest.post.args[4+i][0];
        assert.equal(params.body.level, publishLevel);
      });
    });
  });
});

function checkPostParams(i, publisher, connection) {
  const params = fakeRequest.post.args[i][0];
  const timestamp = params.body.timestamp || 'xyz';

  const expectedParams = {
    url: `https://${publisher._host}/v4/EndpointEvents`,
    headers: {
      'Content-Type': 'application/json',
      'X-Twilio-Token': publisher.token
    },
    body: {
      publisher: publisher.productName,
      group: 'group',
      name: 'name',
      level: 'DEBUG',
      payload_type: 'application/json',
      private: false,
      publisher_metadata: {
        app_name: 'foo',
        app_version: '1.2.3',
      },
      payload: {
        client_name: 'foo',
        platform: 'bar',
        sdk_version: 'baz',
        selected_region: 'us',
        gateway: 'xyz',
        region: 'abc',
        abc: 'xyz'
      }
    }
  };

  if (connection) {
    if (connection.parameters && connection.parameters.CallSid) {
      expectedParams.body.payload.call_sid = connection.parameters.CallSid;
    }
    if (connection._getTempCallSid()) {
      expectedParams.body.payload.temp_call_sid = connection._getTempCallSid();
    }
    expectedParams.body.payload.direction = connection._direction;
  }

  assert.doesNotThrow(() => new Date(timestamp).toISOString());
  delete(params.body.timestamp);
  assert.deepEqual(params, expectedParams);
}

function fakeRequest() {}
fakeRequest.post = sinon.spy();

function FakeConnection() {
  this.parameters = { CallSid: null };
  this._direction = 'outgoing';
  this.outboundConnectionId = 'CA123';
}

FakeConnection.prototype._getTempCallSid = function _getTempCallSid() {
  return this.outboundConnectionId;
};

function createDefaultFakePayload(connection) {
  const payload = {
    client_name: 'foo',
    platform: 'bar',
    sdk_version: 'baz',
    selected_region: 'us'
  };

  function setIfDefined(propertyName, value) {
    if (value) { payload[propertyName] = value; }
  }

  if (connection) {
    setIfDefined('call_sid', connection.parameters.CallSid);
    setIfDefined('temp_call_sid', connection._getTempCallSid());
    payload.direction = connection._direction;
  }

  const stream = {
    gateway: 'xyz',
    region: 'abc'
  };

  if (stream) {
    setIfDefined('gateway', stream.gateway);
    setIfDefined('region', stream.region);
  }

  return payload;
}
