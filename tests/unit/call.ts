import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import * as assert from 'assert';
import { EventEmitter } from 'events';
import { SinonFakeTimers, SinonSpy, SinonStubbedInstance } from 'sinon';
import * as sinon from 'sinon';
import { GeneralErrors, MediaErrors, InvalidStateError, InvalidArgumentError, TwilioError } from '../../lib/twilio/errors';

const Util = require('../../lib/twilio/util');

/* tslint:disable-next-line */
describe('Call', function() {
  let audioHelper: any;
  let callback: Function;
  let clock: SinonFakeTimers;
  let config: Call.Config;
  let conn: Call;
  let mediaHandler: any;
  let monitor: any;
  let onIgnore: any;
  let options: Call.Options;
  let pstream: any;
  let publisher: any;
  let rtcConfig: RTCConfiguration;
  let soundcache: Map<Device.SoundName, any>;
  let voiceEventSidGenerator: () => string;

  const wait = (timeout?: number) => new Promise(r => setTimeout(r, timeout || 0));

  const MediaHandler = () => {
    mediaHandler = createEmitterStub(require('../../lib/twilio/rtc/peerconnection').default);
    mediaHandler.setInputTracksFromStream = sinon.spy((rejectCode?: number) => {
      return rejectCode ? Promise.reject({ code: rejectCode }) : Promise.resolve();
    });
    mediaHandler.answerIncomingCall = sinon.spy((a: any, b: any, c: RTCConfiguration, cb: Function) => {
      callback = cb;
      rtcConfig = c;
    });
    mediaHandler.openDefaultDeviceWithConstraints = sinon.spy(() => Promise.resolve());
    mediaHandler.stream = Symbol('stream');
    mediaHandler._remoteStream = Symbol('_remoteStream');
    mediaHandler.isMuted = false;
    mediaHandler.mute = sinon.spy((shouldMute: boolean) => { mediaHandler.isMuted = shouldMute; });
    mediaHandler.version = {pc: {}, getSDP: () =>
      'a=rtpmap:1337 opus/48000/2\na=rtpmap:0 PCMU/8000\na=fmtp:0\na=fmtp:1337 maxaveragebitrate=12000'};
    return mediaHandler;
  };

  const StatsMonitor: any = () => monitor = createEmitterStub(require('../../lib/twilio/statsMonitor').default);

  afterEach(() => {
    clock.restore();
  });

  beforeEach(() => {
    clock = sinon.useFakeTimers(Date.now());

    audioHelper = createEmitterStub(require('../../lib/twilio/audiohelper').default);
    onIgnore = sinon.spy();
    pstream = createEmitterStub(require('../../lib/twilio/pstream').default);
    publisher = createEmitterStub(require('../../lib/twilio/eventpublisher').default);
    publisher.postMetrics = sinon.spy(() => Promise.resolve());

    pstream.transport = {
      on: sinon.stub()
    };

    soundcache = new Map()
    Object.values(Device.SoundName).forEach((soundName: Device.SoundName) => {
      soundcache.set(soundName, { play: sinon.spy() });
    });

    voiceEventSidGenerator = sinon.stub().returns('foobar-voice-event-sid');

    config = {
      audioHelper,
      onIgnore,
      publisher,
      pstream,
      soundcache,
    };

    options = {
      enableImprovedSignalingErrorPrecision: false,
      MediaHandler,
      StatsMonitor,
      voiceEventSidGenerator,
    };

    conn = new Call(config, options);
  });

  describe('constructor', () => {
    it('should set .parameters to options.callParameters', () => {
      const callParameters = { foo: 'bar' };
      conn = new Call(config, Object.assign(options, { callParameters }));
      assert.equal(conn.parameters, callParameters);
    });

    it('should convert options.twimlParams to .customParameters as a Map<string, string>', () => {
      conn = new Call(config, Object.assign(options, { twimlParams: {
        foo: 'bar',
        baz: 123,
      }}));
      assert.equal(conn.customParameters.get('foo'), 'bar');
      assert.equal(conn.customParameters.get('baz'), 123);
    });

    it('should set MediaStream to null by default', () => {
      assert.equal(conn['_options'].MediaStream, null);
    });

    it('should set MediaStream to "foo" if passed in as "foo"', () => {
      conn = new Call(config, Object.assign(options, { MediaStream: 'foo' }));
      assert.equal(conn['_options'].MediaStream, 'foo');
    });

    context('connectToken', () => {
      it('should return undefined if callsid is missing', () => {
        conn = new Call(config, Object.assign(options, { reconnectToken: 'testReconnectToken' }));
        assert.equal(conn.connectToken, undefined);
      });

      it('should return undefined if reconnectToken is missing', () => {
        conn = new Call(config, Object.assign(options, { callParameters: { CallSid: 'CA123' }}));
        assert.equal(conn.connectToken, undefined);
      });

      it('should return a base64 string if customParameters is missing', () => {
        conn = new Call(config, Object.assign(options, {
          callParameters: { CallSid: 'CA123', foo: 'foo', bar: '我不吃蛋' }, reconnectToken: 'testReconnectToken'
        }));
        assert.equal(conn.connectToken, btoa(encodeURIComponent(JSON.stringify({
          customParameters: {},
          parameters: { CallSid: 'CA123', foo: 'foo', bar: '我不吃蛋' },
          signalingReconnectToken: 'testReconnectToken',
        }))));
      });

      it('should return a base64 string if there is a customParameters', () => {
        conn = new Call(config, Object.assign(options, {
          callParameters: { CallSid: 'CA123', foo: 'foo', bar: '我不吃蛋' },
          reconnectToken: 'testReconnectToken',
          twimlParams: { To: 'foo' },
        }));
        assert.equal(conn.connectToken, btoa(encodeURIComponent(JSON.stringify({
          customParameters: { To: 'foo' },
          parameters: { CallSid: 'CA123', foo: 'foo', bar: '我不吃蛋' },
          signalingReconnectToken: 'testReconnectToken',
        }))));
      });
    });

    context('when incoming', () => {
      it('should send incoming event to insights', () => {
        conn = new Call(config, Object.assign(options, { callParameters: {
          CallSid: 'CA123'
        }}));
        assert.equal(publisher.info.lastCall.args[1], 'incoming');
      });

      it('should populate the .callerInfo fields appropriately when StirStatus is A', () => {
        conn = new Call(config, Object.assign(options, { callParameters: {
          StirStatus: 'TN-Validation-Passed-A',
          CallSid: 'CA123',
          From: '929-321-2323',
        }}));
        let callerInfo: Call.CallerInfo;
        if (conn.callerInfo !== null) {
          callerInfo = conn.callerInfo;
          assert.equal(callerInfo.isVerified, true);
        } else {
          throw Error('callerInfo object null, but expected to be populated');
        }
      });

      it('should populate the .callerInfo fields appropriately when StirStatus is B', () => {
        conn = new Call(config, Object.assign(options, { callParameters: {
          StirStatus: 'TN-Validation-Passed-B',
          CallSid: 'CA123',
          From: '1-929-321-2323',
        }}));
        let callerInfo: Call.CallerInfo;
        if (conn.callerInfo !== null) {
          callerInfo = conn.callerInfo;
          assert.equal(callerInfo.isVerified, false);
        } else {
          throw Error('callerInfo object null, but expected to be populated');
        }
      });

      it('should populate the .callerInfo fields appropriately when StirStatus is C', () => {
        conn = new Call(config, Object.assign(options, { callParameters: {
          StirStatus: 'TN-Validation-Passed-C',
          CallSid: 'CA123',
          From: '1 (929) 321-2323',
        }}));
        let callerInfo: Call.CallerInfo;
        if (conn.callerInfo !== null) {
          callerInfo = conn.callerInfo;
          assert.equal(callerInfo.isVerified, false);
        } else {
          throw Error('callerInfo object null, but expected to be populated');
        }
      });

      it('should populate the .callerInfo fields appropriately when StirStatus is failed-A', () => {
        conn = new Call(config, Object.assign(options, { callParameters: {
          StirStatus: 'TN-Validation-Failed-A',
          CallSid: 'CA123',
          From: '1 (929) 321 2323',
        }}));
        let callerInfo: Call.CallerInfo;
        if (conn.callerInfo !== null) {
          callerInfo = conn.callerInfo;
          assert.equal(callerInfo.isVerified, false);
        } else {
          throw Error('callerInfo object null, but expected to be populated');
        }
      });

      it('should populate the .callerInfo fields appropriately when StirStatus is failed-B', () => {
        conn = new Call(config, Object.assign(options, { callParameters: {
          StirStatus: 'TN-Validation-Failed-B',
          CallSid: 'CA123',
          From: '1 929 321 2323',
        }}));
        let callerInfo: Call.CallerInfo;
        if (conn.callerInfo !== null) {
          callerInfo = conn.callerInfo;
          assert.equal(callerInfo.isVerified, false);
        } else {
          throw Error('callerInfo object null, but expected to be populated');
        }
      });

      it('should populate the .callerInfo fields appropriately when StirStatus is failed-C', () => {
        conn = new Call(config, Object.assign(options, { callParameters: {
          StirStatus: 'TN-Validation-Failed-C',
          CallSid: 'CA123',
          From: '19293212323',
        }}));
        let callerInfo: Call.CallerInfo;
        if (conn.callerInfo !== null) {
          callerInfo = conn.callerInfo;
          assert.equal(callerInfo.isVerified, false);
        } else {
          throw Error('callerInfo object null, but expected to be populated');
        }
      });

      it('should populate the .callerInfo fields appropriately when StirStatus is no-validation', () => {
        conn = new Call(config, Object.assign(options, { callParameters: {
          StirStatus: 'TN-No-Validation',
          CallSid: 'CA123',
          From: '+19293212323',
        }}));
        let callerInfo: Call.CallerInfo;
        if (conn.callerInfo !== null) {
          callerInfo = conn.callerInfo;
          assert.equal(callerInfo.isVerified, false);
        } else {
          throw Error('callerInfo object null, but expected to be populated');
        }
      });

      it('should set .callerInfo to null when StirStatus is undefined', () => {
        conn = new Call(config, Object.assign(options, { callParameters: {
          CallSid: 'CA123',
          From: '19293212323',
        }}));
        assert.equal(conn.callerInfo, null);
      });

      describe('when From is not a number', () => {
        it('should populate the .callerInfo fields appropriately when StirStatus is A', () => {
          conn = new Call(config, Object.assign(options, { callParameters: {
            StirStatus: 'TN-Validation-Passed-A',
            CallSid: 'CA123',
            From: 'client:alice',
          }}));
          let callerInfo: Call.CallerInfo;
          if (conn.callerInfo !== null) {
            callerInfo = conn.callerInfo;
            assert.equal(callerInfo.isVerified, true);
          } else {
            throw Error('callerInfo object null, but expected to be populated');
          }
        });

        it('should populate the .callerInfo fields appropriately when StirStatus is failed-A', () => {
          conn = new Call(config, Object.assign(options, { callParameters: {
            StirStatus: 'TN-Validation-Failed-A',
            CallSid: 'CA123',
            From: 'client:alice',
          }}));
          let callerInfo: Call.CallerInfo;
          if (conn.callerInfo !== null) {
            callerInfo = conn.callerInfo;
            assert.equal(callerInfo.isVerified, false);
          } else {
            throw Error('callerInfo object null, but expected to be populated');
          }
        });
      });

      describe('when additional parameters are supplied', () => {
        it('should populate the .callerInfo fields appropriately when DisplayName is supplied', () => {
          conn = new Call(config, Object.assign(options, { callParameters: {
            StirStatus: 'TN-Validation-Passed-A',
            CallSid: 'CA123',
            From: 'client:alice',
            DisplayName: 'foo bar baz',
          }}));
          let callerInfo: Call.CallerInfo;
          if (conn.callerInfo !== null) {
            callerInfo = conn.callerInfo;
            assert.equal(callerInfo.isVerified, true);
          } else {
            throw Error('callerInfo object null, but expected to be populated');
          }
        });

        it('should populate the .callerInfo fields appropriately when a long string is supplied', () => {
          conn = new Call(config, Object.assign(options, { callParameters: {
            StirStatus: 'TN-Validation-Passed-A',
            CallSid: 'CA123',
            From: 'client:alice',
            DisplayName: Array(100).fill('foo bar baz').join(','),
          }}));
          let callerInfo: Call.CallerInfo;
          if (conn.callerInfo !== null) {
            callerInfo = conn.callerInfo;
            assert.equal(callerInfo.isVerified, true);
          } else {
            throw Error('callerInfo object null, but expected to be populated');
          }
        });
      });
    });

    context('when outgoing', () => {
      it('should send default outgoing event to insights', () => {
        conn = new Call(config, Object.assign(options, { preflight: true }));
        const args = publisher.info.lastCall.args;
        assert.equal(args[1], 'outgoing');
        assert.deepEqual(args[2], { preflight: true, reconnect: false })
      });

      it('should send outgoing event to insights with reconnect set to true', () => {
        conn = new Call(config, Object.assign(options, { preflight: true, reconnectCallSid: 'foo' }));
        const args = publisher.info.lastCall.args;
        assert.equal(args[1], 'outgoing');
        assert.deepEqual(args[2], { preflight: true, reconnect: true })
      });

      it('should populate the .callerInfo fields', () => {
        conn = new Call(config, Object.assign(options, { callParameters: {
          StirStatus: 'TN-Validation-Passed-A',
        }}));
        assert.equal(conn.callerInfo!.isVerified, true);
      });

      it('should not populate the .callerInfo fields, instead return null', () => {
        conn = new Call(config, Object.assign(options, { }));
        assert.equal(conn.callerInfo, null);
      });
    });

    it('should set .direction to CallDirection.Outgoing if there is no CallSid', () => {
      const callParameters = { foo: 'bar' };
      conn = new Call(config, Object.assign(options, { callParameters }));
      assert.equal(conn.direction, Call.CallDirection.Outgoing);
    });

    it('should set .direction to CallDirection.Outgoing if there is a CallSid and a reconnectCallSid', () => {
      const callParameters = { CallSid: 'CA1234' };
      conn = new Call(config, Object.assign(options, { callParameters, reconnectCallSid: 'CA1234' }));
      assert.equal(conn.direction, Call.CallDirection.Outgoing);
    });

    it('should set .direction to CallDirection.Incoming if there is a CallSid', () => {
      const callParameters = { CallSid: 'CA1234' };
      conn = new Call(config, Object.assign(options, { callParameters }));
      assert.equal(conn.direction, Call.CallDirection.Incoming);
    });

    it('should disable monitor warnings', () => {
      sinon.assert.calledOnce(monitor.disableWarnings);
    });

    it('should enable monitor warnings after 5000 ms', () => {
      clock.tick(5000 - 10);
      sinon.assert.notCalled(monitor.enableWarnings);
      clock.tick(20);
      sinon.assert.calledOnce(monitor.enableWarnings);
    });
  });

  describe('.accept', () => {
    [
      Call.State.Open,
      Call.State.Connecting,
      Call.State.Ringing,
      Call.State.Closed,
    ].forEach((state: Call.State) => {
      context(`when state is ${state}`, () => {
        beforeEach(() => {
          (conn as any)['_status'] = state;
        });

        it('should not transition state', () => {
          conn.accept();
          assert.equal(conn.status(), state);
        });

        it('should not call mediaHandler.openDefaultDeviceWithConstraints', () => {
          conn.accept();
          sinon.assert.notCalled(mediaHandler.openDefaultDeviceWithConstraints);
        });
      });
    });

    it('should transition state to Connecting', () => {
      conn.accept();
      assert.equal(conn.status(), Call.State.Connecting);
    });

    context('when getInputStream is not present', () => {
      it('should call mediaHandler.openDefaultDeviceWithConstraints with rtcConstraints if passed', () => {
        conn.accept({ rtcConstraints: { audio: { foo: 'bar' } as MediaTrackConstraints } });
        sinon.assert.calledWith(mediaHandler.openDefaultDeviceWithConstraints, { audio: { foo: 'bar' } });
      });

      it('should call mediaHandler.openDefaultDeviceWithConstraints with options.audioConstraints if no args', () => {
        Object.assign(options, { rtcConstraints: { audio: { bar: 'baz' } } });
        conn = new Call(config, options);
        conn.accept();
        sinon.assert.calledWith(mediaHandler.openDefaultDeviceWithConstraints, { audio: { bar: 'baz' } });
      });

      it('should result in a `denied` error when `getUserMedia` does not allow the application to access the media', () => {
        return new Promise<void>(resolve => {
          mediaHandler.openDefaultDeviceWithConstraints = () => {
            const p = Promise.reject({
              code: 0,
              name: 'NotAllowedError',
              message: 'Permission denied',
            });
            p.catch(() => resolve());
            return p;
          }

          conn.accept();
        }).then(() => {
          sinon.assert.calledWith(publisher.error, 'get-user-media', 'denied');
        });
      });
    });

    context('when getInputStream is present and succeeds', () => {
      let getInputStream: any;
      let wait: Promise<any>;

      beforeEach(() => {
        getInputStream = sinon.spy(() => 'foo');
        Object.assign(options, { getInputStream });
        conn = new Call(config, options);

        mediaHandler.setInputTracksFromStream = sinon.spy(() => {
          const p = Promise.resolve();
          wait = p.then(() => Promise.resolve());
          return p;
        });
      });

      it('should call mediaHandler.setInputTracksFromStream', () => {
        conn.accept();
        sinon.assert.calledWith(mediaHandler.setInputTracksFromStream, 'foo');
      });

      it('should publish a get-user-media succeeded event', () => {
        conn.accept();
        return wait.then(() => {
          sinon.assert.calledWith(publisher.info, 'get-user-media', 'succeeded');
        });
      });

      context('when incoming', () => {
        beforeEach(() => {
          getInputStream = sinon.spy(() => 'foo');
          Object.assign(options, {
            getInputStream,
            callParameters: { CallSid: 'CA123' },
            rtcConfiguration: {
              foo: 'bar',
              sdpSemantics: 'unified-plan',
            },
          });
          conn = new Call(config, options);

          mediaHandler.setInputTracksFromStream = sinon.spy(() => {
            const p = Promise.resolve();
            wait = p.then(() => Promise.resolve());
            return p;
          });
        });

        it('should call mediaHandler.answerIncomingCall', () => {
          conn.accept();
          return wait.then(() => {
            sinon.assert.calledOnce(mediaHandler.answerIncomingCall);
          });
        });

        it('should call mediaHandler.answerIncomingCall with override `rtcConfiguration`', () => {
          const rtcConfiguration = {
            iceServers: [{ urls: 'foo-ice-server-url' }],
          };
          conn.accept({ rtcConfiguration });
          return wait.then(() => {
            assert.deepEqual(mediaHandler.answerIncomingCall.args[0][2], rtcConfiguration);
          });
        });

        context('when the success callback is called', () => {
          it('should publish an accepted-by-local event', () => {
            conn.accept();
            return wait.then(() => {
              callback('foo');
              sinon.assert.calledWith(publisher.info, 'connection', 'accepted-by-local');
            });
          });

          it('should publish a settings:codec event', () => {
            conn.accept();
            return wait.then(() => {
              callback('foo');
              sinon.assert.calledWith(publisher.info, 'settings', 'codec', {
                codec_params: 'maxaveragebitrate=12000',
                selected_codec: 'opus/48000/2',
              });
            });
          });

          it('should call monitor.enable', () => {
            conn.accept();
            return wait.then(() => {
              callback('foo');
              sinon.assert.calledWith(monitor.enable, 'foo');
            });
          });
        });
      });

      context('when outgoing', () => {
        let callback: Function;

        const setup = (callOptions = {}) => {
          getInputStream = sinon.spy(() => 'foo');
          Object.assign(options, { getInputStream, ...callOptions });
          options.twimlParams = {
            To: 'foo',
            a: undefined,
            b: true,
            c: false,
            d: '',
            e: 123,
            f: '123',
            g: null,
            h: 'undefined',
            i: 'null',
            j: 0,
            k: '0',
            l: 'a$b&c?d=e',
          };
          conn = new Call(config, options);

          mediaHandler.setInputTracksFromStream = sinon.spy(() => {
            const p = Promise.resolve();
            wait = p.then(() => Promise.resolve());
            return p;
          });

          mediaHandler.makeOutgoingCall = sinon.spy((a: any, b: any, c: any, d: any, _callback: Function) => {
            callback = _callback;
          });
        };

        beforeEach(() => setup());

        it('should call mediaHandler.makeOutgoingCall with correctly encoded params', () => {
          conn.accept();
          return wait.then(() => {
            sinon.assert.calledOnce(mediaHandler.makeOutgoingCall);
            assert.equal(mediaHandler.makeOutgoingCall.args[0][0],
              'To=foo&a=undefined&b=true&c=false&d=&e=123&f=123&g=null&h=undefined&i=null&j=0&k=0&l=a%24b%26c%3Fd%3De');
          });
        });

        it('should call mediaHandler.makeOutgoingCall with a reconnectToken', () => {
          setup({ reconnectToken: 'testReconnectToken' });
          conn.accept();
          return wait.then(() => {
            sinon.assert.calledOnce(mediaHandler.makeOutgoingCall);
            assert.equal(mediaHandler.makeOutgoingCall.args[0][1],
              'testReconnectToken');
          });
        });

        it('should call mediaHandler.makeOutgoingCall with a temp callsid', () => {
          conn.accept();
          return wait.then(() => {
            sinon.assert.calledOnce(mediaHandler.makeOutgoingCall);
            assert.equal(mediaHandler.makeOutgoingCall.args[0][2],
              conn.outboundConnectionId);
          });
        });

        it('should call mediaHandler.makeOutgoingCall with a reconnect callsid', () => {
          setup({ reconnectCallSid: 'testReconnectCallsid' });
          conn.accept();
          return wait.then(() => {
            sinon.assert.calledOnce(mediaHandler.makeOutgoingCall);
            assert.equal(mediaHandler.makeOutgoingCall.args[0][2],
              'testReconnectCallsid');
          });
        });

        it('should call mediaHandler.makeOutgoingCall with an override `rtcConfiguration`', () => {
          const rtcConfiguration = {
            iceServers: [{ urls: 'foo-ice-server-url' }],
          };
          conn.accept({ rtcConfiguration });
          return wait.then(() => {
            assert.deepEqual(mediaHandler.makeOutgoingCall.args[0][3], rtcConfiguration);
          });
        });

        context('when the success callback is called', () => {
          it('should publish an accepted-by-remote event', () => {
            conn.accept();
            return wait.then(() => {
              callback('foo');
              sinon.assert.calledWith(publisher.info, 'connection', 'accepted-by-remote');
            });
          });

          it('should publish a settings:codec event', () => {
            conn.accept();
            return wait.then(() => {
              callback('foo');
              sinon.assert.calledWith(publisher.info, 'settings', 'codec', {
                codec_params: 'maxaveragebitrate=12000',
                selected_codec: 'opus/48000/2',
              });
            });
          });

          it('should call monitor.enable', () => {
            conn.accept();
            return wait.then(() => {
              callback('foo');
              sinon.assert.calledWith(monitor.enable, 'foo');
            });
          });
        });
      });

      context('if call state transitions before connect finishes', () => {
        beforeEach(() => {
          mediaHandler.setInputTracksFromStream = sinon.spy(() => {
            (conn as any)['_status'] = Call.State.Closed;
            const p = Promise.resolve();
            wait = p.then(() => Promise.resolve());
            return p;
          });
        });

        it('should call mediaHandler.close', () => {
          conn.accept();
          return wait.then(() => {
            sinon.assert.calledOnce(mediaHandler.close);
          });
        });

        it('should not set a pstream listener for hangup', () => {
          pstream.addListener = sinon.spy();
          conn.accept();
          return wait.then(() => {
            sinon.assert.notCalled(pstream.addListener);
          });
        });
      });
    });

    context('when getInputStream is present and fails with 31208', () => {
      let getInputStream: () => any;
      let wait: Promise<any>;

      beforeEach(() => {
        getInputStream = sinon.spy(() => 'foo');

        Object.assign(options, { getInputStream });
        conn = new Call(config, options);

        mediaHandler.setInputTracksFromStream = sinon.spy(() => {
          const p = Promise.reject({ code: 31208 });
          wait = p.catch(() => Promise.resolve());
          return p;
        });
      });

      it('should publish a get-user-media denied error', () => {
        conn.accept({ rtcConstraints: { audio: { foo: 'bar' } as MediaTrackConstraints } });
        return wait.then(() => {
          sinon.assert.calledWith(publisher.error, 'get-user-media', 'denied');
        });
      });
    });

    context('when getInputStream is present and fails without 31208', () => {
      let getInputStream: () => any;
      let wait: Promise<any>;

      beforeEach(() => {
        getInputStream = sinon.spy(() => 'foo');

        Object.assign(options, { getInputStream });
        conn = new Call(config, options);

        mediaHandler.setInputTracksFromStream = sinon.spy(() => {
          const p = Promise.reject({ });
          wait = p.catch(() => Promise.resolve());
          return p;
        });
      });

      it('should publish a get-user-media failed error', () => {
        conn.accept({ rtcConstraints: { audio: { foo: 'bar' } as MediaTrackConstraints } });
        return wait.then(() => {
          sinon.assert.calledWith(publisher.error, 'get-user-media', 'failed');
        });
      });
    });
  });

  describe('.disconnect()', () => {
    [
      Call.State.Open,
      Call.State.Connecting,
      Call.State.Ringing,
    ].forEach((state: Call.State) => {
      context(`when state is ${state}`, () => {
        beforeEach(() => {
          (conn as any)['_status'] = state;
        });

        it('should call pstream.hangup', () => {
          conn.disconnect();
          sinon.assert.calledWith(pstream.hangup, conn.outboundConnectionId);
        });

        it('should call mediaHandler.close', () => {
          conn.disconnect();
          sinon.assert.calledOnce(mediaHandler.close);
        });

        [
          'ack',
          'answer',
          'cancel',
          'connected',
          'error',
          'hangup',
          'message',
          'ringing',
          'transportClose',
        ].forEach((eventName: string) => {
          it(`should call pstream.removeListener on ${eventName}`, () => {
            conn.disconnect();
            clock.tick(10);
            assert.equal(pstream.listenerCount(eventName), 0);
          });
        });
      });
    });

    [
      Call.State.Pending,
      Call.State.Closed,
    ].forEach((state: Call.State) => {
      context(`when state is ${state}`, () => {
        beforeEach(() => {
          (conn as any)['_status'] = state;
        });

        it('should not call pstream.hangup', () => {
          conn.disconnect();
          sinon.assert.notCalled(pstream.hangup);
        });

        it('should not call mediaHandler.close', () => {
          conn.disconnect();
          sinon.assert.notCalled(mediaHandler.close);
        });
      });
    });
  });

  describe('.getLocalStream()', () => {
    it('should get the local MediaStream from the MediaHandler', () => {
      assert.equal(conn.getLocalStream(), mediaHandler.stream);
    });
  });

  describe('.getRemoteStream()', () => {
    it('should get the local MediaStream from the MediaHandler', () => {
      assert.equal(conn.getRemoteStream(), mediaHandler._remoteStream);
    });
  });

  describe('.ignore()', () => {
    context('when state is pending', () => {
      it('should call mediaHandler.ignore', () => {
        conn.ignore();
        sinon.assert.calledOnce(mediaHandler.ignore);
      });

      it('should transition state to closed', () => {
        conn.ignore();
        assert.equal(conn.status(), Call.State.Closed);
      });

      it('should publish an event to insights', () => {
        conn.ignore();
        sinon.assert.calledWith(publisher.info, 'connection', 'ignored-by-local');
      });

      it('should call the onIgnore callback', () => {
        conn.ignore();
        sinon.assert.called(onIgnore);
      });
    });

    [
      Call.State.Closed,
      Call.State.Connecting,
      Call.State.Open,
      Call.State.Ringing,
    ].forEach((state: Call.State) => {
      context(`when call state is ${state}`, () => {
        beforeEach(() => {
          (conn as any)['_status'] = state;
        });

        it('should not call mediaHandler.ignore', () => {
          conn.ignore();
          sinon.assert.notCalled(mediaHandler.ignore);
        });

        it('should not emit cancel', () => {
          conn.on('cancel', () => { throw new Error('Should not have emitted cancel'); });
          conn.ignore();
        });

        it('should not transition state to closed', () => {
          conn.ignore();
          assert.equal(conn.status(), state);
        });

        it('should not publish an event to insights', () => {
          conn.ignore();
          publisher.info.getCalls().forEach((methodCall: any) => {
            const insightsEventName = methodCall.args[1];
            assert.notEqual(insightsEventName, 'ignored-by-local');
          });
        });
      });
    });
  });

  describe('.isMuted()', () => {
    it('should return isMuted from MediaHandler', () => {
      assert.equal(conn.isMuted(), mediaHandler.isMuted);
    });
  });

  describe('.mute()', () => {
    context('when mediaHandler.isMuted was previously true', () => {
      beforeEach(() => {
        mediaHandler.isMuted = true;
      });

      [true, undefined].forEach((value?: boolean) => {
        context(`when ${value}`, () => {
          it('should call mediaHandler.mute()', () => {
            conn.mute(value);
            sinon.assert.calledOnce(mediaHandler.mute);
            sinon.assert.calledWith(mediaHandler.mute, true);
          });

          it('should not call publisher.info', () => {
            conn.mute(value);
            publisher.info.getCalls().forEach((methodCall: any) => {
              const insightsEventName = methodCall.args[1];
              assert.notEqual(insightsEventName, 'muted');
              assert.notEqual(insightsEventName, 'unmuted');
            });
          });

          it('should not emit mute', () => {
            conn.on('mute', () => { throw new Error('Expected mute to not be emitted'); });
            conn.mute(value);
          });
        });
      });

      context(`when false`, () => {
        it('should call mediaHandler.mute()', () => {
          conn.mute(false);
          sinon.assert.calledOnce(mediaHandler.mute);
          sinon.assert.calledWith(mediaHandler.mute, false);
        });

        it('should call publisher.info', () => {
          conn.mute(false);
          sinon.assert.calledWith(publisher.info, 'connection', 'unmuted');
        });

        it('should emit mute', (done) => {
          conn.on('mute', () => done());
          conn.mute(false);
        });
      });
    });

    context('when mediaHandler.isMuted was previously false', () => {
      beforeEach(() => {
        mediaHandler.isMuted = false;
      });

      [true, undefined].forEach((value?: boolean) => {
        context(`when ${value}`, () => {
          it('should call mediaHandler.mute()', () => {
            conn.mute(value);
            sinon.assert.calledOnce(mediaHandler.mute);
            sinon.assert.calledWith(mediaHandler.mute, true);
          });
        });

        it('should call publisher.info', () => {
          conn.mute(value);
          sinon.assert.calledWith(publisher.info, 'connection', 'muted');
        });

        it('should emit mute', (done) => {
          conn.on('mute', () => done());
          conn.mute(value);
        });
      });

      context(`when false`, () => {
        it('should call mediaHandler.mute()', () => {
          conn.mute(false);
          sinon.assert.calledOnce(mediaHandler.mute);
          sinon.assert.calledWith(mediaHandler.mute, false);
        });

        it('should not call publisher.info', () => {
          conn.mute(false);
          publisher.info.getCalls().forEach((methodCall: any) => {
            const insightsEventName = methodCall.args[1];
            assert.notEqual(insightsEventName, 'muted');
            assert.notEqual(insightsEventName, 'unmuted');
          });
        });

        it('should not emit mute', () => {
          conn.on('mute', () => { throw new Error('Expected mute to not be emitted'); });
          conn.mute(false);
        });
      });
    });
  });

  describe('.reject()', () => {
    context('when state is pending', () => {
      it('should call pstream.reject', () => {
        conn.reject();
        sinon.assert.calledOnce(pstream.reject);
        sinon.assert.calledWith(pstream.reject, conn.parameters.CallSid);
      });

      it('should call mediaHandler.reject', () => {
        conn.reject();
        sinon.assert.calledOnce(mediaHandler.reject);
      });

      it('should call mediaHandler.close', () => {
        conn.reject();
        sinon.assert.calledOnce(mediaHandler.close);
      });

      it('should emit cancel', (done) => {
        conn.on('reject', () => done());
        conn.reject();
      });

      it('should publish an event to insights', () => {
        conn.reject();
        sinon.assert.calledWith(publisher.info, 'connection', 'rejected-by-local');
      });

      it('should transition status to closed', () => {
        conn.reject();
        assert.equal(conn.status(), 'closed');
      });

      it('should not emit a disconnect event', () => {
        const callback = sinon.stub();
        conn['_mediaHandler'].close = () => mediaHandler.onclose();
        conn.on('disconnect', callback);
        conn.reject();
        clock.tick(10);
        sinon.assert.notCalled(callback);
      });

      it('should not play disconnect sound', () => {
        conn['_mediaHandler'].close = () => mediaHandler.onclose();
        conn.reject();
        clock.tick(10);
        sinon.assert.notCalled(soundcache.get(Device.SoundName.Disconnect).play);
      });

      [
        'ack',
        'answer',
        'cancel',
        'connected',
        'error',
        'hangup',
        'message',
        'ringing',
        'transportClose',
      ].forEach((eventName: string) => {
        it(`should call pstream.removeListener on ${eventName}`, () => {
          conn.reject();
          clock.tick(10);
          assert.equal(pstream.listenerCount(eventName), 0);
        });
      });
    });

    [
      Call.State.Closed,
      Call.State.Connecting,
      Call.State.Open,
      Call.State.Ringing,
    ].forEach((state: Call.State) => {
      context(`when call state is ${state}`, () => {
        beforeEach(() => {
          (conn as any)['_status'] = state;
        });

        it('should not call pstream.reject', () => {
          conn.reject();
          sinon.assert.notCalled(pstream.reject);
        });

        it('should not call mediaHandler.reject', () => {
          conn.reject();
          sinon.assert.notCalled(mediaHandler.reject);
        });

        it('should not call mediaHandler.close', () => {
          conn.reject();
          sinon.assert.notCalled(mediaHandler.close);
        });

        it('should not emit reject', () => {
          conn.on('reject', () => { throw new Error('Should not have emitted reject'); });
          conn.reject();
        });

        it('should not publish an event to insights', () => {
          conn.reject();
          publisher.info.getCalls().forEach((methodCall: any) => {
            const insightsEventName = methodCall.args[1];
            assert.notEqual(insightsEventName, 'rejected-by-local');
          });
        });
      });
    });
  });

  describe('.postFeedback()', () => {
    it('should call publisher.info with feedback received-none when called with no arguments', () => {
      conn.postFeedback();
      sinon.assert.calledWith(publisher.info, 'feedback', 'received-none');
    });

    Object.values(Call.FeedbackScore).forEach((score: any) => {
      Object.values(Call.FeedbackIssue).forEach((issue: Call.FeedbackIssue) => {
        it(`should call publisher.info with feedback received-none when called with ${score} and ${issue}`, () => {
          conn.postFeedback(score, issue);
          sinon.assert.calledWith(publisher.info, 'feedback', 'received', {
            issue_name: issue,
            quality_score: score,
          });
        });
      });
    });

    it('should throw if score is invalid', () => {
      assert.throws(() => { (conn as any)['postFeedback'](0); });
    });

    it('should throw if issue is invalid', () => {
      assert.throws(() => { (conn as any)['postFeedback'](Call.FeedbackScore.Five, 'foo'); });
    });
  });

  describe('.sendMessage()', () => {
    let message: Call.Message;

    beforeEach(() => {
      message = {
        content: { foo: 'foo' },
        messageType: 'user-defined-message',
      };
    });

    context('when messageType is invalid', () => {
      [
        undefined,
        null,
        {},
        1234,
        true,
      ].forEach((messageType: any) => {
        it(`should throw on ${JSON.stringify(messageType)}`, () => {
          assert.throws(
            () => conn.sendMessage({ ...message, messageType }),
            new InvalidArgumentError(
              '`messageType` must be a string.',
            ),
          );
        });
      });
    });

    context('when content is invalid', () => {
      [
        undefined,
        null,
      ].forEach((content: any) => {
        it(`should throw on ${JSON.stringify(content)}`, () => {
          assert.throws(
            () => conn.sendMessage({ ...message, content }),
            new InvalidArgumentError('`content` is empty'),
          );
        });
      });
    });

    it('should throw if pstream is unavailable', () => {
      // @ts-ignore
      conn._pstream = null;
      assert.throws(
        () => conn.sendMessage(message),
        new InvalidStateError(
          'Could not send CallMessage; Signaling channel is disconnected',
        ),
      );
    });

    it('should throw if the call sid is not set', () => {
      assert.throws(
        () => conn.sendMessage(message),
        new InvalidStateError(
          'Could not send CallMessage; Call has no CallSid',
        ),
      );
    });

    it('should invoke pstream.sendMessage', () => {
      const mockCallSid = conn.parameters.CallSid = 'foobar-callsid';
      conn.sendMessage(message);
      sinon.assert.calledOnceWithExactly(
        pstream.sendMessage,
        mockCallSid,
        message.content,
        undefined,
        'user-defined-message',
        'foobar-voice-event-sid',
      );
    });

    it('should return voiceEventSid', () => {
      conn.parameters.CallSid = 'foobar-callsid';
      const sid = conn.sendMessage(message);
      assert.strictEqual(sid, 'foobar-voice-event-sid');
    });

    it('should generate a voiceEventSid', () => {
      conn.parameters.CallSid = 'foobar-callsid';
      conn.sendMessage(message);
      sinon.assert.calledOnceWithExactly(
        voiceEventSidGenerator as sinon.SinonStub,
      );
    });
  });

  describe('.sendDigits()', () => {
    context('when digit string is invalid', () => {
      [
        'foo',
        '87309870934z',
        '09-823-',
        'ABC',
        '9 9',
      ].forEach((digits: string) => {
        it(`should throw on '${digits}'`, () => {
          assert.throws(() => conn.sendDigits(digits));
        });
      });
    });

    context('when digit string is valid', () => {
      [
        '12345',
        '1w2w3w',
        '*#*#*#',
        '1#*w23####0099',
      ].forEach((digits: string) => {
        it(`should not throw on '${digits}'`, () => {
          conn.sendDigits(digits);
        });
      });
    });

    it('should call dtmfSender.insertDTMF for each segment', () => {
      const sender = { insertDTMF: sinon.spy() };
      mediaHandler.getOrCreateDTMFSender = () => sender;
      conn.sendDigits('123w456w#*');
      clock.tick(1 + 500 * 3);
      sinon.assert.callCount(sender.insertDTMF, 3);
    });

    describe('when playing sound', () => {
      const digits = '0123w456789w*#w';
      let dialtonePlayer: any;

      [{
        name: 'dialtonePlayer',
        getOptions: () => {
          dialtonePlayer = { play: sinon.stub() };
          options.dialtonePlayer = dialtonePlayer;
          return options;
        },
        assert: (dtmf: string, digit: string) => {
          sinon.assert.callCount(dialtonePlayer.play, digits.replace(/w/g, '').indexOf(digit) + 1);
          sinon.assert.calledWithExactly(dialtonePlayer.play, dtmf);
        },
      },{
        name: 'soundcache',
        getOptions: () => options,
        assert: (dtmf: string) => {
          const playStub = soundcache.get(dtmf as Device.SoundName).play;
          sinon.assert.callCount(playStub, 1);
        },
      },{
        name: 'customSounds',
        getOptions: () => {
          dialtonePlayer = { play: sinon.stub() };

          return {
            ...options,
            dialtonePlayer,
            customSounds: Object.values(Device.SoundName)
              .filter(name => name.includes('dtmf'))
              .reduce((customSounds, name) => {
                customSounds[name] = name;
                return customSounds;
              }, {} as any)
          };
        },
        assert: (dtmf: string, digit: string) => {
          const playStub = soundcache.get(dtmf as Device.SoundName).play;
          sinon.assert.callCount(playStub, 1);
        },
      }].forEach(({ name, assert, getOptions }) => {
        it(`should play the sound for each letter using ${name}`, () => {
          const o = getOptions();
          conn = new Call(config, o);

          const sender = { insertDTMF: sinon.spy() };
          mediaHandler.getOrCreateDTMFSender = () => sender;
          conn.sendDigits(digits);

          clock.tick(1);
          digits.split('').forEach((digit) => {
            if (digit === 'w') {
              clock.tick(200);
              return;
            }
            let dtmf = `dtmf${digit}`;
            if (dtmf === 'dtmf*') { dtmf = 'dtmfs'; }
            if (dtmf === 'dtmf#') { dtmf = 'dtmfh'; }

            assert(dtmf, digit);
            clock.tick(200);
          });
        });
      })
    });

    it('should call pstream.dtmf if connected', () => {
      conn.sendDigits('123');
      sinon.assert.calledWith(pstream.dtmf, conn.parameters.CallSid, '123');
    });

    it('should emit error if pstream is disconnected', (done) => {
      pstream.status = 'disconnected';
      conn.on('error', () => done());
      conn.sendDigits('123');
    });
  });

  context('in response to', () => {
    describe('mediaHandler.onvolume', () => {
      it('should emit volume', (done) => {
        conn.on('volume', (input, output) => {
          assert.equal(input, 123);
          assert.equal(output, 456);
          done();
        });

        mediaHandler.onvolume(123, 456);
      });
    });

    describe('mediaHandler.onicecandidate', () => {
      it('should publish a debug event', () => {
        mediaHandler.onicecandidate({ candidate: 'foo' });
        sinon.assert.calledWith(publisher.debug, 'ice-candidate', 'ice-candidate');
      });
    });

    describe('mediaHandler.onselectedcandidatepairchange', () => {
      it('should publish a debug event', () => {
        mediaHandler.onselectedcandidatepairchange({
          local: { candidate: 'foo' },
          remote: { candidate: 'bar' },
        });
        sinon.assert.calledWith(publisher.debug, 'ice-candidate', 'selected-ice-candidate-pair');
      });
    });

    describe('mediaHandler.onpcconnectionstatechange', () => {
      it('should publish an warning event if state is failed', () => {
        mediaHandler.onpcconnectionstatechange('failed');
        sinon.assert.calledWith(publisher.post, 'warning', 'pc-connection-state', 'failed');
      });

      it('should publish a debug event if state is not failed', () => {
        mediaHandler.onpcconnectionstatechange('foo');
        sinon.assert.calledWith(publisher.post, 'debug', 'pc-connection-state', 'foo');
      });
    });

    describe('mediaHandler.ondtlstransportstatechange', () => {
      it('should publish an error event if state is failed', () => {
        mediaHandler.ondtlstransportstatechange('failed');
        sinon.assert.calledWith(publisher.post, 'error', 'dtls-transport-state', 'failed');
      });

      it('should publish a debug event if state is not failed', () => {
        mediaHandler.ondtlstransportstatechange('foo');
        sinon.assert.calledWith(publisher.post, 'debug', 'dtls-transport-state', 'foo');
      });
    });

    describe('mediaHandler.oniceconnectionstatechange', () => {
      it('should publish an error event if state is failed', () => {
        mediaHandler.oniceconnectionstatechange('failed');
        sinon.assert.calledWith(publisher.post, 'error', 'ice-connection-state', 'failed');
      });

      it('should publish a debug event if state is not failed', () => {
        mediaHandler.oniceconnectionstatechange('foo');
        sinon.assert.calledWith(publisher.post, 'debug', 'ice-connection-state', 'foo');
      });
    });

    describe('mediaHandler.onicegatheringstatechange', () => {
      it('should publish a debug event: ice-gathering-state', () => {
        mediaHandler.onicegatheringstatechange('foo');
        sinon.assert.calledWith(publisher.debug, 'ice-gathering-state', 'foo');
      });
    });

    describe('mediaHandler.onsignalingstatechange', () => {
      it('should publish a debug event: signaling-state', () => {
        mediaHandler.onsignalingstatechange('foo');
        sinon.assert.calledWith(publisher.debug, 'signaling-state', 'foo');
      });
    });

    describe('mediaHandler.ondisconnected', () => {
      it('should publish a warning event: ice-connectivity-lost', () => {
        mediaHandler.ondisconnected('foo');
        sinon.assert.calledWith(publisher.warn, 'network-quality-warning-raised',
          'ice-connectivity-lost', { message: 'foo' });
      });

      it('should emit a warning event', (done) => {
        conn.on('warning', (warningName) => {
          assert.equal(warningName, 'ice-connectivity-lost');
          done();
        });

        mediaHandler.ondisconnected('foo');
      });
    });

    describe('mediaHandler.onreconnected', () => {
      it('should publish an info event: ice-connectivity-lost', () => {
        mediaHandler.onreconnected('foo');
        sinon.assert.calledWith(publisher.info, 'network-quality-warning-cleared',
          'ice-connectivity-lost', { message: 'foo' });
      });

      it('should emit a warning-cleared event', (done) => {
        conn.on('warning-cleared', (warningName) => {
          assert.equal(warningName, 'ice-connectivity-lost');
          done();
        });

        mediaHandler.onreconnected('foo');
      });
    });

    describe('mediaHandler.onerror', () => {
      const baseError = { info: { code: 123, message: 'foo', twilioError: 'bar' } };

      it('should emit an error event', (done) => {
        conn.on('error', (error) => {
          assert.deepEqual(error, 'bar');
          done();
        });

        mediaHandler.onerror(baseError);
      });

      context('when error.disconnect is true', () => {
        [
          Call.State.Open,
          Call.State.Connecting,
          Call.State.Ringing,
        ].forEach((state: Call.State) => {
          context(`and state is ${state}`, () => {
            beforeEach(() => {
              (conn as any)['_status'] = state;
            });

            it('should call pstream.hangup with error message', () => {
              mediaHandler.onerror(Object.assign({ disconnect: true }, baseError));
              sinon.assert.calledWith(pstream.hangup, conn.outboundConnectionId, 'foo');
            });

            it('should call mediaHandler.close', () => {
              mediaHandler.onerror(Object.assign({ disconnect: true }, baseError));
              sinon.assert.calledOnce(mediaHandler.close);
            });
          });
        });

        [
          Call.State.Pending,
          Call.State.Closed,
        ].forEach((state: Call.State) => {
          context(`and state is ${state}`, () => {
            beforeEach(() => {
              (conn as any)['_status'] = state;
            });

            it('should not call pstream.hangup', () => {
              mediaHandler.onerror(Object.assign({ disconnect: true }, baseError));
              sinon.assert.notCalled(pstream.hangup);
            });

            it('should not call mediaHandler.close', () => {
              mediaHandler.onerror(Object.assign({ disconnect: true }, baseError));
              sinon.assert.notCalled(mediaHandler.close);
            });
          });
        });
      });
    });

    describe('mediaHandler.onopen', () => {
      context('when state is open', () => {
        beforeEach(() => {
          (conn as any)['_status'] = Call.State.Open;
        });

        it(`should not call mediaHandler.close`, () => {
          mediaHandler.onopen();
          sinon.assert.notCalled(mediaHandler.close);
        });

        it(`should not call call.mute(false)`, () => {
          conn.mute = sinon.spy();
          mediaHandler.onopen();
          sinon.assert.notCalled(conn.mute as SinonSpy);
        });
      });

      [
        Call.State.Ringing,
        Call.State.Connecting,
      ].forEach((state: Call.State) => {
        context(`when state is ${state}`, () => {
          beforeEach(() => {
            (conn as any)['_status'] = state;
          });

          it(`should not call mediaHandler.close`, () => {
            mediaHandler.onopen();
            sinon.assert.notCalled(mediaHandler.close);
          });

          it(`should call call.mute(false)`, () => {
            conn.mute = sinon.spy();
            mediaHandler.onopen();
            sinon.assert.calledWith(conn.mute as SinonSpy, false);
          });

          it(`should call call.mute(true)`, () => {
            conn.mute = sinon.spy();
            mediaHandler.isMuted = true;
            mediaHandler.onopen();
            sinon.assert.calledWith(conn.mute as SinonSpy, true);
          });

          context('when this call is answered', () => {
            beforeEach(() => {
              mediaHandler.status = 'open';
              conn['_isAnswered'] = true;
            });

            it('should emit Call.accept event', (done) => {
              conn.on('accept', () => done());
              mediaHandler.onopen();
            });

            it('should transition to open', () => {
              mediaHandler.onopen();
              assert.equal(conn.status(), Call.State.Open);
            });
          });

          context('when this call is not answered', () => {
            beforeEach(() => {
              mediaHandler.status = 'open';
            });

            it('should not emit Call.accept event', () => {
              conn.on('accept', () => { throw new Error('Expected to not emit accept event'); });
              mediaHandler.onopen();
              clock.tick(1);
            });

            it('should not transition to open', () => {
              mediaHandler.onopen();
              assert.equal(conn.status(), state);
            });
          });
        });
      });

      [
        Call.State.Pending,
        Call.State.Closed,
      ].forEach((state: Call.State) => {
        context(`when state is ${state}`, () => {
          beforeEach(() => {
            (conn as any)['_status'] = state;
          });

          it(`should call mediaHandler.close`, () => {
            mediaHandler.onopen();
            sinon.assert.calledOnce(mediaHandler.close);
          });

          it(`should not call call.mute(false)`, () => {
            conn.mute = sinon.spy();
            mediaHandler.onopen();
            sinon.assert.notCalled(conn.mute as SinonSpy);
          });
        });
      });
    });

    describe('mediaHandler.onclose', () => {
      it('should transition to closed', () => {
        mediaHandler.onclose();
        assert.equal(conn.status(), Call.State.Closed);
      });

      it('should call monitor.disable', () => {
        mediaHandler.onclose();
        sinon.assert.calledOnce(monitor.disable);
      });

      it('should emit a disconnect event', (done) => {
        conn.on('disconnect', (call) => {
          assert.equal(conn, call);
          done();
        });

        mediaHandler.onclose();
      });

      it('should play the disconnect ringtone if shouldPlayDisconnect is not specified', () => {
        mediaHandler.onclose();
        sinon.assert.calledOnce(soundcache.get(Device.SoundName.Disconnect).play);
      });

      it('should play the disconnect ringtone if shouldPlayDisconnect returns true', () => {
        conn = new Call(config, Object.assign({ shouldPlayDisconnect: () => true }, options));
        mediaHandler.onclose();
        sinon.assert.calledOnce(soundcache.get(Device.SoundName.Disconnect).play);
      });

      it('should not play the disconnect ringtone if shouldPlayDisconnect returns false', () => {
        conn = new Call(config, Object.assign({ shouldPlayDisconnect: () => false }, options));
        mediaHandler.onclose();
        sinon.assert.notCalled(soundcache.get(Device.SoundName.Disconnect).play);
      });
    });

    describe('pstream.transportClose event', () => {
      it('should re-emit transportClose event', () => {
        const callback = sinon.stub();
        conn = new Call(config, Object.assign({
          callParameters: { CallSid: 'CA123' }
        }, options));

        conn.on('transportClose', callback);
        pstream.emit('transportClose');

        assert(callback.calledOnce);
      });

      it('should publish a reconnecting event if reconnectToken is set', () => {
        publisher.info.reset();
        conn = new Call(config, Object.assign({
          callParameters: { CallSid: 'CA123' },
          reconnectToken: 'testReconnectToken',
        }, options));

        pstream.emit('transportClose');

        sinon.assert.calledWith(publisher.info, 'connection', 'reconnecting');
      });
    });

    describe('pstream.cancel event', () => {
      const wait = (timeout?: number) => new Promise(r => {
        setTimeout(r, timeout || 0);
        clock.tick(0);
      });

      let conn: any;
      let cleanupStub: any;
      let closeStub: any;
      let publishStub: any;

      const initCall = () => {
        cleanupStub = sinon.stub();
        closeStub = sinon.stub();
        publishStub = sinon.stub();

        conn = new Call(config, Object.assign({
          callParameters: { CallSid: 'CA123' }
        }, options));

        conn._cleanupEventListeners = cleanupStub;
        conn['_mediaHandler'].close = () => {
          closeStub();
          conn.emit('disconnect');
        };
        conn._publisher = {
          info: publishStub
        };
      };

      beforeEach(initCall);

      context('when the callsid matches', () => {
        it('should transition to closed', () => {
          pstream.emit('cancel', { callsid: 'CA123' });
          assert.equal(conn.status(), Call.State.Closed);
        });

        it('should emit a cancel event', (done) => {
          conn.on('cancel', () => done());
          pstream.emit('cancel', { callsid: 'CA123' });
        });

        it('should disconnect the call', () => {
          pstream.emit('cancel', { callsid: 'CA123' });
          sinon.assert.called(cleanupStub);
          sinon.assert.called(closeStub);
          sinon.assert.calledWithExactly(publishStub, 'connection', 'cancel', null, conn);
        });

        it('should not emit a disconnect event', () => {
          const callback = sinon.stub();
          conn['_mediaHandler'].close = () => mediaHandler.onclose();
          conn.on('disconnect', callback);
          pstream.emit('cancel', { callsid: 'CA123' });

          return wait().then(() => sinon.assert.notCalled(callback));
        });

        it('should not play disconnect sound', () => {
          options.shouldPlayDisconnect = () => true;
          initCall();
          conn['_mediaHandler'].close = () => mediaHandler.onclose();
          pstream.emit('cancel', { callsid: 'CA123' });

          return wait().then(() => {
            sinon.assert.notCalled(soundcache.get(Device.SoundName.Disconnect).play);
          });
        });
      });

      context('when the callsid does not match', () => {
        it('should not transition to closed', () => {
          pstream.emit('cancel', { callsid: 'foo' });
          assert.equal(conn.status(), Call.State.Pending);
        });

        it('should not emit a cancel event', () => {
          conn.on('cancel', () => { throw new Error('Was expecting cancel to not be emitted'); });
          pstream.emit('cancel', { callsid: 'foo' });
        });
      });
    });

    describe('pstream.hangup event', () => {
      context('when callsid matches', () => {
        beforeEach((done) => {
          conn = new Call(config, Object.assign({
            callParameters: { CallSid: 'CA123' }
          }, options));
          mediaHandler.makeOutgoingCall = () => done();
          mediaHandler.answerIncomingCall = () => done();
          conn.accept();
        });

        it('should publish a disconnected-by-remote event', () => {
          publisher.info.reset();
          pstream.emit('hangup', { callsid: 'CA123' });
          sinon.assert.calledWith(publisher.info, 'connection', 'disconnected-by-remote');
        });

        it('should not call pstream.hangup', () => {
          pstream.emit('hangup', { callsid: 'CA123' });
          sinon.assert.notCalled(pstream.hangup);
        });

        it('should throw an error if the payload contains an error', () => {
          const callback = sinon.stub();
          conn.on('error', callback);
          pstream.emit('cancel', { callsid: 'foo' });
          pstream.emit('hangup', { callsid: 'CA123', error: {
            code: 123,
            message: 'foo',
          }});

          const rVal = callback.firstCall.args[0];
          assert.equal(rVal.code, 31005);
          assert.deepStrictEqual(rVal.originalError, { code: 123, message: 'foo' });
        });

        describe('should transform an error if enableImprovedSignalingErrorPrecision is true', () => {
          beforeEach(() => {
            conn['_options'].enableImprovedSignalingErrorPrecision = true;
          });

          it('should pass the signaling error message', () => {
            const cb = sinon.stub();
            conn.on('error', cb);
            pstream.emit('hangup', { callsid: 'CA123', error: {
              code: 31480,
              message: 'foobar',
            }});
            const rVal = cb.firstCall.args[0];
            assert.equal(rVal.code, 31480);
            assert.equal(rVal.message, 'TemporarilyUnavailable (31480): foobar');
          })

          it('should default the error message', () => {
            const cb = sinon.stub();
            conn.on('error', cb);
            pstream.emit('hangup', { callsid: 'CA123', error: {
              code: 31480,
            }});
            const rVal = cb.firstCall.args[0];
            assert.equal(rVal.code, 31480);
            assert.equal(
              rVal.message,
              'TemporarilyUnavailable (31480): The callee is currently unavailable.',
            );
          });
        })

        it('should not transform an error if enableImprovedSignalingErrorPrecision is false', () => {
          conn['_options'].enableImprovedSignalingErrorPrecision = false;
          const cb = sinon.stub();
          conn.on('error', cb);
          pstream.emit('hangup', { callsid: 'CA123', error: {
            code: 31480, message: 'foobar',
          }});
          const rVal = cb.firstCall.args[0];
          assert.equal(rVal.code, 31005);
          assert.equal(
            rVal.message,
            'ConnectionError (31005): Error sent from gateway in HANGUP',
          );
          assert.deepStrictEqual(rVal.originalError, { code: 31480, message: 'foobar' });
        });
      });

      context('when callsid does not match', () => {
        beforeEach((done) => {
          conn = new Call(config, Object.assign({
            callParameters: { CallSid: 'CA987' }
          }, options));
          mediaHandler.makeOutgoingCall = () => done();
          mediaHandler.answerIncomingCall = () => done();
          conn.accept();
        });

        it('should not publish a disconnected-by-remote event', () => {
          publisher.info.reset();
          pstream.emit('hangup', { callsid: 'CA123' });
          sinon.assert.notCalled(publisher.info);
        });

        it('should not call pstream.hangup', () => {
          pstream.emit('hangup', { callsid: 'CA123' });
          sinon.assert.notCalled(pstream.hangup);
        });
      });
    });

    describe('pstream.ringing event', () => {
      [Call.State.Connecting, Call.State.Ringing].forEach((state: Call.State) => {
        context(`when state is ${state}`, () => {
          beforeEach(() => {
            conn = new Call(config, options);
            (conn as any)['_status'] = state;
          });

          it('should set status to ringing', () => {
            pstream.emit('ringing', { callsid: 'ABC123', });
            assert.equal(conn.status(), Call.State.Ringing);
          });

          it('should publish an outgoing-ringing event with hasEarlyMedia: false if no sdp', () => {
            pstream.emit('ringing', { callsid: 'ABC123' });
            sinon.assert.calledWith(publisher.info, 'connection', 'outgoing-ringing', {
              hasEarlyMedia: false,
            });
          });

          it('should publish an outgoing-ringing event with hasEarlyMedia: true if sdp', () => {
            pstream.emit('ringing', { callsid: 'ABC123', sdp: 'foo' });
            sinon.assert.calledWith(publisher.info, 'connection', 'outgoing-ringing', {
              hasEarlyMedia: true,
            });
          });

          it('should emit a ringing event with hasEarlyMedia: false if no sdp', (done) => {
            conn.on('ringing', (hasEarlyMedia) => {
              assert(!hasEarlyMedia);
              done();
            });

            pstream.emit('ringing', { callsid: 'ABC123' });
          });

          it('should emit a ringing event with hasEarlyMedia: true if sdp', (done) => {
            conn.on('ringing', (hasEarlyMedia) => {
              assert(hasEarlyMedia);
              done();
            });

            pstream.emit('ringing', { callsid: 'ABC123', sdp: 'foo' });
          });
        });
      });
    });

    describe('pstream.connected event', () => {
      [true, false].forEach(doesMediaHandlerVersionExist => {
        ['foo', undefined].forEach(signalingReconnectToken => {
          describe(`when mediaHandler.version ${
            doesMediaHandlerVersionExist ? 'exists' : 'does not exist'
          } and signaling reconnect token ${
            signalingReconnectToken ? 'exists' : 'does not exist'
          }`, () => {
            beforeEach(async () => {
              conn = new Call(config, Object.assign(options, { callParameters: { CallSid: 'CA1234' } }));
              conn.accept();
              await clock.tickAsync(0);
              if (!doesMediaHandlerVersionExist) {
                mediaHandler.version = null;
              }
              if (signalingReconnectToken) {
                // @ts-ignore
                conn._signalingReconnectToken = signalingReconnectToken;
              }
              pstream.emit('connected');
            });

            it(`should ${
              doesMediaHandlerVersionExist && signalingReconnectToken ? '' : 'not '
            }call pstream.reconnect()`, async () => {
              if (doesMediaHandlerVersionExist && signalingReconnectToken) {
                sinon.assert.calledWith(pstream.reconnect, mediaHandler.version.getSDP(), 'CA1234', signalingReconnectToken);
              } else {
                sinon.assert.notCalled(pstream.reconnect);
              }
            });
          });
        });
      });
    });

    describe('pstream.answer event', () => {
      let pStreamAnswerPayload: any;

      beforeEach(() => {
        pStreamAnswerPayload = {
          edge: 'foobar-edge',
          reconnect: 'foobar-reconnect-token',
        };
      });

      describe('for incoming calls', () => {
        beforeEach(async () => {
          // With a CallSid, this becomes an incoming call
          const callParameters = { CallSid: 'CA1234' };
          conn = new Call(config, Object.assign(options, { callParameters }));
          conn.accept();
          await clock.tickAsync(0);
        });

        it('should remove event handler after disconnect for an incoming call', () => {
          pstream.emit('answer', pStreamAnswerPayload);
          conn.disconnect();
          assert.strictEqual(pstream.listenerCount('answer'), 0);
        });
      });

      describe('for outgoing calls', () => {
        beforeEach(async () => {
          conn = new Call(config, options);
          conn.accept();
          await clock.tickAsync(0);
        });

        it('should set the call to "answered"', () => {
          pstream.emit('answer', pStreamAnswerPayload);
          assert(conn['_isAnswered']);
        });

        it('should save the reconnect token', () => {
          pstream.emit('answer', pStreamAnswerPayload);
          assert.equal(conn['_signalingReconnectToken'], pStreamAnswerPayload.reconnect);
        });

        it('should remove event handler after disconnect for an outgoing call', () => {
          pstream.emit('answer', pStreamAnswerPayload);
          conn.disconnect();
          assert.strictEqual(pstream.listenerCount('answer'), 0);
        });

        describe('if raised multiple times', () => {
          it('should save the reconnect token multiple times', () => {
            pstream.emit('answer', pStreamAnswerPayload);
            assert.equal(conn['_signalingReconnectToken'], pStreamAnswerPayload.reconnect);

            pStreamAnswerPayload.reconnect = 'biffbazz-reconnect-token';

            pstream.emit('answer', pStreamAnswerPayload);
            assert.equal(conn['_signalingReconnectToken'], pStreamAnswerPayload.reconnect);
          });

          it('should not invoke "call._maybeTransitionToOpen" more than once', () => {
            const spy = conn['_maybeTransitionToOpen'] = sinon.spy(conn['_maybeTransitionToOpen']);

            pstream.emit('answer', pStreamAnswerPayload);
            sinon.assert.calledOnce(spy);

            pstream.emit('answer', pStreamAnswerPayload);
            sinon.assert.calledOnce(spy);
          });
        });
      });
    });

    describe('pstream.ack event', () => {
      const mockcallsid = 'mock-callsid';
      let mockMessagePayload: any;
      let mockAckPayload: any;

      beforeEach(() => {
        mockMessagePayload = {
          content: {
            foo: 'bar',
          },
          contentType: 'application/json',
          messageType: 'user-defined-message',
        };

        mockAckPayload = {
          acktype: 'message',
          callsid: mockcallsid,
          voiceeventsid: 'mockvoiceeventsid',
        };

        conn.parameters = {
          ...conn.parameters,
          CallSid: mockcallsid,
        };
        clock.restore();
      });

      it('should emit messageSent', async () => {
        const sid = conn.sendMessage(mockMessagePayload);
        const payloadPromise = new Promise((resolve) => {
          conn.on('messageSent', resolve);
        });
        pstream.emit('ack', { ...mockAckPayload, voiceeventsid: sid });
        assert.deepEqual(await payloadPromise, { ...mockMessagePayload, voiceEventSid: sid });
      });

      it('should publish a user-defined-message sent event', async () => {
        const sid = conn.sendMessage(mockMessagePayload);
        const payloadPromise = new Promise((resolve) => {
          conn.on('messageSent', resolve);
        });
        pstream.emit('ack', { ...mockAckPayload, voiceeventsid: sid });
        await payloadPromise;
        assert.deepStrictEqual(publisher.info.args[1][0], 'call-message');
        assert.deepStrictEqual(publisher.info.args[1][1], mockMessagePayload.messageType);
        assert.deepStrictEqual(publisher.info.args[1][2], {
          content_type: mockMessagePayload.contentType,
          event_type: 'sent',
          voice_event_sid: sid
        });
      });

      it('should ignore ack when callSids do not match', async () => {
        const sid = conn.sendMessage(mockMessagePayload);
        const payloadPromise = new Promise((resolve, reject) => {
          conn.on('messageSent', reject);
        });
        pstream.emit('ack', { ...mockAckPayload, voiceeventsid: sid, callsid: 'foo' });
        await Promise.race([
          wait(1),
          payloadPromise,
        ]);
      });

      it('should not emit messageSent when acktype is not `message`', async () => {
        const sid = conn.sendMessage(mockMessagePayload);
        const payloadPromise = new Promise((resolve, reject) => {
          conn.on('messageSent', reject);
        });
        pstream.emit('ack', { ...mockAckPayload, voiceeventsid: sid, acktype: 'foo' });
        await Promise.race([
          wait(1),
          payloadPromise,
        ]);
      });

      it('should not emit messageSent if voiceEventSid was not previously sent', async () => {
        const sid = conn.sendMessage(mockMessagePayload);
        const payloadPromise = new Promise((resolve, reject) => {
          conn.on('messageSent', reject);
        });
        pstream.emit('ack', { ...mockAckPayload, voiceeventsid: 'foo' });
        await Promise.race([
          wait(1),
          payloadPromise,
        ]);
      });

      it('should emit messageSent only once', async () => {
        const sid = conn.sendMessage(mockMessagePayload);
        const handler = sinon.stub();
        const payloadPromise = new Promise((resolve) => {
          conn.on('messageSent', () => {
            handler();
            resolve(null);
          });
        });
        pstream.emit('ack', { ...mockAckPayload, voiceeventsid: sid });
        pstream.emit('ack', { ...mockAckPayload, voiceeventsid: sid });
        await payloadPromise;
        sinon.assert.calledOnce(handler);
      });

      it('should not emit messageSent after an error', async () => {
        const sid = conn.sendMessage(mockMessagePayload);
        const payloadPromise = new Promise((resolve, reject) => {
          conn.on('messageSent', reject);
        });
        pstream.emit('error', { callsid: mockcallsid, voiceeventsid: sid, error: { code: 31210, message: 'foo' }});
        pstream.emit('ack', { ...mockAckPayload, voiceeventsid: sid });
        await Promise.race([
          wait(1),
          payloadPromise,
        ]);
      });

      it('should ignore errors with different callsid', async () => {
        const sid = conn.sendMessage(mockMessagePayload);
        const payloadPromise = new Promise((resolve) => {
          conn.on('messageSent', resolve);
        });
        pstream.emit('error', { callsid: 'foo', voiceeventsid: sid, error: { code: 31210, message: 'foo' }});
        pstream.emit('ack', { ...mockAckPayload, voiceeventsid: sid });
        await payloadPromise;
      });

      it('should ignore errors with different voiceeventsid', async () => {
        const sid = conn.sendMessage(mockMessagePayload);
        const payloadPromise = new Promise((resolve) => {
          conn.on('messageSent', resolve);
        });
        pstream.emit('error', { callsid: mockcallsid, voiceeventsid: 'foo', error: { code: 31210, message: 'foo' }});
        pstream.emit('ack', { ...mockAckPayload, voiceeventsid: sid });
        await payloadPromise;
      });

      it('should ignore errors with missing voiceeventsid', async () => {
        const sid = conn.sendMessage(mockMessagePayload);
        const payloadPromise = new Promise((resolve) => {
          conn.on('messageSent', resolve);
        });
        pstream.emit('error', { callsid: mockcallsid, error: { code: 31210, message: 'foo' }});
        pstream.emit('ack', { ...mockAckPayload, voiceeventsid: sid });
        await payloadPromise;
      });

      it('should publish a user-defined-message error event', () => {
        const sid = conn.sendMessage(mockMessagePayload);
        pstream.emit('error', { callsid: mockcallsid, voiceeventsid: sid, error: { code: 31210, message: 'foo' }});
        assert.deepStrictEqual(publisher.error.args[0][0], 'call-message');
        assert.deepStrictEqual(publisher.error.args[0][1], 'error');
        assert.deepStrictEqual(publisher.error.args[0][2],   {
          code: 31210,
          message: 'foo',
          voice_event_sid: sid
        });
      });

      it('should emit the correct call message error', async () => {
        const sid = conn.sendMessage(mockMessagePayload);
        const payloadPromise: Promise<TwilioError> = new Promise((resolve) => {
          conn.on('error', resolve);
        });
        pstream.emit('error', { callsid: mockcallsid, voiceeventsid: sid, error: { code: 31210, message: 'foo' }});
        const error = await payloadPromise;
        assert.strictEqual(error.code, 31210);
      });

      it('should emit an unknown error', async () => {
        const sid = conn.sendMessage(mockMessagePayload);
        const payloadPromise: Promise<TwilioError> = new Promise((resolve) => {
          conn.on('error', resolve);
        });
        pstream.emit('error', { callsid: mockcallsid, voiceeventsid: sid, error: { code: 111, message: 'foo' }});
        const error = await payloadPromise;
        assert.strictEqual(error.code, 31000);
      });
    });

    describe('pstream.message event', () => {
      const mockcallsid = 'mock-callsid';
      let mockPayload: any;

      beforeEach(() => {
        mockPayload = {
          callsid: mockcallsid,
          content: {
            foo: 'bar',
          },
          contenttype: 'application/json',
          messagetype: 'foo-bar',
          voiceeventsid: 'mock-voiceeventsid-foobar',
        };
        conn.parameters = {
          ...conn.parameters,
          CallSid: mockcallsid,
        };
        clock.restore();
      });

      it('should emit messageReceived', async () => {
        const payloadPromise = new Promise((resolve) => {
          conn.on('messageReceived', resolve);
        });
        pstream.emit('message', mockPayload);
        assert.deepEqual(await payloadPromise, {
          content: mockPayload.content,
          contentType: mockPayload.contenttype,
          messageType: mockPayload.messagetype,
          voiceEventSid: mockPayload.voiceeventsid,
        });
      });

      it('should ignore messages when callSids do not match', async () => {
        const messagePromise = new Promise((resolve, reject) => {
          conn.on('messageReceived', reject);
        });
        pstream.emit('message', { ...mockPayload, callsid: 'foo' });
        await Promise.race([
          wait(1),
          messagePromise,
        ]);
      });

      it('should publish a user-defined-message received event', () => {
        pstream.emit('message', mockPayload);
        assert.deepStrictEqual(publisher.info.args[1][0], 'call-message');
        assert.deepStrictEqual(publisher.info.args[1][1], mockPayload.messagetype);
        assert.deepStrictEqual(publisher.info.args[1][2], {
          content_type: mockPayload.contenttype,
          event_type: 'received',
          voice_event_sid: mockPayload.voiceeventsid
        });
      });
    });
  });

  describe('on monitor.sample', () => {
    let sampleData: any;
    let audioData: any;

    beforeEach(() => {
      sampleData = {
        timestamp: 0,
        totals: {
          packetsReceived: 0,
          packetsLost: 0,
          packetsSent: 0,
          packetsLostFraction: 0,
          bytesReceived: 0,
          bytesSent: 0
        },
        packetsSent: 0,
        packetsReceived: 0,
        packetsLost: 0,
        packetsLostFraction: 0,
        jitter: 0,
        rtt: 0,
        mos: 0,
        codecName: 'opus'
      };

      audioData = {
        audioInputLevel: 0,
        audioOutputLevel: 0,
        inputVolume: 0,
        outputVolume: 0
      };
    });

    context('after 10 samples have been emitted', () => {
      it('should call publisher.postMetrics with the samples', () => {
        const samples: any[] = [];

        for (let i = 0; i < 10; i++) {
          const sample = {...sampleData, ...audioData}
          samples.push(sample);
          monitor.emit('sample', sample);
        }

        sinon.assert.calledOnce(publisher.postMetrics);
        sinon.assert.calledWith(publisher.postMetrics, 'quality-metrics-samples', 'metrics-sample', samples);
      });

      it('should publish correct volume levels', () => {
        const samples: any = [];
        const dataLength = 10;

        const convert = (internalValue: any) => (internalValue / 255) * 32767;

        for (let i = 1; i <= dataLength; i++) {
          const internalAudioIn = i;
          const internalAudioOut = i * 2;

          mediaHandler.onvolume(i, i, internalAudioIn, internalAudioOut);

          // This helps determine that levels are averaging correctly
          mediaHandler.onvolume(i, i, 2, 2);

          const sample = {
            ...sampleData,
            audioInputLevel: Math.round((convert(internalAudioIn) + convert(2)) / 2),
            audioOutputLevel: Math.round((convert(internalAudioOut) + convert(2)) / 2),
            inputVolume: i,
            outputVolume: i
          };

          samples.push(sample);
          monitor.emit('sample', sample);
        }

        sinon.assert.calledOnce(publisher.postMetrics);
        sinon.assert.calledWith(publisher.postMetrics, 'quality-metrics-samples', 'metrics-sample', samples);
      });

      it('should call on sample event handler', () => {
        const onSample = sinon.stub();
        conn.on('sample', onSample);

        const sample = {...sampleData};
        monitor.emit('sample', sample);
        sinon.assert.calledOnce(onSample);
        sinon.assert.calledWith(onSample, sample);
      });
    });
  });

  describe('on monitor.warning', () => {
    context('single-threshold warnings', () => {
      it('should properly translate `maxAverage`', () => {
        monitor.emit('warning', {
          name: 'jitter',
          threshold: { name: 'maxAverage', value: 1 },
          value: 3,
        });
        sinon.assert.calledOnce(publisher.post);
        const [warningStr, warningType, warning] = publisher.post.args[0];
        assert.equal(warningStr, 'warning');
        assert.equal(warningType, 'network-quality-warning-raised');
        assert.equal(warning, 'high-jitter');
      });

      it('should properly translate `max`', () => {
        monitor.emit('warning', {
          name: 'jitter',
          samples: [],
          threshold: { name: 'max', value: 1 },
          values: [3, 3, 3],
        });
        sinon.assert.calledOnce(publisher.post);
        const [warningStr, warningType, warning] = publisher.post.args[0];
        assert.equal(warningStr, 'warning');
        assert.equal(warningType, 'network-quality-warning-raised');
        assert.equal(warning, 'high-jitter');
      });
    });

    context('multiple-threshold warnings', () => {
      it('should properly translate `maxAverage`', () => {
        monitor.emit('warning', {
          name: 'packetsLostFraction',
          threshold: { name: 'maxAverage', value: 3 },
          value: 1,
        });
        sinon.assert.calledOnce(publisher.post);
        const [warningStr, warningType, warning] = publisher.post.args[0];
        assert.equal(warningStr, 'warning');
        assert.equal(warningType, 'network-quality-warning-raised');
        assert.equal(warning, 'high-packets-lost-fraction');
      });

      it('should properly translate `max`', () => {
        monitor.emit('warning', {
          name: 'packetsLostFraction',
          threshold: { name: 'max', value: 1 },
          values: [2, 2, 2],
        });
        sinon.assert.calledOnce(publisher.post);
        const [warningStr, warningType, warning] = publisher.post.args[0];
        assert.equal(warningStr, 'warning');
        assert.equal(warningType, 'network-quality-warning-raised');
        assert.equal(warning, 'high-packet-loss');
      });
    });

    it('should properly translate `minStandardDeviation`', () => {
      mediaHandler.isMuted = false;
      monitor.emit('warning', {
        name: 'audioInputLevel',
        threshold: { name: 'minStandardDeviation', value: 3 },
        value: 1,
      });
      sinon.assert.calledOnce(publisher.post);
      const [warningStr, warningType, warning] = publisher.post.args[0];
      assert.equal(warningStr, 'warning');
      assert.equal(warningType, 'audio-level-warning-raised');
      assert.equal(warning, 'constant-audio-input-level');
    });

    context('if warningData.name contains audio', () => {
      it('should publish an audio-level-warning-raised warning event', () => {
        monitor.emit('warning', { name: 'audio', threshold: { name: 'max' }, values: [1, 2, 3] });
        sinon.assert.calledWith(publisher.post, 'warning', 'audio-level-warning-raised');
      });

      it('should emit a warning event', (done) => {
        const data = { name: 'audioInputLevel', threshold: { name: 'maxDuration', value: 1 }, values: [1, 2, 3] };
        mediaHandler.isMuted = false;
        conn.on('warning', (name, warningData) => {
          assert.equal(name, 'constant-audio-input-level');
          assert.deepStrictEqual(data, warningData);
          done();
        });
        monitor.emit('warning', data);
      });
    });

    context('if warningData.name does not contain audio', () => {
      it('should publish an network-quality-warning-raised warning event', () => {
        monitor.emit('warning', { name: 'foo', threshold: { name: 'max' } });
        sinon.assert.calledWith(publisher.post, 'warning', 'network-quality-warning-raised');
      });

      [{
        name: 'bytesReceived',
        threshold: 'min',
        warning: 'low-bytes-received',
      },{
        name: 'bytesSent',
        threshold: 'min',
        warning: 'low-bytes-sent',
      },{
        name: 'jitter',
        threshold: 'max',
        warning: 'high-jitter',
      },{
        name: 'mos',
        threshold: 'min',
        warning: 'low-mos',
      },{
        name: 'packetsLostFraction',
        threshold: 'max',
        warning: 'high-packet-loss',
      },{
        name: 'rtt',
        threshold: 'max',
        warning: 'high-rtt',
      }].forEach(item => {
        it(`should emit a warning event for ${item.name}`, (done) => {
          const data = { name: item.name, threshold: { name: item.threshold, value: 1 }, values: [1, 2, 3] };
          conn.on('warning', (name, warningData) => {
            assert.equal(name, item.warning);
            assert.deepStrictEqual(data, warningData);
            done();
          });
          monitor.emit('warning', data);
        });
      });
    });
  });

  describe('on monitor.warning-cleared', () => {
    context('if warningData.name contains audio', () => {
      it('should publish an audio-level-warning-cleared info event', () => {
        monitor.emit('warning-cleared', { name: 'audio', threshold: { name: 'max' } });
        sinon.assert.calledWith(publisher.post, 'info', 'audio-level-warning-cleared');
      });

      it('should emit a warning-cleared event', (done) => {
        conn.on('warning-cleared', () => done());
        monitor.emit('warning-cleared', { name: 'audio', threshold: { name: 'max' } });
      });
    });

    context('if warningData.name does not contain audio', () => {
      it('should publish an network-quality-warning-cleared info event', () => {
        monitor.emit('warning-cleared', { name: 'foo', threshold: { name: 'max' } });
        sinon.assert.calledWith(publisher.post, 'info', 'network-quality-warning-cleared');
      });

      it('should emit a warning-cleared event', (done) => {
        conn.on('warning-cleared', () => done());
        monitor.emit('warning-cleared', { name: 'foo', threshold: { name: 'max' } });
      });
    });
  });

  describe('on media failed', () => {
    beforeEach(() => {
      mediaHandler.iceRestart = sinon.stub();
      conn = new Call(config, Object.assign(options));
      conn['_mediaReconnectBackoff'] = {
        backoff: () => mediaHandler.iceRestart(),
        reset: sinon.stub(),
      }
      Util.isChrome = sinon.stub().returns(true);
    });

    context('on ICE Gathering failures', () => {
      it('should emit reconnecting', () => {
        const callback = sinon.stub();

        conn.on('reconnecting', callback);
        mediaHandler.onicegatheringfailure();

        const mediaReconnectionError = new MediaErrors.ConnectionError('Media connection failed.');
        sinon.assert.callCount(callback, 1);
        assert.deepEqual(callback.args[0][0], mediaReconnectionError);

        const rVal = callback.firstCall.args[0];
        assert.equal(rVal.code, 53405);
      });

      it('should publish warning on ICE Gathering timeout', () => {
        mediaHandler.onicegatheringfailure(Call.IceGatheringFailureReason.Timeout);
        sinon.assert.calledWith(publisher.warn, 'ice-gathering-state',
          Call.IceGatheringFailureReason.Timeout, null);
      });

      it('should publish warning on ICE Gathering none', () => {
        mediaHandler.onicegatheringfailure(Call.IceGatheringFailureReason.None);
        sinon.assert.calledWith(publisher.warn, 'ice-gathering-state',
          Call.IceGatheringFailureReason.None, null);
      });
    });

    context('on low bytes', () => {
      it('should restart ice if ice connection state is disconnected and bytes received is low', () => {
        mediaHandler.version.pc.iceConnectionState = 'disconnected';
        monitor.hasActiveWarning = sinon.stub().returns(true);
        monitor.emit('warning', { name: 'bytesReceived', threshold: { name: 'min' } });
        sinon.assert.callCount(mediaHandler.iceRestart, 1);
      });

      it('should restart ice if ice connection state is disconnected and bytes sent is low', () => {
        mediaHandler.version.pc.iceConnectionState = 'disconnected';
        monitor.hasActiveWarning = sinon.stub().returns(true);
        monitor.emit('warning', { name: 'bytesSent', threshold: { name: 'min' } });
        sinon.assert.callCount(mediaHandler.iceRestart, 1);
      });

      it('should not restart ice if ice connection state is not disconnected and bytes received is low', () => {
        mediaHandler.version.pc.iceConnectionState = 'connected';
        monitor.hasActiveWarning = sinon.stub().returns(true);
        monitor.emit('warning', { name: 'bytesReceived', threshold: { name: 'min' } });
        sinon.assert.callCount(mediaHandler.iceRestart, 0);
      });

      it('should not restart ice if ice connection state is not disconnected and bytes sent is low', () => {
        mediaHandler.version.pc.iceConnectionState = 'connected';
        monitor.hasActiveWarning = sinon.stub().returns(true);
        monitor.emit('warning', { name: 'bytesSent', threshold: { name: 'min' } });
        sinon.assert.callCount(mediaHandler.iceRestart, 0);
      });
    });

    context('on ice disconnected', () => {
      it('should restart ice if has low bytes', () => {
        mediaHandler.version.pc.iceConnectionState = 'disconnected';
        monitor.hasActiveWarning = sinon.stub().returns(true);
        mediaHandler.ondisconnected();
        sinon.assert.callCount(mediaHandler.iceRestart, 1);
      });
      it('should not restart ice if no low bytes warning', () => {
        mediaHandler.version.pc.iceConnectionState = 'disconnected';
        monitor.hasActiveWarning = sinon.stub().returns(false);
        mediaHandler.ondisconnected();
        sinon.assert.callCount(mediaHandler.iceRestart, 0);
      });
    });

    it('should restart on ice failed', () => {
      mediaHandler.onfailed();
      sinon.assert.callCount(mediaHandler.iceRestart, 1);
    });

    it('should emit reconnecting once', () => {
      const callback = sinon.stub();
      mediaHandler.version.pc.iceConnectionState = 'disconnected';
      monitor.hasActiveWarning = sinon.stub().returns(true);

      conn.on('reconnecting', callback);
      mediaHandler.ondisconnected();
      mediaHandler.onfailed();

      const mediaReconnectionError = new MediaErrors.ConnectionError('Media connection failed.');
      sinon.assert.callCount(callback, 1);
      assert.deepEqual(callback.args[0][0], mediaReconnectionError);

      const rVal = callback.firstCall.args[0];
      assert.equal(rVal.code, 53405);
    });

    it('should emit reconnected on ice reconnected', () => {
      const callback = sinon.stub();
      mediaHandler.onfailed();
      conn.on('reconnected', callback);
      conn['_signalingStatus'] = Call.State.Open;
      mediaHandler.onreconnected();

      sinon.assert.callCount(callback, 1);
    });

    it('should emit reconnected on initial ice connected after ice gathering failure', () => {
      const callback = sinon.stub();
      mediaHandler.onicegatheringfailure();
      conn.on('reconnected', callback);
      conn['_signalingStatus'] = Call.State.Open;
      mediaHandler.onconnected();

      sinon.assert.callCount(callback, 1);
    });
  });
});

/**
 * Create a stub and mixin the EventEmitter functions. All methods are replaced with stubs,
 * except the EventEmitter functionality, which works as expected.
 * @param BaseClass - The base class to stub.
 * @returns A stubbed instance with EventEmitter mixed in.
 */
function createEmitterStub(BaseClass: any): SinonStubbedInstance<any> {
  const stub: SinonStubbedInstance<any> = sinon.createStubInstance(BaseClass);

  Object.getOwnPropertyNames(EventEmitter.prototype).forEach((name: string) => {
    const property = (EventEmitter.prototype as any)[name];
    if (typeof property !== 'function') { return; }
    stub[name] = property.bind(stub);
  });

  EventEmitter.constructor.call(stub);
  return stub;
}
