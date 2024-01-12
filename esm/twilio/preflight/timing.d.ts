/**
 * @packageDocumentation
 * @module Voice
 * @publicapi
 */
/**
 * Timing measurements that provides operational milestones.
 */
export interface TimeMeasurement {
    /**
     * Number milliseconds elapsed for this measurement
     */
    duration?: number;
    /**
     * A millisecond timestamp the represents the end of a process
     */
    end?: number;
    /**
     * A millisecond timestamp the represents the start of a process
     */
    start: number;
}
/**
 * Represents network related time measurements.
 */
export interface NetworkTiming {
    /**
     * Measurements for establishing DTLS connection.
     * This is measured from RTCDtlsTransport `connecting` to `connected` state.
     * See [RTCDtlsTransport state](https://developer.mozilla.org/en-US/docs/Web/API/RTCDtlsTransport/state).
     */
    dtls?: TimeMeasurement;
    /**
     * Measurements for establishing ICE connection.
     * This is measured from ICE connection `checking` to `connected` state.
     * See [RTCPeerConnection.iceConnectionState](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/iceConnectionState).
     */
    ice?: TimeMeasurement;
    /**
     * Measurements for establishing a PeerConnection.
     * This is measured from PeerConnection `connecting` to `connected` state.
     * See [RTCPeerConnection.connectionState](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/connectionState).
     */
    peerConnection?: TimeMeasurement;
    /**
     * Measurements for establishing Signaling connection.
     * This is measured from initiating a connection using `device.connect()`,
     * up to when [RTCPeerConnection.signalingState](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/signalingState)
     * transitions to `stable` state.
     */
    signaling?: TimeMeasurement;
}
