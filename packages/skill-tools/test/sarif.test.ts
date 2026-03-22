import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lint } from '../src/linter.js';
import { toSarif } from '../src/sarif.js';
import { validate } from '../src/validator.js';

const FIXTURES = resolve(import.meta.dirname, 'fixtures');

describe('toSarif', () => {
	it('produces valid SARIF 2.1.0 structure', async () => {
		const validationResults = await validate(resolve(FIXTURES, 'good-skill'));
		const lintResults = validationResults
			.filter((r) => r.valid && r.skill)
			.map((r) => lint(r.skill!));

		const sarif = toSarif(validationResults, lintResults);

		expect(sarif.$schema).toContain('sarif-schema-2.1.0');
		expect(sarif.version).toBe('2.1.0');
		expect(sarif.runs).toHaveLength(1);
		expect(sarif.runs[0]!.tool.driver.name).toBe('skill-tools');
		expect(Array.isArray(sarif.runs[0]!.results)).toBe(true);
	});

	it('maps diagnostic severities to SARIF levels', async () => {
		const validationResults = await validate(resolve(FIXTURES, 'bad-skill'));
		const lintResults = validationResults
			.filter((r) => r.valid && r.skill)
			.map((r) => lint(r.skill!));

		const sarif = toSarif(validationResults, lintResults);
		const results = sarif.runs[0]!.results;

		// bad-skill has warnings (name mismatch, etc.)
		expect(results.length).toBeGreaterThan(0);
		for (const r of results) {
			expect(['error', 'warning', 'note']).toContain(r.level);
		}
	});

	it('includes file locations in results', async () => {
		const validationResults = await validate(resolve(FIXTURES, 'bad-skill'));
		const sarif = toSarif(validationResults, []);

		for (const result of sarif.runs[0]!.results) {
			expect(result.locations).toHaveLength(1);
			expect(result.locations[0]!.physicalLocation.artifactLocation.uri).toBeTruthy();
		}
	});
});
