import { parseSkill } from '@skill-tools/core';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lint } from '../src/linter.js';

const FIXTURES = resolve(import.meta.dirname, 'fixtures');

describe('lint', () => {
	it('reports no errors for a good skill', async () => {
		const parseResult = await parseSkill(resolve(FIXTURES, 'good-skill/SKILL.md'));
		if (!parseResult.ok) throw new Error('Parse failed');

		const result = lint(parseResult.skill);

		expect(result.errorCount).toBe(0);
	});

	it('reports specificity warning for vague description', async () => {
		const parseResult = await parseSkill(resolve(FIXTURES, 'bad-skill/SKILL.md'));
		if (!parseResult.ok) throw new Error('Parse failed');

		const result = lint(parseResult.skill);

		const specificityIssue = result.diagnostics.find(
			(d) => d.ruleId === 'description-specificity',
		);
		expect(specificityIssue).toBeDefined();
	});

	it('reports secrets in SKILL.md', async () => {
		const parseResult = await parseSkill(resolve(FIXTURES, 'secret-skill/SKILL.md'));
		if (!parseResult.ok) throw new Error('Parse failed');

		const result = lint(parseResult.skill);

		const secretIssue = result.diagnostics.find((d) => d.ruleId === 'no-secrets');
		expect(secretIssue).toBeDefined();
		expect(secretIssue!.severity).toBe('error');
	});

	it('reports hardcoded paths', async () => {
		const parseResult = await parseSkill(resolve(FIXTURES, 'secret-skill/SKILL.md'));
		if (!parseResult.ok) throw new Error('Parse failed');

		const result = lint(parseResult.skill);

		const pathIssue = result.diagnostics.find((d) => d.ruleId === 'no-hardcoded-paths');
		expect(pathIssue).toBeDefined();
	});

	it('respects rule overrides', async () => {
		const parseResult = await parseSkill(resolve(FIXTURES, 'bad-skill/SKILL.md'));
		if (!parseResult.ok) throw new Error('Parse failed');

		const result = lint(parseResult.skill, {
			'description-specificity': 'off',
		});

		const specificityIssue = result.diagnostics.find(
			(d) => d.ruleId === 'description-specificity',
		);
		expect(specificityIssue).toBeUndefined();
	});
});
