// @ts-nocheck
class MediaDeviceInfoShim {
  constructor(options) {
    Object.defineProperties(this, {
      deviceId: { get() { return options.deviceId; } },
      groupId: { get() { return options.groupId; } },
      kind: { get() { return options.kind; } },
      label: { get() { return options.label; } },
    });
  }
}

export default MediaDeviceInfoShim;
