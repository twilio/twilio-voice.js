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

/**
 * Read the account SID and identity from a Twilio JWT, so two tokens can be
 * compared. Only the payload segment is decoded (base64url -> base64, then
 * `atob` and `JSON.parse`, as Device does for `connectToken`); the signature is
 * not verified.
 *
 * - Access Token: account SID from `sub`, identity from `grants.identity`.
 * - Capability Token: account SID from `iss`, identity from the first
 *   `clientName` parameter in `scope`.
 *
 * Non-ASCII characters are not UTF-8 decoded. The values are only compared,
 * and the same bytes always produce the same string.
 * @param {string} token
 * @returns {{accountSid: string, identity: (string|null)}|null} null when the
 *   token cannot be decoded or has no account SID.
 */
function getTokenPrincipal(token) {
  try {
    const parts = typeof token === 'string' ? token.split('.') : [];
    if (parts.length !== 3) { return null; }

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64 + '==='.slice((base64.length + 3) % 4)));
    if (!payload || typeof payload !== 'object') { return null; }

    const accountSid = typeof payload.sub === 'string' ? payload.sub : payload.iss;
    if (typeof accountSid !== 'string' || !accountSid) { return null; }

    let identity = null;
    if (payload.grants && typeof payload.grants === 'object') {
      identity = typeof payload.grants.identity === 'string' ? payload.grants.identity : null;
    } else if (typeof payload.scope === 'string') {
      payload.scope.split(' ').some(scope => {
        const query = scope.split('?')[1];
        const clientName = query ? queryToJson(query).clientName : undefined;
        if (typeof clientName === 'string' && clientName) {
          identity = clientName;
          return true;
        }
        return false;
      });
    }

    return { accountSid, identity };
  } catch (e) {
    return null;
  }
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
  queryToJson,
  flatMap,
  getTokenPrincipal,
  promisifyEvents,
  sortByMimeTypes,
};
