import { readFile } from 'node:fs/promises';
import { countTokens, type Diagnostic, parseSkillContent } from '@skill-tools/core';
import { introspectMcpServer } from './mcp.js';
import { renderMcpSkillMd } from './mcp-renderer.js';
import type {
	McpConnectionOptions,
	McpGenerateOptions,
	McpGenerateResult,
	McpServerSpec,
} from './mcp-types.js';
import { parseOpenApi } from './openapi.js';
import { renderSkillMd } from './renderer.js';
import type { ApiSpec, GenerateError, GenerateOptions, GenerateResult } from './types.js';

/**
 * Generate SKILL.md files from an OpenAPI specification file.
 *
 * @param specPath - Path to an OpenAPI 3.x spec (JSON or YAML)
 * @param options - Generation options
 * @returns Generation result with files map, or an error
 */
export async function generateFromOpenApi(
	specPath: string,
	options: GenerateOptions = {},
): Promise<GenerateResult | GenerateError> {
	try {
		const content = await readFile(specPath, 'utf-8');
		const spec = parseOpenApi(content);
		return generateFromSpec(spec, options);
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * Generate SKILL.md files from a pre-parsed ApiSpec.
 *
 * @param spec - The API specification
 * @param options - Generation options
 * @returns Generation result with files map
 */
export function generateFromSpec(
	spec: ApiSpec,
	options: GenerateOptions = {},
): GenerateResult | GenerateError {
	try {
		const files = renderSkillMd(spec, options);

		// Compute total token count
		let totalTokens = 0;
		for (const content of files.values()) {
			totalTokens += countTokens(content);
		}

		// If maxTokens is set and exceeded in unified mode, warn but don't fail
		const maxTokens = options.maxTokens ?? 4000;
		if (options.mode !== 'per-endpoint' && totalTokens > maxTokens) {
			// Try to truncate — for now, we just return as-is with the count.
			// Future: implement smart truncation.
		}

		return {
			ok: true,
			files,
			endpointCount: spec.endpoints.length,
			tokenCount: totalTokens,
			diagnostics: validateGeneratedFiles(files),
		};
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * Generate SKILL.md files by connecting to a live MCP server and introspecting its tools.
 *
 * @param connectionOptions - How to connect (command/url)
 * @param generateOptions - Generation options (name, outDir, etc.)
 * @returns Generation result with files map, or an error
 */
export async function generateFromMcp(
	connectionOptions: McpConnectionOptions,
	generateOptions: McpGenerateOptions = {},
): Promise<McpGenerateResult | GenerateError> {
	try {
		const spec = await introspectMcpServer(connectionOptions);
		return generateFromMcpSpec(spec, generateOptions);
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * Generate SKILL.md files from a pre-parsed {@link McpServerSpec}.
 *
 * Useful for testing and for consumers who already have the spec.
 */
export function generateFromMcpSpec(
	spec: McpServerSpec,
	options: McpGenerateOptions = {},
): McpGenerateResult | GenerateError {
	try {
		const files = renderMcpSkillMd(spec, options);

		let totalTokens = 0;
		for (const content of files.values()) {
			totalTokens += countTokens(content);
		}

		return {
			ok: true,
			files,
			toolCount: spec.toolCount,
			groupCount: spec.groups.length,
			tokenCount: totalTokens,
			diagnostics: validateGeneratedFiles(files),
		};
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * Generate a SKILL.md from a simple text description.
 *
 * This is a lightweight alternative for when you don't have an OpenAPI spec.
 * Produces a basic SKILL.md with the given name and description.
 */
export function generateFromText(
	name: string,
	description: string,
	instructions: string = '',
): GenerateResult {
	const kebabName = name
		.replace(/[^a-zA-Z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.toLowerCase()
		.slice(0, 64);

	const lines: string[] = [];
	lines.push('---');
	lines.push(`name: ${kebabName}`);
	lines.push(`description: >-`);
	lines.push(`  ${description}`);
	lines.push('---');
	lines.push('');
	lines.push(`# ${name}`);
	lines.push('');
	lines.push(description);
	lines.push('');

	if (instructions) {
		lines.push('## Instructions');
		lines.push('');
		lines.push(instructions);
		lines.push('');
	}

	const content = lines.join('\n');
	const files = new Map<string, string>();
	files.set(`${kebabName}/SKILL.md`, content);

	return {
		ok: true,
		files,
		endpointCount: 0,
		tokenCount: countTokens(content),
		diagnostics: validateGeneratedFiles(files),
	};
}

/**
 * Validate generated SKILL.md files by parsing them.
 * Returns diagnostics without throwing — callers decide whether to surface warnings.
 */
function validateGeneratedFiles(files: ReadonlyMap<string, string>): Diagnostic[] {
	const all: Diagnostic[] = [];
	for (const [path, content] of files) {
		if (!path.endsWith('SKILL.md')) continue;
		const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '.';
		const result = parseSkillContent(content, path, dir);
		all.push(...result.diagnostics);
	}
	return all;
}
