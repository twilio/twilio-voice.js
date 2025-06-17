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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVkaWFkZXZpY2VpbmZvLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9zaGltcy9tZWRpYWRldmljZWluZm8udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsY0FBYztBQUNkLE1BQU0sbUJBQW1CO0lBQ3ZCLFlBQVksT0FBTztRQUNqQixNQUFNLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFO1lBQzVCLFFBQVEsRUFBRSxFQUFFLEdBQUcsS0FBSyxPQUFPLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDaEQsT0FBTyxFQUFFLEVBQUUsR0FBRyxLQUFLLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUM5QyxJQUFJLEVBQUUsRUFBRSxHQUFHLEtBQUssT0FBTyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQ3hDLEtBQUssRUFBRSxFQUFFLEdBQUcsS0FBSyxPQUFPLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUU7U0FDM0MsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBRUQsZUFBZSxtQkFBbUIsQ0FBQyJ9