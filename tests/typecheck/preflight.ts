import { Call, Device, PreflightTest } from '../../lib/twilio';

const checkPreflight = async () => {
  const preflight: PreflightTest = Device.runPreflight('foo', {
    codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
    edge: 'foo',
    fakeMicInput: true,
    iceServers: [],
    logLevel: 'debug',
    signalingTimeoutMs: 1,
  });

  const callSid: string | undefined = preflight.callSid;
  const endTime: number | undefined = preflight.endTime;
  const sample = preflight.latestSample;
  if (sample) {
    const audioInputLevel: number = sample.audioInputLevel;
    const audioOutputLevel: number = sample.audioOutputLevel;
    const bytesReceived: number = sample.bytesReceived;
    const bytesSent: number = sample.bytesSent;
    const jitter: number = sample.jitter;
    const mos: number | null = sample.mos;
    const packetsLost: number = sample.packetsLost;
    const packetsLostFraction: number = sample.packetsLostFraction;
    const packetsReceived: number = sample.packetsReceived;
    const packetsSent: number = sample.packetsSent;
    const rtt: number = sample.rtt;
    const timestamp: number = sample.timestamp;
    const totalBytesReceived: number = sample.totals.bytesReceived;
    const totalBytesSent: number = sample.totals.bytesSent;
    const totalPacketsLost: number = sample.totals.packetsLost;
    const totalPacketsLostFraction: number = sample.totals.packetsLostFraction;
    const totalPacketsReceived: number = sample.totals.packetsReceived;
    const totalPacketsSent: number = sample.totals.packetsSent;
  }
  const report: PreflightTest.Report | undefined = preflight.report;
  if (report) {
    const callQuality: PreflightTest.CallQuality | undefined = report.callQuality;
    const callSid: string | undefined = report.callSid;
    const edge: string | undefined = report.edge;
    const iceCandidateStats: PreflightTest.RTCIceCandidateStats[] = report.iceCandidateStats;
    const isTurnRequired: undefined | false | true = report.isTurnRequired;
    
    const dtlsStart: number | undefined = report.networkTiming.dtls?.start;
    const dtlsEnd: number | undefined = report.networkTiming.dtls?.end;
    const dtlsDuration: number | undefined = report.networkTiming.dtls?.duration;
    const iceStart: number | undefined = report.networkTiming.ice?.start;
    const iceEnd: number | undefined = report.networkTiming.ice?.end;
    const iceDuration: number | undefined = report.networkTiming.ice?.duration;
    const peerConnectionStart: number | undefined = report.networkTiming.peerConnection?.start;
    const peerConnectionEnd: number | undefined = report.networkTiming.peerConnection?.end;
    const peerConnectionDuration: number | undefined = report.networkTiming.peerConnection?.duration;
    const signalingStart: number | undefined = report.networkTiming.signaling?.start;
    const signalingEnd: number | undefined = report.networkTiming.signaling?.end;
    const signalingDuration: number | undefined = report.networkTiming.signaling?.duration;

    const samples: typeof preflight.latestSample[] = report.samples;
    const selectedEdge: string | undefined = report.selectedEdge;
    const selectedIceCandidatePairStats: PreflightTest.RTCSelectedIceCandidatePairStats | undefined = report.selectedIceCandidatePairStats;
    const localCandidate: PreflightTest.RTCIceCandidateStats = selectedIceCandidatePairStats?.localCandidate;
    const remoteCandidate: PreflightTest.RTCIceCandidateStats = selectedIceCandidatePairStats?.remoteCandidate;
    const stats: PreflightTest.RTCStats | undefined = report.stats;
    const jitterAverage: number | undefined = stats?.jitter.average;
    const jitterMax: number | undefined = stats?.jitter.max;
    const jitterMin: number | undefined = stats?.jitter.min;
    const mosAverage: number | undefined = stats?.mos.average;
    const mosMax: number | undefined = stats?.mos.max;
    const mosMin: number | undefined = stats?.mos.min;
    const rttAverage: number | undefined = stats?.rtt.average;
    const rttMax: number | undefined = stats?.rtt.max;
    const rttMin: number | undefined = stats?.rtt.min;
    const testStart: number | undefined = report.testTiming.start;
    const testEnd: number | undefined = report.testTiming.end;
    const testDuration: number | undefined = report.testTiming.duration;

    const totals = report.totals;
    if (totals) {
      const totalBytesReceived: number = totals.bytesReceived;
      const totalBytesSent: number = totals.bytesSent;
      const totalPacketsLost: number = totals.packetsLost;
      const totalPacketsLostFraction: number = totals.packetsLostFraction;
      const totalPacketsReceived: number = totals.packetsReceived;
      const totalPacketsSent: number = totals.packetsSent;
    }

    const warnings: PreflightTest.Warning[] = report.warnings;
    const name: string = warnings[0].name;
    const description: string = warnings[0].description;
  }

  const startTime: number = preflight.startTime;
  const status: PreflightTest.Status = preflight.status;
  preflight.stop();
};

export default checkPreflight;
