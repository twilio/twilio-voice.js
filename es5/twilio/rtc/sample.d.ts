/**
 * @packageDocumentation
 * @module Voice
 * @publicapi
 */
/**
 * Sample RTC statistics. See [[Connection.sampleEvent]]
 */
export default interface RTCSample {
    [key: string]: any;
    /**
     * Audio input level in last second. Between 0 and 32767, representing -100 to -30 dB.
     */
    audioInputLevel: number;
    /**
     * Audio output level in last second. Between 0 and 32767, representing -100 to -30 dB.
     */
    audioOutputLevel: number;
    /**
     * Bytes received in last second.
     */
    bytesReceived: number;
    /**
     * Bytes sent in last second.
     */
    bytesSent: number;
    /**
     * Audio codec used, either pcmu or opus
     */
    codecName: string;
    /**
     * Packets delay variation
     */
    jitter: number;
    /**
     * Mean opinion score, 1.0 through roughly 4.5
     */
    mos: number | null;
    /**
     * Number of packets lost in last second.
     */
    packetsLost: number;
    /**
     * Packets lost to inbound packets ratio in last second.
     */
    packetsLostFraction: number;
    /**
     * Number of packets received in last second.
     */
    packetsReceived: number;
    /**
     * Number of packets sent in last second.
     */
    packetsSent: number;
    /**
     * Round trip time, to the server back to the client.
     */
    rtt: number;
    /**
     * Timestamp
     */
    timestamp: number;
    /**
     * Totals for packets and bytes related information
     */
    totals: RTCSampleTotals;
}
/**
 * Totals included in RTC statistics samples
 */
export interface RTCSampleTotals {
    /**
     * Total bytes received.
     */
    bytesReceived: number;
    /**
     * Total bytes sent.
     */
    bytesSent: number;
    /**
     * Total packets lost.
     */
    packetsLost: number;
    /**
     * Total packets lost to total inbound packets ratio
     */
    packetsLostFraction: number;
    /**
     * Total packets received.
     */
    packetsReceived: number;
    /**
     * Total packets sent.
     */
    packetsSent: number;
}
