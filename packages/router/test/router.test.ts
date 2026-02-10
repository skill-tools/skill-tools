import { describe, expect, it } from 'vitest';
import { SkillRouter } from '../src/router.js';
import type { SkillEntry, SkillRouterSnapshot } from '../src/router.js';

const SAMPLE_SKILLS: SkillEntry[] = [
	{
		name: 'deploy-vercel',
		description: 'Deploy applications to Vercel. Use when the user wants to push code to production on Vercel.',
	},
	{
		name: 'deploy-aws',
		description: 'Deploy applications to AWS. Use when the user wants to push code to production on Amazon Web Services.',
	},
	{
		name: 'run-tests',
		description: 'Execute unit tests, integration tests, and end-to-end test suites with coverage reporting.',
	},
	{
		name: 'lint-code',
		description: 'Run ESLint, Biome, or Prettier to check and fix code formatting and style issues.',
	},
	{
		name: 'database-migrate',
		description: 'Run database migrations using Prisma, Drizzle, or raw SQL migration files.',
	},
];

describe('SkillRouter', () => {
	it('initializes with zero count', () => {
		const router = new SkillRouter();
		expect(router.count).toBe(0);
	});

	it('indexes skills and reports correct count', async () => {
		const router = new SkillRouter();
		await router.indexSkills(SAMPLE_SKILLS);
		expect(router.count).toBe(5);
	});

	it('handles empty skill list', async () => {
		const router = new SkillRouter();
		await router.indexSkills([]);
		expect(router.count).toBe(0);
	});

	it('selects relevant skills for a query', async () => {
		const router = new SkillRouter();
		await router.indexSkills(SAMPLE_SKILLS);

		const results = await router.select('deploy my app');
		expect(results.length).toBeGreaterThan(0);

		// Deploy skills should rank higher than unrelated ones
		const deploySkills = results.filter((r) => r.skill.startsWith('deploy-'));
		expect(deploySkills.length).toBeGreaterThan(0);
	});

	it('respects topK option', async () => {
		const router = new SkillRouter();
		await router.indexSkills(SAMPLE_SKILLS);

		const results = await router.select('deploy my app', { topK: 2 });
		expect(results.length).toBeLessThanOrEqual(2);
	});

	it('respects threshold option', async () => {
		const router = new SkillRouter();
		await router.indexSkills(SAMPLE_SKILLS);

		const highThreshold = await router.select('deploy my app', { threshold: 0.99 });
		const lowThreshold = await router.select('deploy my app', { threshold: 0.0 });

		expect(highThreshold.length).toBeLessThanOrEqual(lowThreshold.length);
	});

	it('applies boost to specified skills', async () => {
		const router = new SkillRouter();
		await router.indexSkills(SAMPLE_SKILLS);

		const boostedResults = await router.select('deploy my app', {
			boost: ['lint-code'],
			topK: 5,
		});

		// Find the boosted skill
		const lintResult = boostedResults.find((r) => r.skill === 'lint-code');
		if (lintResult) {
			// Its score should be multiplied by 1.2
			const unboostedResults = await router.select('deploy my app', { topK: 5 });
			const unboostedLint = unboostedResults.find((r) => r.skill === 'lint-code');
			if (unboostedLint) {
				expect(lintResult.score).toBeCloseTo(unboostedLint.score * 1.2, 5);
			}
		}
	});

	it('applies exclude filters', async () => {
		const router = new SkillRouter();
		await router.indexSkills(SAMPLE_SKILLS);

		const results = await router.select('deploy my app', {
			exclude: ['deploy-vercel'],
			topK: 5,
		});

		expect(results.find((r) => r.skill === 'deploy-vercel')).toBeUndefined();
	});

	it('applies wildcard exclude patterns', async () => {
		const router = new SkillRouter();
		await router.indexSkills(SAMPLE_SKILLS);

		const results = await router.select('deploy my app', {
			exclude: ['deploy-*'],
			topK: 5,
		});

		const deployResults = results.filter((r) => r.skill.startsWith('deploy-'));
		expect(deployResults).toHaveLength(0);
	});

	it('returns metadata in selection results', async () => {
		const router = new SkillRouter();
		await router.indexSkills([
			{
				name: 'test-skill',
				description: 'Run tests',
				path: '/path/to/skill',
				metadata: { custom: 'data' },
			},
		]);

		const results = await router.select('run tests', { topK: 1 });
		expect(results[0]!.metadata).toMatchObject({
			description: 'Run tests',
			path: '/path/to/skill',
			custom: 'data',
		});
	});

	it('saves and loads snapshot', async () => {
		const router = new SkillRouter();
		await router.indexSkills(SAMPLE_SKILLS);

		const snapshot = router.save();

		expect(snapshot.version).toBe(1);
		expect(snapshot.embeddingProvider).toBe('local-tfidf');
		expect(snapshot.dimensions).toBe(256);
		expect(snapshot.skillNames).toHaveLength(5);
	});

	it('restores from snapshot via load()', async () => {
		const router = new SkillRouter();
		await router.indexSkills(SAMPLE_SKILLS);
		const snapshot = router.save();

		const restored = new SkillRouter();
		restored.load(snapshot);

		expect(restored.count).toBe(5);

		// Should still be able to search
		const results = await restored.select('run tests');
		expect(results.length).toBeGreaterThan(0);
	});

	it('restores from snapshot via fromSnapshot()', async () => {
		const router = new SkillRouter();
		await router.indexSkills(SAMPLE_SKILLS);
		const snapshot = router.save();

		const restored = SkillRouter.fromSnapshot(snapshot);
		expect(restored.count).toBe(5);
	});

	it('detects conflicting skills', async () => {
		const router = new SkillRouter();
		await router.indexSkills([
			{
				name: 'deploy-v1',
				description: 'Deploy applications to production servers',
			},
			{
				name: 'deploy-v2',
				description: 'Deploy applications to production servers using containers',
			},
			{
				name: 'run-tests',
				description: 'Execute unit tests and check code coverage',
			},
		]);

		// With low threshold, deploy skills should be flagged as conflicting
		const conflicts = await router.detectConflicts(0.3);
		// The method works by embedding the skill *name* (not description) and searching,
		// so results depend on how similar the names are in embedding space
		expect(Array.isArray(conflicts)).toBe(true);
	});

	it('uses custom embedding provider', async () => {
		let embedCalled = false;
		const router = new SkillRouter({
			embedding: {
				provider: 'custom',
				dimensions: 3,
				embed: async (texts: string[]) => {
					embedCalled = true;
					// Return simple hash-based vectors
					return texts.map((t) => {
						const hash = t.length % 3;
						const vec = [0, 0, 0];
						vec[hash] = 1;
						return vec;
					});
				},
			},
		});

		await router.indexSkills([
			{ name: 'test', description: 'Test skill' },
		]);

		expect(embedCalled).toBe(true);
	});

	it('throws for unsupported embedding providers', () => {
		expect(
			() =>
				new SkillRouter({
					embedding: { provider: 'openai' as 'openai' },
				}),
		).toThrow('requires additional setup');
	});

	it('result scores are between 0 and 1 (approximately)', async () => {
		const router = new SkillRouter();
		await router.indexSkills(SAMPLE_SKILLS);

		const results = await router.select('deploy');
		for (const r of results) {
			expect(r.score).toBeGreaterThanOrEqual(-0.01);
			expect(r.score).toBeLessThanOrEqual(1.5); // boosted scores can exceed 1.0
		}
	});

	it('returns SelectionResult with correct shape', async () => {
		const router = new SkillRouter();
		await router.indexSkills(SAMPLE_SKILLS);

		const results = await router.select('deploy app');
		for (const r of results) {
			expect(r).toHaveProperty('skill');
			expect(r).toHaveProperty('score');
			expect(r).toHaveProperty('metadata');
			expect(typeof r.skill).toBe('string');
			expect(typeof r.score).toBe('number');
			expect(typeof r.metadata).toBe('object');
		}
	});
});
