'use strict';

// @ts-check

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
];

const createExternal = () => [
  ...Object.keys(pkg.dependencies),
];

const commonJsConfig = {
  input,
  output: createOutput('./es5', 'named', 'cjs'),
  external: createExternal(),
  plugins: createPlugins('./es5', 'es5'),
};

const esmConfig = {
  input,
  output: createOutput('./esm', 'auto', 'es'),
  external: createExternal(),
  plugins: createPlugins('./esm', 'es6'),
};

export default [commonJsConfig, esmConfig];
