// @ts-nocheck
export default class Deferred<T> {
  readonly promise: Promise<T>;

  private _reject: (e?: any) => void;
  get reject() { return this._reject; }

  private _resolve: (t?: T) => void;
  get resolve() { return this._resolve; }

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }
}
