/**
 * {@link RTCIceCandidate} parses an ICE candidate gathered by the browser
 * and returns a IceCandidate object
 */
class IceCandidate {
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

export { IceCandidate };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWNlY2FuZGlkYXRlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3J0Yy9pY2VjYW5kaWRhdGUudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBMkJBOzs7QUFHRztNQUNVLFlBQVksQ0FBQTtBQWlFdkI7OztBQUdHO0lBQ0gsV0FBQSxDQUFZLFlBQTZCLEVBQUUsUUFBQSxHQUFvQixLQUFLLEVBQUE7QUE5RHBFOztBQUVHO1FBQ0ssSUFBQSxDQUFBLE9BQU8sR0FBWSxLQUFLO0FBNEQ5QixRQUFBLElBQUksSUFBSTtRQUNSLE1BQU0sS0FBSyxHQUFHLFlBQVksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQztBQUUzRCxRQUFBLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQ1osSUFBSSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQy9CO0FBRUEsUUFBQSxJQUFJLENBQUMsYUFBYSxHQUFHLFlBQVksQ0FBQyxJQUFJO1FBQ3RDLElBQUksQ0FBQyxFQUFFLEdBQUcsWUFBWSxDQUFDLEVBQUUsSUFBSSxZQUFZLENBQUMsT0FBTztBQUNqRCxRQUFBLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUTtBQUN4QixRQUFBLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSTtBQUN2QixRQUFBLElBQUksQ0FBQyxJQUFJLEdBQUcsWUFBWSxDQUFDLElBQUk7QUFDN0IsUUFBQSxJQUFJLENBQUMsUUFBUSxHQUFHLFlBQVksQ0FBQyxRQUFRO0FBQ3JDLFFBQUEsSUFBSSxDQUFDLFFBQVEsR0FBRyxZQUFZLENBQUMsUUFBUTtBQUNyQyxRQUFBLElBQUksQ0FBQyxjQUFjLEdBQUcsWUFBWSxDQUFDLGNBQWM7QUFDakQsUUFBQSxJQUFJLENBQUMsV0FBVyxHQUFHLFlBQVksQ0FBQyxXQUFXO0FBQzNDLFFBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxZQUFZLENBQUMsT0FBTztBQUNuQyxRQUFBLElBQUksQ0FBQyxXQUFXLEdBQUcsWUFBWSxDQUFDLE1BQU07SUFDeEM7QUFFQTs7QUFFRztJQUNILFNBQVMsR0FBQTtRQUNQLE9BQU87WUFDTCxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsYUFBYTtZQUNwQyxTQUFTLEVBQUUsSUFBSSxDQUFDLE9BQU87WUFDdkIsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFO1lBQ2IsV0FBVyxFQUFFLElBQUksQ0FBQyxRQUFRO1lBQzFCLGNBQWMsRUFBRSxJQUFJLENBQUMsV0FBVztZQUNoQyxNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUk7WUFDakIsVUFBVSxFQUFFLElBQUksQ0FBQyxRQUFRO1lBQ3pCLFVBQVUsRUFBRSxJQUFJLENBQUMsUUFBUTtZQUN6QixpQkFBaUIsRUFBRSxJQUFJLENBQUMsY0FBYztZQUN0QyxjQUFjLEVBQUUsSUFBSSxDQUFDLFdBQVc7WUFDaEMsVUFBVSxFQUFFLElBQUksQ0FBQyxPQUFPO1lBQ3hCLGNBQWMsRUFBRSxJQUFJLENBQUMsV0FBVztTQUNqQztJQUNIO0FBQ0Q7Ozs7In0=
