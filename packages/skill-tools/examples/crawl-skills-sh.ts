/**
 * Crawl skills.sh with Playwright, extract leaderboard entries, and emit benchmark-ready repo lists.
 *
 * Usage:
 *   pnpm tsx packages/skill-tools/examples/crawl-skills-sh.ts \
 *     --out ./tmp/skills-sh \
 *     --clean
 *
 * Notes:
 *   - The script tries to resolve `playwright` from the current workspace first.
 *   - If it is not installed in this repo, it also looks for a sibling `bap` repo.
 */
import { createRequire } from 'node:module';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import type { SkillsShRawEntry } from '../src/index.js';
import {
	groupSkillsShRepositories,
	normalizeSkillsShEntries,
	parseSkillsShTotalCount,
	toBenchmarkRepositorySources,
} from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

type BrowserEngine = {
	launch: (options: Record<string, unknown>) => Promise<{
		newPage: (options?: Record<string, unknown>) => Promise<{
			goto: (url: string, options?: Record<string, unknown>) => Promise<unknown>;
			title: () => Promise<string>;
			url: () => string;
			evaluate: <T, Arg = unknown>(
				pageFunction: (arg: Arg) => T | Promise<T>,
				arg?: Arg,
			) => Promise<T>;
			waitForTimeout: (ms: number) => Promise<void>;
			close: () => Promise<void>;
		}>;
		close: () => Promise<void>;
	}>;
};

const program = new Command();

program
	.option('--url <url>', 'skills.sh URL to crawl', 'https://skills.sh')
	.option('--out <dir>', 'Output directory for extracted artifacts', './tmp/skills-sh')
	.option('--session <name>', 'Run identifier written into summary output', `skills-sh-${Date.now()}`)
	.option('--browser <name>', 'Browser engine/channel: chrome or chromium', 'chrome')
	.option('--delay-ms <ms>', 'Delay between scrolls in milliseconds', '200')
	.option('--scroll-factor <n>', 'Scroll by N viewport heights each iteration', '1')
	.option('--max-stagnant <n>', 'Stop after N scrolls with no new entries', '25')
	.option('--max-iterations <n>', 'Safety cap on scroll iterations', '10000')
	.option('--resolve-details', 'Visit unresolved detail pages after the crawl', true)
	.option('--no-resolve-details', 'Skip detail-page fallback resolution')
	.option('--headless', 'Run the browser headless', true)
	.option('--no-headless', 'Run the browser with a visible window')
	.option('--clean', 'Delete output directory before running', false)
	.parse(process.argv);

const options = program.opts<{
	url: string;
	out: string;
	session: string;
	browser: 'chrome' | 'chromium';
	delayMs: string;
	scrollFactor: string;
	maxStagnant: string;
	maxIterations: string;
	resolveDetails: boolean;
	headless: boolean;
	clean: boolean;
}>();

const outputDir = resolve(options.out);
const delayMs = parsePositiveInteger(options.delayMs, '--delay-ms');
const scrollFactor = parsePositiveInteger(options.scrollFactor, '--scroll-factor');
const maxStagnant = parsePositiveInteger(options.maxStagnant, '--max-stagnant');
const maxIterations = parsePositiveInteger(options.maxIterations, '--max-iterations');
const rawEntries = new Map<string, SkillsShRawEntry>();
let expectedTotal: number | null = null;
let stagnantIterations = 0;
let fallbackResolvedCount = 0;
let stopReason = 'max_iterations';
let highestVisibleRank = 0;

if (options.clean) {
	await rm(outputDir, { recursive: true, force: true });
}

await mkdir(outputDir, { recursive: true });

const { chromium } = loadPlaywright();
const browser = await chromium.launch({
	headless: options.headless,
	...(options.browser === 'chrome' ? { channel: 'chrome' } : {}),
});

try {
	const page = await browser.newPage({
		viewport: {
			width: 1440,
			height: 1200,
		},
	});

	await page.goto(options.url, {
		waitUntil: 'domcontentloaded',
		timeout: 30000,
	});
	console.log(`Opened ${page.url()} | ${await page.title()}`);

	for (let iteration = 1; iteration <= maxIterations; iteration++) {
		const visible = await extractVisibleEntries(page);
		const before = rawEntries.size;

		expectedTotal ??= parseSkillsShTotalCount(visible.totalSkills);

		for (const entry of visible.entries) {
			const key = buildRawEntryKey(entry);
			if (!key) continue;
			rawEntries.set(key, mergeRawEntries(rawEntries.get(key), entry));
		}

		const normalized = normalizeSkillsShEntries(Array.from(rawEntries.values()), {
			baseUrl: options.url,
		});
		const newEntries = rawEntries.size - before;
		const advancedRank = (visible.maxRank ?? 0) > highestVisibleRank;
		highestVisibleRank = Math.max(highestVisibleRank, visible.maxRank ?? 0);

		console.log(
			[
				`iteration ${iteration}`,
				`raw ${rawEntries.size}`,
				`normalized ${normalized.entries.length}`,
				`visible ${visible.entries.length}`,
				`range ${visible.minRank ?? '?'}-${visible.maxRank ?? '?'}`,
				expectedTotal !== null ? `expected ${expectedTotal}` : 'expected unknown',
				`new ${newEntries}`,
				advancedRank ? `max-rank ${highestVisibleRank}` : 'max-rank unchanged',
			].join(' | '),
		);

		if (
			(expectedTotal !== null && normalized.entries.length >= expectedTotal)
			|| (expectedTotal !== null && (visible.maxRank ?? 0) >= expectedTotal)
		) {
			stopReason = 'reached_expected_total';
			break;
		}

		if (newEntries === 0 && !advancedRank) {
			stagnantIterations++;
		} else {
			stagnantIterations = 0;
		}

		if (stagnantIterations >= maxStagnant) {
			stopReason = 'stagnant';
			break;
		}

		await advanceLeaderboard(page, scrollFactor, delayMs);
	}

	if (options.resolveDetails) {
		const unresolved = normalizeSkillsShEntries(Array.from(rawEntries.values()), {
			baseUrl: options.url,
		}).skipped;

		for (const rawEntry of unresolved) {
			if (!rawEntry.href) continue;
			const detail = await resolveDetailPage(rawEntry.href, options.url);
			const merged = mergeRawEntries(rawEntry, detail);
			const key = buildRawEntryKey(merged);
			if (!key) continue;
			rawEntries.set(key, mergeRawEntries(rawEntries.get(key), merged));
			fallbackResolvedCount++;
			await page.waitForTimeout(Math.min(delayMs, 250));
		}
	}
} finally {
	await browser.close();
}

const normalized = normalizeSkillsShEntries(Array.from(rawEntries.values()), {
	baseUrl: options.url,
});
const repositories = groupSkillsShRepositories(normalized.entries);
const benchmarkRepos = toBenchmarkRepositorySources(repositories);
const benchmarkReposText = benchmarkRepos.map((repository) => repository.source).join('\n');
const summary = {
	generatedAt: new Date().toISOString(),
	url: options.url,
	session: options.session,
	expectedTotal,
	rawEntryCount: rawEntries.size,
	entryCount: normalized.entries.length,
	skippedCount: normalized.skipped.length,
	repositoryCount: repositories.length,
	fallbackResolvedCount,
	stopReason,
};

await writeFile(join(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
await writeFile(
	join(outputDir, 'skills-sh-raw-entries.json'),
	`${JSON.stringify(Array.from(rawEntries.values()), null, 2)}\n`,
);
await writeFile(
	join(outputDir, 'skills-sh-entries.json'),
	`${JSON.stringify(normalized.entries, null, 2)}\n`,
);
await writeFile(
	join(outputDir, 'skills-sh-repositories.json'),
	`${JSON.stringify(repositories, null, 2)}\n`,
);
await writeFile(
	join(outputDir, 'skills-sh-benchmark-repos.json'),
	`${JSON.stringify(benchmarkRepos, null, 2)}\n`,
);
await writeFile(join(outputDir, 'skills-sh-benchmark-repos.txt'), `${benchmarkReposText}\n`);

console.log(
	[
		`entries ${normalized.entries.length}`,
		`repos ${repositories.length}`,
		expectedTotal !== null ? `expected ${expectedTotal}` : 'expected unknown',
		`stop ${stopReason}`,
	].join(' | '),
);

function loadPlaywright(): { chromium: BrowserEngine } {
	const candidatePaths = [
		process.cwd(),
		resolve(__dirname, '../../../../bap'),
		...(process.env.PLAYWRIGHT_RESOLVE_DIRS?.split(':').filter(Boolean) ?? []),
	];

	for (const base of candidatePaths) {
		try {
			const resolved = require.resolve('playwright', { paths: [base] });
			return require(resolved) as { chromium: BrowserEngine };
		} catch {
			// Keep trying other candidates.
		}
	}

	throw new Error(
		[
			'Could not resolve "playwright".',
			'Tried current workspace and a sibling "bap" repo.',
			'Set PLAYWRIGHT_RESOLVE_DIRS to add more lookup paths.',
		].join(' '),
	);
}

async function extractVisibleEntries(page: {
	evaluate: <T, Arg = unknown>(
		pageFunction: (arg: Arg) => T | Promise<T>,
		arg?: Arg,
	) => Promise<T>;
}): Promise<{
	totalSkills: string | null;
	entries: SkillsShRawEntry[];
	minRank: number | null;
	maxRank: number | null;
}> {
	return page.evaluate(() => {
		const totalAnchor = Array.from(document.querySelectorAll('a[href]')).find((anchor) => {
			return anchor.getAttribute('href') === '/' && /All Time/i.test(anchor.textContent || '');
		});

		const entries = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
			.filter((anchor) => /^\/[^/]+\/[^/]+\/[^/]+$/.test(anchor.getAttribute('href') || ''))
			.map((anchor) => {
				const rank = anchor.querySelector('div:first-child span')?.textContent?.trim() ?? null;
				const name = anchor.querySelector('h3')?.textContent?.trim() ?? null;
				const repo = anchor.querySelector('p')?.textContent?.trim() ?? null;
				const href = anchor.getAttribute('href') ?? null;
				return {
					rank,
					name,
					repo,
					href,
				};
			});

		const numericRanks = entries
			.map((entry) => {
				const digits = entry.rank?.match(/\d+/)?.[0];
				return digits ? Number.parseInt(digits, 10) : null;
			})
			.filter((rank): rank is number => Number.isInteger(rank));

		return {
			totalSkills: totalAnchor?.textContent?.trim() ?? null,
			entries,
			minRank: numericRanks.length > 0 ? Math.min(...numericRanks) : null,
			maxRank: numericRanks.length > 0 ? Math.max(...numericRanks) : null,
		};
	});
}

async function advanceLeaderboard(
	page: {
		evaluate: <T, Arg = unknown>(
			pageFunction: (arg: Arg) => T | Promise<T>,
			arg?: Arg,
		) => Promise<T>;
		waitForTimeout: (ms: number) => Promise<void>;
	},
	scrollFactor: number,
	delayMs: number,
): Promise<void> {
	const steps = Math.max(1, scrollFactor);

	for (let step = 0; step < steps; step++) {
		await page.evaluate(() => {
			window.scrollBy(0, window.innerHeight);
		});
		await page.waitForTimeout(delayMs);
	}
}

async function resolveDetailPage(href: string, baseUrl: string): Promise<SkillsShRawEntry> {
	const { chromium } = loadPlaywright();
	const browser = await chromium.launch({ headless: true, channel: 'chrome' });

	try {
		const page = await browser.newPage();
		await page.goto(new URL(href, baseUrl).toString(), {
			waitUntil: 'domcontentloaded',
			timeout: 30000,
		});

		return page.evaluate(() => {
			const githubLink = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).find((anchor) =>
				anchor.href.includes('github.com/'),
			);

			return {
				name: document.querySelector('h1')?.textContent?.trim() ?? null,
				repo: githubLink?.textContent?.trim() ?? null,
				href: window.location.pathname,
				githubUrl: githubLink?.href ?? null,
			};
		});
	} finally {
		await browser.close();
	}
}

function buildRawEntryKey(entry: SkillsShRawEntry): string | null {
	const href = entry.href?.trim();
	if (href) return href;

	const name = entry.name?.trim();
	const repo = entry.repo?.trim() ?? entry.githubUrl?.trim();
	const rank = typeof entry.rank === 'number' ? String(entry.rank) : entry.rank?.trim();
	if (name && repo) {
		return `${rank ?? 'unranked'}::${repo}::${name}`;
	}

	return null;
}

function mergeRawEntries(
	existing: SkillsShRawEntry | undefined,
	candidate: SkillsShRawEntry,
): SkillsShRawEntry {
	if (!existing) return candidate;

	return {
		rank: existing.rank ?? candidate.rank ?? null,
		name: longestText(existing.name, candidate.name),
		repo: normalizeField(existing.repo, candidate.repo),
		href: normalizeField(existing.href, candidate.href),
		githubUrl: normalizeField(existing.githubUrl, candidate.githubUrl),
	};
}

function longestText(
	left: string | null | undefined,
	right: string | null | undefined,
): string | null {
	const normalizedLeft = normalizeField(left, null);
	const normalizedRight = normalizeField(right, null);

	if (!normalizedLeft) return normalizedRight;
	if (!normalizedRight) return normalizedLeft;
	return normalizedRight.length > normalizedLeft.length ? normalizedRight : normalizedLeft;
}

function normalizeField(
	primary: string | null | undefined,
	fallback: string | null | undefined,
): string | null {
	const first = primary?.trim();
	if (first) return first;
	const second = fallback?.trim();
	return second || null;
}

function parsePositiveInteger(value: string, label: string): number {
	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		throw new Error(`${label} must be a positive integer. Received: ${value}`);
	}
	return parsed;
}
