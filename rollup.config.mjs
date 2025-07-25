import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

const input = 'lib/twilio.ts';
const sourcemap = 'inline';
const preferBuiltins = false;
const tsconfig = './tsconfig.json';

const commonJsConfig = {
  input,
  output: { dir: './es5', format: 'cjs', sourcemap },
  plugins: [
    commonjs(),
    nodeResolve({ preferBuiltins, }),
    typescript({ outDir: './es5', target: 'es5', tsconfig }),
  ],
};

const esmConfig = {
  input,
  output: { dir: './esm', format: 'es', sourcemap },
  plugins: [
    commonjs(),
    nodeResolve({ preferBuiltins }),
    typescript({ outDir: './esm', target: 'es6', tsconfig }),
  ],
};

const umdConfig = {
  input,
  output: { dir: './umd', format: 'umd', name: 'Twilio', sourcemap },
  plugins: [
    commonjs(),
    nodeResolve({ preferBuiltins }),
    typescript({ outDir: './umd', target: 'es6', tsconfig }),
  ],
};

export default [commonJsConfig, esmConfig, umdConfig];
