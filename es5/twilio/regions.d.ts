/**
 * Valid deprecated regions.
 * @private
 */
export declare enum DeprecatedRegion {
    Au = "au",
    Br = "br",
    Ie = "ie",
    Jp = "jp",
    Sg = "sg",
    UsOr = "us-or",
    UsVa = "us-va"
}
/**
 * Valid edges.
 * @private
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
 * All valid regions
 * @private
 */
export declare type ValidRegion = Region | DeprecatedRegion;
/**
 * Deprecated regions. Maps the deprecated region to its equivalent up-to-date region.
 * @private
 */
export declare const deprecatedRegions: Record<DeprecatedRegion, Region>;
/**
 * Region shortcodes. Maps the full region name from AWS to the Twilio shortcode.
 * @private
 */
export declare const regionShortcodes: {
    [index: string]: Region;
};
/**
 * Edge to region mapping, as part of Phase 1 Regional (CLIENT-7519).
 * Temporary.
 * @private
 */
export declare const edgeToRegion: Record<Edge, Region>;
/**
 * Region to edge mapping, as part of Phase 1 Regional (CLIENT-7519).
 * Temporary.
 * @private
 */
export declare const regionToEdge: Record<Region, Edge>;
/**
 * The default region to connect to and create a chunder uri from if region is
 * not defined.
 * @constant
 * @private
 */
export declare const defaultRegion: string;
/**
 * The default edge to connect to and create a chunder uri from, if the edge
 * parameter is not specified during setup in `Device`.
 * @constant
 */
export declare const defaultEdge: Edge;
/**
 * The default chunder URI to connect to, should map to region `gll`.
 * @constant
 * @private
 */
export declare const defaultChunderRegionURI: string;
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
 * Get the URI associated with the passed region or edge. If both are passed,
 * then we want to fail `Device` setup, so we throw an error.
 * As of CLIENT-7519, Regions are deprecated in favor of edges as part of
 * Phase 1 Regional.
 *
 * @private
 * @param edge - A string or an array of edge values
 * @param region - The region shortcode.
 * @param [onDeprecated] - A callback containing the deprecation message to be
 *   warned when the passed parameters are deprecated.
 * @returns An array of chunder URIs
 */
export declare function getChunderURIs(edge: string[] | string | undefined, region: string | undefined, onDeprecated?: (message: string) => void): string[];
/**
 * Get the region shortcode by its full AWS region string.
 *
 * @private
 * @param region - The region's full AWS string.
 */
export declare function getRegionShortcode(region: string): Region | null;
