/* tslint:disable:max-classes-per-file no-empty */

import * as assert from 'assert';
import * as sinon from 'sinon';
import { SinonSpy } from 'sinon';

import AudioPlayer from '../../lib/twilio/audioplayer/audioplayer';
import EventTarget from '../../lib/twilio/audioplayer/eventtarget';

// tslint:disable-next-line:only-arrow-functions
describe('AudioPlayer', function() {
  let audioContext: MockContext;
  let audioPlayer: AudioPlayer;

  beforeEach(() => {
    XMLHttpRequestFactory.clear();
    audioContext = new MockContext();
  });

  describe('without a SRC', () => {
    beforeEach(() => {
      AudioFactory.clear();

      audioPlayer = new AudioPlayer(audioContext, {
        AudioFactory,
        XMLHttpRequestFactory,
      });
    });

    describe('.play()', () => {
      it('should set .paused to false synchronously', () => {
        audioPlayer.play();
        assert.equal(audioPlayer.paused, false);
      });

      it('should return a pending Promise for each play call until a src is set', () => {
        let isNextTick = false;

        const promise = Promise.all([
          audioPlayer.play().then(() => { assert(isNextTick); }),
          audioPlayer.play().then(() => { assert(isNextTick); }),
          audioPlayer.play().then(() => { assert(isNextTick); }),
        ]);

        setTimeout(() => {
          isNextTick = true;
          audioPlayer.src = 'foo';
        });

        return promise;
      });
    });

    describe('.pause()', () => {
      it('should set .paused to true synchronously', () => {
        audioPlayer.pause();
        assert.equal(audioPlayer.paused, true);
      });

      it('should cause pending .play Promises to reject', (done) => {
        audioPlayer.play().catch(() => { done(); });
        audioPlayer.pause();
      });

      context('when already paused', () => {
        it('should silently do nothing', () => {
          audioPlayer.pause();
          assert.equal(audioPlayer.pause(), undefined);
        });
      });
    });

    describe('.load()', () => {
      it('should not affect .src', () => {
        audioPlayer.src = 'test';
        audioPlayer.load();
        assert.equal(audioPlayer.src, 'test');
      });

      it('should not resolve pending play Promises', () => {
        const error = new Error('Promises resolved unexpectedly');
        const promise = Promise.race([
          audioPlayer.play().then(() => { throw error; }),
          audioPlayer.play().then(() => { throw error; }),
          audioPlayer.play().then(() => { throw error; }),
          new Promise(resolve => { setTimeout(resolve); }),
        ]);

        audioPlayer.load();

        return promise;
      });
    });

    describe('setting .src', () => {
      it('should update .src synchronously', () => {
        audioPlayer.src = 'test';
        assert.equal(audioPlayer.src, 'test');
      });

      it('should resolve any pending play Promises', () => {
        const promise = Promise.all([
          audioPlayer.play(),
          audioPlayer.play(),
          audioPlayer.play(),
        ]);

        audioPlayer.src = 'foo';

        return promise;
      });
    });

    describe('setting .loop', () => {
      it('should update .loop synchronously', () => {
        audioPlayer.loop = true;
        assert.equal(audioPlayer.loop, true);
        audioPlayer.loop = false;
        assert.equal(audioPlayer.loop, false);
      });
    });
  });

  describe('with a SRC', () => {
    beforeEach(() => {
      AudioFactory.clear();

      audioPlayer = new AudioPlayer(audioContext, 'foo', {
        AudioFactory,
        XMLHttpRequestFactory,
      });

      audioContext.clear();
    });

    describe('.play()', () => {
      it('should set .paused to false synchronously', () => {
        audioPlayer.play();
        assert.equal(audioPlayer.paused, false);
      });

      it('should create a new audio node', () => {
        audioPlayer.play();
        assert.equal(audioContext.audioNodes.length, 1);
      });

      it('should set .loop on the new audio node', () => {
        audioPlayer.loop = true;
        audioPlayer.play();
        assert.equal(audioContext.audioNodes[0].loop, true);
      });

      it('should start the audio node', () => {
        return audioPlayer.play().then(() => {
          sinon.assert.calledOnce(audioContext.audioNodes[0].start as SinonSpy);
        });
      });

      it('should play the audio element if a sinkId is set', () => {
        audioPlayer.setSinkId('foo');

        return audioPlayer.play().then(() => {
          assert.equal(AudioFactory.instances.length, 1);
          sinon.assert.calledOnce(AudioFactory.instances[0].play as SinonSpy);
        });
      });

      context('when already playing', () => {
        it('should not create another audio node', () => {
          audioPlayer.play();
          return audioPlayer.play()
            .then(() => audioPlayer.play())
            .then(() => {
              assert.equal(audioContext.audioNodes.length, 1);
            });
        });
      });
    });

    describe('.pause()', () => {
      it('should set .paused to true synchronously', () => {
        return audioPlayer.play().then(() => {
          assert.equal(audioPlayer.paused, false);
          audioPlayer.pause();
          assert.equal(audioPlayer.paused, true);
        });
      });

      it('should cause pending .play Promises to reject', (done) => {
        audioPlayer.play().catch(() => { done(); });
        audioPlayer.pause();
      });

      it('should stop the audioNode', () => {
        return audioPlayer.play().then(() => {
          audioPlayer.pause();
          sinon.assert.calledOnce(audioContext.audioNodes[0].stop as SinonSpy);
        });
      });

      it('should pause the audio element if a sinkId is set', () => {
        return audioPlayer.play().then(() => {
          audioPlayer.pause();
          sinon.assert.calledOnce(AudioFactory.instances[0].pause as SinonSpy);
        });
      });

      context('when already paused', () => {
        it('should silently do nothing', () => {
          audioPlayer.pause();
          assert.equal(audioPlayer.pause(), undefined);
        });
      });
    });

    describe('.load()', () => {
      it('should not change .src', () => {
        audioPlayer.src = 'bar';
        audioPlayer.load();
        assert.equal(audioPlayer.src, 'bar');
      });

      it('should not reject any pending play Promises', () => {
        const error = new Error('Promises rejected unexpectedly');
        const promise = Promise.race([
          audioPlayer.play().catch(() => { throw error; }),
          audioPlayer.play().catch(() => { throw error; }),
          audioPlayer.play().catch(() => { throw error; }),
          new Promise(resolve => { setTimeout(resolve); }),
        ]);

        audioPlayer.load();

        return promise;
      });
    });

    describe('setting .src', () => {
      it('should update .src synchronously', () => {
        audioPlayer.src = 'bar';
        assert.equal(audioPlayer.src, 'bar');
      });

      it('should reject any pending play Promises', (done) => {
        const error = new Error('Expected a reject, but got a resolve');
        Promise.all([
          audioPlayer.play().then(() => { throw error; }, () => { }),
          audioPlayer.play().then(() => { throw error; }, () => { }),
          audioPlayer.play().then(() => { throw error; }, () => { }),
        ]).then(() => done(), done);

        audioPlayer.src = 'bar';
      });

      it('should call .pause() if the sound is currently playing', () => {
        audioPlayer.pause = sinon.spy(audioPlayer.pause);
        audioPlayer.play().then(() => {
          audioPlayer.src = 'bar';
          sinon.assert.calledOnce(audioPlayer.pause as SinonSpy);
        });
      });
    });

    describe('setting .loop', () => {
      it('should update .loop synchronously', () => {
        audioPlayer.loop = true;
        assert.equal(audioPlayer.loop, true);
        audioPlayer.loop = false;
        assert.equal(audioPlayer.loop, false);
      });

      context('when a sound is looping and loop is set to false', () => {
        it('should set a listener on the audio node that calls .pause() in response to the ended event', () => {
          audioPlayer.pause = sinon.spy(audioPlayer.pause);
          audioPlayer.loop = true;

          return audioPlayer.play().then(() => {
            audioPlayer.loop = false;
            sinon.assert.notCalled(audioPlayer.pause as SinonSpy);
            audioContext.audioNodes[0].dispatchEvent('ended');
            sinon.assert.calledOnce(audioPlayer.pause as SinonSpy);
          });
        });

        it('should only pause after the initial ended event', () => {
          audioPlayer.pause = sinon.spy(audioPlayer.pause);
          audioPlayer.loop = true;

          return audioPlayer.play().then(() => {
            audioPlayer.loop = false;
            sinon.assert.notCalled(audioPlayer.pause as SinonSpy);
            audioContext.audioNodes[0].dispatchEvent('ended');
            sinon.assert.calledOnce(audioPlayer.pause as SinonSpy);
            audioContext.audioNodes[0].dispatchEvent('ended');
            sinon.assert.calledOnce(audioPlayer.pause as SinonSpy);
            audioContext.audioNodes[0].dispatchEvent('ended');
            sinon.assert.calledOnce(audioPlayer.pause as SinonSpy);
          });
        });
      });
    });
  });

  describe('.setSinkId()', () => {
    beforeEach(() => {
      AudioFactory.clear();

      audioPlayer = new AudioPlayer(audioContext, 'foo', {
        AudioFactory,
        XMLHttpRequestFactory,
      });

      audioContext.clear();
    });

    context('when setSinkId is not supported', () => {
      it('should return a rejected Promise', (done) => {
        audioPlayer = new AudioPlayer(audioContext, {
          AudioFactory: LegacyAudioFactory,
          XMLHttpRequestFactory,
        });

        audioPlayer.setSinkId('foo').catch(() => done());
      });
    });

    context('when .sinkId is default', () => {
      context('and setting to default', () => {
        it('should return a resolved Promise', () => {
          return audioPlayer.setSinkId('default');
        });
      });

      context('and setting to a sinkId', () => {
        it('should call .setSinkId of the audio element', () => {
          return audioPlayer.setSinkId('foo').then(() => {
            sinon.assert.calledOnce((AudioFactory.instances[0] as AudioFactory).setSinkId as SinonSpy);
          });
        });

        it('should create a new MediaStreamDestination', () => {
          return audioPlayer.setSinkId('foo').then(() => {
            sinon.assert.calledOnce(audioContext.createMediaStreamDestination as SinonSpy);
          });
        });

        it('should set .destination to the created destination', () => {
          return audioPlayer.setSinkId('foo').then(() => {
            assert.equal(audioPlayer.destination, audioContext.createdDestination);
          });
        });

        it('should connect the gain node to the new destination if already playing', () => {
          return audioPlayer.play().then(() => {
            sinon.assert.calledOnce(audioContext.audioNodes[0].connect as SinonSpy);
            sinon.assert.calledOnce(audioContext.gainNodes[0].connect as SinonSpy);
            return audioPlayer.setSinkId('foo');
          }).then(() => {
            sinon.assert.calledOnce(audioContext.audioNodes[0].connect as SinonSpy);
            sinon.assert.calledTwice(audioContext.gainNodes[0].connect as SinonSpy);
          });
        });

        it('should connect the gain node to the new destination if not already playing', () => {
          return audioPlayer.setSinkId('foo').then(() => {
            sinon.assert.calledTwice(audioContext.gainNodes[0].connect as SinonSpy);
          });
        });
      });
    });

    context('when .sinkId is not default', () => {
      beforeEach(() => {
        return audioPlayer.setSinkId('foo');
      });

      context('and setting to default', () => {
        it('should return a resolved Promise', () => {
          return audioPlayer.setSinkId('default');
        });

        it('should set .destination to context.destination', () => {
          return audioPlayer.setSinkId('default').then(() => {
            assert.equal(audioPlayer.destination, audioContext.destination);
          });
        });
      });

      context('and setting to the same sinkId', () => {
        it('should not create a new MediaStreamDestination', () => {
          sinon.assert.calledOnce(audioContext.createMediaStreamDestination as SinonSpy);
          return audioPlayer.setSinkId('foo').then(() => {
            sinon.assert.calledOnce(audioContext.createMediaStreamDestination as SinonSpy);
          });
        });
      });

      context('and setting to a new sinkId', () => {
        it('should call .setSinkId of the audio element', () => {
          sinon.assert.calledOnce((AudioFactory.instances[0] as AudioFactory).setSinkId as SinonSpy);
          return audioPlayer.setSinkId('bar').then(() => {
            sinon.assert.calledTwice((AudioFactory.instances[0] as AudioFactory).setSinkId as SinonSpy);
          });
        });

        it('should not create a new MediaStreamDestination', () => {
          sinon.assert.calledOnce(audioContext.createMediaStreamDestination as SinonSpy);
          return audioPlayer.setSinkId('foo').then(() => {
            sinon.assert.calledOnce(audioContext.createMediaStreamDestination as SinonSpy);
          });
        });
      });
    });
  });

  describe('.muted', () => {
    beforeEach(() => {
      AudioFactory.clear();

      audioPlayer = new AudioPlayer(audioContext, {
        AudioFactory,
        XMLHttpRequestFactory,
      });
    });

    it('should set gain to 1 when not muted', () => {
      audioPlayer.muted = false;
      assert.equal(audioContext.gainNodes[0].gain.value, 1);
    });

    it('should set gain to 0 when muted', () => {
      audioPlayer.muted = true;
      assert.equal(audioContext.gainNodes[0].gain.value, 0);
    });
  });
});

class MockAudioNode extends EventTarget {
  loop: boolean = false;
  srcObject?: any;

  constructor() {
    super();

    this.connect = sinon.spy(this.connect);
    this.start = sinon.spy(this.start);
    this.stop = sinon.spy(this.stop);
  }

  connect() { }
  disconnect() { }
  start() { }
  stop() { }
}

class MockGainNode {
  gain: any = {
    value: 1,
  };

  constructor() {
    this.connect = sinon.spy(this.connect);
  }

  connect() { }
  disconnect() { }
}

class MockContext {
  audioNodes: MockAudioNode[] = [];
  gainNodes: MockGainNode[] = [];

  destination: any = {
    stream: 'foo',
  };
  createdDestination: any = {
    stream: 'bar',
  };

  constructor() {
    this.createMediaStreamDestination = sinon.spy(this.createMediaStreamDestination);
  }

  clear() {
    this.audioNodes.splice(0, this.audioNodes.length);
  }

  createBufferSource() {
    const node = new MockAudioNode();
    this.audioNodes.push(node);
    return node;
  }

  createGain() {
    const node = new MockGainNode();
    this.gainNodes.push(node);
    return node;
  }

  createMediaStreamDestination() {
    return this.createdDestination;
  }

  decodeAudioData() { }
}

class LegacyAudioFactory {
  static instances: LegacyAudioFactory[] = [];

  static clear() {
    this.instances.splice(0, this.instances.length);
  }

  srcObject: any;

  constructor() {
    this.play = sinon.spy(this.play);
    this.pause = sinon.spy(this.pause);
    AudioFactory.instances.push(this);
  }

  pause() { }
  play() { }
}

class AudioFactory extends LegacyAudioFactory {
  constructor() {
    super();
    this.setSinkId = sinon.spy(this.setSinkId);
  }

  setSinkId() {
    return Promise.resolve();
  }
}

class XMLHttpRequestFactory extends EventTarget {
  static instances: XMLHttpRequestFactory[] = [];

  static clear() {
    this.instances.splice(0, this.instances.length);
  }

  responseType?: string;

  constructor() {
    super();
    XMLHttpRequestFactory.instances.push(this);
  }

  open(method: string, url: string, async?: boolean): void { }
  send(): void {
    this.dispatchEvent('load', {
      target: { response: 'foo' },
    });
  }
}
