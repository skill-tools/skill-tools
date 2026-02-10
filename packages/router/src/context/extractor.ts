/**
 * Context extractor for contextual retrieval.
 *
 * Extracts supplementary terms from a skill's body and sections
 * to enrich the description before BM25 indexing. This is a
 * deterministic, zero-dependency alternative to LLM-generated
 * chunk context (see: Anthropic's contextual retrieval paper).
 *
 * @packageDocumentation
 */

/** Minimal skill shape required for context extraction */
export interface ContextInput {
	readonly name: string;
	readonly description: string;
	readonly body?: string;
	readonly sections?: ReadonlyArray<{
		readonly heading: string;
		readonly depth: number;
		readonly content: string;
	}>;
}

/** Maximum number of context tokens to prepend */
const MAX_CONTEXT_TOKENS = 80;

/**
 * Extract supplementary context from a skill's body and structure.
 *
 * Returns a space-separated string of unique terms derived from:
 * 1. Skill name parts (split on `-` and `_`)
 * 2. Section headings
 * 3. Inline code references (backtick-wrapped)
 * 4. Key terms from body text
 *
 * Terms already present in the description are omitted.
 * Result is truncated to ~80 tokens.
 *
 * Returns empty string if no useful context can be extracted.
 */
export function extractContext(skill: ContextInput): string {
	const terms: string[] = [];

	// 1. Split skill name on - and _
	const nameParts = skill.name
		.split(/[-_]/)
		.map((p) => p.toLowerCase())
		.filter((p) => p.length > 1);
	terms.push(...nameParts);

	// 2. Section headings
	if (skill.sections) {
		for (const section of skill.sections) {
			const headingWords = section.heading
				.toLowerCase()
				.replace(/[^a-z0-9\s-]/g, ' ')
				.split(/\s+/)
				.filter((w) => w.length > 1);
			terms.push(...headingWords);
		}
	}

	// 3. Inline code references from body
	if (skill.body) {
		const codeRefs = extractCodeRefs(skill.body);
		terms.push(...codeRefs);
	}

	// 4. Key terms from section content (longer words, likely meaningful)
	if (skill.sections) {
		for (const section of skill.sections) {
			const contentWords = section.content
				.toLowerCase()
				.replace(/[^a-z0-9\s-]/g, ' ')
				.split(/\s+/)
				.filter((w) => w.length > 3 && !COMMON_WORDS.has(w));
			terms.push(...contentWords);
		}
	}

	// Dedup against description
	const descLower = skill.description.toLowerCase();
	const descTokens = new Set(
		descLower
			.replace(/[^a-z0-9\s-]/g, ' ')
			.split(/\s+/)
			.filter((t) => t.length > 0),
	);

	const seen = new Set<string>();
	const unique: string[] = [];

	for (const term of terms) {
		const lower = term.toLowerCase();
		if (lower.length < 2) continue;
		if (seen.has(lower)) continue;
		if (descTokens.has(lower)) continue;
		seen.add(lower);
		unique.push(lower);
	}

	// Truncate to MAX_CONTEXT_TOKENS
	return truncateTokens(unique, MAX_CONTEXT_TOKENS).join(' ');
}

/**
 * Extract inline code references from markdown body.
 * Matches single-backtick code spans (not fenced blocks).
 */
function extractCodeRefs(body: string): string[] {
	const refs: string[] = [];
	const pattern = /`([^`\n]+)`/g;

	for (const match of body.matchAll(pattern)) {
		const code = match[1]!.trim();
		// Split compound code refs (e.g. "vercel --prod" → ["vercel", "--prod"])
		const parts = code
			.split(/\s+/)
			.map((p) => p.replace(/^-+/, '').toLowerCase())
			.filter((p) => p.length > 1);
		refs.push(...parts);
	}

	return refs;
}

/**
 * Truncate a list of tokens to a maximum count.
 */
function truncateTokens(tokens: string[], max: number): string[] {
	if (tokens.length <= max) return tokens;
	return tokens.slice(0, max);
}

/**
 * Common English words to filter from section content.
 * More aggressive than BM25 stop words — we only want meaningful terms.
 */
const COMMON_WORDS = new Set([
	'also',
	'about',
	'after',
	'again',
	'been',
	'before',
	'being',
	'between',
	'both',
	'check',
	'could',
	'does',
	'done',
	'down',
	'each',
	'even',
	'every',
	'first',
	'following',
	'from',
	'have',
	'here',
	'into',
	'just',
	'know',
	'like',
	'make',
	'many',
	'might',
	'more',
	'most',
	'much',
	'must',
	'need',
	'only',
	'other',
	'over',
	'same',
	'should',
	'some',
	'such',
	'sure',
	'take',
	'than',
	'that',
	'them',
	'then',
	'there',
	'these',
	'they',
	'this',
	'those',
	'through',
	'under',
	'very',
	'want',
	'well',
	'were',
	'what',
	'when',
	'where',
	'which',
	'while',
	'will',
	'with',
	'would',
	'your',
]);
