import Deferred from '../../lib/twilio/deferred';
import * as assert from 'assert';
import * as sinon from 'sinon';

describe('Deferred', () => {
  const RES = 'foo';
  const ERR = 'bar';

  let deferred: Deferred;
  let wait: () => Promise<any>;

  beforeEach(() => {
    deferred = new Deferred();
    wait = () => new Promise(r => setTimeout(r, 0));
  });

  it('Should initialize', () => {
    assert.notEqual(deferred.promise, null);
    assert.notEqual(deferred.promise, undefined);
  });

  it('Should resolve', () => {
    const callback = sinon.stub();
    deferred.promise.then(callback);
    deferred.resolve(RES);

    return wait().then(() => assert(callback.calledWithExactly(RES)));
  });

  it('Should reject', () => {
    const callback = sinon.stub();
    deferred.promise.catch(callback);
    deferred.reject(ERR);
    return wait().then(() => assert(callback.calledWithExactly(ERR)));
  });
});
