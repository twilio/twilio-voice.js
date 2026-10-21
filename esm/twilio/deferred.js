/**
 * Deferred Promise
 */
class Deferred {
    /**
     * @constructor
     */
    constructor() {
        this._promise = new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });
    }
    /**
     * @returns The {@link Deferred} Promise
     */
    get promise() {
        return this._promise;
    }
    /**
     * Rejects this promise
     */
    reject(reason) {
        this._reject(reason);
    }
    /**
     * Resolves this promise
     */
    resolve(value) {
        this._resolve(value);
    }
}

export { Deferred as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmZXJyZWQuanMiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vZGVmZXJyZWQudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7O0FBRUc7QUFDVyxNQUFPLFFBQVEsQ0FBQTtBQWdCM0I7O0FBRUc7QUFDSCxJQUFBLFdBQUEsR0FBQTtRQUNFLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxPQUFPLENBQU0sQ0FBQyxPQUFPLEVBQUUsTUFBTSxLQUFJO0FBQ25ELFlBQUEsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPO0FBQ3ZCLFlBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNO0FBQ3ZCLFFBQUEsQ0FBQyxDQUFDO0lBQ0o7QUFFQTs7QUFFRztBQUNILElBQUEsSUFBSSxPQUFPLEdBQUE7UUFDVCxPQUFPLElBQUksQ0FBQyxRQUFRO0lBQ3RCO0FBRUE7O0FBRUc7QUFDSCxJQUFBLE1BQU0sQ0FBQyxNQUFZLEVBQUE7QUFDakIsUUFBQSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztJQUN0QjtBQUVBOztBQUVHO0FBQ0gsSUFBQSxPQUFPLENBQUMsS0FBVyxFQUFBO0FBQ2pCLFFBQUEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUM7SUFDdEI7QUFDRDs7OzsifQ==
