// @ts-nocheck

/**
 * Exception class.
 * @class
 * @name Exception
 * @exports Exception as Twilio.Exception
 * @memberOf Twilio
 * @param {string} message The exception message
 */
function TwilioException(message) {
  if (!(this instanceof TwilioException)) {
    return new TwilioException(message);
  }
  this.message = message;
}

/**
 * Returns the exception message.
 *
 * @return {string} The exception message.
 */
TwilioException.prototype.toString = function() {
  return `Twilio.Exception: ${this.message}`;
};

function average(values) {
  return values && values.length ? values.reduce((t, v) => t + v) / values.length : 0;
}

function difference(lefts, rights, getKey?) {
  getKey = getKey || (a => a);
  const rightKeys = new Set(rights.map(getKey));
  return lefts.filter(left => !rightKeys.has(getKey(left)));
}

function isElectron(navigator) {
  return !!navigator.userAgent.match('Electron');
}

function isChrome(window, navigator) {
  const isCriOS = !!navigator.userAgent.match('CriOS');
  const isHeadlessChrome = !!navigator.userAgent.match('HeadlessChrome');
  const isGoogle = typeof window.chrome !== 'undefined'
    && navigator.vendor === 'Google Inc.'
    && navigator.userAgent.indexOf('OPR') === -1
    && navigator.userAgent.indexOf('Edge') === -1;

  return isCriOS || isElectron(navigator) || isGoogle || isHeadlessChrome;
}

function isFirefox(navigator?) {
  navigator = navigator || (typeof window === 'undefined'
    ? global.navigator : window.navigator);

  return !!(navigator) && typeof navigator.userAgent === 'string'
    && /firefox|fxios/i.test(navigator.userAgent);
}

/**
 * Chromium-based Edge has a user-agent of "Edg/" where legacy Edge has a
 * user-agent of "Edge/".
 */
function isLegacyEdge(navigator?) {
  navigator = navigator || (typeof window === 'undefined'
    ? global.navigator : window.navigator);

  return !!(navigator) && typeof navigator.userAgent === 'string'
    && /edge\/\d+/i.test(navigator.userAgent);
}

function isSafari(navigator) {
  return !!(navigator.vendor) && navigator.vendor.indexOf('Apple') !== -1
    && navigator.userAgent
    && navigator.userAgent.indexOf('CriOS') === -1
    && navigator.userAgent.indexOf('FxiOS') === -1;
}

function isUnifiedPlanDefault(window, navigator, PeerConnection, RtpTransceiver) {
  if (typeof window === 'undefined'
    || typeof navigator === 'undefined'
    || typeof PeerConnection === 'undefined'
    || typeof RtpTransceiver === 'undefined'
    || typeof PeerConnection.prototype === 'undefined'
    || typeof RtpTransceiver.prototype === 'undefined') {
    return false;
  }

  if (isChrome(window, navigator) && PeerConnection.prototype.addTransceiver) {
    const pc = new PeerConnection();
    let isUnifiedPlan = true;
    try {
      pc.addTransceiver('audio');
    } catch (e) {
      isUnifiedPlan = false;
    }
    pc.close();
    return isUnifiedPlan;
  } else if (isFirefox(navigator)) {
    return true;
  } else if (isSafari(navigator)) {
    return 'currentDirection' in RtpTransceiver.prototype;
  }

  // Edge currently does not support unified plan.
  // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/17733189/
  // https://wpdev.uservoice.com/forums/257854-microsoft-edge-developer/suggestions/34451998-sdp-unified-plan

  return false;
}

function queryToJson(params) {
  if (!params) {
    return '';
  }

  return params.split('&').reduce((output, pair) => {
    const parts = pair.split('=');
    const key = parts[0];
    const value = decodeURIComponent((parts[1] || '').replace(/\+/g, '%20'));

    if (key) { output[key] = value; }
    return output;
  }, { });
}

/**
 * Map a list to an array of arrays, and return the flattened result.
 * @param {Array<*>|Set<*>|Map<*>} list
 * @param {function(*): Array<*>} [mapFn]
 * @returns Array<*>
 */
function flatMap(list, mapFn) {
  const listArray = list instanceof Map || list instanceof Set
    ? Array.from(list.values())
    : list;

  mapFn = mapFn || (item => item);

  return listArray.reduce((flattened, item) => {
    const mapped = mapFn(item);
    return flattened.concat(mapped);
  }, []);
}

/**
 * Converts an EventEmitter's events into a promise and automatically
 * cleans up handlers once the promise is resolved or rejected.
 */
function promisifyEvents(emitter, resolveEventName, rejectEventName) {
  return new Promise((resolve, reject) => {
    function resolveHandler() {
      emitter.removeListener(rejectEventName, rejectHandler);
      resolve();
    }
    function rejectHandler() {
      emitter.removeListener(resolveEventName, resolveHandler);
      reject();
    }
    emitter.once(resolveEventName, resolveHandler);
    emitter.once(rejectEventName, rejectHandler);
  });
}

function sortByMimeTypes(codecs, preferredOrder) {
  const preferredCodecs = preferredOrder.map(codec => 'audio/' + codec.toLowerCase());
  return codecs.sort((a, b) => {
    const indexA = preferredCodecs.indexOf(a.mimeType.toLowerCase());
    const indexB = preferredCodecs.indexOf(b.mimeType.toLowerCase());
    const orderA = indexA >= 0 ? indexA : Number.MAX_VALUE;
    const orderB = indexB >= 0 ? indexB : Number.MAX_VALUE;
    return orderA - orderB;
  });
}

const Exception = TwilioException;

export {
  Exception,
  average,
  difference,
  isElectron,
  isChrome,
  isFirefox,
  isLegacyEdge,
  isSafari,
  isUnifiedPlanDefault,
  queryToJson,
  flatMap,
  promisifyEvents,
  sortByMimeTypes,
};
