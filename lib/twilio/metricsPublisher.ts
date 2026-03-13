import { IPublisher } from './call';
import Log from './log';
import RTCSample from './rtc/sample';
import { RELEASE_VERSION } from './constants';

const METRICS_BATCH_SIZE: number = 10;

/**
 * Options for MetricsPublisher construction.
 */
export interface MetricsPublisherOptions {
  callSid: () => string;
  direction: () => string;
  dscp: boolean;
  gateway?: string;
  getInputVolume: () => number;
  getOutputVolume: () => number;
  publisher: IPublisher;
}

export interface CallMetrics extends RTCSample {
  inputVolume: number;
  outputVolume: number;
}

/**
 * Batches and publishes call quality metrics to Insights.
 * @private
 */
class MetricsPublisher {
  private _metricsSamples: CallMetrics[] = [];
  private _log: Log = new Log('MetricsPublisher');
  private _codec: string = '';
  private _options: MetricsPublisherOptions;

  constructor(options: MetricsPublisherOptions) {
    this._options = options;
  }

  get codec(): string {
    return this._codec;
  }

  /**
   * Called each time StatsMonitor emits a sample.
   * Batches the call stats metrics and publishes when batch is full.
   * @returns The CallMetrics object for the sample.
   */
  onRTCSample(sample: RTCSample): CallMetrics {
    const callMetrics: CallMetrics = {
      ...sample,
      inputVolume: this._options.getInputVolume(),
      outputVolume: this._options.getOutputVolume(),
    };

    this._codec = callMetrics.codecName;

    this._metricsSamples.push(callMetrics);
    if (this._metricsSamples.length >= METRICS_BATCH_SIZE) {
      this.publishMetrics();
    }

    return callMetrics;
  }

  /**
   * Publish the current set of queued metrics samples to Insights.
   */
  publishMetrics(): void {
    if (this._metricsSamples.length === 0) {
      return;
    }

    const payload: Partial<Record<string, string | boolean>> = {
      call_sid: this._options.callSid(),
      dscp: !!this._options.dscp,
      sdk_version: RELEASE_VERSION,
    };

    if (this._options.gateway) {
      payload.gateway = this._options.gateway;
    }

    payload.direction = this._options.direction();

    this._options.publisher.postMetrics(
      'quality-metrics-samples', 'metrics-sample', this._metricsSamples.splice(0), payload, this,
    ).catch((e: any) => {
      this._log.warn('Unable to post metrics to Insights. Received error:', e);
    });
  }
}

export default MetricsPublisher;
