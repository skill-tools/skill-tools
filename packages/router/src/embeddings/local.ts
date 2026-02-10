import type { EmbeddingProvider } from './interface.js';

/**
 * Local TF-IDF based embedding provider.
 *
 * Uses a deterministic hash-based approach to create sparse-then-dense
 * embeddings from text. No external API calls or model downloads needed.
 *
 * Quality is lower than neural embedding models, but sufficient for
 * keyword-heavy skill descriptions where exact word matching matters.
 * Ideal for catalogs under 500 skills.
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
	readonly name = 'local-tfidf';
	readonly dimensions: number;

	private vocabulary: Map<string, number> = new Map();
	private idfValues: Map<string, number> = new Map();
	private isBuilt = false;

	constructor(dimensions = 256) {
		this.dimensions = dimensions;
	}

	/**
	 * Build the vocabulary and IDF values from a corpus.
	 * Call this once after indexing all skill descriptions.
	 */
	buildVocabulary(texts: string[]): void {
		const docCount = texts.length;
		const termDocFreq = new Map<string, number>();

		for (const text of texts) {
			const tokens = new Set(tokenize(text));
			for (const token of tokens) {
				termDocFreq.set(token, (termDocFreq.get(token) ?? 0) + 1);
			}
		}

		// Compute IDF values
		for (const [term, df] of termDocFreq) {
			this.idfValues.set(term, Math.log((docCount + 1) / (df + 1)) + 1);
		}

		// Build vocabulary (top terms by IDF)
		const sorted = Array.from(this.idfValues.entries()).sort((a, b) => b[1] - a[1]);
		let idx = 0;
		for (const [term] of sorted) {
			this.vocabulary.set(term, idx % this.dimensions);
			idx++;
		}

		this.isBuilt = true;
	}

	async embed(texts: string[]): Promise<number[][]> {
		return texts.map((text) => this.embedSingle(text));
	}

	private embedSingle(text: string): number[] {
		const vector = new Float64Array(this.dimensions);
		const tokens = tokenize(text);
		const termFreq = new Map<string, number>();

		for (const token of tokens) {
			termFreq.set(token, (termFreq.get(token) ?? 0) + 1);
		}

		for (const [term, tf] of termFreq) {
			const idf = this.idfValues.get(term) ?? 1;
			const tfidf = (1 + Math.log(tf)) * idf;

			if (this.isBuilt) {
				// Use vocabulary mapping if built
				const idx = this.vocabulary.get(term);
				if (idx !== undefined) {
					vector[idx] = (vector[idx] ?? 0) + tfidf;
				}
			} else {
				// Fall back to hash-based indexing
				const idx = hashToIndex(term, this.dimensions);
				vector[idx] = (vector[idx] ?? 0) + tfidf;
			}
		}

		// L2 normalize
		return l2Normalize(Array.from(vector));
	}
}

/**
 * Tokenize text into lowercase tokens, removing stop words and punctuation.
 */
function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, ' ')
		.split(/\s+/)
		.filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Deterministic hash of a string to an index in range [0, size).
 * Uses FNV-1a hash.
 */
function hashToIndex(str: string, size: number): number {
	let hash = 0x811c9dc5; // FNV offset basis
	for (let i = 0; i < str.length; i++) {
		hash ^= str.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193); // FNV prime
	}
	return Math.abs(hash) % size;
}

/**
 * L2 normalize a vector.
 */
function l2Normalize(vector: number[]): number[] {
	let sum = 0;
	for (const v of vector) {
		sum += v * v;
	}
	const magnitude = Math.sqrt(sum);
	if (magnitude === 0) return vector;
	return vector.map((v) => v / magnitude);
}

/**
 * Common English stop words.
 */
const STOP_WORDS = new Set([
	'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
	'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
	'should', 'may', 'might', 'shall', 'can', 'must', 'to', 'of', 'in',
	'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
	'during', 'before', 'after', 'above', 'below', 'between', 'out',
	'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here',
	'there', 'when', 'where', 'why', 'how', 'all', 'each', 'every',
	'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
	'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'and',
	'but', 'or', 'if', 'it', 'its', 'this', 'that', 'these', 'those',
	'he', 'she', 'they', 'we', 'you', 'i', 'me', 'my', 'your', 'his',
	'her', 'their', 'our', 'what', 'which', 'who', 'whom',
]);
