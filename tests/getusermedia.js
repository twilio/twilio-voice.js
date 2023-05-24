const sinon = require('sinon');
const assert = require('assert');
const getUserMedia = require('../lib/twilio/rtc/getusermedia').default;

context('navigatorhelper', () => {
  context('getUserMedia', () => {
    const ERROR_MEDIA_NOT_SUPPORTED = 'getUserMedia is not supported';
    const E_ERROR = new Error('Expected error');
    const E_CONSTRAINTS = 'Expected constraints';
    const E_STREAM = 'Expected stream';

    let navigator = null;
    let options = null;

    beforeEach(() => {
      navigator = {
        getUserMedia: null,
        mozGetUserMedia: null,
        webkitGetUserMedia: null,
        mediaDevices: {
          getUserMedia: null
        }
      };
      options = {
        isFirefox: sinon.stub().returns(false),
        navigator
      };
    });

    it('Should resolve when navigator getUserMedia is a function and calls success callback', done => {
      navigator.getUserMedia = sinon.stub().callsArgWith(1, E_STREAM);
      getUserMedia(E_CONSTRAINTS, options).then(aStream => {
        assert.equal(aStream, E_STREAM);
        assert(navigator.getUserMedia.calledWithExactly(E_CONSTRAINTS, sinon.match.func, sinon.match.func));
      }).then(done).catch(done);
    });

    it('Should resolve when navigator mozGetUserMedia is a function and calls success callback', done => {
      navigator.mozGetUserMedia = sinon.stub().callsArgWith(1, E_STREAM);
      getUserMedia(E_CONSTRAINTS, options).then(aStream => {
        assert.equal(aStream, E_STREAM);
        assert(navigator.mozGetUserMedia.calledWithExactly(E_CONSTRAINTS, sinon.match.func, sinon.match.func));
      }).then(done).catch(done);
    });

    it('Should resolve when navigator webkitGetUserMedia is a function and calls success callback', done => {
      navigator.webkitGetUserMedia = sinon.stub().callsArgWith(1, E_STREAM);
      getUserMedia(E_CONSTRAINTS, options).then(aStream => {
        assert.equal(aStream, E_STREAM);
        assert(navigator.webkitGetUserMedia.calledWith(E_CONSTRAINTS, sinon.match.func, sinon.match.func));
      }).then(done).catch(done);
    });

    it('Should resolve when navigator mediaDevices is object with getUserMedia function that does not throw errors', done => {
      navigator.mediaDevices.getUserMedia = sinon.stub().returns(E_STREAM);
      getUserMedia(E_CONSTRAINTS, options).then(aStream => {
        assert.equal(aStream, E_STREAM);
        assert(navigator.mediaDevices.getUserMedia.calledWithExactly(E_CONSTRAINTS));
      }).then(done).catch(done);
    });

    it('Should reject when navigator is empty object and not supported', done => {
      navigator = {};
      getUserMedia(E_CONSTRAINTS, options).catch(aError => {
        assert.equal(aError.message, ERROR_MEDIA_NOT_SUPPORTED);
      }).then(done).catch(done);
    });

    it('Should reject when navigator is undefined and not supported', done => {
      navigator = undefined;
      getUserMedia(E_CONSTRAINTS, options).catch(aError => {
        assert.equal(aError.message, ERROR_MEDIA_NOT_SUPPORTED);
      }).then(done).catch(done);
    });

    it('Should reject when navigator is a string', done => {
      navigator = 'undefined';
      getUserMedia(E_CONSTRAINTS, options).catch(aError => {
        assert.equal(aError.message, ERROR_MEDIA_NOT_SUPPORTED);
      }).then(done).catch(done);
    });

    it('Should reject when navigator getUserMedia is a function and calls error callback', done => {
      navigator.getUserMedia = sinon.stub().callsArgWith(2, E_ERROR);
      getUserMedia(E_CONSTRAINTS, options).catch(aError => {
        assert.equal(aError.message, E_ERROR.message);
        assert(navigator.getUserMedia.calledWithExactly(E_CONSTRAINTS, sinon.match.func, sinon.match.func));
      }).then(done).catch(done);
    });

    it('Should reject when navigator getUserMedia is a function that throws error', done => {
      navigator.getUserMedia = sinon.stub().throws(E_ERROR);
      getUserMedia(E_CONSTRAINTS, options).catch(aError => {
        assert.equal(aError.message, E_ERROR.message);
        assert(navigator.getUserMedia.calledWithExactly(E_CONSTRAINTS, sinon.match.func, sinon.match.func));
      }).then(done).catch(done);
    });

    it('Should reject when navigator mozGetUserMedia is a function and calls error callback', done => {
      navigator.mozGetUserMedia = sinon.stub().callsArgWith(2, E_ERROR);
      getUserMedia(E_CONSTRAINTS, options).catch(actualError => {
        assert.equal(actualError.message, E_ERROR.message);
        assert(navigator.mozGetUserMedia.calledWithExactly(E_CONSTRAINTS, sinon.match.func, sinon.match.func));
      }).then(done).catch(done);
    });

    it('Should reject when navigator mozGetUserMedia is a function and throws error', done => {
      navigator.mozGetUserMedia = sinon.stub().throws(E_ERROR);
      getUserMedia(E_CONSTRAINTS, options).catch(aError => {
        assert.equal(aError.message, E_ERROR.message);
        assert(navigator.mozGetUserMedia.calledWithExactly(E_CONSTRAINTS, sinon.match.func, sinon.match.func));
      }).then(done).catch(done);
    });

    it('Should reject when navigator webkitGetUserMedia is a function and calls error callback', done => {
      navigator.webkitGetUserMedia = sinon.stub().callsArgWith(2, E_ERROR);
      getUserMedia(E_CONSTRAINTS, options).catch(aError => {
        assert.equal(aError.message, E_ERROR.message);
        assert(navigator.webkitGetUserMedia.calledWithExactly(E_CONSTRAINTS, sinon.match.func, sinon.match.func));
      }).then(done).catch(done);
    });

    it('Should reject when navigator webkitGetUserMedia is a function and throws error', done => {
      navigator.webkitGetUserMedia = sinon.stub().throws(E_ERROR);
      getUserMedia(E_CONSTRAINTS, options).catch(aError => {
        assert.equal(aError.message, E_ERROR.message);
        assert(navigator.webkitGetUserMedia.calledWithExactly(E_CONSTRAINTS, sinon.match.func, sinon.match.func));
      }).then(done).catch(done);
    });

    it('Should reject when navigator mediaDevices is object with getUserMedia function that throws error', done => {
      navigator.mediaDevices.getUserMedia = sinon.stub().throws(E_ERROR);
      getUserMedia(E_CONSTRAINTS, options).catch(actualError => {
        assert.equal(actualError.message, E_ERROR.message);
        assert(navigator.mediaDevices.getUserMedia.calledWithExactly(E_CONSTRAINTS));
      }).then(done).catch(done);
    });

  });
});
