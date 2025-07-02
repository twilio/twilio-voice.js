import { InvalidArgumentError } from './errors';
/**
 * Valid edges.
 */
export var Edge;
(function (Edge) {
    /**
     * Public edges
     */
    Edge["Sydney"] = "sydney";
    Edge["SaoPaulo"] = "sao-paulo";
    Edge["Dublin"] = "dublin";
    Edge["Frankfurt"] = "frankfurt";
    Edge["Tokyo"] = "tokyo";
    Edge["Singapore"] = "singapore";
    Edge["Ashburn"] = "ashburn";
    Edge["Umatilla"] = "umatilla";
    Edge["Roaming"] = "roaming";
    /**
     * Interconnect edges
     */
    Edge["AshburnIx"] = "ashburn-ix";
    Edge["SanJoseIx"] = "san-jose-ix";
    Edge["LondonIx"] = "london-ix";
    Edge["FrankfurtIx"] = "frankfurt-ix";
    Edge["SingaporeIx"] = "singapore-ix";
    Edge["SydneyIx"] = "sydney-ix";
    Edge["TokyoIx"] = "tokyo-ix";
})(Edge || (Edge = {}));
/**
 * Valid current regions.
 *
 * @deprecated
 *
 * CLIENT-6831
 * This is no longer used or updated for checking validity of regions in the
 * SDK. We now allow any string to be passed for region. Invalid regions won't
 * be able to connect, and won't throw an exception.
 *
 * CLIENT-7519
 * This is used again to temporarily convert edge values to regions as part of
 * Phase 1 Regional. This is still considered deprecated.
 *
 * @private
 */
export var Region;
(function (Region) {
    Region["Au1"] = "au1";
    Region["Au1Ix"] = "au1-ix";
    Region["Br1"] = "br1";
    Region["De1"] = "de1";
    Region["De1Ix"] = "de1-ix";
    Region["Gll"] = "gll";
    Region["Ie1"] = "ie1";
    Region["Ie1Ix"] = "ie1-ix";
    Region["Ie1Tnx"] = "ie1-tnx";
    Region["Jp1"] = "jp1";
    Region["Jp1Ix"] = "jp1-ix";
    Region["Sg1"] = "sg1";
    Region["Sg1Ix"] = "sg1-ix";
    Region["Sg1Tnx"] = "sg1-tnx";
    Region["Us1"] = "us1";
    Region["Us1Ix"] = "us1-ix";
    Region["Us1Tnx"] = "us1-tnx";
    Region["Us2"] = "us2";
    Region["Us2Ix"] = "us2-ix";
    Region["Us2Tnx"] = "us2-tnx";
})(Region || (Region = {}));
/**
 * Region shortcodes. Maps the full region name from AWS to the Twilio shortcode.
 * @private
 */
export const regionShortcodes = {
    ASIAPAC_SINGAPORE: Region.Sg1,
    ASIAPAC_SYDNEY: Region.Au1,
    ASIAPAC_TOKYO: Region.Jp1,
    EU_FRANKFURT: Region.De1,
    EU_IRELAND: Region.Ie1,
    SOUTH_AMERICA_SAO_PAULO: Region.Br1,
    US_EAST_VIRGINIA: Region.Us1,
    US_WEST_OREGON: Region.Us2,
};
/**
 * Region to edge mapping, as part of Phase 1 Regional (CLIENT-7519).
 * Temporary.
 * @private
 */
export const regionToEdge = {
    [Region.Au1]: Edge.Sydney,
    [Region.Br1]: Edge.SaoPaulo,
    [Region.Ie1]: Edge.Dublin,
    [Region.De1]: Edge.Frankfurt,
    [Region.Jp1]: Edge.Tokyo,
    [Region.Sg1]: Edge.Singapore,
    [Region.Us1]: Edge.Ashburn,
    [Region.Us2]: Edge.Umatilla,
    [Region.Gll]: Edge.Roaming,
    /**
     * Interconnect edges
     */
    [Region.Us1Ix]: Edge.AshburnIx,
    [Region.Us2Ix]: Edge.SanJoseIx,
    [Region.Ie1Ix]: Edge.LondonIx,
    [Region.De1Ix]: Edge.FrankfurtIx,
    [Region.Sg1Ix]: Edge.SingaporeIx,
    [Region.Au1Ix]: Edge.SydneyIx,
    [Region.Jp1Ix]: Edge.TokyoIx,
    /**
     * Tnx regions
     */
    [Region.Us1Tnx]: Edge.AshburnIx,
    [Region.Us2Tnx]: Edge.AshburnIx,
    [Region.Ie1Tnx]: Edge.LondonIx,
    [Region.Sg1Tnx]: Edge.SingaporeIx,
};
/**
 * The default edge to connect to and create a chunder uri from, if the edge
 * parameter is not specified during setup in `Device`.
 * @constant
 */
export const defaultEdge = Edge.Roaming;
/**
 * The default event gateway URI to publish to.
 * @constant
 * @private
 */
const defaultEventGatewayURI = 'eventgw.twilio.com';
/**
 * String template for an edge chunder URI
 * @param edge - The edge.
 */
function createChunderEdgeURI(edge) {
    return `voice-js.${edge}.twilio.com`;
}
/**
 * String template for a region insights URI
 * @param region - The region.
 */
export function createEventGatewayURI(region) {
    return region
        ? `eventgw.${region}.twilio.com`
        : defaultEventGatewayURI;
}
/**
 * Create a signaling endpoint URL to connect a websocket to from a chunder URI.
 * @param uri the chunder URI to create a signaling endpoint URL for
 */
export function createSignalingEndpointURL(uri) {
    return `wss://${uri}/signal`;
}
/**
 * Get the URI associated with the passed edge.
 * @private
 * @param edge - A string or an array of edge values
 * @returns An array of chunder URIs
 */
export function getChunderURIs(edge) {
    if (!!edge && typeof edge !== 'string' && !Array.isArray(edge)) {
        throw new InvalidArgumentError('If `edge` is provided, it must be of type `string` or an array of strings.');
    }
    let uris;
    if (edge) {
        const edgeParams = Array.isArray(edge) ? edge : [edge];
        uris = edgeParams.map((param) => createChunderEdgeURI(param));
    }
    else {
        uris = [createChunderEdgeURI(defaultEdge)];
    }
    return uris;
}
/**
 * Get the region shortcode by its full AWS region string.
 *
 * @private
 * @param region - The region's full AWS string.
 */
export function getRegionShortcode(region) {
    return regionShortcodes[region] || null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVnaW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vcmVnaW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFFaEQ7O0dBRUc7QUFDSCxNQUFNLENBQU4sSUFBWSxJQXVCWDtBQXZCRCxXQUFZLElBQUk7SUFDZDs7T0FFRztJQUNILHlCQUFpQixDQUFBO0lBQ2pCLDhCQUFzQixDQUFBO0lBQ3RCLHlCQUFpQixDQUFBO0lBQ2pCLCtCQUF1QixDQUFBO0lBQ3ZCLHVCQUFlLENBQUE7SUFDZiwrQkFBdUIsQ0FBQTtJQUN2QiwyQkFBbUIsQ0FBQTtJQUNuQiw2QkFBcUIsQ0FBQTtJQUNyQiwyQkFBbUIsQ0FBQTtJQUNuQjs7T0FFRztJQUNILGdDQUF3QixDQUFBO0lBQ3hCLGlDQUF5QixDQUFBO0lBQ3pCLDhCQUFzQixDQUFBO0lBQ3RCLG9DQUE0QixDQUFBO0lBQzVCLG9DQUE0QixDQUFBO0lBQzVCLDhCQUFzQixDQUFBO0lBQ3RCLDRCQUFvQixDQUFBO0FBQ3RCLENBQUMsRUF2QlcsSUFBSSxLQUFKLElBQUksUUF1QmY7QUFFRDs7Ozs7Ozs7Ozs7Ozs7O0dBZUc7QUFDSCxNQUFNLENBQU4sSUFBWSxNQXFCWDtBQXJCRCxXQUFZLE1BQU07SUFDaEIscUJBQVcsQ0FBQTtJQUNYLDBCQUFnQixDQUFBO0lBQ2hCLHFCQUFXLENBQUE7SUFDWCxxQkFBVyxDQUFBO0lBQ1gsMEJBQWdCLENBQUE7SUFDaEIscUJBQVcsQ0FBQTtJQUNYLHFCQUFXLENBQUE7SUFDWCwwQkFBZ0IsQ0FBQTtJQUNoQiw0QkFBa0IsQ0FBQTtJQUNsQixxQkFBVyxDQUFBO0lBQ1gsMEJBQWdCLENBQUE7SUFDaEIscUJBQVcsQ0FBQTtJQUNYLDBCQUFnQixDQUFBO0lBQ2hCLDRCQUFrQixDQUFBO0lBQ2xCLHFCQUFXLENBQUE7SUFDWCwwQkFBZ0IsQ0FBQTtJQUNoQiw0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