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
  describe('local processor events', () => {
    [{
      eventName: 'enabled',
      reEmittedName: 'enabled',
      isRemote: false,
    },{
      eventName: 'add',
      reEmittedName: 'add',
      isRemote: false,
    },{
      eventName: 'remove',
      reEmittedName: 'remove',
      isRemote: false,
    },{
      eventName: 'create',
      reEmittedName: 'create-processed-stream',
      isRemote: false, 
    },{
      eventName: 'destroy',
      reEmittedName: 'destroy-processed-stream',
      isRemote: false,
    }].forEach(({ eventName, reEmittedName, isRemote }) => {
      it(`should re-emit ${eventName} event`, () => {
        eventObserver.emit(eventName, isRemote);
        sinon.assert.calledWithExactly(stub, { group: 'audio-processor', name: reEmittedName, isRemote: false });
      });

      it(`should unsubscribe ${eventName} after destroying the event observer`, () => {
        eventObserver.destroy();
        eventObserver.emit(eventName);
        sinon.assert.notCalled(stub);
      });
    });
  });

  describe('remote processor events', () => {
    [{
      eventName: 'enabled',
      reEmittedName: 'enabled',
      isRemote: true
    },{
      eventName: 'add',
      reEmittedName: 'add',
      isRemote: true
    },{
      eventName: 'remove',
      reEmittedName: 'remove',
      isRemote: true
    },{
      eventName: 'create',
      reEmittedName: 'create-processed-stream',
      isRemote: true
    },{
      eventName: 'destroy',
      reEmittedName: 'destroy-processed-stream',
      isRemote: true
    }].forEach(({ eventName, reEmittedName, isRemote }) => {
      it(`should re-emit ${eventName} event`, () => {
        eventObserver.emit(eventName, isRemote);
        sinon.assert.calledWithExactly(stub, { group: 'audio-processor', name: reEmittedName, isRemote: true });
      });

      it(`should unsubscribe ${eventName} after destroying the event observer`, () => {
        eventObserver.destroy();
        eventObserver.emit(eventName);
        sinon.assert.notCalled(stub);
      });
    });
  });
});
