/**
 * @packageDocumentation
 * @module Voice
 * This module describes valid and deprecated regions.
 */
import { InvalidArgumentError } from './errors';
/**
 * Valid edges.
 * @private
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVnaW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vcmVnaW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7OztHQUlHO0FBQ0gsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRWhEOzs7R0FHRztBQUNILE1BQU0sQ0FBTixJQUFZLElBdUJYO0FBdkJELFdBQVksSUFBSTtJQUNkOztPQUVHO0lBQ0gseUJBQWlCLENBQUE7SUFDakIsOEJBQXNCLENBQUE7SUFDdEIseUJBQWlCLENBQUE7SUFDakIsK0JBQXVCLENBQUE7SUFDdkIsdUJBQWUsQ0FBQTtJQUNmLCtCQUF1QixDQUFBO0lBQ3ZCLDJCQUFtQixDQUFBO0lBQ25CLDZCQUFxQixDQUFBO0lBQ3JCLDJCQUFtQixDQUFBO0lBQ25COztPQUVHO0lBQ0gsZ0NBQXdCLENBQUE7SUFDeEIsaUNBQXlCLENBQUE7SUFDekIsOEJBQXNCLENBQUE7SUFDdEIsb0NBQTRCLENBQUE7SUFDNUIsb0NBQTRCLENBQUE7SUFDNUIsOEJBQXNCLENBQUE7SUFDdEIsNEJBQW9CLENBQUE7QUFDdEIsQ0FBQyxFQXZCVyxJQUFJLEtBQUosSUFBSSxRQXVCZjtBQUVEOzs7Ozs7Ozs7Ozs7Ozs7R0FlRztBQUNILE1BQU0sQ0FBTixJQUFZLE1BcUJYO0FBckJELFdBQVksTUFBTTtJQUNoQixxQkFBVyxDQUFBO0lBQ1gsMEJBQWdCLENBQUE7SUFDaEIscUJBQVcsQ0FBQTtJQUNYLHFCQUFXLENBQUE7SUFDWCwwQkFBZ0IsQ0FBQTtJQUNoQixxQkFBVyxDQUFBO0lBQ1gscUJBQVcsQ0FBQTtJQUNYLDBCQUFnQixDQUFBO0lBQ2hCLDRCQUFrQixDQUFBO0lBQ2xCLHFCQUFXLENBQUE7SUFDWCwwQkFBZ0IsQ0FBQTtJQUNoQixxQkFBVyxDQUFBO0lBQ1gsMEJBQWdCLENBQUE7SUFDaEIsNEJBQWtCLENBQUE7SUFDbEIscUJBQVcsQ0FBQTtJQUNYLDBCQUFn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