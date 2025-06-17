/**
 * {@link RTCIceCandidate} parses an ICE candidate gathered by the browser
 * and returns a IceCandidate object
 */
export class IceCandidate {
    /**
     * @constructor
     * @param iceCandidate RTCIceCandidate coming from the browser
     */
    constructor(iceCandidate, isRemote = false) {
        /**
         * Whether this is deleted from the list of candidate gathered
         */
        this.deleted = false;
        let cost;
        const parts = iceCandidate.candidate.split('network-cost ');
        if (parts[1]) {
            cost = parseInt(parts[1], 10);
        }
        this.candidateType = iceCandidate.type;
        this.ip = iceCandidate.ip || iceCandidate.address;
        this.isRemote = isRemote;
        this.networkCost = cost;
        this.port = iceCandidate.port;
        this.priority = iceCandidate.priority;
        this.protocol = iceCandidate.protocol;
        this.relatedAddress = iceCandidate.relatedAddress;
        this.relatedPort = iceCandidate.relatedPort;
        this.tcpType = iceCandidate.tcpType;
        this.transportId = iceCandidate.sdpMid;
    }
    /**
     * Get the payload object for insights
     */
    toPayload() {
        return {
            'candidate_type': this.candidateType,
            'deleted': this.deleted,
            'ip': this.ip,
            'is_remote': this.isRemote,
            'network-cost': this.networkCost,
            'port': this.port,
            'priority': this.priority,
            'protocol': this.protocol,
            'related_address': this.relatedAddress,
            'related_port': this.relatedPort,
            'tcp_type': this.tcpType,
            'transport_id': this.transportId,
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWNlY2FuZGlkYXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9ydGMvaWNlY2FuZGlkYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQTJCQTs7O0dBR0c7QUFDSCxNQUFNLE9BQU8sWUFBWTtJQWlFdkI7OztPQUdHO0lBQ0gsWUFBWSxZQUE2QixFQUFFLFdBQW9CLEtBQUs7UUE5RHBFOztXQUVHO1FBQ0ssWUFBTyxHQUFZLEtBQUssQ0FBQztRQTREL0IsSUFBSSxJQUFJLENBQUM7UUFDVCxNQUFNLEtBQUssR0FBRyxZQUFZLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUU1RCxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQ2IsSUFBSSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDaEMsQ0FBQztRQUVELElBQUksQ0FBQyxhQUFhLEdBQUcsWUFBWSxDQUFDLElBQUksQ0FBQztRQUN2QyxJQUFJLENBQUMsRUFBRSxHQUFHLFlBQVksQ0FBQyxFQUFFLElBQUksWUFBWSxDQUFDLE9BQU8sQ0FBQztRQUNsRCxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUN6QixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztRQUN4QixJQUFJLENBQUMsSUFBSSxHQUFHLFlBQVksQ0FBQyxJQUFJLENBQUM7UUFDOUIsSUFBSSxDQUFDLFFBQVEsR0FBRyxZQUFZLENBQUMsUUFBUSxDQUFDO1FBQ3RDLElBQUksQ0FBQyxRQUFRLEdBQUcsWUFBWSxDQUFDLFFBQVEsQ0FBQztRQUN0QyxJQUFJLENBQUMsY0FBYyxHQUFHLFlBQVksQ0FBQyxjQUFjLENBQUM7UUFDbEQsSUFBSSxDQUFDLFdBQVcsR0FBRyxZQUFZLENBQUMsV0FBVyxDQUFDO1FBQzVDLElBQUksQ0FBQyxPQUFPLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQztRQUNwQyxJQUFJLENBQUMsV0FBVyxHQUFHLFlBQVksQ0FBQyxNQUFNLENBQUM7SUFDekMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsU0FBUztRQUNQLE9BQU87WUFDTCxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsYUFBYTtZQUNwQyxTQUFTLEVBQUUsSUFBSSxDQUFDLE9BQU87WUFDdkIsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFO1lBQ2IsV0FBVyxFQUFFLElBQUksQ0FBQyxRQUFRO1lBQzFCLGNBQWMsRUFBRSxJQUFJLENBQUMsV0FBVztZQUNoQyxNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUk7WUFDakIsVUFBVSxFQUFFLElBQUksQ0FBQyxRQUFRO1lBQ3pCLFVBQVUsRUFBRSxJQUFJLENBQUMsUUFBUTtZQUN6QixpQkFBaUIsRUFBRSxJQUFJLENBQUMsY0FBYztZQUN0QyxjQUFjLEVBQUUsSUFBSSxDQUFDLFdBQVc7WUFDaEMsVUFBVSxFQUFFLElBQUksQ0FBQyxPQUFPO1lBQ3hCLGNBQWMsRUFBRSxJQUFJLENBQUMsV0FBVztTQUNqQyxDQUFDO0lBQ0osQ0FBQztDQUNGIn0=