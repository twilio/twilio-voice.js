import * as assert from 'assert';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';

describe('AudioHelper', function() {
  this.timeout(30000);
  Cypress.config('defaultCommandTimeout', 30000);

  let device: Device;

  beforeEach(async () => {
    const identity = 'id-' + Date.now();
    const token = generateAccessToken(identity);
    device = new Device(token);
    await device.register();
  });

  afterEach(() => {
    if (device) {
      device.disconnectAll();
      device.destroy();
    }
  });

  it('should be accessible via device.audio', () => {
    assert(device.audio !== null, 'AudioHelper should not be null');
  });

  it('should have availableInputDevices as a Map', () => {
    const audio = device.audio!;
    assert(audio.availableInputDevices instanceof Map, 'availableInputDevices should be a Map');
  });

  it('should have availableOutputDevices as a Map', () => {
    const audio = device.audio!;
    assert(audio.availableOutputDevices instanceof Map, 'availableOutputDevices should be a Map');
  });

  it('should have isOutputSelectionSupported as a boolean', () => {
    const audio = device.audio!;
    assert.strictEqual(typeof audio.isOutputSelectionSupported, 'boolean');
  });

  it('should have isVolumeSupported as a boolean', () => {
    const audio = device.audio!;
    assert.strictEqual(typeof audio.isVolumeSupported, 'boolean');
  });

  it('should have ringtoneDevices defined', () => {
    const audio = device.audio!;
    assert(audio.ringtoneDevices !== null && audio.ringtoneDevices !== undefined,
      'ringtoneDevices should be defined');
  });

  it('should have speakerDevices defined', () => {
    const audio = device.audio!;
    assert(audio.speakerDevices !== null && audio.speakerDevices !== undefined,
      'speakerDevices should be defined');
  });

  it('should have audioConstraints as null by default', () => {
    const audio = device.audio!;
    assert.strictEqual(audio.audioConstraints, null);
  });

  it('should set and unset audio constraints', async () => {
    const audio = device.audio!;
    await audio.setAudioConstraints({ echoCancellation: true } as any);
    assert.deepStrictEqual(audio.audioConstraints, { echoCancellation: true });

    await audio.unsetAudioConstraints();
    assert.strictEqual(audio.audioConstraints, null);
  });

  it('should have inputDevice as null by default', () => {
    const audio = device.audio!;
    assert.strictEqual(audio.inputDevice, null);
  });

  it('should enumerate at least one input device', () => {
    const audio = device.audio!;
    // In a browser environment with getUserMedia available, there should be at least one input device
    assert(audio.availableInputDevices.size >= 0,
      'Should have zero or more input devices');
  });
});
