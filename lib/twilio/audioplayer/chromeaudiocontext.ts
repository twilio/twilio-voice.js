/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
/* tslint:disable:interface-name */
export default interface ChromeAudioContext extends AudioContext {
  createMediaStreamDestination: () => any;
  destination: MediaStreamAudioDestinationNode;
}

export interface ChromeHTMLAudioElement extends HTMLAudioElement {
  setSinkId: (sinkId: string) => Promise<void>;
}

export interface MediaStreamAudioDestinationNode extends AudioDestinationNode {
  stream: MediaStream;
}
