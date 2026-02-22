#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Command } from 'commander';
import { generateFromMcp, generateFromOpenApi, generateFromText } from './generator.js';
import type { McpConnectionOptions, McpGenerateOptions } from './mcp-types.js';
import type { GenerateOptions } from './types.js';

const program = new Command();

program
	.name('skillgen')
	.description('Generate Agent Skills (SKILL.md) from API specifications')
	// TODO: read from package.json at build time
	.version('0.3.0');

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

program
	.command('mcp')
	.description('Generate SKILL.md from an MCP server by introspecting its tools')
	.argument('[server]', 'Server name (optional, auto-detected)')
	.option('--command <cmd>', 'Command to start MCP server (stdio transport)')
	.option('--args <args...>', 'Arguments for the command')
	.option('--env <pairs...>', 'Environment variables as KEY=VALUE')
	.option('--url <url>', 'Remote MCP server URL (HTTP/SSE transport)')
	.option('-o, --out <dir>', 'Output directory', '.')
	.option('-n, --name <name>', 'Skill name override (kebab-case)')
	.option('--max-tokens <n>', 'Maximum token budget', '4000')
	.option('--timeout <ms>', 'Connection timeout in milliseconds', '30000')
	.option('--no-tool-reference', 'Skip generating references/TOOLS.md')
	.option('-d, --description <desc>', 'Custom description override')
	.action(async (server: string | undefined, opts: Record<string, unknown>) => {
		const command = opts.command as string | undefined;
		const url = opts.url as string | undefined;

		if (!command && !url) {
			console.error('Error: Either --command or --url must be provided');
			process.exitCode = 1;
			return;
		}
		if (command && url) {
			console.error('Error: --command and --url are mutually exclusive');
			process.exitCode = 1;
			return;
		}

		const maxTokens = Number(opts.maxTokens);
		if (Number.isNaN(maxTokens) || maxTokens < 0) {
			console.error('Error: --max-tokens must be a positive number');
			process.exitCode = 1;
			return;
		}

		const timeout = Number(opts.timeout);
		if (Number.isNaN(timeout) || timeout < 0) {
			console.error('Error: --timeout must be a positive number');
			process.exitCode = 1;
			return;
		}

		// Parse --env KEY=VALUE pairs
		const envPairs = (opts.env ?? []) as string[];
		const env: Record<string, string> = {};
		for (const pair of envPairs) {
			const eqIdx = pair.indexOf('=');
			if (eqIdx === -1) {
				console.error(`Error: Invalid --env format "${pair}". Expected KEY=VALUE`);
				process.exitCode = 1;
				return;
			}
			env[pair.slice(0, eqIdx)] = pair.slice(eqIdx + 1);
		}

		const connectionOptions: McpConnectionOptions = {
			command,
			args: (opts.args ?? []) as string[],
			env: Object.keys(env).length > 0 ? env : undefined,
			url,
			timeout,
			name: (opts.name as string | undefined) ?? server,
		};

		const generateOptions: McpGenerateOptions = {
			name: opts.name as string | undefined,
			outDir: opts.out as string,
			maxTokens,
			description: opts.description as string | undefined,
			includeToolReference: opts.toolReference !== false,
		};

		console.log('Connecting to MCP server...');

		const result = await generateFromMcp(connectionOptions, generateOptions);

		if (!result.ok) {
			console.error(`Error: ${result.error}`);
			process.exitCode = 1;
			return;
		}

		const outDir = resolve(generateOptions.outDir ?? '.');
		let written = 0;

		for (const [filePath, content] of result.files) {
			const fullPath = safeResolvePath(outDir, filePath);
			await mkdir(dirname(fullPath), { recursive: true });
			await writeFile(fullPath, content, 'utf-8');
			console.log(`  Created: ${fullPath}`);
			written++;
		}

		console.log('');
		console.log(
			`Generated ${written} skill file(s) from ${result.toolCount} tools (${result.groupCount} groups)`,
		);
		console.log(`Total tokens: ${result.tokenCount}`);

		if (result.tokenCount > maxTokens) {
			console.log('');
			console.log(
				`Warning: Generated content exceeds token budget (${result.tokenCount} > ${maxTokens}).`,
			);
		}
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
