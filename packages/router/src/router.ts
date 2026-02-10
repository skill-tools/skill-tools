import { parseSkill, resolveSkillFiles } from '@skill-tools/core';
import type { EmbeddingConfig, EmbeddingProvider } from './embeddings/interface.js';
import { LocalEmbeddingProvider } from './embeddings/local.js';
import type { VectorStore } from './stores/interface.js';
import { MemoryVectorStore } from './stores/memory.js';

/**
 * A skill entry prepared for indexing.
 */
export interface SkillEntry {
	/** Unique identifier (typically the skill name) */
	readonly name: string;
	/** The description text to embed */
	readonly description: string;
	/** Path to the SKILL.md file */
	readonly path?: string;
	/** Additional metadata to store alongside the embedding */
	readonly metadata?: Record<string, unknown>;
}

/**
 * Result of selecting a skill for a query.
 */
export interface SelectionResult {
	/** Skill name/ID */
	readonly skill: string;
	/** Similarity score (0-1) */
	readonly score: number;
	/** Metadata from the indexed skill */
	readonly metadata: Record<string, unknown>;
}

/**
 * Options for skill selection queries.
 */
export interface SelectOptions {
	/** Number of results to return (default: 5) */
	readonly topK?: number;
	/** Minimum similarity threshold (default: 0.0) */
	readonly threshold?: number;
	/** Skill names to boost in ranking */
	readonly boost?: string[];
	/** Skill name patterns to exclude */
	readonly exclude?: string[];
}

/**
 * Options for the SkillRouter constructor.
 */
export interface SkillRouterOptions {
	/** Embedding provider configuration */
	readonly embedding?: EmbeddingConfig;
}

/**
 * SkillRouter — Semantic skill selection middleware.
 *
 * Indexes skill descriptions as embeddings and enables semantic
 * search to find the most relevant skills for a given query.
 *
 * @example
 * ```ts
 * const router = new SkillRouter();
 * await router.indexSkills([
 *   { name: 'deploy-vercel', description: 'Deploy apps to Vercel...' },
 *   { name: 'run-tests', description: 'Execute test suites...' },
 * ]);
 *
 * const results = await router.select('deploy my app');
 * // => [{ skill: 'deploy-vercel', score: 0.89, ... }]
 * ```
 */
export class SkillRouter {
	private readonly embedding: EmbeddingProvider;
	private readonly store: VectorStore;
	private skillNames: Set<string> = new Set();

	constructor(options?: SkillRouterOptions) {
		this.embedding = createEmbeddingProvider(options?.embedding ?? 'local');
		this.store = new MemoryVectorStore();
	}

	/**
	 * Index a list of skill entries.
	 * Embeds their descriptions and stores the vectors.
	 */
	async indexSkills(skills: SkillEntry[]): Promise<void> {
		if (skills.length === 0) return;

		const descriptions = skills.map((s) => s.description);

		// Build vocabulary for local embedding provider
		if (this.embedding instanceof LocalEmbeddingProvider) {
			this.embedding.buildVocabulary(descriptions);
		}

		const vectors = await this.embedding.embed(descriptions);

		const entries = skills.map((skill, i) => ({
			id: skill.name,
			vector: vectors[i]!,
			metadata: {
				description: skill.description,
				path: skill.path,
				...skill.metadata,
			},
		}));

		await this.store.add(entries);

		for (const skill of skills) {
			this.skillNames.add(skill.name);
		}
	}

	/**
	 * Index all SKILL.md files in a directory.
	 * Parses each file and indexes its description.
	 */
	async indexDirectory(dirPath: string): Promise<number> {
		const locations = await resolveSkillFiles(dirPath);
		const skills: SkillEntry[] = [];

		for (const location of locations) {
			const result = await parseSkill(location.skillFile);
			if (result.ok && result.skill.metadata.description) {
				skills.push({
					name: result.skill.metadata.name ?? location.dirName,
					description: result.skill.metadata.description,
					path: location.skillFile,
				});
			}
		}

		await this.indexSkills(skills);
		return skills.length;
	}

	/**
	 * Select the most relevant skills for a query.
	 */
	async select(query: string, options?: SelectOptions): Promise<SelectionResult[]> {
		const topK = options?.topK ?? 5;
		const threshold = options?.threshold ?? 0.0;
		const boost = new Set(options?.boost ?? []);
		const exclude = options?.exclude ?? [];

		// Embed the query
		const [queryVector] = await this.embedding.embed([query]);
		if (!queryVector) {
			throw new Error('Embedding provider returned empty result for query');
		}

		// Search the store
		let results = await this.store.search(queryVector, topK * 2, threshold);

		// Apply exclude filters
		if (exclude.length > 0) {
			results = results.filter((r) => {
				return !exclude.some((pattern) => {
					if (pattern.endsWith('*')) {
						return r.id.startsWith(pattern.slice(0, -1));
					}
					return r.id === pattern;
				});
			});
		}

		// Apply boost
		if (boost.size > 0) {
			results = results.map((r) => ({
				...r,
				score: boost.has(r.id) ? r.score * 1.2 : r.score,
			}));
			results.sort((a, b) => b.score - a.score);
		}

		return results.slice(0, topK).map((r) => ({
			skill: r.id,
			score: r.score,
			metadata: r.metadata,
		}));
	}

	/**
	 * Detect skills with overlapping descriptions.
	 */
	async detectConflicts(threshold = 0.85): Promise<ConflictGroup[]> {
		const conflicts: ConflictGroup[] = [];
		const names = Array.from(this.skillNames);

		// For each skill, search for similar ones
		for (let i = 0; i < names.length; i++) {
			const name = names[i]!;
			// Get the stored entry's description to use as query
			const results = await this.store.search(
				(await this.embedding.embed([name]))[0]!,
				names.length,
				threshold,
			);

			// Filter to only other skills above threshold
			const similar = results.filter((r) => r.id !== name && r.score >= threshold).map((r) => r.id);

			if (similar.length > 0) {
				// Check if this group already exists
				const existing = conflicts.find(
					(c) => c.skills.includes(name) || similar.some((s) => c.skills.includes(s)),
				);
				if (!existing) {
					conflicts.push({
						skills: [name, ...similar],
						similarity: results.find((r) => r.id !== name)?.score ?? threshold,
						suggestion:
							'These skills have highly similar descriptions. Consider differentiating their trigger contexts.',
					});
				}
			}
		}

		return conflicts;
	}

	/**
	 * Get the number of indexed skills.
	 */
	get count(): number {
		return this.store.size();
	}

	/**
	 * Save the index to a JSON-serializable object.
	 */
	save(): SkillRouterSnapshot {
		return {
			version: 1,
			embeddingProvider: this.embedding.name,
			dimensions: this.embedding.dimensions,
			store: this.store.serialize(),
			skillNames: Array.from(this.skillNames),
		};
	}

	/**
	 * Load a previously saved index.
	 * Validates that the snapshot dimensions match the current embedding provider.
	 */
	load(snapshot: SkillRouterSnapshot): void {
		if (snapshot.dimensions !== this.embedding.dimensions) {
			throw new Error(
				`Snapshot dimensions (${snapshot.dimensions}) don't match current provider dimensions (${this.embedding.dimensions})`,
			);
		}
		this.store.deserialize(snapshot.store);
		this.skillNames = new Set(snapshot.skillNames);
	}

	/**
	 * Create a SkillRouter from a saved snapshot.
	 */
	static fromSnapshot(snapshot: SkillRouterSnapshot, options?: SkillRouterOptions): SkillRouter {
		const router = new SkillRouter(options);
		router.load(snapshot);
		return router;
	}
}

/**
 * A group of conflicting (highly similar) skills.
 */
export interface ConflictGroup {
	readonly skills: string[];
	readonly similarity: number;
	readonly suggestion: string;
}

/**
 * Serialized snapshot of a SkillRouter state.
 */
export interface SkillRouterSnapshot {
	readonly version: number;
	readonly embeddingProvider: string;
	readonly dimensions: number;
	readonly store: unknown;
	readonly skillNames: string[];
}

/**
 * Create an embedding provider from config.
 */
function createEmbeddingProvider(config: EmbeddingConfig): EmbeddingProvider {
	if (config === 'local') {
		return new LocalEmbeddingProvider();
	}

	if (config.provider === 'custom') {
		return {
			name: 'custom',
			dimensions: config.dimensions,
			embed: config.embed,
		};
	}

	// For openai/ollama, we'd need their SDKs as optional deps.
	// For now, throw a helpful error.
	throw new Error(
		`Embedding provider "${config.provider}" requires additional setup. ` +
			'Install the appropriate SDK and configure an API key. ' +
			'See: https://github.com/skill-tools/skill-tools#embedding-providers',
	);
}
