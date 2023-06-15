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
            _log: { value: options.log },
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
        return Promise.resolve();
    }
    if (!connection || ((!connection.parameters || !connection.parameters.CallSid) && !connection.outboundConnectionId)) {
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
        _this._log.warn("Unable to post " + group + " " + name + " event to Insights. Received error: " + e);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnRwdWJsaXNoZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL2V2ZW50cHVibGlzaGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQUFBOzs7O0dBSUc7QUFDSCxjQUFjO0FBQ2QsaUNBQXNDO0FBQ3RDLHFDQUFnQztBQUVoQzs7Ozs7Ozs7Ozs7R0FXRztBQUNIOzs7Ozs7Ozs7OztHQVdHO0FBQ0g7SUFBNkIsa0NBQVk7SUFDdkMsd0JBQVksV0FBVyxFQUFFLEtBQUssRUFBRSxPQUFPO1FBQXZDLFlBQ0UsaUJBQU8sU0EwQ1I7UUF4Q0MsSUFBSSxDQUFDLENBQUMsS0FBSSxZQUFZLGNBQWMsQ0FBQyxFQUFFO1lBQ3JDLE9BQU8sSUFBSSxjQUFjLENBQUMsV0FBVyxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQztTQUN4RDtRQUVELHdCQUF3QjtRQUN4QixPQUFPLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLGNBQWMsZ0JBQUssT0FBTyxFQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUV2RSxJQUFJLGNBQWMsR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDO1FBRTVDLElBQUksT0FBTyxjQUFjLEtBQUssVUFBVSxFQUFFO1lBQ3hDLGNBQWMsR0FBRyxjQUFNLE9BQUEsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFHLEVBQUUsT0FBTyxDQUFDLGNBQWMsQ0FBQyxFQUExQyxDQUEwQyxDQUFDO1NBQ25FO1FBRUQsSUFBSSxTQUFTLEdBQUcsSUFBSSxDQUFDO1FBQ3JCLElBQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLFdBQVcsRUFBRSxTQUFTLEVBQUUsRUFBRSxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFbEcsTUFBTSxDQUFDLGdCQUFnQixDQUFDLEtBQUksRUFBRTtZQUM1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