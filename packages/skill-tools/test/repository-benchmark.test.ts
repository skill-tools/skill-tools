import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { benchmarkRepositories, benchmarkRepository } from '../src/repository-benchmark.js';

const execFileAsync = promisify(execFile);

const GOOD_SKILL = `---
name: deploy-vercel
description: Deploy apps to Vercel. Use when the user asks to publish a web app.
---

# Deploy

## Steps

1. Run \`vercel\`
2. Confirm the deployment

## Error Handling

- Retry authentication if Vercel rejects the session
`;

const BAD_SKILL = `---
name: thing
description: handles stuff
---

Do the thing.
`;

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
	tempDirs.length = 0;
});

describe('benchmarkRepository', () => {
	it('recursively finds SKILL.md files and ignores excluded directories', async () => {
		const { repoPath, workspaceDir } = await createRepositoryFixture({
			'skills/deploy/SKILL.md': GOOD_SKILL,
			'nested/thing/SKILL.md': BAD_SKILL,
			'node_modules/ignored/SKILL.md': GOOD_SKILL,
		});

		const result = await benchmarkRepository(
			{ source: repoPath, id: 'local-fixture' },
			{ workspaceDir },
		);

		expect(result.repository.status).toBe('ok');
		expect(result.repository.fetched).toBe(false);
		expect(result.summary.discoveredSkillCount).toBe(2);
		expect(result.summary.validSkillCount).toBe(2);
		expect(result.summary.scoredSkillCount).toBe(2);
		expect(result.summary.topScore).not.toBeNull();
		expect(result.skills.map((skill) => skill.relativePath)).toEqual([
			'nested/thing/SKILL.md',
			'skills/deploy/SKILL.md',
		]);
		expect(result.skills[0]?.score?.score).toBeLessThan(result.skills[1]?.score?.score ?? 0);
	});

	it('clones git sources into the workspace cache and reuses them', async () => {
		const { repoPath, workspaceDir } = await createRepositoryFixture({
			'SKILL.md': GOOD_SKILL,
		});

		const source = `file://${repoPath}`;

		const first = await benchmarkRepository(
			{ source, id: 'clone-fixture' },
			{ workspaceDir, refresh: 'always' },
		);
		const second = await benchmarkRepository(
			{ source, id: 'clone-fixture' },
			{ workspaceDir, refresh: 'missing' },
		);

		expect(first.repository.status).toBe('ok');
		expect(first.repository.fetched).toBe(true);
		expect(first.repository.revision).toMatch(/^[a-f0-9]{40}$/);
		expect(first.summary.discoveredSkillCount).toBe(1);
		expect(second.repository.status).toBe('ok');
		expect(second.repository.fetched).toBe(false);
		expect(second.repository.revision).toBe(first.repository.revision);
	});
});

describe('benchmarkRepositories', () => {
	it('aggregates repository totals and invokes the completion callback', async () => {
		const first = await createRepositoryFixture({
			'SKILL.md': GOOD_SKILL,
		});
		const second = await createRepositoryFixture({
			'skills/bad/SKILL.md': BAD_SKILL,
		});
		const completed: string[] = [];

		const run = await benchmarkRepositories(
			[
				{ source: first.repoPath, id: 'repo-one' },
				{ source: second.repoPath, id: 'repo-two' },
			],
			{
				workspaceDir: first.workspaceDir,
				concurrency: 2,
				onRepositoryComplete: async (result) => {
					completed.push(result.repository.id);
				},
			},
		);

		expect(run.repositoryCount).toBe(2);
		expect(run.processedRepositoryCount).toBe(2);
		expect(run.failedRepositoryCount).toBe(0);
		expect(run.totalSkillCount).toBe(2);
		expect(run.validSkillCount).toBe(2);
		expect(run.scoredSkillCount).toBe(2);
		expect(run.averageScore).not.toBeNull();
		expect(completed.sort()).toEqual(['repo-one', 'repo-two']);
	});
});

async function createRepositoryFixture(
	files: Record<string, string>,
): Promise<{ repoPath: string; workspaceDir: string }> {
	const root = await mkdtemp(join(tmpdir(), 'skill-tools-benchmark-'));
	const repoPath = join(root, 'repo');
	const workspaceDir = join(root, 'workspace');
	tempDirs.push(root);

	await mkdir(repoPath, { recursive: true });
	await mkdir(workspaceDir, { recursive: true });

	for (const [relativePath, contents] of Object.entries(files)) {
		const filePath = join(repoPath, relativePath);
		await mkdir(dirname(filePath), { recursive: true });
		await writeFile(filePath, contents);
	}

	await execFileAsync('git', ['init'], { cwd: repoPath });
	await execFileAsync('git', ['add', '.'], { cwd: repoPath });
	await execFileAsync(
		'git',
		['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'init'],
		{ cwd: repoPath },
	);

	return { repoPath, workspaceDir };
}
