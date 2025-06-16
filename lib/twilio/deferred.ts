/**
 * Deferred Promise
 */
export default class Deferred {
  /**
   * This {@link Deferred} Promise
   */
  private readonly _promise: Promise<any>;

  /**
   * The Promise's reject method.
   */
  private _reject: (reason?: any) => void;

  /**
   * The Promise's resolve method.
   */
  private _resolve: (value?: any) => void;

  /**
   * @constructor
   */
  constructor() {
    this._promise = new Promise<any>((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  /**
   * @returns The {@link Deferred} Promise
   */
  get promise(): Promise<any> {
    return this._promise;
  }

  /**
   * Rejects this promise
   */
  reject(reason?: any): void {
    this._reject(reason);
  }

  /**
   * Resolves this promise
   */
  resolve(value?: any): void {
    this._resolve(value);
  }
}
