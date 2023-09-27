/**
 * @packageDocumentation
 * @module Voice
 */

/**
 * Represents an AudioProcessor object that receives an audio stream for processing.
 * @publicapi
 */
interface AudioProcessor {
  /**
   * Called whenever the active input audio stream is updated
   * and is ready for processing such as adding audio filters
   * or removing background noise.
   * Use this method to initiate your audio processing pipeline.
   *
   * @param stream The input audio stream.
   * @returns The modified input audio stream after applying filters.
   */
  createProcessedStream(stream: MediaStream): Promise<MediaStream>;

  /**
   * Called after the processed stream has been destroyed.
   * This happens whenever the current input stream is updated.
   * Use this method to run any necessary teardown routines
   * needed by your audio processing pipeline.
   *
   * @param stream The torn down processed audio stream.
   * @returns
   */
  destroyProcessedStream(stream: MediaStream): Promise<void>;
}

export default AudioProcessor;
