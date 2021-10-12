/// <reference types="node" />
/**
 * @packageDocumentation
 * @module Voice
 */
import { EventEmitter } from 'events';
import Device from './device';
import OutputDeviceCollection from './outputdevicecollection';
/**
 * Provides input and output audio-based functionality in one convenient class.
 * @publicapi
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
     * The current input stream.
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
     * The `getUserMedia()` function to use.
     */
    private _getUserMedia;
    /**
     * The current input device.
     */
    private _inputDevice;
    /**
     * The current input stream.
     */
    private _inputStream;
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
     * Called with the new input stream when the active input is changed.
     */
    private _onActiveInputChanged;
    /**
     * A record of unknown devices (Devices without labels)
     */
    private _unknownDeviceIndexes;
    /**
     * @constructor
     * @private
     * @param onActiveOutputsChanged - A callback to be called when the user changes the active output devices.
     * @param onActiveInputChanged - A callback to be called when the user changes the active input device.
     * @param getUserMedia - The getUserMedia method to use.
     * @param [options]
     */
    constructor(onActiveOutputsChanged: (type: 'ringtone' | 'speaker', outputIds: string[]) => Promise<void>, onActiveInputChanged: (stream: MediaStream | null) => Promise<void>, getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>, options?: AudioHelper.Options);
    /**
     * Start polling volume if it's supported and there's an input stream to poll.
     * @private
     */
    _maybeStartPollingVolume(): void;
    /**
     * Stop polling volume if it's currently polling and there are no listeners.
     * @private
     */
    _maybeStopPollingVolume(): void;
    /**
     * Unbind the listeners from mediaDevices.
     * @private
     */
    _unbind(): void;
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
     * Merge the passed enabledSounds into {@link AudioHelper}. Currently used to merge the deprecated
     *   Device.sounds object onto the new {@link AudioHelper} interface. Mutates
     *   by reference, sharing state between {@link Device} and {@link AudioHelper}.
     * @param enabledSounds - The initial sound settings to merge.
     * @private
     */
    private _addEnabledSounds;
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
     * Replace the current input device with a new device by ID.
     * @param deviceId - An ID of a device to replace the existing
     *   input device with.
     * @param forceGetUserMedia - If true, getUserMedia will be called even if
     *   the specified device is already active.
     */
    private _setInputDevice;
    /**
     * Update the available input and output devices
     */
    private _updateAvailableDevices;
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
declare namespace AudioHelper {
    /**
     * An object like MediaDevices.
     * @private
     */
    interface MediaDevicesLike {
        addEventListener?: (eventName: string, handler: (...args: any[]) => void) => void;
        enumerateDevices: (...args: any[]) => any;
        getUserMedia: (...args: any[]) => any;
        removeEventListener?: (eventName: string, handler: (...args: any[]) => void) => void;
    }
    /**
     * Options that can be passed to the AudioHelper constructor
     * @private
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
         * A Record of sounds. This is modified by reference, and is used to
         * maintain backward-compatibility. This should be removed or refactored in 2.0.
         * TODO: Remove / refactor in 2.0. (CLIENT-5302)
         */
        enabledSounds?: Record<Device.ToggleableSound, boolean>;
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
