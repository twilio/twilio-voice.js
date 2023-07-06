import React, { Component } from 'react';
import { Device } from '@twilio/voice-sdk';

export default class App extends Component {
  constructor(props) {
    super(props);
    const device = new Device(props.token);
    device.on('error', () => this.setState({ ...this.state, success: false }));
    device.on('registered', () => this.setState({ ...this.state, success: true }));
    device.register().catch(() => this.setState({ ...this.state, success: false }));
    this.state = { device };
  }

  render() {
    if (this.state.success === true) {
      return <p>Setup successful</p>;
    }
    if (this.state.success === false) {
      return <p>Setup failed</p>;
    }
    return <p>Calling Device.setup</p>;
  }
}
