import { InvalidArgumentError } from './errors';

/**
 * Valid edges.
 */
export enum Edge {
  /**
   * Public edges
   */
  Sydney = 'sydney',
  SaoPaulo = 'sao-paulo',
  Dublin = 'dublin',
  Frankfurt = 'frankfurt',
  Tokyo = 'tokyo',
  Singapore = 'singapore',
  Ashburn = 'ashburn',
  Umatilla = 'umatilla',
  Roaming = 'roaming',
  /**
   * Interconnect edges
   */
  AshburnIx = 'ashburn-ix',
  SanJoseIx = 'san-jose-ix',
  LondonIx = 'london-ix',
  FrankfurtIx = 'frankfurt-ix',
  SingaporeIx = 'singapore-ix',
  SydneyIx = 'sydney-ix',
  TokyoIx = 'tokyo-ix',
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
export enum Region {
  Au1 = 'au1',
  Au1Ix = 'au1-ix',
  Br1 = 'br1',
  De1 = 'de1',
  De1Ix = 'de1-ix',
  Gll = 'gll',
  Ie1 = 'ie1',
  Ie1Ix = 'ie1-ix',
  Ie1Tnx = 'ie1-tnx',
  Jp1 = 'jp1',
  Jp1Ix = 'jp1-ix',
  Sg1 = 'sg1',
  Sg1Ix = 'sg1-ix',
  Sg1Tnx = 'sg1-tnx',
  Us1 = 'us1',
  Us1Ix = 'us1-ix',
  Us1Tnx = 'us1-tnx',
  Us2 = 'us2',
  Us2Ix = 'us2-ix',
  Us2Tnx = 'us2-tnx',
}

/**
 * Region shortcodes. Maps the full region name from AWS to the Twilio shortcode.
 * @private
 */
export const regionShortcodes: { [index: string]: Region } = {
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
export const regionToEdge: Record<Region, Edge> = {
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
export const defaultEdge: Edge = Edge.Roaming;

/**
 * The default event gateway URI to publish to.
 * @constant
 * @private
 */
const defaultEventGatewayURI: string = 'eventgw.twilio.com';

/**
 * String template for an edge chunder URI
 * @param edge - The edge.
 */
function createChunderEdgeURI(edge: string): string {
  return `voice-js.${edge}.twilio.com`;
}

/**
 * String template for a region insights URI
 * @param region - The region.
 */
export function createEventGatewayURI(region: string): string {
  return region
    ? `eventgw.${region}.twilio.com`
    : defaultEventGatewayURI;
}

/**
 * Create a signaling endpoint URL to connect a websocket to from a chunder URI.
 * @param uri the chunder URI to create a signaling endpoint URL for
 */
export function createSignalingEndpointURL(uri: string): string {
  return `wss://${uri}/signal`;
}

/**
 * Get the URI associated with the passed edge.
 * @private
 * @param edge - A string or an array of edge values
 * @returns An array of chunder URIs
 */
export function getChunderURIs(edge?: string[] | string): string[] {
  if (!!edge && typeof edge !== 'string' && !Array.isArray(edge)) {
    throw new InvalidArgumentError(
      'If `edge` is provided, it must be of type `string` or an array of strings.',
    );
  }

  let uris: string[];

  if (edge) {
    const edgeParams = Array.isArray(edge) ? edge : [edge];
    uris = edgeParams.map((param: Edge) => createChunderEdgeURI(param));
  } else {
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
export function getRegionShortcode(region: string): Region | null {
  return regionShortcodes[region] || null;
}
