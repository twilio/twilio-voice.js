import { EventEmitter } from 'events';
import Log from './log.js';
import Request from './request.js';

// @ts-nocheck
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
        options = Object.assign({ defaultPayload() { return {}; } }, options);
        let defaultPayload = options.defaultPayload;
        if (typeof defaultPayload !== 'function') {
            defaultPayload = () => Object.assign({}, options.defaultPayload);
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
            _request: { value: options.request || Request, writable: true },
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
        }
        else {
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
        this._log.debug('Publishing insights', JSON.stringify({ endpointName, event, force, host: this._host }));
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
            }
            else {
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

export { EventPublisher as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnRwdWJsaXNoZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vZXZlbnRwdWJsaXNoZXIudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOlsicmVxdWVzdCJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBO0FBS0E7Ozs7Ozs7Ozs7O0FBV0c7QUFDSDs7Ozs7Ozs7Ozs7QUFXRztBQUNILE1BQU0sY0FBZSxTQUFRLFlBQVksQ0FBQTtBQUN2QyxJQUFBLFdBQUEsQ0FBWSxXQUFXLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBQTtBQUNyQyxRQUFBLEtBQUssRUFBRTtBQUVQLFFBQUEsSUFBSSxFQUFFLElBQUksWUFBWSxjQUFjLENBQUMsRUFBRTtZQUNyQyxPQUFPLElBQUksY0FBYyxDQUFDLFdBQVcsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDO1FBQ3hEOztBQUdBLFFBQUEsT0FBTyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxjQUFjLEdBQUEsRUFBSyxPQUFPLEVBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQztBQUV0RSxRQUFBLElBQUksY0FBYyxHQUFHLE9BQU8sQ0FBQyxjQUFjO0FBRTNDLFFBQUEsSUFBSSxPQUFPLGNBQWMsS0FBSyxVQUFVLEVBQUU7QUFDeEMsWUFBQSxjQUFjLEdBQUcsTUFBTSxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUcsRUFBRSxPQUFPLENBQUMsY0FBYyxDQUFDO1FBQ25FO1FBRUEsSUFBSSxTQUFTLEdBQUcsSUFBSTtRQUNwQixNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLEVBQUUsT0FBTyxDQUFDLFFBQVEsQ0FBQztBQUVqRyxRQUFBLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUU7QUFDNUIsWUFBQSxlQUFlLEVBQUUsRUFBRSxLQUFLLEVBQUUsY0FBYyxFQUFFO1lB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
