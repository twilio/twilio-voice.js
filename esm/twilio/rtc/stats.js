/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
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
export { getRTCStats, getRTCIceCandidateStatsReport, };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3J0Yy9zdGF0cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7OztHQUlHO0FBQ0gsY0FBYztBQUNkLDBCQUEwQjtBQUMxQixPQUFPLEVBQUUsb0JBQW9CLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFDcEUsT0FBTyxrQkFBa0IsTUFBTSxzQkFBc0IsQ0FBQztBQUV0RCxNQUFNLDBCQUEwQixHQUFHLHdCQUF3QixDQUFDO0FBQzVELE1BQU0seUJBQXlCLEdBQUcsbUNBQW1DLENBQUM7QUFFdEU7Ozs7O0dBS0c7QUFDSCxTQUFTLFlBQVksQ0FBQyxNQUFNLEVBQUUsRUFBRTtJQUM5QixJQUFJLE9BQU8sTUFBTSxDQUFDLEdBQUcsS0FBSyxVQUFVLEVBQUU7UUFDcEMsT0FBTyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0tBQ3ZCO0lBQ0QsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztBQUN2QyxDQUFDO0FBRUQ7Ozs7R0FJRztBQUNILFNBQVMsaUJBQWlCLENBQUMsY0FBYztJQUN2QyxJQUFJLENBQUMsY0FBYyxFQUFFO1FBQ25CLE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLG9CQUFvQixDQUFDLDBCQUEwQixDQUFDLENBQUMsQ0FBQztLQUM3RTtJQUVELElBQUksT0FBTyxjQUFjLENBQUMsUUFBUSxLQUFLLFVBQVUsRUFBRTtRQUNqRCxPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxpQkFBaUIsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLENBQUM7S0FDekU7SUFFRCxJQUFJLE9BQU8sQ0FBQztJQUNaLElBQUk7UUFDRixPQUFPLEdBQUcsY0FBYyxDQUFDLFFBQVEsRUFBRSxDQUFDO0tBQ3JDO0lBQUMs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