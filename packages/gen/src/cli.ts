#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Command } from 'commander';
import { generateFromOpenApi, generateFromText } from './generator.js';
import type { GenerateOptions } from './types.js';

const program = new Command();

program
	.name('skillgen')
	.description('Generate Agent Skills (SKILL.md) from API specifications')
	.version('0.2.0');

program
	.command('openapi')
	.description('Generate SKILL.md from an OpenAPI 3.x specification')
	.argument('<spec>', 'Path to OpenAPI spec file (JSON or YAML)')
	.option('-o, --out <dir>', 'Output directory', '.')
	.option('-n, --name <name>', 'Skill name (kebab-case)')
	.option('-m, --mode <mode>', 'Generation mode: unified or per-endpoint', 'unified')
	.option('--max-tokens <n>', 'Maximum token budget', '4000')
	.option('--no-examples', 'Exclude example requests/responses')
	.option('--no-error-handling', 'Exclude error handling section')
	.option('-d, --description <desc>', 'Custom description override')
	.action(async (specPath: string, opts: Record<string, unknown>) => {
		const maxTokens = Number(opts.maxTokens);
		if (Number.isNaN(maxTokens) || maxTokens < 0) {
			console.error('Error: --max-tokens must be a positive number');
			process.exitCode = 1;
			return;
		}

		const options: GenerateOptions = {
			name: opts.name as string | undefined,
			outDir: opts.out as string,
			mode: opts.mode as 'unified' | 'per-endpoint',
			maxTokens,
			includeExamples: opts.examples !== false,
			includeErrorHandling: opts.errorHandling !== false,
			description: opts.description as string | undefined,
		};

		const result = await generateFromOpenApi(resolve(specPath), options);

		if (!result.ok) {
			console.error(`Error: ${result.error}`);
			process.exitCode = 1;
			return;
		}

		const outDir = resolve(options.outDir ?? '.');
		let written = 0;

		for (const [filePath, content] of result.files) {
			const fullPath = safeResolvePath(outDir, filePath);
			await mkdir(dirname(fullPath), { recursive: true });
			await writeFile(fullPath, content, 'utf-8');
			console.log(`  Created: ${fullPath}`);
			written++;
		}

		console.log('');
		console.log(`Generated ${written} skill file(s) from ${result.endpointCount} endpoints`);
		console.log(`Total tokens: ${result.tokenCount}`);

		if (result.tokenCount > maxTokens) {
			console.log('');
			console.log(
				`Warning: Generated content exceeds token budget (${result.tokenCount} > ${maxTokens}).`,
			);
			console.log('Consider using --mode per-endpoint to split into separate skills.');
		}
	});

program
	.command('from-text')
	.description('Generate a basic SKILL.md from a name and description')
	.argument('<name>', 'Skill name')
	.argument('<description>', 'Skill description')
	.option('-o, --out <dir>', 'Output directory', '.')
	.option('-i, --instructions <text>', 'Additional instructions to include')
	.action(async (name: string, description: string, opts: Record<string, unknown>) => {
		const result = generateFromText(name, description, opts.instructions as string | undefined);

		const outDir = resolve((opts.out as string) ?? '.');

		for (const [filePath, content] of result.files) {
			const fullPath = safeResolvePath(outDir, filePath);
			await mkdir(dirname(fullPath), { recursive: true });
			await writeFile(fullPath, content, 'utf-8');
			console.log(`  Created: ${fullPath}`);
		}

		console.log('');
		console.log(`Generated skill "${name}" (${result.tokenCount} tokens)`);
	});

/**
 * Resolve a file path within a base directory, preventing path traversal.
 * Throws if the resolved path escapes the base directory.
 */
function safeResolvePath(baseDir: string, filePath: string): string {
	const resolved = resolve(baseDir, filePath);
	const normalizedBase = resolve(baseDir);
	if (!resolved.startsWith(`${normalizedBase}/`) && resolved !== normalizedBase) {
		throw new Error(`Path traversal detected: "${filePath}" escapes output directory`);
	}
	return resolved;
}

program.parse();
