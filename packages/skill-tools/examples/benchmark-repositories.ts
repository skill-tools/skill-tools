/**
 * Batch benchmark repositories and emit leaderboard-friendly JSON artifacts.
 *
 * Usage:
 *   pnpm tsx packages/skill-tools/examples/benchmark-repositories.ts \
 *     --repos ./repos.txt \
 *     --out ./tmp/skill-benchmark \
 *     --cache ./tmp/skill-cache \
 *     --concurrency 6 \
 *     --refresh missing
 */
import { appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Command } from 'commander';
import type { RepositoryBenchmarkResult, RepositorySource } from '../src/index.js';
import { benchmarkRepositories } from '../src/index.js';

const program = new Command();

program
	.requiredOption('--repos <path>', 'Path to a newline, JSON, or JSONL file of repositories')
	.option('--out <dir>', 'Output directory for JSON artifacts', './tmp/skill-benchmark')
	.option('--cache <dir>', 'Clone cache directory', './tmp/skill-cache')
	.option('--concurrency <n>', 'Repositories to process in parallel', '4')
	.option('--refresh <mode>', 'Clone policy: missing, always, or never', 'missing')
	.option('--clean', 'Delete existing output files before running', false)
	.parse(process.argv);

const options = program.opts<{
	repos: string;
	out: string;
	cache: string;
	concurrency: string;
	refresh: 'missing' | 'always' | 'never';
	clean: boolean;
}>();

const repositoryList = await loadRepositoryList(options.repos);
const outputDir = resolve(options.out);
const cacheDir = resolve(options.cache);
const repositoriesDir = join(outputDir, 'repositories');
const repositoriesJsonl = join(outputDir, 'repositories.jsonl');
const skillsJsonl = join(outputDir, 'skills.jsonl');
const summaryJson = join(outputDir, 'summary.json');
const concurrency = Number.parseInt(options.concurrency, 10);

if (!Number.isInteger(concurrency) || concurrency <= 0) {
	throw new Error(`Invalid concurrency "${options.concurrency}". Expected a positive integer.`);
}

if (options.clean) {
	await rm(outputDir, { recursive: true, force: true });
}

await mkdir(repositoriesDir, { recursive: true });
await writeFile(repositoriesJsonl, '');
await writeFile(skillsJsonl, '');

let writeQueue = Promise.resolve();
let completedRepositories = 0;
const startedAt = Date.now();

const run = await benchmarkRepositories(repositoryList, {
	workspaceDir: cacheDir,
	concurrency,
	refresh: options.refresh,
	onRepositoryComplete: async (result) => {
		const completed = ++completedRepositories;
		writeQueue = writeQueue.then(() =>
			persistRepositoryResult(result, repositoriesDir, repositoriesJsonl, skillsJsonl),
		);
		await writeQueue;
		const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
		console.log(
			[
				`[${completed}/${repositoryList.length}]`,
				result.repository.id,
				result.repository.status,
				`${result.summary.discoveredSkillCount} skills`,
				result.summary.averageScore !== null
					? `avg ${result.summary.averageScore}`
					: 'avg n/a',
				`${elapsedSeconds}s`,
			].join(' | '),
		);
	},
});

await writeQueue;
await writeFile(summaryJson, `${JSON.stringify(run, null, 2)}\n`);

console.log(
	[
		`Processed ${run.repositoryCount} repositories`,
		`${run.totalSkillCount} skills`,
		`${run.validSkillCount} valid`,
		run.averageScore !== null ? `avg score ${run.averageScore}` : 'avg score n/a',
	].join(' | '),
);
console.log(`Wrote ${summaryJson}`);
console.log(`Wrote ${repositoriesJsonl}`);
console.log(`Wrote ${skillsJsonl}`);

async function persistRepositoryResult(
	result: RepositoryBenchmarkResult,
	repositoryDir: string,
	repositoriesFile: string,
	skillsFile: string,
): Promise<void> {
	const { skills, ...publicRepository } = result;

	await writeFile(
		join(repositoryDir, `${result.repository.id}.json`),
		`${JSON.stringify(result, null, 2)}\n`,
	);
	await appendFile(repositoriesFile, `${JSON.stringify(publicRepository)}\n`);

	for (const skill of skills) {
		await appendFile(skillsFile, `${JSON.stringify(skill)}\n`);
	}
}

async function loadRepositoryList(filePath: string): Promise<RepositorySource[]> {
	const absolutePath = resolve(filePath);
	const raw = await readFile(absolutePath, 'utf8');

	if (absolutePath.endsWith('.json')) {
		return parseJsonList(raw);
	}

	if (absolutePath.endsWith('.jsonl')) {
		return raw
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean)
			.map((line) => normalizeRepositoryEntry(JSON.parse(line) as RepositorySource | string));
	}

	return raw
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith('#'))
		.map((line) => normalizeRepositoryEntry(line));
}

function parseJsonList(raw: string): RepositorySource[] {
	const parsed = JSON.parse(raw) as
		| RepositorySource[]
		| string[]
		| { repositories?: RepositorySource[] | string[] };
	const entries = Array.isArray(parsed) ? parsed : parsed.repositories;

	if (!Array.isArray(entries)) {
		throw new Error('Expected a JSON array or an object with a "repositories" array.');
	}

	return entries.map((entry) => normalizeRepositoryEntry(entry));
}

function normalizeRepositoryEntry(entry: RepositorySource | string): RepositorySource {
	if (typeof entry === 'string') {
		return { source: entry };
	}

	return entry;
}
