/**
 * Okapi BM25 — Zero-dependency, optimized text search index.
 *
 * Builds an inverted index from document text and scores queries
 * using the BM25 ranking function. Designed for fast skill routing
 * with catalogs up to ~10,000 entries.
 *
 * Performance:
 * - Index build: O(n * avg_doc_len)
 * - Query: O(q * avg_posting_len) — only visits docs containing query terms
 * - Memory: O(vocabulary_size * avg_posting_len)
 *
 * @packageDocumentation
 */

/** A document stored in the index */
interface BM25Document {
	readonly id: string;
	readonly length: number;
	readonly metadata: Record<string, unknown>;
}

/** A posting list entry: document index + term frequency */
interface Posting {
	readonly docIdx: number;
	readonly tf: number;
}

/** Serialized snapshot of BM25Index state */
export interface BM25Snapshot {
	readonly version: 2;
	readonly documents: ReadonlyArray<{
		readonly id: string;
		readonly length: number;
		readonly metadata: Record<string, unknown>;
	}>;
	readonly invertedIndex: ReadonlyArray<[string, Posting[]]>;
	readonly idf: ReadonlyArray<[string, number]>;
	readonly avgdl: number;
	readonly k1: number;
	readonly b: number;
}

/** Options for creating a BM25Index */
export interface BM25Options {
	/** Term frequency saturation parameter (default: 1.2) */
	readonly k1?: number;
	/** Document length normalization parameter (default: 0.75) */
	readonly b?: number;
}

/**
 * BM25Index — Fast, zero-dependency full-text search using Okapi BM25.
 *
 * @example
 * ```ts
 * const idx = new BM25Index();
 * idx.add([
 *   { id: 'deploy', text: 'Deploy apps to Vercel production', metadata: {} },
 *   { id: 'test', text: 'Run unit tests with coverage', metadata: {} },
 * ]);
 * const results = idx.search('deploy production', 5);
 * ```
 */
export class BM25Index {
	private readonly k1: number;
	private readonly b: number;

	private documents: BM25Document[] = [];
	private invertedIndex: Map<string, Posting[]> = new Map();
	private idfCache: Map<string, number> = new Map();
	private avgdl = 0;
	private totalDocLength = 0;

	constructor(options?: BM25Options) {
		this.k1 = options?.k1 ?? 1.2;
		this.b = options?.b ?? 0.75;
	}

	/**
	 * Add documents to the index.
	 * Batch operation — IDF is recomputed once after all documents are added.
	 */
	add(
		entries: ReadonlyArray<{
			readonly id: string;
			readonly text: string;
			readonly metadata: Record<string, unknown>;
		}>,
	): void {
		if (entries.length === 0) return;

		for (const entry of entries) {
			const tokens = tokenize(entry.text);
			const docIdx = this.documents.length;

			this.documents.push({
				id: entry.id,
				length: tokens.length,
				metadata: entry.metadata,
			});

			this.totalDocLength += tokens.length;

			// Build term frequencies for this document
			const termFreq = new Map<string, number>();
			for (const token of tokens) {
				termFreq.set(token, (termFreq.get(token) ?? 0) + 1);
			}

			// Append to inverted index
			for (const [term, tf] of termFreq) {
				let postings = this.invertedIndex.get(term);
				if (!postings) {
					postings = [];
					this.invertedIndex.set(term, postings);
				}
				postings.push({ docIdx, tf });
			}
		}

		// Recompute avgdl and IDF after batch add
		this.avgdl = this.totalDocLength / this.documents.length;
		this.recomputeIDF();
	}

	/**
	 * Remove documents by ID.
	 * Rebuilds internal index mappings after removal.
	 */
	remove(ids: readonly string[]): void {
		const idSet = new Set(ids);
		const removedIndices = new Set<number>();

		for (let i = 0; i < this.documents.length; i++) {
			if (idSet.has(this.documents[i]!.id)) {
				removedIndices.add(i);
				this.totalDocLength -= this.documents[i]!.length;
			}
		}

		if (removedIndices.size === 0) return;

		// Rebuild documents array and create old→new index mapping
		const newDocuments: BM25Document[] = [];
		const indexMap = new Map<number, number>();
		for (let i = 0; i < this.documents.length; i++) {
			if (!removedIndices.has(i)) {
				indexMap.set(i, newDocuments.length);
				newDocuments.push(this.documents[i]!);
			}
		}
		this.documents = newDocuments;

		// Rebuild inverted index with remapped indices
		for (const [term, postings] of this.invertedIndex) {
			const filtered: Posting[] = [];
			for (const p of postings) {
				if (!removedIndices.has(p.docIdx)) {
					filtered.push({ docIdx: indexMap.get(p.docIdx)!, tf: p.tf });
				}
			}
			if (filtered.length === 0) {
				this.invertedIndex.delete(term);
			} else {
				this.invertedIndex.set(term, filtered);
			}
		}

		// Recompute stats
		this.avgdl = this.documents.length > 0 ? this.totalDocLength / this.documents.length : 0;
		this.recomputeIDF();
	}

	/**
	 * Search the index with a query string.
	 *
	 * Returns results sorted by BM25 score (highest first).
	 * Scores are normalized to [0, 1] — the top result gets 1.0.
	 *
	 * Only documents containing at least one query term are scored,
	 * making queries fast even on large indexes.
	 */
	search(
		query: string,
		topK: number,
		threshold = 0.0,
	): Array<{
		readonly id: string;
		readonly score: number;
		readonly metadata: Record<string, unknown>;
	}> {
		if (this.documents.length === 0) return [];

		const queryTokens = tokenize(query);
		if (queryTokens.length === 0) return [];

		// Sparse score accumulator — only touched documents get entries
		const scores = new Float64Array(this.documents.length);
		let hasScores = false;

		for (const token of queryTokens) {
			const idf = this.idfCache.get(token);
			if (idf === undefined || idf <= 0) continue;

			const postings = this.invertedIndex.get(token);
			if (!postings) continue;

			for (const posting of postings) {
				const docLen = this.documents[posting.docIdx]!.length;
				const tf = posting.tf;

				// Okapi BM25 scoring
				const numerator = tf * (this.k1 + 1);
				const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / this.avgdl));
				scores[posting.docIdx] = scores[posting.docIdx]! + idf * (numerator / denominator);
				hasScores = true;
			}
		}

		if (!hasScores) return [];

		// Find max score for normalization
		let maxScore = 0;
		for (let i = 0; i < scores.length; i++) {
			if (scores[i]! > maxScore) maxScore = scores[i]!;
		}

		if (maxScore === 0) return [];

		// Collect results, normalize to [0, 1], filter by threshold
		const results: Array<{ id: string; score: number; metadata: Record<string, unknown> }> = [];

		for (let i = 0; i < scores.length; i++) {
			const raw = scores[i]!;
			if (raw === 0) continue;

			const normalized = raw / maxScore;
			if (normalized >= threshold) {
				results.push({
					id: this.documents[i]!.id,
					score: normalized,
					metadata: this.documents[i]!.metadata,
				});
			}
		}

		// Sort by score descending, take topK
		results.sort((a, b) => b.score - a.score);
		return results.slice(0, topK);
	}

	/** Number of indexed documents */
	size(): number {
		return this.documents.length;
	}

	/** Serialize to a JSON-compatible snapshot */
	serialize(): BM25Snapshot {
		return {
			version: 2,
			documents: this.documents.map((d) => ({
				id: d.id,
				length: d.length,
				metadata: d.metadata,
			})),
			invertedIndex: Array.from(this.invertedIndex.entries()),
			idf: Array.from(this.idfCache.entries()),
			avgdl: this.avgdl,
			k1: this.k1,
			b: this.b,
		};
	}

	/** Restore from a serialized snapshot */
	deserialize(data: unknown): void {
		const obj = data as BM25Snapshot;
		if (!obj || typeof obj !== 'object') {
			throw new Error('Invalid BM25 snapshot: expected an object');
		}
		if (obj.version !== 2) {
			throw new Error(`Unsupported BM25 snapshot version: ${obj.version}`);
		}

		this.documents = obj.documents.map((d) => ({
			id: d.id,
			length: d.length,
			metadata: d.metadata,
		}));
		this.invertedIndex = new Map(obj.invertedIndex.map(([k, v]) => [k, [...v]]));
		this.idfCache = new Map(obj.idf);
		this.avgdl = obj.avgdl;
		this.totalDocLength = this.documents.reduce((sum, d) => sum + d.length, 0);
	}

	/** Recompute IDF values for all terms in the inverted index */
	private recomputeIDF(): void {
		const N = this.documents.length;
		this.idfCache.clear();

		for (const [term, postings] of this.invertedIndex) {
			const df = postings.length;
			// BM25 IDF: log((N - df + 0.5) / (df + 0.5) + 1)
			this.idfCache.set(term, Math.log((N - df + 0.5) / (df + 0.5) + 1));
		}
	}
}

/**
 * Tokenize text: lowercase, strip punctuation, split on whitespace,
 * filter stop words and single-character tokens.
 */
function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, ' ')
		.split(/\s+/)
		.filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Common English stop words — filtered during tokenization.
 */
const STOP_WORDS = new Set([
	'a',
	'an',
	'the',
	'is',
	'are',
	'was',
	'were',
	'be',
	'been',
	'being',
	'have',
	'has',
	'had',
	'do',
	'does',
	'did',
	'will',
	'would',
	'could',
	'should',
	'may',
	'might',
	'shall',
	'can',
	'must',
	'to',
	'of',
	'in',
	'for',
	'on',
	'with',
	'at',
	'by',
	'from',
	'as',
	'into',
	'through',
	'during',
	'before',
	'after',
	'above',
	'below',
	'between',
	'out',
	'off',
	'over',
	'under',
	'again',
	'further',
	'then',
	'once',
	'here',
	'there',
	'when',
	'where',
	'why',
	'how',
	'all',
	'each',
	'every',
	'both',
	'few',
	'more',
	'most',
	'other',
	'some',
	'such',
	'no',
	'nor',
	'not',
	'only',
	'own',
	'same',
	'so',
	'than',
	'too',
	'very',
	'and',
	'but',
	'or',
	'if',
	'it',
	'its',
	'this',
	'that',
	'these',
	'those',
	'he',
	'she',
	'they',
	'we',
	'you',
	'i',
	'me',
	'my',
	'your',
	'his',
	'her',
	'their',
	'our',
	'what',
	'which',
	'who',
	'whom',
]);
