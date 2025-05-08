import { TwilioError } from '../../lib/twilio';

const checkTwilioError = async () => {
  const error = new TwilioError.TwilioError;
  const causes: string[] = error.causes;
  const code: number = error.code;
  const description: string = error.description;
  const explanation: string = error.explanation;
  const message: string = error.message;
  const name: string = error.name;
  const originalError: any = error.originalError;
  const solutions: string[] = error.solutions;

};

export default checkTwilioError;
