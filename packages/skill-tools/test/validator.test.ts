import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validate } from '../src/validator.js';

const FIXTURES = resolve(import.meta.dirname, 'fixtures');

describe('validate', () => {
	it('validates a good skill as passing', async () => {
		const results = await validate(resolve(FIXTURES, 'good-skill'));

		expect(results).toHaveLength(1);
		expect(results[0]!.valid).toBe(true);
		expect(results[0]!.name).toBe('deploy-vercel');
	});

	it('validates a bad skill (still parses since spec-valid)', async () => {
		const results = await validate(resolve(FIXTURES, 'bad-skill'));

		expect(results).toHaveLength(1);
		// bad-skill has a vague description but is technically spec-valid
		// Quality issues are caught by the linter, not the validator
		expect(results[0]!.valid).toBe(true);
	});

	it('returns error for non-existent path', async () => {
		const results = await validate('/non/existent/path');

		expect(results).toHaveLength(1);
		expect(results[0]!.valid).toBe(false);
		expect(results[0]!.diagnostics[0]!.ruleId).toBe('skill-not-found');
	});

	it('validates multiple skills in a directory', async () => {
		const results = await validate(FIXTURES);

		expect(results.length).toBeGreaterThanOrEqual(3);
	});
});
