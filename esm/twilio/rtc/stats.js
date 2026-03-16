import { InvalidArgumentError, NotSupportedError } from '../errors/index.js';
import MockRTCStatsReport from './mockrtcstatsreport.js';

// @ts-nocheck
// tslint:disable no-empty
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
    }
    catch (e) {
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
        const { candidatePairs, localCandidates, remoteCandidates, transport, } = Array.from(report.values()).reduce((rval, stat) => {
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
        if (stats.isRemote) {
            return;
        }
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
    if (!activeTransport) {
        return sample;
    }
    const selectedCandidatePair = findStatById(statsReport, activeTransport.selectedCandidatePairId);
    if (!selectedCandidatePair) {
        return sample;
    }
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

export { getRTCIceCandidateStatsReport, getRTCStats };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdHMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi90d2lsaW8vcnRjL3N0YXRzLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBO0FBQ0E7QUFJQSxNQUFNLDBCQUEwQixHQUFHLHdCQUF3QjtBQUMzRCxNQUFNLHlCQUF5QixHQUFHLG1DQUFtQztBQUVyRTs7Ozs7QUFLRztBQUNILFNBQVMsWUFBWSxDQUFDLE1BQU0sRUFBRSxFQUFFLEVBQUE7QUFDOUIsSUFBQSxJQUFJLE9BQU8sTUFBTSxDQUFDLEdBQUcsS0FBSyxVQUFVLEVBQUU7QUFDcEMsUUFBQSxPQUFPLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO0lBQ3ZCO0FBQ0EsSUFBQSxPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDO0FBQ3RDO0FBRUE7Ozs7QUFJRztBQUNILFNBQVMsaUJBQWlCLENBQUMsY0FBYyxFQUFBO0lBQ3ZDLElBQUksQ0FBQyxjQUFjLEVBQUU7UUFDbkIsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksb0JBQW9CLENBQUMsMEJBQTBCLENBQUMsQ0FBQztJQUM3RTtBQUVBLElBQUEsSUFBSSxPQUFPLGNBQWMsQ0FBQyxRQUFRLEtBQUssVUFBVSxFQUFFO1FBQ2pELE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLGlCQUFpQixDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDekU7QUFFQSxJQUFBLElBQUksT0FBTztBQUNYLElBQUEsSUFBSTtBQUNGLFFBQUEsT0FBTyxHQUFHLGNBQWMsQ0FBQyxRQUFRLEVBQUU7SUFDckM7SUFBRSxPQUFPLENBQUMsRUFBRTtRQUNWLE9BQU8sR0FBRyxJQUFJLE9BQU8sQ0FBQyxPQUFPLElBQUksY0FBYyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FB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
