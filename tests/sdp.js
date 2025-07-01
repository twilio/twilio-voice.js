'use strict';

const assert = require('assert');

const {
  getPreferredCodecInfo,
  setCodecPreferences,
  setIceAggressiveNomination,
  setMaxAverageBitrate
} = require('../lib/twilio/rtc/sdp');

const { makeSdpWithTracks } = require('./lib/mocksdp');
const { combinationContext } = require('./lib/util');

const root = global;

describe('setIceAggressiveNomination', () => {
  const SDP_ICE_LITE = 'bar\na=ice-lite\nfoo';
  const SDP_FULL_ICE = 'a=group\nfoo\na=ice-options:trickle-ice\n';
  const navigator = typeof window === 'undefined'
    ? root.window.navigator
    : window.navigator;
  const USER_AGENT = navigator.userAgent;

  beforeEach(() => {
    navigator.userAgent = 'CriOS';
  });

  afterEach(() => {
    navigator.userAgent = USER_AGENT;
  });

  it('should remove ice-lite on chrome', () => {
    assert.equal(setIceAggressiveNomination(SDP_ICE_LITE), 'bar\nfoo');
  });

  it('should not run on other browsers', () => {
    navigator.userAgent = '';
    assert.equal(setIceAggressiveNomination(SDP_ICE_LITE), SDP_ICE_LITE);
  });

  it('should not modify sdp if ice-lite is not enabled', () => {
    assert.equal(setIceAggressiveNomination(SDP_FULL_ICE), SDP_FULL_ICE);
  });
});

describe('setCodecPreferences', () => {
  combinationContext([
    [
      ['planb', 'unified'],
      x => `${x} sdp`,
    ],
    [
      ['', 'pcmu,opus'],
      x => `when preferredCodecs is ${x ? 'not ' : ''}empty`,
    ],
  ], ([sdpType, preferredCodecs]) => {
    preferredCodecs = preferredCodecs ? preferredCodecs.split(',') : [];
    it(`should ${preferredCodecs.length ? 'update the' : 'preserve the existing'} audio codec order`, () => {
      const expectedCodecIds = preferredCodecs.length
        ? ['0', '109', '9', '8', '101']
        : ['109', '9', '0', '8', '101'];
      itShouldHaveCodecOrder(sdpType, preferredCodecs, expectedCodecIds);
    });
  });
});

describe('getPreferredCodecInfo', () => {
  it('should get the correct info for Opus', () => {
    const sdp = 'foo=a\na=rtpmap:1337 opus/48000/2\na=rtpmap:0 PCMU/8000\na=fmtp:0\na=fmtp:1337 maxaveragebitrate=12000;usedtx=0\nbar=b';
    const { codecName, codecParams } = getPreferredCodecInfo(sdp);
    assert.equal(codecName, 'opus/48000/2');
    assert.equal(codecParams, 'maxaveragebitrate=12000;usedtx=0');
  });
});

function itShouldHaveCodecOrder(sdpType, preferredCodecs, expectedCodecIds) {
  const sdp = makeSdpWithTracks(sdpType, {
    audio: ['audio-1', 'audio-2'],
  });
  const modifiedSdp = setCodecPreferences(sdp, preferredCodecs);
  modifiedSdp.split('\r\nm=').slice(1).forEach(section => {
    const kind = section.split(' ')[0];
    const codecIds = section.split('\r\n')[0].match(/([0-9]+)/g).slice(1);
    assert.equal(codecIds.join(' '), expectedCodecIds.join(' '));
  });
}
