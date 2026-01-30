export const isStage = Cypress.env('STAGE') === 'true';

export const getEndpoints = (edge: string) => isStage ? {
  chunderw: `voice-js.${edge}.stage.twilio.com`,
  eventgw: 'eventgw.stage.twilio.com',
} : {};

export const endpoints = isStage ? {
  chunderw: 'voice-js.roaming.stage.twilio.com',
  eventgw: 'eventgw.stage.twilio.com',
} : {};
