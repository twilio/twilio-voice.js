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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3J0Yy9zdGF0cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxjQUFjO0FBQ2QsMEJBQTBCO0FBQzFCLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUNwRSxPQUFPLGtCQUFrQixNQUFNLHNCQUFzQixDQUFDO0FBRXRELE1BQU0sMEJBQTBCLEdBQUcsd0JBQXdCLENBQUM7QUFDNUQsTUFBTSx5QkFBeUIsR0FBRyxtQ0FBbUMsQ0FBQztBQUV0RTs7Ozs7R0FLRztBQUNILFNBQVMsWUFBWSxDQUFDLE1BQU0sRUFBRSxFQUFFO0lBQzlCLElBQUksT0FBTyxNQUFNLENBQUMsR0FBRyxLQUFLLFVBQVUsRUFBRSxDQUFDO1FBQ3JDLE9BQU8sTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUN4QixDQUFDO0lBQ0QsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztBQUN2QyxDQUFDO0FBRUQ7Ozs7R0FJRztBQUNILFNBQVMsaUJBQWlCLENBQUMsY0FBYztJQUN2QyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7UUFDcEIsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksb0JBQW9CLENBQUMsMEJBQTBCLENBQUMsQ0FBQyxDQUFDO0lBQzlFLENBQUM7SUFFRCxJQUFJLE9BQU8sY0FBYyxDQUFDLFFBQVEsS0FBSyxVQUFVLEVBQUUsQ0FBQztRQUNsRCxPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxpQkFBaUIsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLENBQUM7SUFDMUUsQ0FBQztJQUVELElBQUksT0FBTyxDQUFDO0lBQ1osSUFBSSxDQUFDO1FBQ0gsT0FBTyxHQUFHLGNBQWMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUN0QyxDQUFDO0lBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztRQUNYLE9BQU8sR0FBRyxJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsb0JBQW9CLENBQUMsQ0FBQztJQUNuSCxDQUFDO0lBRUQsT0FBTyxPQUFPLENBQUM7QUFDakIsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSDs7Ozs7R0FLRztBQUNILFNBQVMsV0FBVyxDQUFDLGNBQWMsRUFBRSxPQUFPO0lBQzFDLE9BQU8sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsZUFBZSxFQUFFLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFFdEQsT0FBTyxpQkFBaUIsQ0FBQyxjQUFjLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ3pFLENBQUM7QUFFRDs7OztHQUlHO0FBQ0gsU0FBUyw2QkFBNkIsQ0FBQyxjQUFjO0lBQ25ELE9BQU8saUJBQWlCLENBQUMsY0FBYyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUU7UUFDdkQsOEVBQThFO1FBQzlFLE1BQU0sRUFDSixjQUFjLEVBQUUsZUFBZSxFQUFFLGdCQUFnQixFQUFFLFNBQVMsR0FDN0QsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRTtZQUNwRCxDQUFDLGdCQUFnQixFQUFFLGlCQUFpQixFQUFFLGtCQUFrQixDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUU7Z0JBQ3pFLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztvQkFDaEIsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztnQkFDbEIsQ0FBQztZQUNILENBQUMsQ0FBQyxDQUFDO1lBRUgsUUFBUSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ2xCLEtBQUssZ0JBQWdCO29CQUNuQixJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDL0IsTUFBTTtnQkFDUixLQUFLLGlCQUFpQjtvQkFDcEIsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ2hDLE1BQU07Z0JBQ1IsS0FBSyxrQkFBa0I7b0JBQ3JCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ2pDLE1BQU07Z0JBQ1IsS0FBSyxXQUFXO29CQUNkLCtFQUErRTtvQkFDL0UsSUFBSSxJQUFJLENBQUMsdUJBQXVCLEVBQUUsQ0FBQzt3QkFDakMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7b0JBQ3hCLENBQUM7b0JBQ0QsTUFBTTtZQUNWLENBQUM7WUFFRCxPQUFPLElBQUksQ0FBQztRQUNkLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVQLHFGQUFxRjtRQUNyRiwrRkFBK0Y7UUFDL0YsTUFBTSwyQkFBMkIsR0FBRyxjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFO1FBQzdELFVBQVU7UUFDVixJQUFJLENBQUMsUUFBUTtZQUNiLHFCQUFxQjtZQUNyQixDQUFDLFNBQVMsSUFBSSxJQUFJLENBQUMsRUFBRSxLQUFLLFNBQVMsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLENBQUM7UUFFaEUsSUFBSSw2QkFBNkIsQ0FBQztRQUNsQyxJQUFJLDJCQUEyQixFQUFFLENBQUM7WUFDaEMsNkJBQTZCLEdBQUc7Z0JBQzlCLGNBQWMsRUFBRSxlQUFlLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLEVBQUUsS0FBSywyQkFBMkIsQ0FBQyxnQkFBZ0IsQ0FBQztnQkFDaEgsZUFBZSxFQUFFLGdCQUFnQixDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEtBQUssMkJBQTJCLENBQUMsaUJBQWlCLENBQUM7YUFDcEgsQ0FBQztRQUNKLENBQUM7UUFFRCwwQkFBMEI7UUFDMUIsT0FBTztZQUNMLGlCQUFpQixFQUFFLENBQUMsR0FBRyxlQUFlLEVBQUUsR0FBRyxnQkFBZ0IsQ0FBQztZQUM1RCw2QkFBNkI7U0FDOUIsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVEOzs7Ozs7Ozs7Ozs7O0dBYUc7QUFDSCxTQUFTLFNBQVMsS0FBSyxDQUFDO0FBRXhCOzs7OztHQUtHO0FBQ0gsU0FBUyxlQUFlLENBQUMsV0FBVztJQUNsQyxJQUFJLGlCQUFpQixHQUFHLElBQUksQ0FBQztJQUM3QixNQUFNLE1BQU0sR0FBRyxJQUFJLFNBQVMsRUFBRSxDQUFDO0lBQy9CLElBQUksaUJBQWlCLENBQUM7SUFFdEIsS0FBSyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUU7UUFDL0MsOEVBQThFO1FBQzlFLElBQUksS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQUMsT0FBTztRQUFDLENBQUM7UUFFL0Isa0VBQWtFO1FBQ2xFLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUV6QyxpQkFBaUIsR0FBRyxpQkFBaUIsSUFBSSxLQUFLLENBQUMsU0FBUyxDQUFDO1FBRXpELDRGQUE0RjtRQUM1RiwyRkFBMkY7UUFDM0YsK0NBQStDO1FBQy9DLElBQUksS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ25CLE1BQU0sTUFBTSxHQUFHLFlBQVksQ0FBQyxXQUFXLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3pELElBQUksTUFBTSxJQUFJLE1BQU0sQ0FBQyxhQUFhLEVBQUUsQ0FBQztnQkFDbkMsTUFBTSxDQUFDLEdBQUcsR0FBRyxNQUFNLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQztZQUMzQyxDQUFDO1FBQ0gsQ0FBQztRQUVELFFBQVEsSUFBSSxFQUFFLENBQUM7WUFDYixLQUFLLFlBQVk7Z0JBQ2YsTUFBTSxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsU0FBUyxJQUFJLEtBQUssQ0FBQyxTQUFTLENBQUM7Z0JBQ3ZELE1BQU0sQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7Z0JBQ3BDLE1BQU0sQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQztnQkFDdkMsTUFBTSxDQUFDLGVBQWUsR0FBRyxLQUFLLENBQUMsZUFBZSxDQUFDO2dCQUMvQyxNQUFNLENBQUMsYUFBYSxHQUFHLEtBQUssQ0FBQyxhQUFhLENBQUM7Z0JBRTNDLE1BQU07WUFDUixLQUFLLGFBQWE7Z0JBQ2hCLE1BQU0sQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDLFNBQVMsQ0FBQztnQkFDbkMsTUFBTSxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDO2dCQUN2QyxNQUFNLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUM7Z0JBRW5DLElBQUksS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO29CQUNsQixNQUFNLEtBQUssR0FBRyxZQUFZLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztvQkFDdkQsTUFBTSxDQUFDLFNBQVMsR0FBRyxLQUFLO3dCQUN0QixDQUFDLENBQUMsS0FBSyxDQUFDLFFBQVEsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQzFELENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDO2dCQUNwQixDQUFDO2dCQUVELE1BQU07WUFDUixLQUFLLFdBQVc7Z0JBQ2QsaUJBQWlCLEdBQUcsS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDN0IsTUFBTTtRQUNWLENBQUM7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDdEIsTUFBTSxDQUFDLFNBQVMsR0FBRyxpQkFBaUIsQ0FBQztJQUN2QyxDQUFDO0lBRUQsTUFBTSxlQUFlLEdBQUcsWUFBWSxDQUFDLFdBQVcsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3JFLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUFDLE9BQU8sTUFBTSxDQUFDO0lBQUMsQ0FBQztJQUV4QyxNQUFNLHFCQUFxQixHQUFHLFlBQVksQ0FBQyxXQUFXLEVBQUUsZUFBZSxDQUFDLHVCQUF1QixDQUFDLENBQUM7SUFDakcsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7UUFBQyxPQUFPLE1BQU0sQ0FBQztJQUFDLENBQUM7SUFFOUMsTUFBTSxjQUFjLEdBQUcsWUFBWSxDQUFDLFdBQVcsRUFBRSxxQkFBcUIsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0lBQ3pGLE1BQU0sZUFBZSxHQUFHLFlBQVksQ0FBQyxXQUFXLEVBQUUscUJBQXFCLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUUzRixJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQ2hCLE1BQU0sQ0FBQyxHQUFHLEdBQUcscUJBQXFCO1lBQ2hDLENBQUMscUJBQXFCLENBQUMsb0JBQW9CLEdBQUcsSUFBSSxDQUFDLENBQUM7SUFDeEQsQ0FBQztJQUVELE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFO1FBQ3BCLDhFQUE4RTtRQUM5RSxZQUFZLEVBQUUsY0FBYyxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sSUFBSSxjQUFjLENBQUMsRUFBRSxDQUFDO1FBQzdFLGFBQWEsRUFBRSxlQUFlLElBQUksQ0FBQyxlQUFlLENBQUMsT0FBTyxJQUFJLGVBQWUsQ0FBQyxFQUFFLENBQUM7S0FDbEYsQ0FBQyxDQUFDO0lBRUgsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQztBQUVELE9BQU8sRUFDTCxXQUFXLEVBQ1gsNkJBQTZCLEdBQzlCLENBQUMifQ==