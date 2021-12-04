import * as assert from 'assert';
import * as sinon from 'sinon';
import {
  createEventGatewayURI,
  createSignalingEndpointURL,
  defaultEdge,
  defaultRegion,
  deprecatedRegions,
  edgeToRegion,
  getChunderURIs,
  getRegionShortcode,
  Region,
  regionShortcodes,
  regionToEdge,
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

  describe('getChunderURI', () => {
    let onDeprecated: sinon.SinonSpy;

    beforeEach(() => {
      onDeprecated = sinon.spy();
    });

    describe('with invalid parameter typings', async () => {
      [
        ['foo', {}],
        ['foo', []],
        ['foo', 2],
        [{}, 'bar'],
      ].forEach(([edge, region]) => {
        describe(`edge "${edge}" and region "${region}"`, () => {
          it('should throw', () => {
            assert.throws(() => {
              getChunderURIs(edge as any, region as any);
            });
          });
        });
      });
    });

    it('should work with or without the deprecation handler', async () => {
      const uri = [
        getChunderURIs(undefined, undefined, onDeprecated),
        getChunderURIs(undefined, undefined),
      ];
      assert.deepEqual(uri[0], uri[1]);
      assert.deepEqual(uri[0], ['chunderw-vpc-gll.twilio.com']);
    });

    describe('without edge or region', () => {
      it('should not call the deprecation handler', async () => {
        getChunderURIs(undefined, undefined, onDeprecated);
        await new Promise(resolve => setTimeout(() => {
          assert.equal(onDeprecated.callCount, 0);
          resolve();
        }));
      });

      it('should return the default chunder uri', () => {
        const uris = getChunderURIs(undefined, undefined);
        assert.deepEqual(uris, ['chunderw-vpc-gll.twilio.com']);
      });
    });

    describe('without edge and with region', () => {
      describe('for deprecated known regions', () => {
        Object.entries(deprecatedRegions).forEach(([deprecatedRegion, preferredRegion]) => {
          describe(deprecatedRegion, () => {
            it('should call the deprecation handler and recommend an edge', async () => {
              const preferredEdge = regionToEdge[preferredRegion];
              getChunderURIs(undefined, deprecatedRegion, onDeprecated);

              await new Promise(resolve => setTimeout(() => {
                assert(onDeprecated.calledOnce);
                assert(onDeprecated.args[0][0].match(new RegExp(`please use \`edge\` "${preferredEdge}"`)));
                resolve();
              }));
            });

            it('should return the right chunder uri', () => {
              const uris = getChunderURIs(undefined, deprecatedRegion, onDeprecated);
              assert.deepEqual(uris, [`chunderw-vpc-gll-${preferredRegion}.twilio.com`]);
            });
          });
        });
      });

      describe('for nondeprecated known regions', () => {
        Object.values(Region).filter(r => r !== defaultRegion).forEach(region => {
          describe(region, () => {
            it('should call the deprecation handler and recommend an edge', async () => {
              const preferredEdge = regionToEdge[region];
              getChunderURIs(undefined, region, onDeprecated);
              await new Promise(resolve => setTimeout(() => {
                assert(onDeprecated.calledOnce);
                assert(onDeprecated.args[0][0].match(new RegExp(`please use \`edge\` "${preferredEdge}"`)));
                resolve();
              }));
            });

            it('should return the right chunder uri', () => {
              const uris = getChunderURIs(undefined, region, onDeprecated);
              assert.deepEqual(uris, [`chunderw-vpc-gll-${region}.twilio.com`]);
            });
          });
        });
      });

      describe('for an unknown region', () => {
        it('should call the deprecation handler, but not recommend an edge', async () => {
          getChunderURIs(undefined, 'foo', onDeprecated);
          await new Promise(resolve => setTimeout(() => {
            assert(onDeprecated.calledOnce);
            assert.equal(onDeprecated.args[0][0].match(new RegExp('edge', 'g')).length, 2);
            assert.equal(onDeprecated.args[0][0].match(new RegExp('please use', 'g')), null);
            resolve();
          }));
        });

        it('should return the right chunder uri', () => {
          const uris = getChunderURIs(undefined, 'foo', onDeprecated);
          assert.deepEqual(uris, ['chunderw-vpc-gll-foo.twilio.com']);
        });
      });

      describe('for the default (gll) region', () => {
        it('should call the deprecation handler and recommend an edge', async () => {
          getChunderURIs(undefined, 'gll', onDeprecated);
          await new Promise(resolve => setTimeout(() => {
            assert(onDeprecated.calledOnce);
            assert.equal(onDeprecated.args[0][0].match(new RegExp('edge', 'g')).length, 3);
            assert.equal(onDeprecated.args[0][0].match(new RegExp(`please use \`edge\` "roaming"`, 'g')).length, 1);
            resolve();
          }));
        });

        it('should return the right chunder uri', () => {
          const uris = getChunderURIs(undefined, 'gll', onDeprecated);
          assert.deepEqual(uris, ['chunderw-vpc-gll.twilio.com']);
        });
      });
    });

    describe('with edge and without region', () => {
      describe('for known edges', () => {
        Object.entries(edgeToRegion).filter(([e]) => e !== defaultEdge).forEach(([edge, region]) => {
          describe(edge, () => {
            it('should not call the deprecation handler', async () => {
              getChunderURIs(edge, undefined, onDeprecated);
              await new Promise(resolve => setTimeout(() => {
                assert(onDeprecated.notCalled);
                resolve();
              }));
            });

            it('should return the right chunder uri', () => {
              const uris = getChunderURIs(edge, undefined, onDeprecated);
              assert.deepEqual(uris, [`chunderw-vpc-gll-${region}.twilio.com`]);
            });
          });
        });
      });

      describe('for unknown edges', () => {
        it('should not call the deprecation handler', async () => {
          getChunderURIs('foo', undefined, onDeprecated);
          await new Promise(resolve => setTimeout(() => {
            assert(onDeprecated.notCalled);
            resolve();
          }));
        });

        it('should transform the uri properly', () => {
          const uris = getChunderURIs('foo', undefined, onDeprecated);
          assert.deepEqual(uris, ['voice-js.foo.twilio.com']);
        });
      });

      describe('for default (roaming) edge', () => {
        it('should not call the deprecation handler', async () => {
          getChunderURIs('roaming', undefined, onDeprecated);
          await new Promise(resolve => setTimeout(() => {
            assert(onDeprecated.notCalled);
            resolve();
          }));
        });

        it('should transform the uri properly', () => {
          const uris = getChunderURIs('roaming', undefined, onDeprecated);
          assert.deepEqual(uris, ['chunderw-vpc-gll.twilio.com']);
        });
      });

      describe('for multiple edges', () => {
        it('should return the right chunder uris', () => {
          const uris = getChunderURIs(['singapore', 'sydney'], undefined, onDeprecated);
          assert.deepEqual(uris, [
            'chunderw-vpc-gll-sg1.twilio.com',
            'chunderw-vpc-gll-au1.twilio.com',
          ]);
        });

        it('should not throw if roaming is provided in the edge array', () => {
          assert(getChunderURIs(['roaming'], undefined));
        });

        it('should not throw if roaming is provided as a string', () => {
          assert(getChunderURIs('roaming', undefined));
        });
      });
    });

    it('should throw an error with both', () => {
      assert.throws(() => getChunderURIs('foo', 'bar', onDeprecated));
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
