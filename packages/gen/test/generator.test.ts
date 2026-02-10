import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateFromOpenApi, generateFromSpec, generateFromText } from '../src/generator.js';
import { parseOpenApi } from '../src/openapi.js';

const FIXTURES = resolve(import.meta.dirname, 'fixtures');

describe('generateFromOpenApi', () => {
	it('generates skill files from a spec path', async () => {
		const result = await generateFromOpenApi(resolve(FIXTURES, 'petstore.json'));

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.files.size).toBe(1);
		expect(result.endpointCount).toBe(5);
		expect(result.tokenCount).toBeGreaterThan(0);
	});

	it('returns error for non-existent file', async () => {
		const result = await generateFromOpenApi('/nonexistent/path.json');

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toContain('ENOENT');
	});

	it('generates per-endpoint files', async () => {
		const result = await generateFromOpenApi(resolve(FIXTURES, 'petstore.json'), {
			mode: 'per-endpoint',
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.files.size).toBe(5);
	});

	it('works with YAML specs', async () => {
		const result = await generateFromOpenApi(resolve(FIXTURES, 'petstore.yaml'));

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.endpointCount).toBe(1);
	});
});

describe('generateFromSpec', () => {
	it('generates from a pre-parsed spec', () => {
		const content = readFileSync(resolve(FIXTURES, 'petstore.json'), 'utf-8');
		const spec = parseOpenApi(content);
		const result = generateFromSpec(spec);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.files.size).toBe(1);
		expect(result.endpointCount).toBe(5);
	});

	it('respects custom name option', () => {
		const content = readFileSync(resolve(FIXTURES, 'petstore.json'), 'utf-8');
		const spec = parseOpenApi(content);
		const result = generateFromSpec(spec, { name: 'my-api' });

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const paths = Array.from(result.files.keys());
		expect(paths[0]).toBe('my-api/SKILL.md');
	});
});

describe('generateFromText', () => {
	it('generates a basic SKILL.md from text', () => {
		const result = generateFromText(
			'Deploy Vercel',
			'Deploy applications to Vercel. Use when the user wants to push to production.',
		);

		expect(result.ok).toBe(true);
		expect(result.files.size).toBe(1);

		const [path, content] = Array.from(result.files.entries())[0]!;
		expect(path).toBe('deploy-vercel/SKILL.md');
		expect(content).toContain('name: deploy-vercel');
		expect(content).toContain('Deploy applications to Vercel');
	});

	it('includes instructions when provided', () => {
		const result = generateFromText(
			'Run Tests',
			'Execute test suites.',
			'1. Run `npm test`\n2. Check coverage report',
		);

		expect(result.ok).toBe(true);
		const content = Array.from(result.files.values())[0]!;
		expect(content).toContain('## Instructions');
		expect(content).toContain('npm test');
	});

	it('converts name to kebab-case', () => {
		const result = generateFromText('My Cool Skill', 'A cool skill.');

		const [path] = Array.from(result.files.keys());
		expect(path).toBe('my-cool-skill/SKILL.md');
	});

	it('reports token count', () => {
		const result = generateFromText('test', 'A test skill.');
		expect(result.tokenCount).toBeGreaterThan(0);
	});
});
