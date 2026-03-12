import { Device, Edge } from '../../lib/twilio';

const checkEdge = () => {
  // Edge is a type-only export of the enum from regions.ts
  // Verify Edge is usable as a type annotation

  // Device.Options accepts edge as string | string[]
  const options1: Device.Options = { edge: 'ashburn' };
  const options2: Device.Options = { edge: ['ashburn', 'dublin'] };

  // Device.edge returns string | null, which is compatible with Edge values
  const device: Device = new Device('foo', { edge: 'roaming' });
  const currentEdge: string | null = device.edge;

  // Edge can be used to type function parameters
  function connectToEdge(edge: Edge): void {
    const opts: Device.Options = { edge: edge as string };
  }

  // Edge can be used in type position for variables
  let selectedEdge: Edge;
};

export default checkEdge;
