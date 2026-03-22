import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { Diagnostic, QualityScore, SkillMetadata } from '@skill-tools/core';
import type { LintResult } from './linter.js';
import { lint } from './linter.js';
import { score } from './scorer/index.js';
import type { ValidationResult } from './validator.js';
import { validate } from './validator.js';

const execFileAsync = promisify(execFile);

const DEFAULT_EXCLUDED_DIRECTORIES = [
	'.git',
	'.hg',
	'.svn',
	'.turbo',
	'.next',
	'.vercel',
	'node_modules',
	'dist',
	'build',
	'coverage',
	'tmp',
];

export type RepositoryRefreshMode = 'missing' | 'always' | 'never';

/**
 * Repository input accepted by the benchmark runner.
 */
export interface RepositorySource {
	/** Git URL, GitHub shorthand (owner/repo), or local repository path */
	readonly source: string;
	/** Stable identifier for output files and leaderboard rows */
	readonly id?: string;
	/** Optional branch or tag to clone */
	readonly ref?: string;
}

/**
 * Serializable lint summary for batch benchmark output.
 */
export interface RepositoryLintSummary {
	readonly errorCount: number;
	readonly warningCount: number;
	readonly infoCount: number;
	readonly diagnostics: readonly Diagnostic[];
}

/**
 * Benchmark record for a single SKILL.md file within a repository.
 */
export interface RepositorySkillBenchmark {
	readonly repositoryId: string;
	readonly repositorySource: string;
	readonly repositoryRevision: string | null;
	readonly relativePath: string;
	readonly skillDirectory: string;
	readonly name: string;
	readonly description: string | null;
	readonly metadata: SkillMetadata | null;
	readonly valid: boolean;
	readonly validationDiagnostics: readonly Diagnostic[];
	readonly lint: RepositoryLintSummary | null;
	readonly score: QualityScore | null;
	readonly tokenCount: number | null;
	readonly lineCount: number | null;
}

/**
 * Summary metrics for a benchmarked repository.
 */
export interface RepositoryBenchmarkSummary {
	readonly discoveredSkillCount: number;
	readonly validSkillCount: number;
	readonly scoredSkillCount: number;
	readonly averageScore: number | null;
	readonly topScore: number | null;
}

/**
 * Repository-level benchmark output.
 */
export interface RepositoryBenchmarkResult {
	readonly repository: {
		readonly id: string;
		readonly source: string;
		readonly resolvedSource: string;
		readonly revision: string | null;
		readonly status: 'ok' | 'error';
		readonly fetched: boolean;
		readonly error?: string;
	};
	readonly summary: RepositoryBenchmarkSummary;
	readonly skills: readonly RepositorySkillBenchmark[];
}

/**
 * Batch benchmark options shared by single-repo and multi-repo runs.
 */
export interface RepositoryBenchmarkOptions {
	/** Directory used to cache cloned repositories */
	readonly workspaceDir: string;
	/** Whether to re-clone git sources on each run */
	readonly refresh?: RepositoryRefreshMode;
	/** Directories to ignore while recursively scanning for SKILL.md files */
	readonly excludeDirectories?: readonly string[];
}

/**
 * Multi-repository benchmark options.
 */
export interface BenchmarkRepositoriesOptions extends RepositoryBenchmarkOptions {
	/** Number of repositories to process in parallel */
	readonly concurrency?: number;
	/** Callback invoked after each repository finishes */
	readonly onRepositoryComplete?: (result: RepositoryBenchmarkResult) => void | Promise<void>;
}

/**
 * Aggregate result for a multi-repository benchmark run.
 */
export interface RepositoryBenchmarkRun {
	readonly generatedAt: string;
	readonly repositoryCount: number;
	readonly processedRepositoryCount: number;
	readonly failedRepositoryCount: number;
	readonly totalSkillCount: number;
	readonly validSkillCount: number;
	readonly scoredSkillCount: number;
	readonly averageScore: number | null;
	readonly repositories: readonly RepositoryBenchmarkResult[];
}

/**
 * Benchmark a single repository source.
 *
 * The repository can be a git URL, GitHub shorthand (`owner/repo`),
 * or a local path to an already-cloned repository.
 */
export async function benchmarkRepository(
	input: RepositorySource | string,
	options: RepositoryBenchmarkOptions,
): Promise<RepositoryBenchmarkResult> {
	const source = typeof input === 'string' ? { source: input } : input;
	const normalized = await normalizeRepositorySource(source);

	try {
		const prepared = await prepareRepository(normalized, options);
		const revision = await getRepositoryRevision(prepared.localPath);
		const skillFiles = await discoverSkillFiles(prepared.localPath, options.excludeDirectories);
		const skills: RepositorySkillBenchmark[] = [];

		for (const skillFile of skillFiles) {
			const validation = await validate(skillFile);
			const result = validation[0];
			if (!result) continue;

			skills.push(toSkillBenchmark(result, prepared.localPath, normalized, revision));
		}

		return {
			repository: {
				id: normalized.id,
				source: source.source,
				resolvedSource: normalized.resolvedSource,
				revision,
				status: 'ok',
				fetched: prepared.fetched,
			},
			summary: summarizeSkills(skills),
			skills,
		};
	} catch (error) {
		return {
			repository: {
				id: normalized.id,
				source: source.source,
				resolvedSource: normalized.resolvedSource,
				revision: null,
				status: 'error',
				fetched: false,
				error: formatError(error),
			},
			summary: {
				discoveredSkillCount: 0,
				validSkillCount: 0,
				scoredSkillCount: 0,
				averageScore: null,
				topScore: null,
			},
			skills: [],
		};
	}
}

/**
 * Benchmark a list of repositories with bounded concurrency.
 */
export async function benchmarkRepositories(
	inputs: readonly (RepositorySource | string)[],
	options: BenchmarkRepositoriesOptions,
): Promise<RepositoryBenchmarkRun> {
	const concurrency = Math.max(1, options.concurrency ?? 4);
	const repositories = await mapLimit(inputs, concurrency, async (input) => {
		const result = await benchmarkRepository(input, options);
		await options.onRepositoryComplete?.(result);
		return result;
	});

	const processedRepositoryCount = repositories.filter(
		(result) => result.repository.status === 'ok',
	).length;
	const failedRepositoryCount = repositories.length - processedRepositoryCount;
	const totalSkillCount = repositories.reduce(
		(total, result) => total + result.summary.discoveredSkillCount,
		0,
	);
	const validSkillCount = repositories.reduce(
		(total, result) => total + result.summary.validSkillCount,
		0,
	);
	const scoredSkillCount = repositories.reduce(
		(total, result) => total + result.summary.scoredSkillCount,
		0,
	);
	const totalScore = repositories.reduce((sum, result) => {
		return sum + result.skills.reduce((skillSum, skill) => skillSum + (skill.score?.score ?? 0), 0);
	}, 0);

	return {
		generatedAt: new Date().toISOString(),
		repositoryCount: repositories.length,
		processedRepositoryCount,
		failedRepositoryCount,
		totalSkillCount,
		validSkillCount,
		scoredSkillCount,
		averageScore: scoredSkillCount > 0 ? roundToTwo(totalScore / scoredSkillCount) : null,
		repositories,
	};
}

interface NormalizedRepositorySource {
	readonly id: string;
	readonly source: string;
	readonly resolvedSource: string;
	readonly kind: 'local' | 'git';
	readonly ref?: string;
}

async function normalizeRepositorySource(
	source: RepositorySource,
): Promise<NormalizedRepositorySource> {
	const localPath = resolve(source.source);
	const localStat = await stat(localPath).catch(() => null);

	if (localStat?.isDirectory()) {
		return {
			id: source.id ? sanitizeIdentifier(source.id) : deriveRepositoryId(localPath),
			source: source.source,
			resolvedSource: localPath,
			kind: 'local',
		};
	}

	const resolvedSource = normalizeGitSource(source.source);
	return {
		id: source.id ? sanitizeIdentifier(source.id) : deriveRepositoryId(resolvedSource),
		source: source.source,
		resolvedSource,
		kind: 'git',
		ref: source.ref,
	};
}

async function prepareRepository(
	source: NormalizedRepositorySource,
	options: RepositoryBenchmarkOptions,
): Promise<{ localPath: string; fetched: boolean }> {
	if (source.kind === 'local') {
		return {
			localPath: source.resolvedSource,
			fetched: false,
		};
	}

	const refresh = options.refresh ?? 'missing';
	const repoDir = join(resolve(options.workspaceDir), source.id);
	const existing = await stat(repoDir).catch(() => null);

	if (existing?.isDirectory()) {
		if (refresh === 'always') {
			await rm(repoDir, { recursive: true, force: true });
		} else {
			return {
				localPath: repoDir,
				fetched: false,
			};
		}
	} else if (refresh === 'never') {
		throw new Error(`Repository cache missing for ${source.resolvedSource}`);
	}

	await mkdir(options.workspaceDir, { recursive: true });

	const cloneArgs = ['clone', '--depth', '1', '--no-tags'];
	if (source.ref) {
		cloneArgs.push('--branch', source.ref, '--single-branch');
	}
	cloneArgs.push(source.resolvedSource, repoDir);

	await execGit(cloneArgs);

	return {
		localPath: repoDir,
		fetched: true,
	};
}

async function getRepositoryRevision(repoPath: string): Promise<string | null> {
	try {
		const { stdout } = await execGit(['-C', repoPath, 'rev-parse', 'HEAD']);
		return stdout.trim() || null;
	} catch {
		return null;
	}
}

async function discoverSkillFiles(
	rootDir: string,
	excludeDirectories: readonly string[] = DEFAULT_EXCLUDED_DIRECTORIES,
): Promise<string[]> {
	const excluded = new Set(excludeDirectories);
	const discovered: string[] = [];

	async function walk(currentDir: string): Promise<void> {
		const entries = await readdir(currentDir, { withFileTypes: true }).catch(() => []);

		for (const entry of entries) {
			const entryPath = join(currentDir, entry.name);

			if (entry.isDirectory()) {
				if (excluded.has(entry.name)) continue;
				await walk(entryPath);
				continue;
			}

			if (entry.isFile() && entry.name === 'SKILL.md') {
				discovered.push(entryPath);
			}
		}
	}

	await walk(rootDir);
	discovered.sort((a, b) => a.localeCompare(b));

	return discovered;
}

function toSkillBenchmark(
	validation: ValidationResult,
	repositoryRoot: string,
	repository: NormalizedRepositorySource,
	revision: string | null,
): RepositorySkillBenchmark {
	const skill = validation.skill;
	const lintResult = skill ? lint(skill) : null;
	const qualityScore = skill ? score(skill) : null;
	const relativePath = relative(repositoryRoot, validation.filePath) || 'SKILL.md';
	const skillDirectory =
		relative(repositoryRoot, skill?.dirPath ?? dirname(validation.filePath)) || '.';

	return {
		repositoryId: repository.id,
		repositorySource: repository.source,
		repositoryRevision: revision,
		relativePath,
		skillDirectory,
		name: skill?.metadata.name ?? validation.name,
		description: skill?.metadata.description ?? null,
		metadata: skill?.metadata ?? null,
		valid: validation.valid,
		validationDiagnostics: relativizeDiagnostics(validation.diagnostics, repositoryRoot),
		lint: lintResult ? summarizeLint(lintResult, repositoryRoot) : null,
		score: qualityScore,
		tokenCount: skill?.tokenCount ?? null,
		lineCount: skill?.lineCount ?? null,
	};
}

function summarizeLint(lintResult: LintResult, repositoryRoot: string): RepositoryLintSummary {
	return {
		errorCount: lintResult.errorCount,
		warningCount: lintResult.warningCount,
		infoCount: lintResult.infoCount,
		diagnostics: relativizeDiagnostics(lintResult.diagnostics, repositoryRoot),
	};
}

function summarizeSkills(skills: readonly RepositorySkillBenchmark[]): RepositoryBenchmarkSummary {
	const validSkillCount = skills.filter((skill) => skill.valid).length;
	const scoredSkills = skills.filter((skill) => skill.score);
	const totalScore = scoredSkills.reduce((sum, skill) => sum + (skill.score?.score ?? 0), 0);
	const topScore = scoredSkills.reduce((top, skill) => {
		return Math.max(top, skill.score?.score ?? 0);
	}, 0);

	return {
		discoveredSkillCount: skills.length,
		validSkillCount,
		scoredSkillCount: scoredSkills.length,
		averageScore: scoredSkills.length > 0 ? roundToTwo(totalScore / scoredSkills.length) : null,
		topScore: scoredSkills.length > 0 ? topScore : null,
	};
}

function relativizeDiagnostics(
	diagnostics: readonly Diagnostic[],
	repositoryRoot: string,
): Diagnostic[] {
	return diagnostics.map((diagnostic) => {
		if (!diagnostic.file || !isAbsolute(diagnostic.file)) {
			return diagnostic;
		}

		const relativeFile = relative(repositoryRoot, diagnostic.file);
		if (relativeFile.startsWith('..')) {
			return diagnostic;
		}

		return {
			...diagnostic,
			file: relativeFile || '.',
		};
	});
}

function normalizeGitSource(source: string): string {
	if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(source)) {
		return `https://github.com/${source}.git`;
	}

	return source;
}

function deriveRepositoryId(source: string): string {
	const base = sanitizeIdentifier(extractRepositoryLabel(source));
	const hash = shortHash(source);
	return `${base}-${hash}`;
}

function extractRepositoryLabel(source: string): string {
	const sshMatch = source.match(/^[^@]+@[^:]+:(.+?)(?:\.git)?$/);
	if (sshMatch?.[1]) {
		return sshMatch[1].replace(/\//g, '-');
	}

	try {
		const url = new URL(source);
		const path = url.pathname
			.replace(/\/+$/, '')
			.replace(/^\//, '')
			.replace(/\.git$/, '');
		return path ? path.replace(/\//g, '-') : url.hostname;
	} catch {
		return basename(source);
	}
}

function sanitizeIdentifier(value: string): string {
	const sanitized = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.replace(/-{2,}/g, '-');

	return sanitized || 'repository';
}

function shortHash(value: string): string {
	return createHash('sha1').update(value).digest('hex').slice(0, 8);
}

async function execGit(args: string[]): Promise<{ stdout: string; stderr: string }> {
	try {
		return await execFileAsync('git', args, {
			maxBuffer: 10 * 1024 * 1024,
		});
	} catch (error) {
		throw new Error(`git ${args.join(' ')} failed: ${formatError(error)}`);
	}
}

async function mapLimit<T, R>(
	items: readonly T[],
	limit: number,
	mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
	const results = new Array<R>(items.length);
	let cursor = 0;

	async function worker(): Promise<void> {
		while (true) {
			const index = cursor++;
			if (index >= items.length) return;
			const item = items[index];
			if (item === undefined) return;
			results[index] = await mapper(item, index);
		}
	}

	const workerCount = Math.min(limit, items.length);
	await Promise.all(Array.from({ length: workerCount }, () => worker()));

	return results;
}

function roundToTwo(value: number): number {
	return Math.round(value * 100) / 100;
}

function formatError(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}
