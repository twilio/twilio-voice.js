// @ts-nocheck
// tslint:disable no-empty
import { InvalidArgumentError, NotSupportedError } from '../errors';
import MockRTCStatsReport from './mockrtcstatsreport';

const ERROR_PEER_CONNECTION_NULL = 'PeerConnection is null';
const ERROR_WEB_RTC_UNSUPPORTED = 'WebRTC statistics are unsupported';

/**
 * Helper function to find a specific stat from a report.
 * Some environment provide the stats report as a map (regular browsers)
 * but some provide stats report as an array (citrix vdi)
 * @private
 */
function findStatById(report, id) {
  if (typeof report.get === 'function') {
    return report.get(id);
  }
  return report.find(s => s.id === id);
}

/**
 * Generate WebRTC statistics report for the given {@link PeerConnection}
 * @param {PeerConnection} peerConnection - Target connection.
 * @return {Promise<RTCStatsReport>} WebRTC RTCStatsReport object
 */
function getRTCStatsReport(peerConnection) {
  if (!peerConnection) {
    return Promise.reject(new InvalidArgumentError(ERROR_PEER_CONNECTION_NULL));
  }

  if (typeof peerConnection.getStats !== 'function') {
    return Promise.reject(new NotSupportedError(ERROR_WEB_RTC_UNSUPPORTED));
  }

  let promise;
  try {
    promise = peerConnection.getStats();
  } catch (e) {
    promise = new Promise(resolve => peerConnection.getStats(resolve)).then(MockRTCStatsReport.fromRTCStatsResponse);
  }

  return promise;
}

/**
 * @typedef {Object} StatsOptions
 * Used for testing to inject and extract methods.
 * @property {function} [createRTCSample] - Method for parsing an RTCStatsReport
 */
/**
 * Collects any WebRTC statistics for the given {@link PeerConnection}
 * @param {PeerConnection} peerConnection - Target connection.
 * @param {StatsOptions} options - List of custom options.
 * @return {Promise<RTCSample>} Universally-formatted version of RTC stats.
 */
function getRTCStats(peerConnection, options) {
  options = Object.assign({ createRTCSample }, options);

  return getRTCStatsReport(peerConnection).then(options.createRTCSample);
}

/**
 * Generate WebRTC stats report containing relevant information about ICE candidates for the given {@link PeerConnection}
 * @param {PeerConnection} peerConnection - Target connection.
 * @return {Promise<RTCIceCandidateStatsReport>} RTCIceCandidateStatsReport object
 */
function getRTCIceCandidateStatsReport(peerConnection) {
  return getRTCStatsReport(peerConnection).then((report) => {
    // Find the relevant information needed to determine selected candidates later
    const {
      candidatePairs, localCandidates, remoteCandidates, transport,
    } = Array.from(report.values()).reduce((rval, stat) => {
      ['candidatePairs', 'localCandidates', 'remoteCandidates'].forEach((prop) => {
        if (!rval[prop]) {
          rval[prop] = [];
        }
      });

      switch (stat.type) {
        case 'candidate-pair':
          rval.candidatePairs.push(stat);
          break;
        case 'local-candidate':
          rval.localCandidates.push(stat);
          break;
        case 'remote-candidate':
          rval.remoteCandidates.push(stat);
          break;
        case 'transport':
          // This transport is the one being used if selectedCandidatePairId is populated
          if (stat.selectedCandidatePairId) {
            rval.transport = stat;
          }
          break;
      }

      return rval;
    }, {});

    // This is a report containing information about the selected candidates, such as IDs
    // This is coming from WebRTC stats directly and doesn't contain the actual ICE Candidates info
    const selectedCandidatePairReport = candidatePairs.find(pair =>
      // Firefox
      pair.selected ||
      // Spec-compliant way
      (transport && pair.id === transport.selectedCandidatePairId));

    let selectedIceCandidatePairStats;
    if (selectedCandidatePairReport) {
      selectedIceCandidatePairStats = {
        localCandidate: localCandidates.find(candidate => candidate.id === selectedCandidatePairReport.localCandidateId),
        remoteCandidate: remoteCandidates.find(candidate => candidate.id === selectedCandidatePairReport.remoteCandidateId),
      };
    }

    // Build the return object
    return {
      iceCandidateStats: [...localCandidates, ...remoteCandidates],
      selectedIceCandidatePairStats,
    };
  });
}

/**
 * @typedef {Object} RTCSample - A sample containing relevant WebRTC stats information.
 * @property {Number} [timestamp]
 * @property {String} [codecName] - MimeType name of the codec being used by the outbound audio stream
 * @property {Number} [rtt] - Round trip time
 * @property {Number} [jitter]
 * @property {Number} [packetsSent]
 * @property {Number} [packetsLost]
 * @property {Number} [packetsReceived]
 * @property {Number} [bytesReceived]
 * @property {Number} [bytesSent]
 * @property {Number} [localAddress]
 * @property {Number} [remoteAddress]
 */
function RTCSample() { }

/**
 * Create an RTCSample object from an RTCStatsReport
 * @private
 * @param {RTCStatsReport} statsReport
 * @returns {RTCSample}
 */
function createRTCSample(statsReport) {
  let activeTransportId = null;
  const sample = new RTCSample();
  let fallbackTimestamp;

  Array.from(statsReport.values()).forEach(stats => {
    // Skip isRemote tracks which will be phased out completely and break in FF66.
    if (stats.isRemote) { return; }

    // Firefox hack -- Older firefox doesn't have dashes in type names
    const type = stats.type.replace('-', '');

    fallbackTimestamp = fallbackTimestamp || stats.timestamp;

    // (rrowland) As I understand it, this is supposed to come in on remote-inbound-rtp but it's
    // currently coming in on remote-outbound-rtp, so I'm leaving this outside the switch until
    // the appropriate place to look is cleared up.
    if (stats.remoteId) {
      const remote = findStatById(statsReport, stats.remoteId);
      if (remote && remote.roundTripTime) {
        sample.rtt = remote.roundTripTime * 1000;
      }
    }

    switch (type) {
      case 'inboundrtp':
        sample.timestamp = sample.timestamp || stats.timestamp;
        sample.jitter = stats.jitter * 1000;
        sample.packetsLost = stats.packetsLost;
        sample.packetsReceived = stats.packetsReceived;
        sample.bytesReceived = stats.bytesReceived;

        break;
      case 'outboundrtp':
        sample.timestamp = stats.timestamp;
        sample.packetsSent = stats.packetsSent;
        sample.bytesSent = stats.bytesSent;

        if (stats.codecId) {
          const codec = findStatById(statsReport, stats.codecId);
          sample.codecName = codec
            ? codec.mimeType && codec.mimeType.match(/(.*\/)?(.*)/)[2]
            : stats.codecId;
        }

        break;
      case 'transport':
        activeTransportId = stats.id;
        break;
    }
  });

  if (!sample.timestamp) {
    sample.timestamp = fallbackTimestamp;
  }

  const activeTransport = findStatById(statsReport, activeTransportId);
  if (!activeTransport) { return sample; }

  const selectedCandidatePair = findStatById(statsReport, activeTransport.selectedCandidatePairId);
  if (!selectedCandidatePair) { return sample; }

  const localCandidate = findStatById(statsReport, selectedCandidatePair.localCandidateId);
  const remoteCandidate = findStatById(statsReport, selectedCandidatePair.remoteCandidateId);

  if (!sample.rtt) {
    sample.rtt = selectedCandidatePair &&
      (selectedCandidatePair.currentRoundTripTime * 1000);
  }

  Object.assign(sample, {
    // ip is deprecated. use address first then ip if on older versions of browser
    localAddress: localCandidate && (localCandidate.address || localCandidate.ip),
    remoteAddress: remoteCandidate && (remoteCandidate.address || remoteCandidate.ip),
  });

  return sample;
}

export {
  getRTCStats,
  getRTCIceCandidateStatsReport,
};
