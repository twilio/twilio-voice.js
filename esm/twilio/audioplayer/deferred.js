// @ts-nocheck
class Deferred {
    get reject() { return this._reject; }
    get resolve() { return this._resolve; }
    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });
    }
}

export { Deferred as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmZXJyZWQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi90d2lsaW8vYXVkaW9wbGF5ZXIvZGVmZXJyZWQudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDYyxNQUFPLFFBQVEsQ0FBQTtJQUkzQixJQUFJLE1BQU0sS0FBSyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUdwQyxJQUFJLE9BQU8sS0FBSyxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUV0QyxJQUFBLFdBQUEsR0FBQTtRQUNFLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxLQUFJO0FBQzdDLFlBQUEsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPO0FBQ3ZCLFlBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNO0FBQ3ZCLFFBQUEsQ0FBQyxDQUFDO0lBQ0o7QUFDRDs7OzsifQ==
