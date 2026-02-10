/**
 * A single entry in the vector store.
 */
export interface VectorEntry {
	/** Unique identifier (skill name or path) */
	readonly id: string;
	/** The embedding vector */
	readonly vector: number[];
	/** Metadata associated with this entry */
	readonly metadata: Record<string, unknown>;
}

/**
 * Result of a similarity search.
 */
export interface SearchResult {
	/** Identifier of the matched entry */
	readonly id: string;
	/** Cosine similarity score (0-1, higher is more similar) */
	readonly score: number;
	/** Metadata from the matched entry */
	readonly metadata: Record<string, unknown>;
}

/**
 * Interface for vector storage backends.
 */
export interface VectorStore {
	/**
	 * Add entries to the store.
	 */
	add(entries: VectorEntry[]): Promise<void>;

	/**
	 * Search for the top-K most similar entries to a query vector.
	 */
	search(queryVector: number[], topK: number, threshold?: number): Promise<SearchResult[]>;

	/**
	 * Remove entries by ID.
	 */
	remove(ids: string[]): Promise<void>;

	/**
	 * Get the number of entries in the store.
	 */
	size(): number;

	/**
	 * Serialize the store to a JSON-compatible object.
	 */
	serialize(): unknown;

	/**
	 * Load from a serialized object.
	 */
	deserialize(data: unknown): void;
}
