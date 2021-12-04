/**
 * Used for testing to inject and extract methods.
 */
export type StatsOptions = {
    /**
     * - Method for parsing an RTCStatsReport
     */
    createRTCSample?: Function;
};
/**
 * - A sample containing relevant WebRTC stats information.
 */
export type RTCSample = {
    timestamp?: number;
    /**
     * - MimeType name of the codec being used by the outbound audio stream
     */
    codecName?: string;
    /**
     * - Round trip time
     */
    rtt?: number;
    jitter?: number;
    packetsSent?: number;
    packetsLost?: number;
    packetsReceived?: number;
    bytesReceived?: number;
    bytesSent?: number;
    localAddress?: number;
    remoteAddress?: number;
};
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
export function getRTCStats(peerConnection: any, options: StatsOptions): Promise<RTCSample>;
/**
 * Generate WebRTC stats report containing relevant information about ICE candidates for the given {@link PeerConnection}
 * @param {PeerConnection} peerConnection - Target connection.
 * @return {Promise<RTCIceCandidateStatsReport>} RTCIceCandidateStatsReport object
 */
export function getRTCIceCandidateStatsReport(peerConnection: any): Promise<any>;
