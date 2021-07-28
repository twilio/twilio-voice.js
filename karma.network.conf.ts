const fs = require('fs');
const yaml = require('js-yaml');
const isDocker = require('is-docker')();

if (fs.existsSync(__dirname + '/config.yaml')) {
  const creds = yaml.safeLoad(fs.readFileSync(__dirname + '/config.yaml', 'utf8')).prod;

  process.env.ACCOUNT_SID = process.env.ACCOUNT_SID || creds.account_sid;
  process.env.API_KEY_SID = process.env.API_KEY_SID || creds.api_key_sid;
  process.env.API_KEY_SECRET = process.env.API_KEY_SECRET || creds.api_key_secret;
  process.env.APPLICATION_SID = process.env.APPLICATION_SID || creds.app_sid;
  process.env.APPLICATION_SID_STIR = process.env.APPLICATION_SID_STIR || creds.app_sid_stir;
  process.env.CALLER_ID = process.env.CALLER_ID || creds.caller_id;
  process.env.AUTH_TOKEN = process.env.AUTH_TOKEN || creds.auth_token;
}

module.exports = function(config: any) {
  const supportedBrowsers: Record<string, string[]> = {
    chrome: ['ChromeWebRTC'],
    firefox: ['FirefoxWebRTC'],
    safari: ['SafariTechPreview']
  };

  let browsers: string[];
  if (process.env.BROWSER) {
    browsers = supportedBrowsers[process.env.BROWSER];
    if (!browsers) {
      throw new Error('Unknown browser');
    }
  } else if (process.platform === 'darwin') {
    browsers = ['ChromeWebRTC', 'FirefoxWebRTC'];
  } else {
    browsers = ['ChromeWebRTC', 'FirefoxWebRTC'];
  }

  const firefoxFlags = [];
  const chromeFlags = [
    '--no-sandbox',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ];

  if (isDocker) {
    firefoxFlags.push('-headless');
    chromeFlags.push(
      '--headless',
      '--disable-gpu',
      '--remote-debugging-port=9222'
    );
  }

  config.set({
    basePath: '',
    browsers,
    colors: true,
    concurrency: 1,
    customLaunchers: {
      ChromeWebRTC: {
        base: 'Chrome',
        flags: chromeFlags,
      },
      FirefoxWebRTC: {
        base: 'Firefox',
        flags: firefoxFlags,
        prefs: {
          'media.autoplay.default': 0,
          'media.autoplay.enabled': true,
          'media.gstreamer.enabled': true,
          'media.navigator.permission.disabled': true,
          'media.navigator.streams.fake': true,
        },
      },
    },
    files: [
      'lib/twilio.ts',
      'lib/twilio/**/*.+(ts|js)',
      'tests/network/*.ts',
    ],
    frameworks: ['mocha', 'karma-typescript'],
    karmaTypescriptConfig: {
      bundlerOptions: {
        addNodeGlobals: true,
        resolve: {
          alias: {
            buffer: './node_modules/buffer/index.js',
            deprecate: './scripts/noop.js',
          }
        },
        transforms: [require('karma-typescript-es6-transform')({
          plugins: [
            'transform-inline-environment-variables',
          ]
        })],
      },
      include: [
        'lib/**/*',
        'tests/network/**/*.ts',
      ],
      tsconfig: './tsconfig.json',
    },
    logLevel: config.LOG_INFO,
    port: 9876,
    preprocessors: {
      'lib/**/*.+(ts|js)': 'karma-typescript',
      'tests/network/*.ts': 'karma-typescript',
    },
    reporters: ['spec', 'karma-typescript'],
    singleRun: true,
    browserDisconnectTolerance: 3,
    browserDisconnectTimeout : 5000,
    browserNoActivityTimeout : 120000,
  });
};
