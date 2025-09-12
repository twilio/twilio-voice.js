import { IceCandidate } from '../../lib/twilio/rtc/icecandidate';
import * as assert from 'assert';

describe('Candidate', () => {
  let data: any;
  let output: any;

  beforeEach(() => {
    data = {
      type: 'host',
      address: '192.168.1.1',
      candidate: 'network-id 2 network-cost 20',
      port: 63982,
      priority: 123,
      protocol: 'udp',
      relatedAddress: '10.2.2.1',
      relatedPort: 65982,
      tcpType: 'active',
      sdpMid: 'audio'
    };

    output = {
      candidate_type: 'host',
      deleted: false,
      ip: '192.168.1.1',
      is_remote: false,
      'network-cost': 20,
      port: 63982,
      priority: 123,
      protocol: 'udp',
      related_address: '10.2.2.1',
      related_port: 65982,
      tcp_type: 'active',
      transport_id: 'audio'
    };
  });

  it('Should return valid IceCandidate', () => {
    assert.deepEqual(new IceCandidate(data).toPayload(), output);
  });

  it('Should return undefined when a property is not supported', () => {
    delete data.address;
    assert.equal(new IceCandidate(data).toPayload().ip, undefined);
  });

  it('Should use ip if exists', () => {
    data.ip = 'foo';
    assert.equal(new IceCandidate(data).toPayload().ip, 'foo');
  });

  it('Should return empty cost if it does not exists', () => {
    data.candidate = 'foo';
    assert.equal(new IceCandidate(data).toPayload()['network-cost'], undefined);
  });

  it('Should return default values for deleted and remote', () => {
    const result = new IceCandidate(data).toPayload();
    assert(result.deleted === false);
    assert(result.is_remote === false);
  });

  it('Should set remote to false if it is provided as false', () => {
    const result = new IceCandidate(data, false).toPayload();
    assert(result.is_remote === false);
  });

  it('Should set remote to true if it is provided as true', () => {
    const result = new IceCandidate(data, true).toPayload();
    assert(result.is_remote === true);
  });
});
