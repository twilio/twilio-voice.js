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
export default EventPublisher;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnRwdWJsaXNoZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL2V2ZW50cHVibGlzaGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGNBQWM7QUFDZCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBQ3RDLE9BQU8sR0FBRyxNQUFNLE9BQU8sQ0FBQztBQUN4QixPQUFPLE9BQU8sTUFBTSxXQUFXLENBQUM7QUFFaEM7Ozs7Ozs7Ozs7O0dBV0c7QUFDSDs7Ozs7Ozs7Ozs7R0FXRztBQUNILE1BQU0sY0FBZSxTQUFRLFlBQVk7SUFDdkMsWUFBWSxXQUFXLEVBQUUsS0FBSyxFQUFFLE9BQU87UUFDckMsS0FBSyxFQUFFLENBQUM7UUFFUixJQUFJLENBQUMsQ0FBQyxJQUFJLFlBQVksY0FBYyxDQUFDLEVBQUUsQ0FBQztZQUN0QyxPQUFPLElBQUksY0FBYyxDQUFDLFdBQVcsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDekQsQ0FBQztRQUVELHdCQUF3QjtRQUN4QixPQUFPLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLGNBQWMsS0FBSyxPQUFPLEVBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBRXZFLElBQUksY0FBYyxHQUFHLE9BQU8sQ0FBQyxjQUFjLENBQUM7UUFFNUMsSUFBSSxPQUFPLGNBQWMsS0FBSyxVQUFVLEVBQUUsQ0FBQztZQUN6QyxjQUFjLEdBQUcsR0FBRyxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFHLEVBQUUsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ3BFLENBQUM7UUFFRCxJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUM7UUFDckIsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxFQUFFLE9B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