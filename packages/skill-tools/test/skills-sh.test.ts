import { describe, expect, it } from 'vitest';
import {
	groupSkillsShRepositories,
	normalizeSkillsShEntries,
	parseSkillsShTotalCount,
	toBenchmarkRepositorySources,
} from '../src/skills-sh.js';

describe('normalizeSkillsShEntries', () => {
	it('derives repo and skill slug from skills.sh detail URLs', () => {
		const result = normalizeSkillsShEntries([
			{
				rank: '1',
				name: 'find-skills',
				href: '/vercel-labs/skills/find-skills',
			},
		]);

		expect(result.skipped).toHaveLength(0);
		expect(result.entries).toEqual([
			expect.objectContaining({
				rank: 1,
				name: 'find-skills',
				repo: 'vercel-labs/skills',
				owner: 'vercel-labs',
				repository: 'skills',
				skillSlug: 'find-skills',
				href: 'https://skills.sh/vercel-labs/skills/find-skills',
			}),
		]);
	});

	it('normalizes repo values from GitHub URLs and de-duplicates by href', () => {
		const result = normalizeSkillsShEntries([
			{
				rank: '12',
				name: 'deploy',
				repo: 'https://github.com/acme/skill-repo',
				href: 'https://skills.sh/acme/skill-repo/deploy',
			},
			{
				rank: '12',
				name: 'deploy production',
				repo: 'acme/skill-repo',
				href: 'https://skills.sh/acme/skill-repo/deploy',
				githubUrl: 'https://github.com/acme/skill-repo',
			},
		]);

		expect(result.skipped).toHaveLength(0);
		expect(result.entries).toHaveLength(1);
		expect(result.entries[0]).toEqual(
			expect.objectContaining({
				name: 'deploy production',
				repo: 'acme/skill-repo',
				githubUrl: 'https://github.com/acme/skill-repo',
			}),
		);
	});

	it('skips rows that cannot resolve a repo or href', () => {
		const result = normalizeSkillsShEntries([
			{
				rank: '3',
				name: 'mystery-skill',
			},
		]);

		expect(result.entries).toHaveLength(0);
		expect(result.skipped).toHaveLength(1);
	});
});

describe('groupSkillsShRepositories', () => {
	it('groups multiple skills from the same repository', () => {
		const normalized = normalizeSkillsShEntries([
			{
				rank: '1',
				name: 'find-skills',
				href: '/vercel-labs/skills/find-skills',
			},
			{
				rank: '8',
				name: 'search-skills',
				href: '/vercel-labs/skills/search-skills',
			},
			{
				rank: '3',
				name: 'write-tests',
				href: '/acme/toolbox/write-tests',
			},
		]);

		const repositories = groupSkillsShRepositories(normalized.entries);

		expect(repositories).toHaveLength(2);
		expect(repositories[0]).toEqual(
			expect.objectContaining({
				repo: 'vercel-labs/skills',
				skillCount: 2,
				skills: ['find-skills', 'search-skills'],
				bestRank: 1,
			}),
		);
		expect(repositories[1]).toEqual(
			expect.objectContaining({
				repo: 'acme/toolbox',
				skillCount: 1,
				skills: ['write-tests'],
			}),
		);
	});

	it('produces benchmark-ready repository sources', () => {
		const normalized = normalizeSkillsShEntries([
			{
				rank: '1',
				name: 'find-skills',
				href: '/vercel-labs/skills/find-skills',
			},
		]);

		const repositories = groupSkillsShRepositories(normalized.entries);
		expect(toBenchmarkRepositorySources(repositories)).toEqual([
			{
				source: 'vercel-labs/skills',
				id: 'vercel-labs-skills',
			},
		]);
	});
});

describe('parseSkillsShTotalCount', () => {
	it('parses the leaderboard header count', () => {
		expect(parseSkillsShTotalCount('87,312 skills')).toBe(87312);
		expect(parseSkillsShTotalCount('Public skills: 1,024')).toBe(1024);
		expect(parseSkillsShTotalCount('unknown')).toBeNull();
	});
});
