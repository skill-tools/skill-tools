import { defineConfig } from 'tsup';

export default defineConfig([
	{
		entry: ['src/index.ts'],
		format: ['esm', 'cjs'],
		dts: true,
		sourcemap: true,
		clean: true,
		splitting: false,
		treeshake: true,
		target: 'node18',
		outDir: 'dist',
	},
	{
		entry: ['src/cli.ts'],
		format: ['esm'],
		sourcemap: true,
		splitting: false,
		treeshake: true,
		target: 'node18',
		outDir: 'dist',
		banner: {
			js: '#!/usr/bin/env node',
		},
	},
]);
