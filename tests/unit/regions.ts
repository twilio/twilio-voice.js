import * as assert from 'assert';
import * as sinon from 'sinon';
import {
  createEventGatewayURI,
  createSignalingEndpointURL,
  defaultEdge,
  Edge,
  getChunderURIs,
  getRegionShortcode,
  Region,
  regionShortcodes,
} from '../../lib/twilio/regions';

describe('regions', () => {
  describe('createEventGatewayURI', () => {
    [null, '', undefined, 0].forEach((home: any) => {
      it(`should set event gateway uri to eventgw.twilio.com if home is '${home}'`, () => {
        assert.equal(createEventGatewayURI(home), 'eventgw.twilio.com');
      });
    });

    Object.values(Region).concat(['foo', 'bar'] as any).forEach((home: any) => {
      it(`should set event gateway uri to eventgw.${home}.twilio.com when home is set to '${home}'`, () => {
        assert.equal(createEventGatewayURI(home), `eventgw.${home}.twilio.com`);
      });
    });
  });

  describe('getChunderURIs', () => {
    describe('with invalid parameter typings', async () => {
      [
        {},
        2,
      ].forEach((edge) => {
        describe(`edge "${edge}"`, () => {
          it('should throw', () => {
            assert.throws(() => {
              getChunderURIs(edge as any);
            });
          });
        });
      });
    });

    describe('without edge', () => {
      it('should return the default chunder uri', () => {
        const uris = getChunderURIs(undefined);
        assert.deepEqual(uris, ['voice-js.roaming.twilio.com']);
      });
    });

    describe('with edge', () => {
      describe('for known edges', () => {
        Object.values(Edge).forEach((edge) => {
          describe(edge, () => {
            it('should return the right chunder uri', () => {
              const uris = getChunderURIs(edge);
              assert.deepEqual(uris, [`voice-js.${edge}.twilio.com`]);
            });
          });
        });
      });

      describe('for unknown edges', () => {
        it('should transform the uri properly', () => {
          const uris = getChunderURIs('foo');
          assert.deepEqual(uris, ['voice-js.foo.twilio.com']);
        });
      });

      describe('for default (roaming) edge', () => {
        it('should transform the uri properly', () => {
          const uris = getChunderURIs('roaming');
          assert.deepEqual(uris, ['voice-js.roaming.twilio.com']);
        });
      });

      describe('for multiple edges', () => {
        it('should return the right chunder uris', () => {
          const uris = getChunderURIs(['singapore', 'sydney']);
          assert.deepEqual(uris, [
            'voice-js.singapore.twilio.com',
            'voice-js.sydney.twilio.com',
          ]);
        });

        it('should not throw if roaming is provided in the edge array', () => {
          assert(getChunderURIs(['roaming']));
        });

        it('should not throw if roaming is provided as a string', () => {
          assert(getChunderURIs('roaming'));
        });
      });
    });
  });

  describe('getRegionShortcode', () => {
    it('should return the correct region from the shortcode', () => {
      Object.entries(regionShortcodes).forEach(([shortcode, region]) => {
        const result = getRegionShortcode(shortcode);
        assert.equal(result, region);
      });
    });

    it('should return null for an unknown shortcode', () => {
      const result = getRegionShortcode('foo');
      assert.equal(result, null);
    });
  });

  describe('createSignalingEndpointURL', () => {
    it('should transform a uri into an endpoint', () => {
      const uri = 'foobar';
      const url = createSignalingEndpointURL(uri);
      assert.equal(url, 'wss://foobar/signal');
    });
  });
});
