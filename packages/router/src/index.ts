/**
 * skillrouter — Semantic skill selection middleware for Agent Skills
 *
 * Provides embedding-based routing to intelligently select which skills
 * to inject into an agent's context window from large skill catalogs.
 *
 * @packageDocumentation
 */

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
