import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SkillRouter } from '@skill-tools/router';

const FIXTURES = resolve(import.meta.dirname, 'fixtures');

describe('route', () => {
	it('indexes a directory and returns ranked results for a query', async () => {
		const router = new SkillRouter();
		const count = await router.indexDirectory(resolve(FIXTURES, 'good-skill'));
		expect(count).toBe(1);

		const results = await router.select('deploy my app to vercel');
		expect(results.length).toBeGreaterThanOrEqual(1);
		expect(results[0]!.skill).toBe('deploy-vercel');
		expect(results[0]!.score).toBeGreaterThan(0);
	});

	it('returns empty results for unrelated queries', async () => {
		const router = new SkillRouter();
		await router.indexDirectory(resolve(FIXTURES, 'good-skill'));

		const results = await router.select('quantum computing algorithms', { threshold: 0.5 });
		expect(results).toHaveLength(0);
	});

	it('save and load snapshot produce same results', async () => {
		const router = new SkillRouter();
		await router.indexDirectory(resolve(FIXTURES, 'good-skill'));

		const snapshot = router.save();

		const restored = SkillRouter.fromSnapshot(snapshot);
		const original = await router.select('deploy');
		const loaded = await restored.select('deploy');

		expect(loaded).toEqual(original);
	});

	it('detectConflicts returns an array', async () => {
		const router = new SkillRouter();
		await router.indexSkills([
			{ name: 'deploy-vercel', description: 'Deploy web apps to Vercel hosting' },
			{ name: 'run-tests', description: 'Execute test suites with vitest' },
		]);

		const conflicts = await router.detectConflicts();
		expect(Array.isArray(conflicts)).toBe(true);
	});
});
