#!/usr/bin/env node
'use strict';

const browserify = require('browserify');
const fs = require('fs/promises');
const { createWriteStream } = require('fs');
const pkg = require('../package.json');

const entryPoint = pkg.main;
const template = process.argv[2];
const license = process.argv[3];
const dest = process.argv[4];
const debug = process.env.ENV === 'dev';

const bundler = browserify({
  entries: entryPoint,
  debug
});

let entryPointId = null;
bundler.on('dep', dep => {
  entryPointId = dep.entry ? dep.id : entryPointId;
});

return Promise.all([
  fs.mkdir(__dirname + '/../dist', { recursive: true }),
  fs.readFile(template),
  fs.readFile(license),
  readableStreamToPromise(bundler.bundle())
]).then(results => {
  if (entryPointId === null) {
    throw new Error('Entry point ID not found!');
  }

  const [_, template, license, bundle] = results;
  const rendered = template.toString()
    .split('$name').join(pkg.name)
    .split('$version').join(pkg.version)
    .split('$license').join(license)
    .split('$entry').join(entryPointId)
    .split('$bundle').join(bundle);

  createWriteStream(dest).end(rendered);
})
.catch(console.error); // Just in case something goes wrong

function readableStreamToPromise(readable) {
  return new Promise((resolve, reject) => {
    let data = '';
    readable.on('data', chunk => data += chunk);
    readable.once('end', () => resolve(data));
    readable.once('error', reject);
  });
}
