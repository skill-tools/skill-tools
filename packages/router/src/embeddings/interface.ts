/**
 * Interface for embedding providers.
 * Implementations convert text into dense vector representations
 * for semantic similarity comparison.
 */
export interface EmbeddingProvider {
	/** Human-readable name of the provider */
	readonly name: string;

	/** Dimensionality of the output vectors */
	readonly dimensions: number;

	/**
	 * Generate embeddings for a batch of texts.
	 * @param texts - Array of text strings to embed
	 * @returns Array of embedding vectors (same order as input)
	 */
	embed(texts: string[]): Promise<number[][]>;
}

/**
 * Configuration for embedding providers.
 */
export type EmbeddingConfig =
	| 'local'
	| { provider: 'openai'; model?: string; apiKey?: string }
	| { provider: 'ollama'; model?: string; baseUrl?: string }
	| { provider: 'custom'; embed: (texts: string[]) => Promise<number[][]>; dimensions: number };
