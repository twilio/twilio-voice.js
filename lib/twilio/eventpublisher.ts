import { EventEmitter } from 'events';
import Log from './log';
import request from './request';

interface EventPublisherOptions {
  defaultPayload?: object | (() => object);
  host?: string;
  metadata?: {
    app_name?: string;
    app_version?: string;
  };
  request?: any;
}

interface EventPublisherMetadata {
  app_name?: string;
  app_version?: string;
}

/**
 * Builds Endpoint Analytics (EA) event payloads and sends them to
 *   the EA server.
 * @param {String} productName - Name of the product publishing events.
 * @param {String} token - The JWT token to use to authenticate with
 *   the EA server.
 * @param {EventPublisher.Options} options
 * @property {Boolean} isEnabled - Whether or not this publisher is publishing
 *   to the server. Currently ignores the request altogether, in the future this
 *   may store them in case publishing is re-enabled later. Defaults to true.
 */
class EventPublisher extends EventEmitter {
  _defaultPayload: (connection?: any) => object;
  _host: string | undefined;
  _isEnabled: boolean;
  _log: Log;
  _request: any;
  _token: string;
  metadata: EventPublisherMetadata;
  productName: string;

  get isEnabled(): boolean {
    return this._isEnabled;
  }

  get token(): string {
    return this._token;
  }

  constructor(productName: string, token: string, options?: EventPublisherOptions) {
    super();

    // Apply default options
    const opts: EventPublisherOptions = Object.assign({ defaultPayload() { return { }; } }, options);

    let defaultPayload: any = opts.defaultPayload;

    if (typeof defaultPayload !== 'function') {
      defaultPayload = () => Object.assign({ }, opts.defaultPayload);
    }

    this._defaultPayload = defaultPayload;
    this._host = opts.host;
    this._isEnabled = true;
    this._log = new Log('EventPublisher');
    this._request = opts.request || request;
    this._token = token;
    this.metadata = Object.assign({ app_name: undefined, app_version: undefined }, opts.metadata);
    this.productName = productName;
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
  _post(endpointName: string, level: string, group: string, name: string, payload?: any, connection?: any, force?: boolean): Promise<void> {
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

    const event: any = {
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

    return new Promise<void>((resolve, reject) => {
      this._request.post(requestParams, (err: any) => {
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
  }

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
  post(level: string, group: string, name: string, payload?: any, connection?: any, force?: boolean): Promise<void> {
    return this._post('EndpointEvents', level, group, name, payload, connection, force);
  }

  /**
   * Post a debug-level event to the EA server.
   * @param {String} group - The name of the group the event belongs to.
   * @param {String} name - The designated event name.
   * @param {?Object} [payload=null] - The payload to pass. This will be extended
   *    onto the default payload object, if one exists.
   * @param {?Connection} [connection=null] - The {@link Connection} which is posting this payload.
   * @returns {Promise} Fulfilled if the HTTP response is 20x.
   */
  debug(group: string, name: string, payload?: any, connection?: any): Promise<void> {
    return this.post('debug', group, name, payload, connection);
  }

  /**
   * Post an info-level event to the EA server.
   * @param {String} group - The name of the group the event belongs to.
   * @param {String} name - The designated event name.
   * @param {?Object} [payload=null] - The payload to pass. This will be extended
   *    onto the default payload object, if one exists.
   * @param {?Connection} [connection=null] - The {@link Connection} which is posting this payload.
   * @returns {Promise} Fulfilled if the HTTP response is 20x.
   */
  info(group: string, name: string, payload?: any, connection?: any): Promise<void> {
    return this.post('info', group, name, payload, connection);
  }

  /**
   * Post a warning-level event to the EA server.
   * @param {String} group - The name of the group the event belongs to.
   * @param {String} name - The designated event name.
   * @param {?Object} [payload=null] - The payload to pass. This will be extended
   *    onto the default payload object, if one exists.
   * @param {?Connection} [connection=null] - The {@link Connection} which is posting this payload.
   * @returns {Promise} Fulfilled if the HTTP response is 20x.
   */
  warn(group: string, name: string, payload?: any, connection?: any): Promise<void> {
    return this.post('warning', group, name, payload, connection);
  }

  /**
   * Post an error-level event to the EA server.
   * @param {String} group - The name of the group the event belongs to.
   * @param {String} name - The designated event name.
   * @param {?Object} [payload=null] - The payload to pass. This will be extended
   *    onto the default payload object, if one exists.
   * @param {?Connection} [connection=null] - The {@link Connection} which is posting this payload.
   * @returns {Promise} Fulfilled if the HTTP response is 20x.
   */
  error(group: string, name: string, payload?: any, connection?: any): Promise<void> {
    return this.post('error', group, name, payload, connection);
  }

  /**
   * Post a metrics event to the EA server.
   * @param {String} group - The name of the group the event belongs to.
   * @param {String} name - The designated event name.
   * @param {Array<Object>} metrics - The metrics to post.
   * @param {?Object} [customFields] - Custom fields to append to each payload.
   * @returns {Promise} Fulfilled if the HTTP response is 20x.
   */
  postMetrics(group: string, name: string, metrics: any[], customFields?: any, connection?: any): Promise<any> {
    return new Promise(resolve => {
      const samples = metrics
        .map(formatMetric)
        .map(sample => Object.assign(sample, customFields));

      resolve(this._post('EndpointMetrics', 'info', group, name, samples, connection));
    });
  }

  /**
   * Update the host address of the insights server to publish to.
   * @param {String} host - The new host address of the insights server.
   */
  setHost(host: string): void {
    this._host = host;
  }

  /**
   * Update the token to use to authenticate requests.
   * @param {string} token
   * @returns {void}
   */
  setToken(token: string): void {
    this._token = token;
  }

  /**
   * Enable the publishing of events.
   */
  enable(): void {
    this._isEnabled = true;
  }

  /**
   * Disable the publishing of events.
   */
  disable(): void {
    this._isEnabled = false;
  }
}

function formatMetric(sample: any): any {
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
