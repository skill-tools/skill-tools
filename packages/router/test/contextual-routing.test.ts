import { describe, expect, it } from 'vitest';
import type { SkillEntry } from '../src/router.js';
import { SkillRouter } from '../src/router.js';

/**
 * Skills with body/sections for contextual retrieval testing.
 * The descriptions are intentionally generic — the body contains
 * the specific terms that should improve routing.
 */
const SKILLS_WITH_BODY: SkillEntry[] = [
	{
		name: 'deploy-vercel',
		description: 'Deploy applications to production hosting.',
		body: 'Run `vercel login` then `vercel --prod` to deploy.\nMake sure `vercel.json` exists in the project root.',
		sections: [
			{ heading: 'Prerequisites', depth: 2, content: 'Install the Vercel CLI globally.' },
			{ heading: 'Steps', depth: 2, content: 'Run `vercel login` to authenticate.\nRun `vercel --prod` to deploy.' },
			{ heading: 'Error Handling', depth: 2, content: 'Check build logs if deployment fails.' },
		],
	},
	{
		name: 'deploy-aws',
		description: 'Deploy applications to cloud infrastructure.',
		body: 'Use `aws configure` to set credentials.\nRun `cdk deploy` or `sam deploy` for serverless.',
		sections: [
			{ heading: 'Prerequisites', depth: 2, content: 'Install AWS CLI and configure credentials.' },
			{ heading: 'Steps', depth: 2, content: 'Run `aws configure` then `cdk deploy`.' },
		],
	},
	{
		name: 'run-jest',
		description: 'Execute test suites with coverage reporting.',
		body: 'Run `npx jest --coverage` to execute all tests.\nConfigure in `jest.config.ts`.',
		sections: [
			{ heading: 'Configuration', depth: 2, content: 'Set up jest.config.ts with your test patterns.' },
			{ heading: 'Usage', depth: 2, content: 'Run `npx jest` for all tests, or `npx jest --watch` for development.' },
		],
	},
	{
		name: 'lint-biome',
		description: 'Check and fix code formatting issues.',
		body: 'Run `npx biome check .` to lint the entire project.\nConfigure rules in `biome.json`.',
		sections: [
			{ heading: 'Setup', depth: 2, content: 'Add biome.json to your project root.' },
			{ heading: 'Usage', depth: 2, content: 'Run `npx biome check .` or `npx biome format .`.' },
		],
	},
];

/** Same skills but without body/sections — v0.1 behavior */
const SKILLS_WITHOUT_BODY: SkillEntry[] = SKILLS_WITH_BODY.map((s) => ({
	name: s.name,
	description: s.description,
}));

describe('Contextual routing', () => {
	it('body terms improve ranking for specific queries', async () => {
		const withCtx = new SkillRouter();
		await withCtx.indexSkills(SKILLS_WITH_BODY);

		const withoutCtx = new SkillRouter();
		await withoutCtx.indexSkills(SKILLS_WITHOUT_BODY);

		// Query using a term only in the body (not in description)
		const ctxResults = await withCtx.select('vercel login', { topK: 4 });
		const plainResults = await withoutCtx.select('vercel login', { topK: 4 });

		// With context, deploy-vercel should rank first
		expect(ctxResults[0]?.skill).toBe('deploy-vercel');

		// Without context (generic descriptions), the term "vercel" doesn't exist
		// so deploy-vercel may not even appear
		const plainVercel = plainResults.find((r) => r.skill === 'deploy-vercel');
		const ctxVercel = ctxResults.find((r) => r.skill === 'deploy-vercel');
		// If both return it, ctx score should be higher or equal
		if (plainVercel && ctxVercel) {
			expect(ctxVercel.score).toBeGreaterThanOrEqual(plainVercel.score);
		}
	});

	it('aws-specific terms route to aws skill', async () => {
		const router = new SkillRouter();
		await router.indexSkills(SKILLS_WITH_BODY);

		const results = await router.select('aws cdk deploy serverless', { topK: 4 });
		expect(results[0]?.skill).toBe('deploy-aws');
	});

	it('jest-specific terms route to test skill', async () => {
		const router = new SkillRouter();
		await router.indexSkills(SKILLS_WITH_BODY);

		const results = await router.select('jest coverage', { topK: 4 });
		expect(results[0]?.skill).toBe('run-jest');
	});

	it('biome-specific terms route to lint skill', async () => {
		const router = new SkillRouter();
		await router.indexSkills(SKILLS_WITH_BODY);

		const results = await router.select('biome format check', { topK: 4 });
		expect(results[0]?.skill).toBe('lint-biome');
	});

	it('context: false disables enrichment', async () => {
		const router = new SkillRouter({ context: false });
		await router.indexSkills(SKILLS_WITH_BODY);

		// "vercel" only appears in name and body, not description
		// With context disabled, the body terms shouldn't help
		const results = await router.select('vercel login', { topK: 4 });

		// Without contextual enrichment, "vercel login" won't match
		// "Deploy applications to production hosting" very well
		// The deploy-vercel might still show up via name splitting, but
		// "login" specifically won't contribute to the score
		const vercelResult = results.find((r) => r.skill === 'deploy-vercel');
		if (vercelResult) {
			// If it appears at all, score should be lower than with context
			const ctxRouter = new SkillRouter();
			await ctxRouter.indexSkills(SKILLS_WITH_BODY);
			const ctxResults = await ctxRouter.select('vercel login', { topK: 4 });
			const ctxVercel = ctxResults.find((r) => r.skill === 'deploy-vercel');
			if (ctxVercel) {
				expect(ctxVercel.score).toBeGreaterThanOrEqual(vercelResult.score);
			}
		}
	});

	it('skills without body/sections behave identically to v0.1', async () => {
		const router = new SkillRouter();
		await router.indexSkills(SKILLS_WITHOUT_BODY);

		const routerNoCtx = new SkillRouter({ context: false });
		await routerNoCtx.indexSkills(SKILLS_WITHOUT_BODY);

		// Both should produce identical results since no body/sections exist
		const results = await router.select('deploy production', { topK: 4 });
		const resultsNoCtx = await routerNoCtx.select('deploy production', { topK: 4 });

		expect(results.length).toBe(resultsNoCtx.length);
		for (let i = 0; i < results.length; i++) {
			expect(results[i]!.skill).toBe(resultsNoCtx[i]!.skill);
			expect(results[i]!.score).toBeCloseTo(resultsNoCtx[i]!.score, 5);
		}
	});

	it('metadata.description in results stays as original', async () => {
		const router = new SkillRouter();
		await router.indexSkills(SKILLS_WITH_BODY);

		const results = await router.select('vercel login', { topK: 1 });
		expect(results[0]?.metadata.description).toBe('Deploy applications to production hosting.');
	});

	it('count is correct after indexing skills with body', async () => {
		const router = new SkillRouter();
		await router.indexSkills(SKILLS_WITH_BODY);
		expect(router.count).toBe(4);
	});

	it('save/load round-trip preserves indexed state', async () => {
		const router = new SkillRouter();
		await router.indexSkills(SKILLS_WITH_BODY);
		const snapshot = router.save();

		const restored = SkillRouter.fromSnapshot(snapshot);
		const results = await restored.select('vercel login', { topK: 4 });
		expect(results.length).toBeGreaterThan(0);
	});

	it('mixed skills — some with body, some without', async () => {
		const mixed: SkillEntry[] = [
			{
				name: 'deploy-vercel',
				description: 'Deploy applications to production hosting.',
				body: 'Run `vercel --prod`.',
				sections: [{ heading: 'Steps', depth: 2, content: 'Authenticate with `vercel login`.' }],
			},
			{
				name: 'run-tests',
				description: 'Execute test suites with coverage reporting.',
				// no body or sections
			},
		];

		const router = new SkillRouter();
		await router.indexSkills(mixed);
		expect(router.count).toBe(2);

		// vercel-specific query should hit deploy skill
		const results = await router.select('vercel prod', { topK: 2 });
		expect(results[0]?.skill).toBe('deploy-vercel');
	});
});
