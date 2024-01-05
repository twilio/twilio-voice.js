"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
// @ts-nocheck
var events_1 = require("events");
var log_1 = require("./log");
var request_1 = require("./request");
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
    __extends(EventPublisher, _super);
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
            _log: { value: new log_1.default('EventPublisher') },
            _request: { value: options.request || request_1.default, writable: true },
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
}(events_1.EventEmitter));
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
        url: "https://" + this._host + "/v4/" + endpointName,
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
        _this._log.error("Unable to post " + group + " " + name + " event to Insights. Received error: " + e);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnRwdWJsaXNoZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL2V2ZW50cHVibGlzaGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQUFBOzs7O0dBSUc7QUFDSCxjQUFjO0FBQ2QsaUNBQXNDO0FBQ3RDLDZCQUF3QjtBQUN4QixxQ0FBZ0M7QUFFaEM7Ozs7Ozs7Ozs7O0dBV0c7QUFDSDs7Ozs7Ozs7Ozs7R0FXRztBQUNIO0lBQTZCLGtDQUFZO0lBQ3ZDLHdCQUFZLFdBQVcsRUFBRSxLQUFLLEVBQUUsT0FBTztRQUF2QyxZQUNFLGlCQUFPLFNBMENSO1FBeENDLElBQUksQ0FBQyxDQUFDLEtBQUksWUFBWSxjQUFjLENBQUMsRUFBRTtZQUNyQyxPQUFPLElBQUksY0FBYyxDQUFDLFdBQVcsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7U0FDeEQ7UUFFRCx3QkFBd0I7UUFDeEIsT0FBTyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxjQUFjLGdCQUFLLE9BQU8sRUFBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFFdkUsSUFBSSxjQUFjLEdBQUcsT0FBTyxDQUFDLGNBQWMsQ0FBQztRQUU1QyxJQUFJLE9BQU8sY0FBYyxLQUFLLFVBQVUsRUFBRTtZQUN4QyxjQUFjLEdBQUcsY0FBTSxPQUFBLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRyxFQUFFLE9BQU8sQ0FBQyxjQUFjLENBQUMsRUFBMUMsQ0FBMEMsQ0FBQztTQUNuRTtRQUVELElBQUksU0FBUyxHQUFHLElBQUksQ0FBQztRQUNyQixJQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLEVBQUUsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBRWxHLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxL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