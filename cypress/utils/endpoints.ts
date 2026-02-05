import Device from "../../lib/twilio/device";

export const isStage = Cypress.env('ENV') === 'stage';

export const getEndpoints = (edge: string) => isStage
  ? {
    chunderw: `voice-js.${edge}.stage.twilio.com`,
    eventgw: 'eventgw.stage.twilio.com',
  } as Device.Options
  : {} as Device.Options;

export const defaultEndpoints: Device.Options = isStage
  ? {
    chunderw: 'voice-js.roaming.stage.twilio.com',
    eventgw: 'eventgw.stage.twilio.com',
  } as Device.Options
  : {} as Device.Options;
