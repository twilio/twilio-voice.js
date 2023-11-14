/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVkaWFkZXZpY2VpbmZvLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9zaGltcy9tZWRpYWRldmljZWluZm8udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7R0FJRztBQUNILGNBQWM7QUFDZCxNQUFNLG1CQUFtQjtJQUN2QixZQUFZLE9BQU87UUFDakIsTUFBTSxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRTtZQUM1QixRQUFRLEVBQUUsRUFBRSxHQUFHLEtBQUssT0FBTyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQ2hELE9BQU8sRUFBRSxFQUFFLEdBQUcsS0FBSyxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDOUMsSUFBSSxFQUFFLEVBQUUsR0FBRyxLQUFLLE9BQU8sT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUN4QyxLQUFLLEVBQUUsRUFBRSxHQUFHLEtBQUssT0FBTyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFO1NBQzNDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQUVELGVBQWUsbUJBQW1CLENBQUMifQ==