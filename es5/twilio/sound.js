'use strict';

var AsyncQueue = require('./asyncQueue').AsyncQueue;
var AudioPlayer = require('@twilio/audioplayer');
var InvalidArgumentError = require('./errors').InvalidArgumentError;

/**
 * @class
 * @param {string} name - Name of the sound
 * @param {string} url - URL of the sound
 * @param {Sound#ConstructorOptions} options
 * @property {boolean} isPlaying - Whether the Sound is currently playing audio.
 * @property {string} name - Name of the sound
 * @property {string} url - URL of the sound
 * @property {AudioContext} audioContext - The AudioContext to use if available for AudioPlayer.
 */ /**
    * @typedef {Object} Sound#ConstructorOptions
    * @property {number} [maxDuration=0] - The maximum length of time to play the sound
    *   before stopping it.
    * @property {Boolean} [shouldLoop=false] - Whether the sound should be looped.
    */
function Sound(name, url, options) {
  if (!(this instanceof Sound)) {
    return new Sound(name, url, options);
  }

  if (!name || !url) {
    throw new InvalidArgumentError('name and url are required arguments');
  }

  options = Object.assign({
    AudioFactory: typeof Audio !== 'undefined' ? Audio : null,
    maxDuration: 0,
    shouldLoop: false
  }, options);

  options.AudioPlayer = options.audioContext ? AudioPlayer.bind(AudioPlayer, options.audioContext) : options.AudioFactory;

  Object.defineProperties(this, {
    _activeEls: {
      value: new Map()
    },
    _Audio: {
      value: options.AudioPlayer
    },
    _isSinkSupported: {
      value: options.AudioFactory !== null && typeof options.AudioFactory.prototype.setSinkId === 'function'
    },
    _maxDuration: {
      value: options.maxDuration
    },
    _maxDurationTimeout: {
      value: null,
      writable: true
    },
    _operations: {
      value: new AsyncQueue()
    },
    _playPromise: {
      value: null,
      writable: true
    },
    _shouldLoop: {
      value: options.shouldLoop
    },
    _sinkIds: {
      value: ['default']
    },
    isPlaying: {
      enumerable: true,
      get: function get() {
        return !!this._playPromise;
      }
    },
    name: {
      enumerable: true,
      value: name
    },
    url: {
      enumerable: true,
      value: url
    }
  });

  if (this._Audio) {
    // Play it (muted and should not loop) as soon as possible so that it does not get incorrectly caught by Chrome's
    // "gesture requirement for media playback" feature.
    // https://plus.google.com/+FrancoisBeaufort/posts/6PiJQqJzGqX
    this._play(true, false);
  }
}

function destroyAudioElement(audioElement) {
  if (audioElement) {
    audioElement.pause();
    audioElement.src = '';
    audioElement.srcObject = null;
    audioElement.load();
  }
}

/**
 * Plays the audio element that was initialized using the speficied sinkId
 */
Sound.prototype._playAudioElement = function _playAudioElement(sinkId, isMuted, shouldLoop) {
  var _this = this;

  var audioElement = this._activeEls.get(sinkId);

  if (!audioElement) {
    throw new InvalidArgumentError('sinkId: "' + sinkId + '" doesn\'t have an audio element');
  }

  audioElement.muted = !!isMuted;
  audioElement.loop = !!shouldLoop;

  return audioElement.play().then(function () {
    return audioElement;
  }).catch(function (reason) {
    destroyAudioElement(audioElement);
    _this._activeEls.delete(sinkId);
    throw reason;
  });
};

/**
 * Start playing the sound. Will stop the currently playing sound first.
 * If it exists, the audio element that was initialized for the sinkId will be used
 */
Sound.prototype._play = function _play(forceIsMuted, forceShouldLoop) {
  if (this.isPlaying) {
    this._stop();
  }

  if (this._maxDuration > 0) {
    this._maxDurationTimeout = setTimeout(this._stop.bind(this), this._maxDuration);
  }

  forceShouldLoop = typeof forceShouldLoop === 'boolean' ? forceShouldLoop : this._shouldLoop;
  var self = this;
  var playPromise = this._playPromise = Promise.all(this._sinkIds.map(function createAudioElement(sinkId) {
    if (!self._Audio) {
      return Promise.resolve();
    }

    var audioElement = self._activeEls.get(sinkId);
    if (audioElement) {
      return self._playAudioElement(sinkId, forceIsMuted, forceShouldLoop);
    }

    audioElement = new self._Audio(self.url);

    // Make sure the browser always retrieves the resource using CORS.
    // By default when using media tags, origin header is not sent to server
    // which causes the server to not return CORS headers. When this caches
    // on the CDN or browser, it causes issues to future requests that needs CORS,
    // which is true when using AudioContext. Please note that we won't have to do this
    // once we migrate to CloudFront.
    if (typeof audioElement.setAttribute === 'function') {
      audioElement.setAttribute('crossorigin', 'anonymous');
    }

    /**
     * (rrowland) Bug in Chrome 53 & 54 prevents us from calling Audio.setSinkId without
     *   crashing the tab. https://bugs.chromium.org/p/chromium/issues/detail?id=655342
     */
    return new Promise(function (resolve) {
      audioElement.addEventListener('canplaythrough', resolve);
    }).then(function () {
      return (self._isSinkSupported ? audioElement.setSinkId(sinkId) : Promise.resolve()).then(function setSinkIdSuccess() {
        self._activeEls.set(sinkId, audioElement);

        // Stop has been called, bail out
        if (!self._playPromise) {
          return Promise.resolve();
        }
        return self._playAudioElement(sinkId, forceIsMuted, forceShouldLoop);
      });
    });
  }));

  return playPromise;
};

/**
 * Stop playing the sound.
 */
Sound.prototype._stop = function _stop() {
  var _this2 = this;

  this._activeEls.forEach(function (audioEl, sinkId) {
    if (_this2._sinkIds.includes(sinkId)) {
      audioEl.pause();
      audioEl.currentTime = 0;
    } else {
      // Destroy the ones that are not used anymore
      destroyAudioElement(audioEl);
      _this2._activeEls.delete(sinkId);
    }
  });

  clearTimeout(this._maxDurationTimeout);

  this._playPromise = null;
  this._maxDurationTimeout = null;
};

/**
 * Update the sinkIds of the audio output devices this sound should play through.
 */
Sound.prototype.setSinkIds = function setSinkIds(ids) {
  if (!this._isSinkSupported) {
    return;
  }

  ids = ids.forEach ? ids : [ids];
  [].splice.apply(this._sinkIds, [0, this._sinkIds.length].concat(ids));
};

/**
 * Add a stop operation to the queue
 */
Sound.prototype.stop = function stop() {
  var _this3 = this;

  this._operations.enqueue(function () {
    _this3._stop();
    return Promise.resolve();
  });
};

/**
 * Add a play operation to the queue
 */
Sound.prototype.play = function play() {
  var _this4 = this;

  return this._operations.enqueue(function () {
    return _this4._play();
  });
};

module.exports = Sound;