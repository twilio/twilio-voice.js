export const isStage = Cypress.env('ENV') === 'stage';

export const getEndpoints = (edge: string) => isStage ? {
  chunderw: `voice-js.${edge}.stage.twilio.com`,
  eventgw: 'eventgw.stage.twilio.com',
} : {};

export const defaultEndpoints = isStage ? {
  chunderw: 'voice-js.roaming.stage.twilio.com',
  eventgw: 'eventgw.stage.twilio.com',
} : {};
