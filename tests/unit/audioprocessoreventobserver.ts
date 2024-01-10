import { AudioProcessorEventObserver } from '../../lib/twilio/audioprocessoreventobserver';
import * as sinon from 'sinon';

describe('AudioProcessorEventObserver', () => {
  let eventObserver: AudioProcessorEventObserver;
  let stub: any;

  beforeEach(() => {
    stub = sinon.stub();
    eventObserver = new AudioProcessorEventObserver();
    eventObserver.on('event', stub);
  });

  [{
    eventName: 'enabled',
    reEmittedName: 'enabled',
  },{
    eventName: 'add',
    reEmittedName: 'add',
  },{
    eventName: 'remove',
    reEmittedName: 'remove',
  },{
    eventName: 'create',
    reEmittedName: 'create-processed-stream',
  },{
    eventName: 'destroy',
    reEmittedName: 'destroy-processed-stream',
  }].forEach(({ eventName, reEmittedName }) => {
    it(`should re-emit ${eventName} event`, () => {
      eventObserver.emit(eventName);
      sinon.assert.calledWithExactly(stub, { group: 'audio-processor', name: reEmittedName });
    });

    it(`should unsubscribe ${eventName} after destroying the event observer`, () => {
      eventObserver.destroy();
      eventObserver.emit(eventName);
      sinon.assert.notCalled(stub);
    });
  });
});
