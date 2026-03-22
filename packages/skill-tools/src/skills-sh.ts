export interface SkillsShRawEntry {
	readonly rank?: string | number | null;
	readonly name?: string | null;
	readonly repo?: string | null;
	readonly href?: string | null;
	readonly githubUrl?: string | null;
}

export interface SkillsShEntry {
	readonly rank: number | null;
	readonly name: string;
	readonly repo: string;
	readonly owner: string;
	readonly repository: string;
	readonly skillSlug: string | null;
	readonly href: string;
	readonly githubUrl: string | null;
}

export interface SkillsShNormalizationResult {
	readonly entries: readonly SkillsShEntry[];
	readonly skipped: readonly SkillsShRawEntry[];
}

export interface SkillsShRepositoryRecord {
	readonly repo: string;
	readonly owner: string;
	readonly repository: string;
	readonly skillCount: number;
	readonly skills: readonly string[];
	readonly bestRank: number | null;
	readonly entries: readonly SkillsShEntry[];
}

export interface SkillsShNormalizeOptions {
	readonly baseUrl?: string;
}

/**
 * Normalize raw entries extracted from skills.sh into stable leaderboard rows.
 */
export function normalizeSkillsShEntries(
	rawEntries: readonly SkillsShRawEntry[],
	options?: SkillsShNormalizeOptions,
): SkillsShNormalizationResult {
	const baseUrl = options?.baseUrl ?? 'https://skills.sh';
	const entries = new Map<string, SkillsShEntry>();
	const skipped: SkillsShRawEntry[] = [];

	for (const raw of rawEntries) {
		const href = normalizeSkillsShUrl(raw.href, baseUrl);
		const githubUrl = normalizeUrl(raw.githubUrl);
		const repo = normalizeRepositoryReference(raw.repo)
			?? normalizeRepositoryReference(githubUrl)
			?? deriveRepositoryFromHref(href);
		const rank = parseRank(raw.rank);
		const skillSlug = deriveSkillSlug(href);
		const name = normalizeText(raw.name) ?? skillSlug;

		if (!href || !repo || !name) {
			skipped.push(raw);
			continue;
		}

		const [owner, repository] = repo.split('/');
		if (!owner || !repository) {
			skipped.push(raw);
			continue;
		}

		const entry: SkillsShEntry = {
			rank,
			name,
			repo,
			owner,
			repository,
			skillSlug,
			href,
			githubUrl,
		};
		const key = href;
		const existing = entries.get(key);

		if (!existing || shouldReplaceEntry(existing, entry)) {
			entries.set(key, entry);
		}
	}

	return {
		entries: Array.from(entries.values()).sort(compareSkillsShEntries),
		skipped,
	};
}

/**
 * Group normalized entries by repository so benchmark jobs run once per repo.
 */
export function groupSkillsShRepositories(
	entries: readonly SkillsShEntry[],
): SkillsShRepositoryRecord[] {
	const grouped = new Map<string, SkillsShEntry[]>();

	for (const entry of entries) {
		const existing = grouped.get(entry.repo);
		if (existing) {
			existing.push(entry);
		} else {
			grouped.set(entry.repo, [entry]);
		}
	}

	return Array.from(grouped.entries())
		.map(([repo, repoEntries]) => {
			const sortedEntries = [...repoEntries].sort(compareSkillsShEntries);
			const [owner, repository] = repo.split('/');
			const skills = Array.from(
				new Set(
					sortedEntries.map((entry) => entry.skillSlug ?? slugifySkillName(entry.name)),
				),
			).sort();
			const bestRank = sortedEntries.reduce<number | null>((best, entry) => {
				if (entry.rank === null) return best;
				return best === null ? entry.rank : Math.min(best, entry.rank);
			}, null);

			return {
				repo,
				owner: owner ?? repo,
				repository: repository ?? repo,
				skillCount: skills.length,
				skills,
				bestRank,
				entries: sortedEntries,
			} satisfies SkillsShRepositoryRecord;
		})
		.sort((a, b) => {
			if (a.bestRank === null && b.bestRank === null) return a.repo.localeCompare(b.repo);
			if (a.bestRank === null) return 1;
			if (b.bestRank === null) return -1;
			if (a.bestRank !== b.bestRank) return a.bestRank - b.bestRank;
			return a.repo.localeCompare(b.repo);
		});
}

/**
 * Convert grouped repositories to benchmark job inputs.
 */
export function toBenchmarkRepositorySources(
	repositories: readonly SkillsShRepositoryRecord[],
): Array<{ source: string; id: string }> {
	return repositories.map((repository) => ({
		source: repository.repo,
		id: repository.repo.replace(/[/.]+/g, '-'),
	}));
}

/**
 * Parse the "87,312 skills" header into an integer.
 */
export function parseSkillsShTotalCount(value: string | null | undefined): number | null {
	const normalized = normalizeText(value);
	if (!normalized) return null;

	const match = normalized.match(/([\d,]+)/);
	if (!match?.[1]) return null;

	const parsed = Number.parseInt(match[1].replace(/,/g, ''), 10);
	return Number.isNaN(parsed) ? null : parsed;
}

function normalizeText(value: string | null | undefined): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function normalizeUrl(value: string | null | undefined): string | null {
	const trimmed = normalizeText(value);
	if (!trimmed) return null;

	try {
		return new URL(trimmed).toString();
	} catch {
		return null;
	}
}

function normalizeSkillsShUrl(value: string | null | undefined, baseUrl: string): string | null {
	const trimmed = normalizeText(value);
	if (!trimmed) return null;

	try {
		return new URL(trimmed, baseUrl).toString();
	} catch {
		return null;
	}
}

function normalizeRepositoryReference(value: string | null | undefined): string | null {
	const trimmed = normalizeText(value);
	if (!trimmed) return null;

	const githubMatch = trimmed.match(/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/i);
	if (githubMatch?.[1]) {
		return stripGitSuffix(githubMatch[1]);
	}

	const repoMatch = trimmed.match(/\b([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\b/);
	if (repoMatch?.[1]) {
		return stripGitSuffix(repoMatch[1]);
	}

	return null;
}

function stripGitSuffix(value: string): string {
	return value.replace(/\.git$/i, '');
}

function deriveRepositoryFromHref(href: string | null): string | null {
	if (!href) return null;

	try {
		const url = new URL(href);
		const segments = url.pathname.split('/').filter(Boolean);
		if (segments.length < 2) return null;
		return `${segments[0]}/${segments[1]}`;
	} catch {
		return null;
	}
}

function deriveSkillSlug(href: string | null): string | null {
	if (!href) return null;

	try {
		const url = new URL(href);
		const segments = url.pathname.split('/').filter(Boolean);
		return segments[2] ?? null;
	} catch {
		return null;
	}
}

function parseRank(value: string | number | null | undefined): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}

	if (typeof value !== 'string') return null;
	const match = value.match(/\d+/);
	if (!match?.[0]) return null;
	const parsed = Number.parseInt(match[0], 10);
	return Number.isNaN(parsed) ? null : parsed;
}

function slugifySkillName(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.replace(/-{2,}/g, '-');
}

function shouldReplaceEntry(existing: SkillsShEntry, candidate: SkillsShEntry): boolean {
	if (existing.rank === null && candidate.rank !== null) return true;
	if (existing.rank !== null && candidate.rank === null) return false;
	if (existing.rank !== candidate.rank) {
		return (candidate.rank ?? Number.MAX_SAFE_INTEGER) < (existing.rank ?? Number.MAX_SAFE_INTEGER);
	}
	if (!existing.githubUrl && candidate.githubUrl) return true;
	if (existing.name.length < candidate.name.length) return true;
	return false;
}

function compareSkillsShEntries(a: SkillsShEntry, b: SkillsShEntry): number {
	if (a.rank === null && b.rank === null) return a.href.localeCompare(b.href);
	if (a.rank === null) return 1;
	if (b.rank === null) return -1;
	if (a.rank !== b.rank) return a.rank - b.rank;
	return a.href.localeCompare(b.href);
}
