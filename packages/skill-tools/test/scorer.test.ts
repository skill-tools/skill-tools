import { resolve } from 'node:path';
import { parseSkill } from '@skill-tools/core';
import { describe, expect, it } from 'vitest';
import { score } from '../src/scorer/index.js';

const FIXTURES = resolve(import.meta.dirname, 'fixtures');

describe('score', () => {
	it('scores a good skill highly', async () => {
		const parseResult = await parseSkill(resolve(FIXTURES, 'good-skill/SKILL.md'));
		if (!parseResult.ok) throw new Error('Parse failed');

		const result = score(parseResult.skill);

		expect(result.score).toBeGreaterThanOrEqual(70);
		expect(result.dimensions.description_quality?.score).toBeGreaterThan(0);
		expect(result.dimensions.instruction_clarity?.score).toBeGreaterThan(0);
		expect(result.dimensions.spec_compliance?.score).toBe(20); // Perfect compliance
		expect(result.dimensions.security?.score).toBe(10); // No security issues
	});

	it('scores a bad skill lower', async () => {
		const parseResult = await parseSkill(resolve(FIXTURES, 'bad-skill/SKILL.md'));
		if (!parseResult.ok) throw new Error('Parse failed');

		const result = score(parseResult.skill);

		expect(result.score).toBeLessThan(70);
		expect(result.suggestions.length).toBeGreaterThan(0);
	});

	it('penalizes skills with secrets', async () => {
		const parseResult = await parseSkill(resolve(FIXTURES, 'secret-skill/SKILL.md'));
		if (!parseResult.ok) throw new Error('Parse failed');

		const result = score(parseResult.skill);

		expect(result.dimensions.security?.score).toBeLessThan(10);
	});

	it('returns suggestions sorted by point gain', async () => {
		const parseResult = await parseSkill(resolve(FIXTURES, 'bad-skill/SKILL.md'));
		if (!parseResult.ok) throw new Error('Parse failed');

		const result = score(parseResult.skill);

		for (let i = 1; i < result.suggestions.length; i++) {
			expect(result.suggestions[i]?.pointsGain).toBeLessThanOrEqual(
				result.suggestions[i - 1]?.pointsGain,
			);
		}
	});

	it('rewards procedural signals in instruction clarity', async () => {
		const parseResult = await parseSkill(resolve(FIXTURES, 'good-skill/SKILL.md'));
		if (!parseResult.ok) throw new Error('Parse failed');

		const result = score(parseResult.skill);
		const clarity = result.dimensions.instruction_clarity;

		// Good skill has numbered steps and imperative verbs → procedural signals > 0
		expect(clarity).toBeDefined();
		expect(clarity!.details).toMatch(/\d+ procedural signals/);
		expect(clarity!.score).toBeGreaterThanOrEqual(5);
	});

	it('returns score between 0 and 100', async () => {
		const parseResult = await parseSkill(resolve(FIXTURES, 'good-skill/SKILL.md'));
		if (!parseResult.ok) throw new Error('Parse failed');

		const result = score(parseResult.skill);

		expect(result.score).toBeGreaterThanOrEqual(0);
		expect(result.score).toBeLessThanOrEqual(100);
	});
});
