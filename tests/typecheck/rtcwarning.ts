import { RTCWarning, RTCSample, ThresholdWarningData } from '../../lib/twilio';

const checkRTCWarning = () => {
  // RTCWarning interface
  const warning: RTCWarning = {};

  const warningWithName: RTCWarning = {
    name: 'jitter',
  };

  const warningWithThreshold: RTCWarning = {
    name: 'audioInputLevel',
    threshold: {
      name: 'maxDuration',
      value: 10,
    },
  };

  const warningWithValue: RTCWarning = {
    name: 'rtt',
    value: 500,
  };

  const warningWithValues: RTCWarning = {
    name: 'mos',
    values: [1.0, 1.5, 2.0],
  };

  // All optional fields
  const fullWarning: RTCWarning = {
    name: 'jitter',
    samples: [] as RTCSample[],
    threshold: {
      name: 'max',
      value: 30,
    },
    value: 25,
    values: [20, 25, 30],
  };

  // Access fields
  const name: string | undefined = fullWarning.name;
  const samples: RTCSample[] | undefined = fullWarning.samples;
  const threshold: ThresholdWarningData | undefined = fullWarning.threshold;
  const value: number | undefined = fullWarning.value;
  const values: number[] | undefined = fullWarning.values;

  // ThresholdWarningData interface
  const thresholdData: ThresholdWarningData = {
    name: 'max',
    value: 100,
  };

  const thresholdName: string = thresholdData.name;
  const thresholdValue: number = thresholdData.value;
};

export default checkRTCWarning;
