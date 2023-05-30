const assert = require('assert');
const sinon = require('sinon');

const Sound = require('../lib/twilio/sound').default;

describe('Sound', () => {
  const root = global;
  const wait = (timeout) => new Promise(r => setTimeout(r, timeout || 0));

  let audioContext;
  let AudioFactory;
  let name;
  let sound;
  let tempAudio;
  let url;

  beforeEach(() => {
    audioContext = {
      createBufferSource: () => ({
        addEventListener: () => {},
        connect: () => {},
        disconnect: () => {},
        start: () => {},
        stop: () => {}
      }),
      createGain: () => ({
        connect: () => {},
        gain: {}
      }),
      decodeAudioData: () => {}
    };

    AudioFactory = function AudioFactory(url) {
      this.url = url;
    };
    AudioFactory.prototype.pause = sinon.stub();
    AudioFactory.prototype.load = sinon.stub();
    AudioFactory.prototype.play = () => ({
      then: () => ({ catch: () => {} })
    });
    AudioFactory.prototype.stop = () => {};
    AudioFactory.prototype.addEventListener = () => {};

    name = 'foo';
    url = 'bar.com';
    tempAudio = root.Audio;
    root.Audio = AudioFactory;
    sound = new Sound(name, url);
  });

  afterEach(() => {
    root.Audio = tempAudio;
  });

  context('constructor', () => {
    it('should use audioContext when passed in', () => {
      sound = new Sound(name, url, { audioContext });
      assert.notEqual(sound._Audio, AudioFactory);
    });

    it('should use HTML Audio when audioContext is not passed in', () => {
      assert.equal(sound._Audio, AudioFactory);
    });

    it('should set _isSinkSupported to true', () => {
      AudioFactory.prototype.setSinkId = function(){};
      sound = new Sound(name, url);
      assert(sound._isSinkSupported);
    });

    it('should set _isSinkSupported to false', () => {
      assert(!sound._isSinkSupported);
    });

    it('should set maxDuration', () => {
      sound = new Sound(name, url, { maxDuration: 1000 });
      assert.equal(sound._maxDuration, 1000);
    });

    it('should set shouldLoop', () => {
      sound = new Sound(name, url, { shouldLoop: true });
      assert.equal(sound._shouldLoop, true);

      sound = new Sound(name, url, { shouldLoop: false });
      assert.equal(sound._shouldLoop, false);
    });

    it('should set default sinkId', () => {
      assert.deepEqual(sound._sinkIds, ['default']);
    });

    it('should set isPlaying', () => {
      sound._playPromise = Promise.resolve();
      assert(sound.isPlaying);

      sound._playPromise = null;
      assert(!sound.isPlaying);
    });

    it('should play on init', () => {
      assert(sound.isPlaying);
    });
  });

  context('Sound.prototype._playAudioElement', () => {
    const METHOD = Sound.prototype._playAudioElement;
    const SINK_ID = 'foo';

    let audioElement;
    let context;
    let toTest;

    beforeEach(() => {
      context = {
        _activeEls: new Map()
      };

      audioElement = new AudioFactory();
      context._activeEls.set(SINK_ID, audioElement);

      toTest = METHOD.bind(context);
    });

    it('should throw error if sinkId was not initialized with an audio', () => {
      const spy = sinon.spy(toTest);
      try {
        spy();
      } catch { }
      assert(spy.threw());
    });

    it('should set muted', () => {
      toTest(SINK_ID, true);
      assert(audioElement.muted === true);
      toTest(SINK_ID, false);
      assert(audioElement.muted === false);
    });

    it('should set loop', () => {
      toTest(SINK_ID, true, true);
      assert(audioElement.loop === true);
      toTest(SINK_ID, true, false);
      assert(audioElement.loop === false);
    });

    it('should return audio element on play success', (done) => {
      AudioFactory.prototype.play = () => Promise.resolve();
      audioElement.src = 'bar';
      audioElement.srcObject = 'baz';
      toTest(SINK_ID).then(result => {
        assert.equal(result, audioElement);
        assert.equal(audioElement.src, 'bar');
        assert.equal(audioElement.srcObject, 'baz');
        sinon.assert.notCalled(audioElement.pause);
        sinon.assert.notCalled(audioElement.load);
        assert.equal(context._activeEls.get(SINK_ID), audioElement);
        done();
      });
    });

    it('should cleanup on error', (done) => {
      AudioFactory.prototype.play = () => Promise.reject('foo');
      audioElement.src = 'bar';
      audioElement.srcObject = 'baz';
      toTest(SINK_ID).catch(reason => {
        assert.equal(reason, 'foo');
        assert.equal(audioElement.src, '');
        assert.equal(audioElement.srcObject, null);
        sinon.assert.calledOnce(audioElement.pause);
        sinon.assert.calledOnce(audioElement.load);
        assert.equal(context._activeEls.get(SINK_ID), undefined);
        done();
      });
    });
  });

  context('Sound.prototype.setSinkIds', () => {
    const METHOD = Sound.prototype.setSinkIds;

    let context;
    let toTest;

    beforeEach(() => {
      context = {};
      toTest = METHOD.bind(context);
    });

    it('should do nothing if sink is not supported', () => {
      context._isSinkSupported = false;
      context._sinkIds = ['foo'];

      toTest(['bar']);
      assert.deepEqual(context._sinkIds, ['foo']);
    });

    it('should set sinkIds', () => {
      context._isSinkSupported = true;
      context._sinkIds = ['foo'];

      toTest(['bar']);
      assert.deepEqual(context._sinkIds, ['bar']);

      toTest(['a', 'b']);
      assert.deepEqual(context._sinkIds, ['a', 'b']);

      toTest(['bar']);
      assert.deepEqual(context._sinkIds, ['bar']);
    });
  });

  context('Sound.prototype.stop', () => {
    const METHOD = Sound.prototype.stop;

    let context;
    let toTest;

    beforeEach(() => {
      context = {
        _operations: {
          enqueue: (cb) => cb()
        },
        _stop: sinon.stub(),
      };
      toTest = METHOD.bind(context);
    });

    it('should call _stop', () => {
      toTest();
      return wait().then(() => sinon.assert.calledOnce(context._stop));
    });
  });

  context('Sound.prototype._stop', () => {
    const METHOD = Sound.prototype._stop;

    let context;
    let toTest;
    let activeEls;

    beforeEach(() => {
      activeEls = new Map();
      context = {
        _activeEls: activeEls,
        _operations: {
          enqueue: (cb) => cb()
        },
        _sinkIds: []
      };
      toTest = METHOD.bind(context);
    });

    it('should stop play max duration timeout', () => {
      const stub = sinon.stub();
      context._playPromise = {};
      context._maxDurationTimeout = setTimeout(stub, 10);

      toTest();
      return wait(20).then(() => {
        sinon.assert.notCalled(stub);
        assert.equal(context._playPromise, null);
        assert.equal(context._maxDurationTimeout, null);
      });
    });

    it('should stop audioElements associated to a sinkId', () => {
      const audio = new AudioFactory();
      audio.src = 'foo';
      audio.srcObject = 'bar';
      activeEls.set('sink1', audio);
      context._sinkIds = ['sink1'];

      toTest();
      assert.equal(activeEls.get('sink1'), audio);
      assert.equal(audio.src, 'foo');
      assert.equal(audio.srcObject, 'bar');
      sinon.assert.calledOnce(audio.pause);
      assert.equal(audio.currentTime, 0);
    });

    it('should destroy audioElements not associated to a sinkId', () => {
      const audio = new AudioFactory();
      audio.src = 'foo';
      audio.srcObject = 'bar';
      activeEls.set('sink1', audio);

      toTest();
      assert.equal(activeEls.get('sink1'), undefined);
      assert.equal(audio.src, '');
      assert.equal(audio.srcObject, null);
      sinon.assert.called(audio.pause);
      sinon.assert.called(audio.load);
    });
  });

  context('Sound.prototype.play', () => {
    const METHOD = Sound.prototype.play;

    let context;
    let toTest;

    beforeEach(() => {
      context = {
        _play: sinon.stub(),
        _operations: {
          enqueue: (cb) => cb()
        },
      };
      toTest = METHOD.bind(context);
    });

    it('should play unmuted', () => {
      toTest();
      sinon.assert.calledOnce(context._play);
      assert(context._play.getCall(0).args.length === 0);

      toTest(true);
      assert(context._play.getCall(0).args.length === 0);
    });

    it('should not override shouldLoop', () => {
      toTest(true, true);
      sinon.assert.calledOnce(context._play);
      assert(context._play.getCall(0).args.length === 0);
    });
  });

  context('Sound.prototype._play', () => {
    const METHOD = Sound.prototype._play;
    const SINK_ID = 'foo';

    let scope;
    let toTest;
    let activeEls;
    let audio;

    beforeEach(() => {
      activeEls = new Map();
      scope = {
        _Audio: AudioFactory,
        _activeEls: activeEls,
        _sinkIds: [],
        _playAudioElement: sinon.stub(),
        _stop: sinon.stub(),
      };

      audio = new AudioFactory();
      scope._sinkIds = [SINK_ID];
      activeEls.set(SINK_ID, audio);

      toTest = METHOD.bind(scope);
    });

    it('should call stop appropriately', () => {
      scope.isPlaying = true;
      toTest();
      sinon.assert.calledOnce(scope._stop);
      sinon.assert.calledOnce(scope._playAudioElement);
      sinon.assert.callOrder(scope._stop, scope._playAudioElement);
    });

    it('should call stop after maxDuration threshold', () => {
      scope.isPlaying = false;
      scope._maxDuration = 10;
      toTest();
      return wait(20).then(() => {
        sinon.assert.calledOnce(scope._stop);
      });
    });

    it('should play audio if exists for a sinkId', () => {
      toTest();
      sinon.assert.calledOnce(scope._playAudioElement);
    });

    it('should set crossorigin attribute when using html5 audio', () => {
      AudioFactory.prototype.setAttribute = sinon.stub();
      activeEls.clear();
      toTest();
      sinon.assert.calledWithExactly(audio.setAttribute, 'crossorigin', 'anonymous');
    });

    it('should play audio with muted and loop parameters', () => {
      toTest(true, false);
      sinon.assert.calledOnce(scope._playAudioElement);
      sinon.assert.calledWithExactly(scope._playAudioElement, SINK_ID, true, false);

      toTest(true, true);
      sinon.assert.calledWithExactly(scope._playAudioElement, SINK_ID, true, true);

      toTest(false, true);
      sinon.assert.calledWithExactly(scope._playAudioElement, SINK_ID, false, true);

      toTest(false, false);
      sinon.assert.calledWithExactly(scope._playAudioElement, SINK_ID, false, false);
    });

    it('should override loop parameter properly', () => {
      scope._shouldLoop = true;
      toTest(true);
      sinon.assert.calledOnce(scope._playAudioElement);
      sinon.assert.calledWithExactly(scope._playAudioElement, SINK_ID, true, true);

      toTest(true, false);
      sinon.assert.calledWithExactly(scope._playAudioElement, SINK_ID, true, false);

      scope._shouldLoop = false;
      toTest(true);
      sinon.assert.calledWithExactly(scope._playAudioElement, SINK_ID, true, false);

      toTest(true, true);
      sinon.assert.calledWithExactly(scope._playAudioElement, SINK_ID, true, true);
    });

    context('media cache', () => {
      beforeEach(() => {
        AudioFactory.prototype.addEventListener = (name, handler) => handler();
        AudioFactory.prototype.setSinkId = function (sinkId) {
          this.sinkId = sinkId;
          return Promise.resolve();
        };
        activeEls.clear();
      });

      it('should create and play new audio element if not cached', () => {
        scope._isSinkSupported = false;
        scope.url = 'foo';

        assert.equal(activeEls.size, 0);
        toTest();

        return wait(10).then(() => {
          const audio = activeEls.get(SINK_ID);

          assert.equal(audio.url, 'foo');
          assert.equal(activeEls.size, 1);
          sinon.assert.calledOnce(scope._playAudioElement);
        });
      });

      it('should set sinkId', () => {
        scope._isSinkSupported = true;
        toTest();

        return wait(10).then(() => {
          const audio = activeEls.get(SINK_ID);

          assert.equal(audio.sinkId, SINK_ID);
          sinon.assert.calledOnce(scope._playAudioElement);
        });
      });

      it('should not set sinkId', () => {
        scope._isSinkSupported = false;
        toTest();

        return wait(10).then(() => {
          const audio = activeEls.get(SINK_ID);

          assert.notEqual(audio.sinkId, SINK_ID);
          sinon.assert.calledOnce(scope._playAudioElement);
        });
      });

      it('should play audio with muted and loop parameters', () => {
        toTest(true, false);
        return wait(5).then(() => {
          sinon.assert.calledOnce(scope._playAudioElement);
          sinon.assert.calledWithExactly(scope._playAudioElement, SINK_ID, true, false);

          toTest(true, true);
          return wait(5).then(() => {
            sinon.assert.calledWithExactly(scope._playAudioElement, SINK_ID, true, true);

            toTest(false, true);
            return wait(5).then(() => {
              sinon.assert.calledWithExactly(scope._playAudioElement, SINK_ID, false, true);

              toTest(false, false);
              return wait(5).then(() => {
                sinon.assert.calledWithExactly(scope._playAudioElement, SINK_ID, false, false);
              });
            });
          });
        });
      });

      it('should override loop parameter properly', () => {
        scope._shouldLoop = true;
        toTest(true);
        return wait(5).then(() => {
          sinon.assert.calledOnce(scope._playAudioElement);
          sinon.assert.calledWithExactly(scope._playAudioElement, SINK_ID, true, true);

          toTest(true, false);
          return wait(5).then(() => {
            sinon.assert.calledWithExactly(scope._playAudioElement, SINK_ID, true, false);

            scope._shouldLoop = false;
            toTest(true);
            return wait(5).then(() => {
              sinon.assert.calledWithExactly(scope._playAudioElement, SINK_ID, true, false);      
              toTest(true, true);

              return wait(5).then(() => {
                sinon.assert.calledWithExactly(scope._playAudioElement, SINK_ID, true, true);
              });
            });
          });
        });
      });

      it('should not play if stop is called while waiting for canplaythrough event', () => {
        AudioFactory.prototype.addEventListener = (name, handler) => {
          setTimeout(() => {
            scope._playPromise = null;
            handler();
          }, 5);
        };
        scope.url = 'foo';

        assert.equal(activeEls.size, 0);
        toTest();

        return wait(10).then(() => {
          const audio = activeEls.get(SINK_ID);

          assert.equal(audio.url, 'foo');
          assert.equal(activeEls.size, 1);
          sinon.assert.notCalled(scope._playAudioElement);
        });

      });

      it('should not play if stop is called while waiting for setSinkId', () => {
        scope._isSinkSupported = true;
        AudioFactory.prototype.setSinkId = function (sinkId) {
          return new Promise(resolve => {
            setTimeout(() => {
              scope._playPromise = null;
              resolve();
            }, 5);
          });
        };
        scope.url = 'foo';

        assert.equal(activeEls.size, 0);
        toTest();

        return wait(10).then(() => {
          const audio = activeEls.get(SINK_ID);

          assert.equal(audio.url, 'foo');
          assert.equal(activeEls.size, 1);
          sinon.assert.notCalled(scope._playAudioElement);
        });
      });
    });
  });
});
