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

export { MediaDeviceInfoShim as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVkaWFkZXZpY2VpbmZvLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3NoaW1zL21lZGlhZGV2aWNlaW5mby50cyJdLCJzb3VyY2VzQ29udGVudCI6W251bGxdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUNBLE1BQU0sbUJBQW1CLENBQUE7QUFDdkIsSUFBQSxXQUFBLENBQVksT0FBTyxFQUFBO0FBQ2pCLFFBQUEsTUFBTSxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRTtZQUM1QixRQUFRLEVBQUUsRUFBRSxHQUFHLEdBQUEsRUFBSyxPQUFPLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDaEQsT0FBTyxFQUFFLEVBQUUsR0FBRyxHQUFBLEVBQUssT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQzlDLElBQUksRUFBRSxFQUFFLEdBQUcsR0FBQSxFQUFLLE9BQU8sT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUN4QyxLQUFLLEVBQUUsRUFBRSxHQUFHLEdBQUEsRUFBSyxPQUFPLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDM0MsU0FBQSxDQUFDO0lBQ0o7QUFDRDs7OzsifQ==
