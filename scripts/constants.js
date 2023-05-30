'use strict';

const fs = require('fs');
const pkg = require('../package.json');
const twilioFileString = fs.readFileSync('./templates/constants.ts', 'utf8');
fs.writeFileSync('./lib/twilio/constants.ts', `\
/**
 * This file is generated on build. To make changes, see /templates/constants.ts
 */
${twilioFileString
    .replace('$packageName', pkg.name)
    .replace('$version', pkg.version)}`, 'utf8');
