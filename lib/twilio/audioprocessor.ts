/**
 * An AudioProcessor can be added to the SDK, providing access to the audio input stream
 * and the ability to process or analyze the stream before sending it to Twilio.
 * To add the processor, you must implement the AudioProcessor interface and use
 * {@link AudioHelper.addProcessor}. You can use {@link AudioHelper.removeProcessor} to remove it.
 * Use cases include the following:</br>
 * </br>&nbsp;&nbsp;&bull; Background noise removal using a noise cancellation library of your choice
 * </br>&nbsp;&nbsp;&bull; Music playback when putting the call on hold
 * </br>&nbsp;&nbsp;&bull; Audio filters
 * </br>&nbsp;&nbsp;&bull; AI audio classification
 * </br>&nbsp;&nbsp;&bull; ... and more!
 *
 * The following example demonstrates how to utilize AudioProcessor APIs to use background music
 * for local audio instead of using a microphone.
 *
 * ```ts
 * import { AudioProcessor, Device } from '@twilio/voice-sdk';
 *
 * let audioContext;
 *
 * class BackgroundAudioProcessor implements AudioProcessor {
 *
 *  private audioContext: AudioContext;
 *  private background: MediaElementAudioSourceNode;
 *  private destination: MediaStreamAudioDestinationNode;
 *
 *  constructor() {
 *    if (!audioContext) {
 *      audioContext = new AudioContext();
 *    }
 *    this.audioContext = audioContext;
 *  }
 *
 *  async createProcessedStream(stream: MediaStream): Promise<MediaStream> {
 *    // Create the source node
 *    const audioEl = new Audio('/background.mp3');
 *    audioEl.addEventListener('canplaythrough', () => audioEl.play());
 *    this.background = this.audioContext.createMediaElementSource(audioEl);
 *
 *    // Create the destination node and connect the source node
 *    this.destination = this.audioContext.createMediaStreamDestination();
 *    this.background.connect(this.destination);
 *
 *    // Return the resulting MediaStream
 *    return this.destination.stream;
 *  }
 *
 *  async destroyProcessedStream(stream: MediaStream): Promise<void> {
 *    // Cleanup
 *    this.background.disconnect();
 *    this.destination.disconnect();
 *  }
 * }
 * // Construct a device object, passing your own token and desired options
 * const device = new Device(token, options);
 *
 * // Construct the AudioProcessor
 * const processor = new BackgroundAudioProcessor();
 *
 * // Add the processor
 * await device.audio.addProcessor(processor);
 * // Or remove it later
 * // await device.audio.removeProcessor(processor);
 * ```
 */
interface AudioProcessor {
  /**
   * Called by the SDK whenever the active input audio stream is updated.
   * Use this method to initiate your audio processing pipeline.
   *
   * @param stream The current input audio stream.
   * This is the MediaStream object from the input device such as a microphone.
   * You can process or analyze this stream and create a new stream that you
   * can send over to Twilio.
   * @returns The resulting audio stream after processing or analyzing the original input stream.
   */
  createProcessedStream(stream: MediaStream): Promise<MediaStream>;

  /**
   * Called by the SDK after the original input audio stream and the processed stream has been destroyed.
   * The stream is considered destroyed when all of its tracks are stopped and its
   * references in the SDK are removed.
   *
   * This method is called whenever the current input stream is updated.
   * Use this method to run any necessary teardown routines
   * needed by your audio processing pipeline.
   *
   * @param stream The destroyed processed audio stream.
   * @returns
   */
  destroyProcessedStream(stream: MediaStream): Promise<void>;
}

export default AudioProcessor;
