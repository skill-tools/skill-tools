import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeSkill } from '../src/improve.js';

// Use skill-tools fixtures (they're in the sibling package)
const FIXTURES = resolve(import.meta.dirname, '../../skill-tools/test/fixtures');

describe('analyzeSkill', () => {
	it('returns score and suggestions for a valid skill', async () => {
		const results = await analyzeSkill(resolve(FIXTURES, 'good-skill'));
		expect(results).toHaveLength(1);
		expect(results[0]!.name).toBe('deploy-vercel');
		expect(results[0]!.currentScore.score).toBeGreaterThan(0);
	});

	it('returns suggestions sorted by pointsGain descending', async () => {
		const results = await analyzeSkill(resolve(FIXTURES, 'good-skill'));
		const suggestions = results[0]!.suggestions;
		for (let i = 1; i < suggestions.length; i++) {
			expect(suggestions[i]!.pointsGain).toBeLessThanOrEqual(suggestions[i - 1]!.pointsGain);
		}
	});
});
