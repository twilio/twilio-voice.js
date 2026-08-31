'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var tslib = require('tslib');
var events = require('events');
var log = require('./log.js');
var request = require('./request.js');

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
var EventPublisher = /** @class */ (function (_super) {
    tslib.__extends(EventPublisher, _super);
    function EventPublisher(productName, token, options) {
        var _this = _super.call(this) || this;
        if (!(_this instanceof EventPublisher)) {
            return new EventPublisher(productName, token, options);
        }
        // Apply default options
        options = Object.assign({ defaultPayload: function () { return {}; } }, options);
        var defaultPayload = options.defaultPayload;
        if (typeof defaultPayload !== 'function') {
            defaultPayload = function () { return Object.assign({}, options.defaultPayload); };
        }
        var isEnabled = true;
        var metadata = Object.assign({ app_name: undefined, app_version: undefined }, options.metadata);
        Object.defineProperties(_this, {
            _defaultPayload: { value: defaultPayload },
            _host: { value: options.host, writable: true },
            _isEnabled: {
                get: function () { return isEnabled; },
                set: function (_isEnabled) { isEnabled = _isEnabled; },
            },
            _log: { value: new log.default('EventPublisher') },
            _request: { value: options.request || request.default, writable: true },
            _token: { value: token, writable: true },
            isEnabled: {
                enumerable: true,
                get: function () { return isEnabled; },
            },
            metadata: {
                enumerable: true,
                get: function () { return metadata; },
            },
            productName: { enumerable: true, value: productName },
            token: {
                enumerable: true,
                get: function () { return this._token; },
            },
        });
        return _this;
    }
    return EventPublisher;
}(events.EventEmitter));
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
    var _this = this;
    if ((!this.isEnabled && !force) || !this._host) {
        this._log.debug('Publishing cancelled', JSON.stringify({ isEnabled: this.isEnabled, force: force, host: this._host }));
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
    var event = {
        group: group,
        level: level.toUpperCase(),
        name: name,
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
        this._log.debug('Publishing insights', JSON.stringify({ endpointName: endpointName, event: event, force: force, host: this._host }));
    }
    var requestParams = {
        body: event,
        headers: {
            'Content-Type': 'application/json',
            'X-Twilio-Token': this.token,
        },
        url: "https://".concat(this._host, "/v4/").concat(endpointName),
    };
    return new Promise(function (resolve, reject) {
        _this._request.post(requestParams, function (err) {
            if (err) {
                _this.emit('error', err);
                reject(err);
            }
            else {
                resolve();
            }
        });
    }).catch(function (e) {
        _this._log.error("Unable to post ".concat(group, " ").concat(name, " event to Insights. Received error: ").concat(e));
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
    var _this = this;
    return new Promise(function (resolve) {
        var samples = metrics
            .map(formatMetric)
            .map(function (sample) { return Object.assign(sample, customFields); });
        resolve(_this._post('EndpointMetrics', 'info', group, name, samples, connection));
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

exports.default = EventPublisher;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnRwdWJsaXNoZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vZXZlbnRwdWJsaXNoZXIudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOlsiX19leHRlbmRzIiwiTG9nIiwicmVxdWVzdCIsIkV2ZW50RW1pdHRlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBS0E7Ozs7Ozs7Ozs7O0FBV0c7QUFDSDs7Ozs7Ozs7Ozs7QUFXRztBQUNILElBQUEsY0FBQSxrQkFBQSxVQUFBLE1BQUEsRUFBQTtJQUE2QkEsZUFBQSxDQUFBLGNBQUEsRUFBQSxNQUFBLENBQUE7QUFDM0IsSUFBQSxTQUFBLGNBQUEsQ0FBWSxXQUFXLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBQTtRQUNyQyxJQUFBLEtBQUEsR0FBQSxNQUFLLFdBQUUsSUFBQSxJQUFBO0FBRVAsUUFBQSxJQUFJLEVBQUUsS0FBSSxZQUFZLGNBQWMsQ0FBQyxFQUFFO1lBQ3JDLE9BQU8sSUFBSSxjQUFjLENBQUMsV0FBVyxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUM7UUFDeEQ7O0FBR0EsUUFBQSxPQUFPLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLGNBQWMsRUFBQSxZQUFBLEVBQUssT0FBTyxFQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxPQUFPLENBQUM7QUFFdEUsUUFBQSxJQUFJLGNBQWMsR0FBRyxPQUFPLENBQUMsY0FBYztBQUUzQyxRQUFBLElBQUksT0FBTyxjQUFjLEtBQUssVUFBVSxFQUFFO0FBQ3hDLFlBQUEsY0FBYyxHQUFHLFlBQUEsRUFBTSxPQUFBLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRyxFQUFFLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQSxDQUExQyxDQUEwQztRQUNuRTtRQUVBLElBQUksU0FBUyxHQUFHLElBQUk7UUFDcEIsSUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsV0FB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QVUsRUFBRSxLQUFLLENBQUM7QUFDckYsQ0FBQztBQUVEOzs7Ozs7OztBQVFHO0FBQ0gsY0FBYyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEdBQUcsU0FBUyxLQUFLLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsVUFBVSxFQUFBO0FBQzlFLElBQUEsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxVQUFVLENBQUM7QUFDN0QsQ0FBQztBQUVEOzs7Ozs7OztBQVFHO0FBQ0gsY0FBYyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEdBQUcsU0FBUyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsVUFBVSxFQUFBO0FBQzVFLElBQUEsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxVQUFVLENBQUM7QUFDNUQsQ0FBQztBQUVEOzs7Ozs7OztBQVFHO0FBQ0gsY0FBYyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEdBQUcsU0FBUyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsVUFBVSxFQUFBO0FBQzVFLElBQUEsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxVQUFVLENBQUM7QUFDL0QsQ0FBQztBQUVEOzs7Ozs7OztBQVFHO0FBQ0gsY0FBYyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEdBQUcsU0FBUyxLQUFLLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsVUFBVSxFQUFBO0FBQzlFLElBQUEsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxVQUFVLENBQUM7QUFDN0QsQ0FBQztBQUVEOzs7Ozs7O0FBT0c7QUFDSCxjQUFjLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBRyxTQUFT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
