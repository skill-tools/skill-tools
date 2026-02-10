import type { SearchResult, VectorEntry, VectorStore } from './interface.js';

/**
 * In-memory vector store using brute-force cosine similarity search.
 *
 * Suitable for catalogs of up to ~1,000 skills. For larger catalogs,
 * use the SQLite backend.
 *
 * At 1,000 entries with 256-dimensional vectors, search takes <5ms.
 */
export class MemoryVectorStore implements VectorStore {
	private entries: VectorEntry[] = [];

	async add(entries: VectorEntry[]): Promise<void> {
		this.entries.push(...entries);
	}

	async search(queryVector: number[], topK: number, threshold = 0.0): Promise<SearchResult[]> {
		const scored = this.entries.map((entry) => ({
			id: entry.id,
			score: cosineSimilarity(queryVector, entry.vector),
			metadata: entry.metadata,
		}));

		return scored
			.filter((r) => r.score >= threshold)
			.sort((a, b) => b.score - a.score)
			.slice(0, topK);
	}

	async remove(ids: string[]): Promise<void> {
		const idSet = new Set(ids);
		this.entries = this.entries.filter((e) => !idSet.has(e.id));
	}

	size(): number {
		return this.entries.length;
	}

	serialize(): unknown {
		return {
			version: 1,
			entries: this.entries.map((e) => ({
				id: e.id,
				vector: e.vector,
				metadata: e.metadata,
			})),
		};
	}

	deserialize(data: unknown): void {
		if (!data || typeof data !== 'object') {
			throw new Error('Invalid snapshot: expected an object');
		}
		const obj = data as Record<string, unknown>;
		if (obj['version'] !== 1) {
			throw new Error(`Unsupported vector store version: ${obj['version']}`);
		}
		if (!Array.isArray(obj['entries'])) {
			throw new Error('Invalid snapshot: entries must be an array');
		}
		for (const entry of obj['entries'] as unknown[]) {
			if (!entry || typeof entry !== 'object') {
				throw new Error('Invalid snapshot: each entry must be an object');
			}
			const e = entry as Record<string, unknown>;
			if (typeof e['id'] !== 'string') {
				throw new Error('Invalid snapshot: entry id must be a string');
			}
			if (
				!Array.isArray(e['vector']) ||
				!(e['vector'] as unknown[]).every((v) => typeof v === 'number')
			) {
				throw new Error('Invalid snapshot: entry vector must be an array of numbers');
			}
		}
		this.entries = obj['entries'] as VectorEntry[];
	}
}

/**
 * Compute cosine similarity between two vectors.
 * Returns a value between -1 and 1. For normalized vectors, this is equivalent
 * to the dot product.
 */
function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length !== b.length) {
		throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
	}

	let dotProduct = 0;
	let normA = 0;
	let normB = 0;

	for (let i = 0; i < a.length; i++) {
		dotProduct += a[i]! * b[i]!;
		normA += a[i]! * a[i]!;
		normB += b[i]! * b[i]!;
	}

	const denominator = Math.sqrt(normA) * Math.sqrt(normB);
	if (denominator === 0) return 0;

	return dotProduct / denominator;
}
