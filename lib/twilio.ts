import Call from './twilio/call';
import Device from './twilio/device';
import { Logger } from './twilio/log';
import { PreflightTest } from './twilio/preflight/preflight';
// TODO: Consider refactoring this export (VBLOCKS-4589)
import * as TwilioError from './twilio/errors';

import type AudioHelper from './twilio/audiohelper';
import type AudioProcessor from './twilio/audioprocessor';
import type OutputDeviceCollection from './twilio/outputdevicecollection';
import type { NetworkTiming, TimeMeasurement } from './twilio/preflight/timing';
import type { Edge } from './twilio/regions';
import RTCSample from './twilio/rtc/sample';
import { RTCSampleTotals } from './twilio/rtc/sample';
import RTCWarning from './twilio/rtc/warning';
import { ThresholdWarningData } from './twilio/rtc/warning';

export { Call, Device, PreflightTest, Logger, TwilioError };
export type {
  AudioHelper,
  AudioProcessor,
  Edge,
  OutputDeviceCollection,
  NetworkTiming,
  RTCSample,
  RTCSampleTotals,
  RTCWarning,
  TimeMeasurement,
  ThresholdWarningData,
};
