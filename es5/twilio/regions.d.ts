/**
 * Valid edges.
 */
export declare enum Edge {
    /**
     * Public edges
     */
    Sydney = "sydney",
    SaoPaulo = "sao-paulo",
    Dublin = "dublin",
    Frankfurt = "frankfurt",
    Tokyo = "tokyo",
    Singapore = "singapore",
    Ashburn = "ashburn",
    Umatilla = "umatilla",
    Roaming = "roaming",
    /**
     * Interconnect edges
     */
    AshburnIx = "ashburn-ix",
    SanJoseIx = "san-jose-ix",
    LondonIx = "london-ix",
    FrankfurtIx = "frankfurt-ix",
    SingaporeIx = "singapore-ix",
    SydneyIx = "sydney-ix",
    TokyoIx = "tokyo-ix"
}
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
export declare enum Region {
    Au1 = "au1",
    Au1Ix = "au1-ix",
    Br1 = "br1",
    De1 = "de1",
    De1Ix = "de1-ix",
    Gll = "gll",
    Ie1 = "ie1",
    Ie1Ix = "ie1-ix",
    Ie1Tnx = "ie1-tnx",
    Jp1 = "jp1",
    Jp1Ix = "jp1-ix",
    Sg1 = "sg1",
    Sg1Ix = "sg1-ix",
    Sg1Tnx = "sg1-tnx",
    Us1 = "us1",
    Us1Ix = "us1-ix",
    Us1Tnx = "us1-tnx",
    Us2 = "us2",
    Us2Ix = "us2-ix",
    Us2Tnx = "us2-tnx"
}
/**
 * Region shortcodes. Maps the full region name from AWS to the Twilio shortcode.
 * @private
 */
export declare const regionShortcodes: {
    [index: string]: Region;
};
/**
 * Region to edge mapping, as part of Phase 1 Regional (CLIENT-7519).
 * Temporary.
 * @private
 */
export declare const regionToEdge: Record<Region, Edge>;
/**
 * The default edge to connect to and create a chunder uri from, if the edge
 * parameter is not specified during setup in `Device`.
 * @constant
 */
export declare const defaultEdge: Edge;
/**
 * String template for a region insights URI
 * @param region - The region.
 */
export declare function createEventGatewayURI(region: string): string;
/**
 * Create a signaling endpoint URL to connect a websocket to from a chunder URI.
 * @param uri the chunder URI to create a signaling endpoint URL for
 */
export declare function createSignalingEndpointURL(uri: string): string;
/**
 * Get the URI associated with the passed edge.
 * @private
 * @param edge - A string or an array of edge values
 * @returns An array of chunder URIs
 */
export declare function getChunderURIs(edge?: string[] | string): string[];
/**
 * Get the region shortcode by its full AWS region string.
 *
 * @private
 * @param region - The region's full AWS string.
 */
export declare function getRegionShortcode(region: string): Region | null;
