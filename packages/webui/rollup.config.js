import typescript from '@rollup/plugin-typescript';
import { dts } from 'rollup-plugin-dts';
import pkg from './package.json' with { type: 'json' };

const name = pkg.name;

export default [
  // Browser-friendly version
  {
    input: 'src/index.ts',
    output: {
      name,
      file: 'dist/index.min.js',
      format: 'iife',
      globals: {
        react: 'React',
        'react-dom': 'ReactDOM',
      },
    },
    external: ['react', 'react-dom'],
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
      }),
    ],
  },
  // ES module version
  {
    input: 'src/index.ts',
    output: [
      { file: 'dist/index.esm.js', format: 'es' },
      { file: 'dist/index.cjs.js', format: 'cjs' },
    ],
    external: ['react', 'react-dom'],
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
      }),
    ],
  },
  // Type declarations
  {
    input: 'dist/dts/src/index.d.ts',
    output: [{ file: 'dist/index.d.ts', format: 'es' }],
    plugins: [dts()],
  },
];
