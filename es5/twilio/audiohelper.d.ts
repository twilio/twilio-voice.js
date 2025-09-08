import { EventEmitter } from 'events';
import AudioProcessor from './audioprocessor';
import { AudioProcessorEventObserver } from './audioprocessoreventobserver';
import Device from './device';
import OutputDeviceCollection from './outputdevicecollection';
/**
 * Provides input and output audio-based functionality in one convenient class.
 */
declare class AudioHelper extends EventEmitter {
    /**
     * The currently set audio constraints set by setAudioConstraints(). Starts as null.
     */
    get audioConstraints(): MediaTrackConstraints | null;
    /**
     * A Map of all audio input devices currently available to the browser by their device ID.
     */
    availableInputDevices: Map<string, MediaDeviceInfo>;
    /**
     * A Map of all audio output devices currently available to the browser by their device ID.
     */
    availableOutputDevices: Map<string, MediaDeviceInfo>;
    /**
     * The active input device. Having no inputDevice specified by `setInputDevice()`
     * will disable input selection related functionality.
     */
    get inputDevice(): MediaDeviceInfo | null;
    /**
     * The current input stream coming from the microphone device or
     * the processed audio stream if there is an {@link AudioProcessor}.
     */
    get inputStream(): MediaStream | null;
    /**
     * False if the browser does not support `HTMLAudioElement.setSinkId()` or
     * `MediaDevices.enumerateDevices()` and Twilio cannot facilitate output selection functionality.
     */
    isOutputSelectionSupported: boolean;
    /**
     * False if the browser does not support AudioContext and Twilio can not analyse the volume
     * in real-time.
     */
    isVolumeSupported: boolean;
    /**
     * The processed stream if an {@link AudioProcessor} was previously added.
     */
    get processedStream(): MediaStream | null;
    /**
     * The current set of output devices that incoming ringtone audio is routed through.
     * These are the sounds that may play while the user is away from the machine or not wearing
     * their headset. It is important that this audio is heard. If all specified
     * devices lost, this Set will revert to contain only the "default" device.
     */
    ringtoneDevices: OutputDeviceCollection;
    /**
     * The current set of output devices that call audio (`[voice, outgoing, disconnect, dtmf]`)
     * is routed through. These are the sounds that are initiated by the user, or played while
     * the user is otherwise present at the endpoint. If all specified devices are lost,
     * this Set will revert to contain only the "default" device.
     */
    speakerDevices: OutputDeviceCollection;
    /**
     * The currently set audio constraints set by setAudioConstraints().
     */
    private _audioConstraints;
    /**
     * An AudioContext to use.
     */
    private _audioContext?;
    /**
     * The AudioProcessorEventObserver instance to use
     */
    private _audioProcessorEventObserver;
    /**
     * Promise to wait for before setting the input device.
     */
    private _beforeSetInputDevice;
    /**
     * The audio stream of the default device.
     * This is populated when _openDefaultDeviceWithConstraints is called,
     * See _selectedInputDeviceStream for differences.
     * TODO: Combine these two workflows (3.x?)
     */
    private _defaultInputDeviceStream;
    /**
     * Whether each sound is enabled.
     */
    private _enabledSounds;
    /**
     * The enumerateDevices method to use
     */
    private _enumerateDevices;
    /**
     * The `getUserMedia()` function to use.
     */
    private _getUserMedia;
    /**
     * The current input device.
     */
    private _inputDevice;
    /**
     * The internal promise created when calling setInputDevice
     */
    private _inputDevicePromise;
    /**
     * An AnalyserNode to use for input volume.
     */
    private _inputVolumeAnalyser?;
    /**
     * An MediaStreamSource to use for input volume.
     */
    private _inputVolumeSource?;
    /**
     * Whether the {@link AudioHelper} is currently polling the input stream's volume.
     */
    private _isPollingInputVolume;
    /**
     * An instance of Logger to use.
     */
    private _log;
    /**
     * The MediaDevices instance to use.
     */
    private _mediaDevices;
    /**
     * The microphone permission status
     */
    private _microphonePermissionStatus;
    /**
     * Called with the new input stream when the active input is changed.
     */
    private _onActiveInputChanged;
    /**
     * Handler for microphone permission status change
     */
    private _onMicrophonePermissionStatusChanged;
    /**
     * Internal reference to the processed stream
     */
    private _processedStream;
    /**
     * Internal reference to the added AudioProcessor
     */
    private _processor;
    /**
     * The selected input stream coming from the microphone device.
     * This is populated when the setInputDevice is called, meaning,
     * the end user manually selected it, which is different than
     * the defaultInputDeviceStream.
     * TODO: Combine these two workflows (3.x?)
     */
    private _selectedInputDeviceStream;
    /**
     * A record of unknown devices (Devices without labels)
     */
    private _unknownDeviceIndexes;
    /**
     * @internal
     * @param onActiveOutputsChanged - A callback to be called when the user changes the active output devices.
     * @param onActiveInputChanged - A callback to be called when the user changes the active input device.
     * @param [options]
     */
    constructor(onActiveOutputsChanged: (type: 'ringtone' | 'speaker', outputIds: string[]) => Promise<void>, onActiveInputChanged: (stream: MediaStream | null) => Promise<void>, options?: AudioHelper.Options);
    /**
     * Destroy this AudioHelper instance
     * @internal
     */
    _destroy(): void;
    /**
     * Promise to wait for the input device, if setInputDevice is called outside of the SDK
     * @internal
     */
    _getInputDevicePromise(): Promise<void> | null;
    /**
     * Start polling volume if it's supported and there's an input stream to poll.
     * @internal
     */
    _maybeStartPollingVolume(): void;
    /**
     * Stop polling volume if it's currently polling and there are no listeners.
     * @internal
     */
    _maybeStopPollingVolume(): void;
    /**
     * Call getUserMedia with specified constraints
     * @internal
     */
    _openDefaultDeviceWithConstraints(constraints: MediaStreamConstraints): Promise<MediaStream>;
    /**
     * Stop the default audio stream
     * @internal
     */
    _stopDefaultInputDeviceStream(): void;
    /**
     * Unbind the listeners from mediaDevices.
     * @internal
     */
    _unbind(): void;
    /**
     * Update the available input and output devices
     * @internal
     */
    _updateAvailableDevices: () => Promise<void>;
    /**
     * Update AudioHelper options that can be changed by the user
     * @internal
     */
    _updateUserOptions(options: AudioHelper.Options): void;
    /**
     * Adds an {@link AudioProcessor} object. Once added, the AudioHelper will route
     * the input audio stream through the processor before sending the audio
     * stream to Twilio. Only one AudioProcessor can be added at this time.
     *
     * See the {@link AudioProcessor} interface for an example.
     *
     * @param processor The AudioProcessor to add.
     * @returns
     */
    addProcessor(processor: AudioProcessor): Promise<void>;
    /**
     * Enable or disable the disconnect sound.
     * @param doEnable Passing `true` will enable the sound and `false` will disable the sound.
     * Not passing this parameter will not alter the enable-status of the sound.
     * @returns The enable-status of the sound.
     */
    disconnect(doEnable?: boolean): boolean;
    /**
     * Enable or disable the incoming sound.
     * @param doEnable Passing `true` will enable the sound and `false` will disable the sound.
     * Not passing this parameter will not alter the enable-status of the sound.
     * @returns The enable-status of the sound.
     */
    incoming(doEnable?: boolean): boolean;
    /**
     * Enable or disable the outgoing sound.
     * @param doEnable Passing `true` will enable the sound and `false` will disable the sound.
     * Not passing this parameter will not alter the enable-status of the sound.
     * @returns The enable-status of the sound.
     */
    outgoing(doEnable?: boolean): boolean;
    /**
     * Removes an {@link AudioProcessor}. Once removed, the AudioHelper will start using
     * the audio stream from the selected input device for existing or future calls.
     *
     * @param processor The AudioProcessor to remove.
     * @returns
     */
    removeProcessor(processor: AudioProcessor): Promise<void>;
    /**
     * Set the MediaTrackConstraints to be applied on every getUserMedia call for new input
     * device audio. Any deviceId specified here will be ignored. Instead, device IDs should
     * be specified using {@link AudioHelper#setInputDevice}. The returned Promise resolves
     * when the media is successfully reacquired, or immediately if no input device is set.
     * @param audioConstraints - The MediaTrackConstraints to apply.
     */
    setAudioConstraints(audioConstraints: MediaTrackConstraints): Promise<void>;
    /**
     * Replace the current input device with a new device by ID.
     *
     * Calling `setInputDevice` sets the stream for current and future calls and
     * will not release it automatically.
     *
     * While this behavior is not an issue, it will result in the application
     * holding onto the input device, and the application may show a red
     * "recording" symbol in the browser tab.
     *
     * To remove the red "recording" symbol, the device must be released. To
     * release it, call `unsetInputDevice` after the call disconnects. Note that
     * after calling `unsetInputDevice` future calls will then use the default
     * input device.
     *
     * Consider application logic that keeps track of the user-selected device
     * and call `setInputDevice` before calling `device.connect()` for outgoing
     * calls and `call.accept()` for incoming calls. Furthermore, consider
     * calling `unsetInputDevice` once a call is disconnected. Below is an
     * example:
     *
     * ```ts
     * import { Device } from '@twilio/voice-sdk';
     * let inputDeviceId = ...;
     * const device = new Device(...);
     *
     * async function makeOutgoingCall() {
     *   await device.audio.setInputDevice(inputDeviceId);
     *   const call = await device.connect(...);
     *
     *   call.on('disconnect', async () => {
     *     inputDeviceId = ... // save the current input device id
     *     await device.audio.unsetInputDevice();
     *   });
     * }
     *
     * async function acceptIncomingCall(incomingCall) {
     *   await device.audio.setInputDevice(inputDeviceId);
     *   await incomingCall.accept();
     *
     *   incomingCall.on('disconnect', async () => {
     *     inputDeviceId = ... // save the current input device id
     *     await device.audio.unsetInputDevice();
     *   });
     * }
     * ```
     *
     * @param deviceId - An ID of a device to replace the existing
     *   input device with.
     */
    setInputDevice(deviceId: string): Promise<void>;
    /**
     * Unset the MediaTrackConstraints to be applied on every getUserMedia call for new input
     * device audio. The returned Promise resolves when the media is successfully reacquired,
     * or immediately if no input device is set.
     */
    unsetAudioConstraints(): Promise<void>;
    /**
     * Unset the input device, stopping the tracks. This should only be called when not in a connection, and
     *   will not allow removal of the input device during a live call.
     */
    unsetInputDevice(): Promise<void>;
    /**
     * Destroys processed stream and update references
     */
    private _destroyProcessedStream;
    /**
     * Get the index of an un-labeled Device.
     * @param mediaDeviceInfo
     * @returns The index of the passed MediaDeviceInfo
     */
    private _getUnknownDeviceIndex;
    /**
     * Initialize output device enumeration.
     */
    private _initializeEnumeration;
    /**
     * Route input stream to the processor if it exists
     */
    private _maybeCreateProcessedStream;
    /**
     * Set whether the sound is enabled or not
     * @param soundName
     * @param doEnable
     * @returns Whether the sound is enabled or not
     */
    private _maybeEnableSound;
    /**
     * Remove an input device from inputs
     * @param lostDevice
     * @returns Whether the device was active
     */
    private _removeLostInput;
    /**
     * Remove an input device from outputs
     * @param lostDevice
     * @returns Whether the device was active
     */
    private _removeLostOutput;
    /**
     * Stop the tracks on the current input stream before replacing it with the passed stream.
     * @param stream - The new stream
     */
    private _replaceStream;
    /**
     * Restart the active streams
     */
    private _restartStreams;
    /**
     * Replace the current input device with a new device by ID.
     * @param deviceId - An ID of a device to replace the existing
     *   input device with.
     * @param forceGetUserMedia - If true, getUserMedia will be called even if
     *   the specified device is already active.
     */
    private _setInputDevice;
    /**
     * Remove event listener for microphone permissions
     */
    private _stopMicrophonePermissionListener;
    /**
     * Stop the selected audio stream
     */
    private _stopSelectedInputDeviceStream;
    /**
     * Update a set of devices.
     * @param updatedDevices - An updated list of available Devices
     * @param availableDevices - The previous list of available Devices
     * @param removeLostDevice - The method to call if a previously available Device is
     *   no longer available.
     */
    private _updateDevices;
    /**
     * Disconnect the old input volume source, and create and connect a new one with the current
     * input stream.
     */
    private _updateVolumeSource;
    /**
     * Convert a MediaDeviceInfo to a IMediaDeviceInfoShim.
     * @param mediaDeviceInfo - The info to convert
     * @returns The converted shim
     */
    private _wrapMediaDeviceInfo;
}
/**
 * @mergeModuleWith AudioHelper
 */
declare namespace AudioHelper {
    /**
     * Emitted when the available set of Devices changes.
     * @event
     * @param lostActiveDevices - An array containing any Devices that were previously active
     * that were lost as a result of this deviceChange event.
     * @example
     * ```ts
     * device.audio.on('deviceChange', lostActiveDevices => { });
     * ```
     */
    function deviceChangeEvent(lostActiveDevices: MediaDeviceInfo[]): void;
    /**
     * Emitted on `requestAnimationFrame` (up to 60fps, depending on browser) with
     *   the current input and output volumes, as a percentage of maximum
     *   volume, between -100dB and -30dB. Represented by a floating point
     *   number.
     * @event
     * @param inputVolume - A floating point number between 0.0 and 1.0 inclusive.
     * @example
     * ```ts
     * device.audio.on('inputVolume', volume => { });
     * ```
     */
    function inputVolumeEvent(inputVolume: number): void;
    /**
     * An object like MediaDevices.
     * @internal
     */
    interface MediaDevicesLike {
        addEventListener?: (eventName: string, handler: (...args: any[]) => void) => void;
        enumerateDevices: (...args: any[]) => any;
        getUserMedia: (...args: any[]) => any;
        removeEventListener?: (eventName: string, handler: (...args: any[]) => void) => void;
    }
    /**
     * Options that can be passed to the AudioHelper constructor
     * @internal
     */
    interface Options {
        /**
         * A custom replacement for the AudioContext constructor.
         */
        AudioContext?: typeof AudioContext;
        /**
         * An existing AudioContext instance to use.
         */
        audioContext?: AudioContext;
        /**
         * AudioProcessorEventObserver to use
         */
        audioProcessorEventObserver: AudioProcessorEventObserver;
        /**
         * Promise to wait for before setting the input device.
         */
        beforeSetInputDevice?: () => Promise<any>;
        /**
         * Whether each sound is enabled.
         */
        enabledSounds?: Record<Device.ToggleableSound, boolean>;
        /**
         * Overrides the native MediaDevices.enumerateDevices API.
         */
        enumerateDevices?: any;
        /**
         * The getUserMedia method to use
         */
        getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
        /**
         * A custom MediaDevices instance to use.
         */
        mediaDevices?: AudioHelper.MediaDevicesLike;
        /**
         * A custom setSinkId function to use.
         */
        setSinkId?: (sinkId: string) => Promise<void>;
    }
}
export default AudioHelper;
