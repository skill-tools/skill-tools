/**
 * @skill-tools/router — Skill selection middleware for Agent Skills
 *
 * Uses BM25 full-text search by default to intelligently select which skills
 * to inject into an agent's context window from large skill catalogs.
 * Supports pluggable embedding providers for neural/semantic search.
 *
 * @packageDocumentation
 */

export type { BM25Options, BM25Snapshot } from './bm25/index.js';
export { BM25Index } from './bm25/index.js';
export type { EmbeddingConfig, EmbeddingProvider } from './embeddings/interface.js';
export { LocalEmbeddingProvider } from './embeddings/local.js';
export type {
	ConflictGroup,
	SelectionResult,
	SelectOptions,
	SkillEntry,
	SkillRouterOptions,
	SkillRouterSnapshot,
} from './router.js';
export { SkillRouter } from './router.js';
export type { SearchResult, VectorEntry, VectorStore } from './stores/interface.js';
export { MemoryVectorStore } from './stores/memory.js';
