'use strict';

// @ts-check

import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import pkg from './package.json' with { type: 'json' };

const input = './lib/twilio.ts';

const createOutput = (dir, exports, format) => ({
  dir,
  format,
  exports,
  sourcemap: 'inline',
  preserveModules: true,
  preserveModulesRoot: './lib',
});

const createPlugins = (outDir, target) => [
  commonjs(),
  nodeResolve({
    preferBuiltins: false,
  }),
  typescript({
    outDir,
    target,
    tsconfig: './tsconfig.json',
  }),
  babel({
    babelHelpers: 'bundled',
    include: ['node_modules/sip.js/**'],
    presets: [['@babel/preset-env']],
    extensions: ['.js'],
  }),
];

// sip.js ships as ESM-only, so it must be bundled inline for the CJS build
// (which browserify consumes for the browser dist). The ESM build keeps it
// external so consumers can resolve their own copy.
const BUNDLED_DEPS = ['sip.js'];

const allDeps = Object.keys(pkg.dependencies);

const commonJsConfig = {
  input,
  output: createOutput('./es5', 'named', 'cjs'),
  external: allDeps.filter(dep => !BUNDLED_DEPS.includes(dep)),
  plugins: createPlugins('./es5', 'es5'),
};

const esmConfig = {
  input,
  output: createOutput('./esm', 'auto', 'es'),
  external: allDeps,
  plugins: createPlugins('./esm', 'es6'),
};

export default [commonJsConfig, esmConfig];
