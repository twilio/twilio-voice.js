// @ts-nocheck
import { EventEmitter } from 'events';
import Log from './log';
import request from './request';

/**
 * Builds Endpoint Analytics (EA) event payloads and sends them to
 *   the EA server.
 * @constructor
 * @param {String} productName - Name of the product publishing events.
 * @param {String} token - The JWT token to use to authenticate with
 *   the EA server.
 * @param {EventPublisher.Options} options
 * @property {Boolean} isEnabled - Whether or not this publisher is publishing
 *   to the server. Currently ignores the request altogether, in the future this
 *   may store them in case publishing is re-enabled later. Defaults to true.
 */
/**
 * @typedef {Object} EventPublisher.Options
 * @property {Object} [metadata=undefined] - A publisher_metadata object to send
 *   with each payload.
 * @property {String} [host='eventgw.twilio.com'] - The host address of the EA
 *   server to publish to.
 * @property {Object|Function} [defaultPayload] - A default payload to extend
 *   when creating and sending event payloads. Also takes a function that
 *   should return an object representing the default payload. This is
 *   useful for fields that should always be present when they are
 *   available, but are not always available.
 */
class EventPublisher extends EventEmitter {
  constructor(productName, token, options) {
    super();

    if (!(this instanceof EventPublisher)) {
      return new EventPublisher(productName, token, options);
    }

    // Apply default options
    options = Object.assign({ defaultPayload() { return { }; } }, options);

    let defaultPayload = options.defaultPayload;

    if (typeof defaultPayload !== 'function') {
      defaultPayload = () => Object.assign({ }, options.defaultPayload);
    }

    let isEnabled = true;
    const metadata = Object.assign({ app_name: undefined, app_version: undefined }, options.metadata);

    Object.defineProperties(this, {
      _defaultPayload: { value: defaultPayload },
      _host: { value: options.host, writable: true },
      _isEnabled: {
        get() { return isEnabled; },
        set(_isEnabled) { isEnabled = _isEnabled; },
      },
      _log: { value: new Log('EventPublisher') },
      _request: { value: options.request || request, writable: true },
      _token: { value: token, writable: true },
      isEnabled: {
        enumerable: true,
        get() { return isEnabled; },
      },
      metadata: {
        enumerable: true,
        get() { return metadata; },
      },
      productName: { enumerable: true, value: productName },
      token: {
        enumerable: true,
        get() { return this._token; },
      },
    });
  }
}

/**
 * Post to an EA server.
 * @private
 * @param {String} endpointName - Endpoint to post the event to
 * @param {String} level - ['debug', 'info', 'warning', 'error']
 * @param {String} group - The name of the group the event belongs to.
 * @param {String} name - The designated event name.
 * @param {?Object} [payload=null] - The payload to pass. This will be extended
 *    onto the default payload object, if one exists.
 * @param {?Connection} [connection=null] - The {@link Connection} which is posting this payload.
 * @param {?Boolean} [force=false] - Whether or not to send this even if
 *    publishing is disabled.
 * @returns {Promise} Fulfilled if the HTTP response is 20x.
 */
EventPublisher.prototype._post = function _post(endpointName, level, group, name, payload, connection, force) {
  if ((!this.isEnabled && !force) || !this._host) {
    this._log.debug('Publishing cancelled', JSON.stringify({ isEnabled: this.isEnabled, force, host: this._host }));
    return Promise.resolve();
  }

  if (!connection || ((!connection.parameters || !connection.parameters.CallSid) && !connection.outboundConnectionId)) {
    if (!connection) {
      this._log.debug('Publishing cancelled. Missing connection object');
    } else {
      this._log.debug('Publishing cancelled. Missing connection info', JSON.stringify({
        outboundConnectionId: connection.outboundConnectionId, parameters: connection.parameters,
      }));
    }
    return Promise.resolve();
  }

  const event = {
    group,
    level: level.toUpperCase(),
    name,
    payload: (payload && payload.forEach) ?
      payload.slice(0) : Object.assign(this._defaultPayload(connection), payload),
      payload_type: 'application/json',
      private: false,
    publisher: this.productName,
    timestamp: (new Date()).toISOString(),
  };

  if (this.metadata) {
    event.publisher_metadata = this.metadata;
  }

  if (endpointName === 'EndpointEvents') {
    this._log.debug(
      'Publishing insights',
      JSON.stringify({ endpointName, event, force, host: this._host }),
    );
  }

  const requestParams = {
    body: event,
    headers: {
      'Content-Type': 'application/json',
      'X-Twilio-Token': this.token,
    },
    url: `https://${this._host}/v4/${endpointName}`,
  };

  return new Promise((resolve, reject) => {
    this._request.post(requestParams, err => {
      if (err) {
        this.emit('error', err);
        reject(err);
      } else {
        resolve();
      }
    });
  }).catch(e => {
    this._log.error(`Unable to post ${group} ${name} event to Insights. Received error: ${e}`);
  });
};

/**
 * Post an event to the EA server. Use this method when the level
 *  is dynamic. Otherwise, it's better practice to use the sugar
 *  methods named for the specific level.
 * @param {String} level - ['debug', 'info', 'warning', 'error']
 * @param {String} group - The name of the group the event belongs to.
 * @param {String} name - The designated event name.
 * @param {?Object} [payload=null] - The payload to pass. This will be extended
 *    onto the default payload object, if one exists.
 * @param {?Connection} [connection=null] - The {@link Connection} which is posting this payload.
 * @returns {Promise} Fulfilled if the HTTP response is 20x.
 */
EventPublisher.prototype.post = function post(level, group, name, payload, connection, force) {
  return this._post('EndpointEvents', level, group, name, payload, connection, force);
};

/**
 * Post a debug-level event to the EA server.
 * @param {String} group - The name of the group the event belongs to.
 * @param {String} name - The designated event name.
 * @param {?Object} [payload=null] - The payload to pass. This will be extended
 *    onto the default payload object, if one exists.
 * @param {?Connection} [connection=null] - The {@link Connection} which is posting this payload.
 * @returns {Promise} Fulfilled if the HTTP response is 20x.
 */
EventPublisher.prototype.debug = function debug(group, name, payload, connection) {
  return this.post('debug', group, name, payload, connection);
};

/**
 * Post an info-level event to the EA server.
 * @param {String} group - The name of the group the event belongs to.
 * @param {String} name - The designated event name.
 * @param {?Object} [payload=null] - The payload to pass. This will be extended
 *    onto the default payload object, if one exists.
 * @param {?Connection} [connection=null] - The {@link Connection} which is posting this payload.
 * @returns {Promise} Fulfilled if the HTTP response is 20x.
 */
EventPublisher.prototype.info = function info(group, name, payload, connection) {
  return this.post('info', group, name, payload, connection);
};

/**
 * Post a warning-level event to the EA server.
 * @param {String} group - The name of the group the event belongs to.
 * @param {String} name - The designated event name.
 * @param {?Object} [payload=null] - The payload to pass. This will be extended
 *    onto the default payload object, if one exists.
 * @param {?Connection} [connection=null] - The {@link Connection} which is posting this payload.
 * @returns {Promise} Fulfilled if the HTTP response is 20x.
 */
EventPublisher.prototype.warn = function warn(group, name, payload, connection) {
  return this.post('warning', group, name, payload, connection);
};

/**
 * Post an error-level event to the EA server.
 * @param {String} group - The name of the group the event belongs to.
 * @param {String} name - The designated event name.
 * @param {?Object} [payload=null] - The payload to pass. This will be extended
 *    onto the default payload object, if one exists.
 * @param {?Connection} [connection=null] - The {@link Connection} which is posting this payload.
 * @returns {Promise} Fulfilled if the HTTP response is 20x.
 */
EventPublisher.prototype.error = function error(group, name, payload, connection) {
  return this.post('error', group, name, payload, connection);
};

/**
 * Post a metrics event to the EA server.
 * @param {String} group - The name of the group the event belongs to.
 * @param {String} name - The designated event name.
 * @param {Array<Object>} metrics - The metrics to post.
 * @param {?Object} [customFields] - Custom fields to append to each payload.
 * @returns {Promise} Fulfilled if the HTTP response is 20x.
 */
EventPublisher.prototype.postMetrics = function postMetrics(group, name, metrics, customFields, connection) {
  return new Promise(resolve => {
    const samples = metrics
      .map(formatMetric)
      .map(sample => Object.assign(sample, customFields));

    resolve(this._post('EndpointMetrics', 'info', group, name, samples, connection));
  });
};

/**
 * Update the host address of the insights server to publish to.
 * @param {String} host - The new host address of the insights server.
 */
EventPublisher.prototype.setHost = function setHost(host) {
  this._host = host;
};

/**
 * Update the token to use to authenticate requests.
 * @param {string} token
 * @returns {void}
 */
EventPublisher.prototype.setToken = function setToken(token) {
  this._token = token;
};

/**
 * Enable the publishing of events.
 */
EventPublisher.prototype.enable = function enable() {
  this._isEnabled = true;
};

/**
 * Disable the publishing of events.
 */
EventPublisher.prototype.disable = function disable() {
  this._isEnabled = false;
};

function formatMetric(sample) {
  return {
    audio_codec: sample.codecName,
    audio_level_in: sample.audioInputLevel,
    audio_level_out: sample.audioOutputLevel,
    bytes_received: sample.bytesReceived,
    bytes_sent: sample.bytesSent,
    call_volume_input: sample.inputVolume,
    call_volume_output: sample.outputVolume,
    jitter: sample.jitter,
    mos: sample.mos && (Math.round(sample.mos * 100) / 100),
    packets_lost: sample.packetsLost,
    packets_lost_fraction: sample.packetsLostFraction &&
      (Math.round(sample.packetsLostFraction * 100) / 100),
    packets_received: sample.packetsReceived,
    rtt: sample.rtt,
    timestamp: (new Date(sample.timestamp)).toISOString(),
    total_bytes_received: sample.totals.bytesReceived,
    total_bytes_sent: sample.totals.bytesSent,
    total_packets_lost: sample.totals.packetsLost,
    total_packets_received: sample.totals.packetsReceived,
    total_packets_sent: sample.totals.packetsSent,
  };
}

export default EventPublisher;
