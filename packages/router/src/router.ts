import { parseSkill, resolveSkillFiles } from '@skill-tools/core';
import type { BM25Options } from './bm25/index.js';
import { BM25Index } from './bm25/index.js';
import { extractContext } from './context/extractor.js';
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
	/** Raw markdown body (used for contextual retrieval) */
	readonly body?: string;
	/** Parsed sections from the SKILL.md (used for contextual retrieval) */
	readonly sections?: ReadonlyArray<{
		readonly heading: string;
		readonly depth: number;
		readonly content: string;
	}>;
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
	/** Number of results to return (default: 3) */
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
	/** Embedding provider configuration. Defaults to BM25 ('local'). */
	readonly embedding?: EmbeddingConfig;
	/** BM25 tuning parameters (only used with the default BM25 engine) */
	readonly bm25?: BM25Options;
	/**
	 * Enable contextual retrieval. When true (default), skills with
	 * body or sections will have supplementary context extracted and
	 * prepended to their description before indexing.
	 * Only affects indexing — result descriptions stay unchanged.
	 */
	readonly context?: boolean;
}

/**
 * SkillRouter — Skill selection middleware using BM25 full-text search.
 *
 * Indexes skill descriptions and enables fast, ranked search to find
 * the most relevant skills for a given query. Uses Okapi BM25 by default
 * with zero external dependencies.
 *
 * For neural/semantic embeddings, pass a custom embedding provider
 * via the `embedding` option.
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
	/** BM25 index — used when no external embedding provider is configured */
	private readonly bm25: BM25Index | null;

	/** Embedding provider — used with custom/openai/ollama providers */
	private readonly embedding: EmbeddingProvider | null;

	/** Vector store — used alongside embedding provider */
	private readonly store: VectorStore | null;

	/** Whether the router uses the BM25 engine (true) or embedding+store (false) */
	private readonly usesBM25: boolean;

	/** Whether contextual retrieval is enabled */
	private readonly contextEnabled: boolean;

	private skillNames: Set<string> = new Set();

	constructor(options?: SkillRouterOptions) {
		const embeddingConfig = options?.embedding ?? 'local';
		this.contextEnabled = options?.context !== false;

		if (embeddingConfig === 'local') {
			// Default: BM25 full-text search — fast, zero-dependency
			this.bm25 = new BM25Index(options?.bm25);
			this.embedding = null;
			this.store = null;
			this.usesBM25 = true;
		} else {
			// External embedding provider: use embedding + vector store
			this.embedding = createEmbeddingProvider(embeddingConfig);
			this.store = new MemoryVectorStore();
			this.bm25 = null;
			this.usesBM25 = false;
		}
	}

	/**
	 * Index a list of skill entries.
	 * With BM25 (default): indexes description text directly.
	 * With embeddings: embeds descriptions and stores vectors.
	 */
	async indexSkills(skills: SkillEntry[]): Promise<void> {
		if (skills.length === 0) return;

		if (this.usesBM25 && this.bm25) {
			// BM25 path — direct text indexing, no vectors
			this.bm25.add(
				skills.map((s) => ({
					id: s.name,
					text: this.enrichText(s),
					metadata: {
						description: s.description,
						path: s.path,
						...s.metadata,
					},
				})),
			);
		} else if (this.embedding && this.store) {
			// Embedding path — vectorize and store
			const descriptions = skills.map((s) => this.enrichText(s));

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
		}

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
					body: result.skill.body,
					sections: result.skill.sections,
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
		const topK = options?.topK ?? 3;
		const threshold = options?.threshold ?? 0.0;
		const boost = new Set(options?.boost ?? []);
		const exclude = options?.exclude ?? [];

		let results: Array<{ id: string; score: number; metadata: Record<string, unknown> }>;

		if (this.usesBM25 && this.bm25) {
			// BM25 path — direct text scoring
			results = this.bm25.search(query, topK * 2, threshold);
		} else if (this.embedding && this.store) {
			// Embedding path — vectorize query and search store
			const [queryVector] = await this.embedding.embed([query]);
			if (!queryVector) {
				throw new Error('Embedding provider returned empty result for query');
			}
			results = await this.store.search(queryVector, topK * 2, threshold);
		} else {
			return [];
		}

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

		if (this.usesBM25 && this.bm25) {
			// BM25 path — search each skill name against descriptions
			for (const name of names) {
				const results = this.bm25.search(name, names.length, threshold);
				const similar = results
					.filter((r) => r.id !== name && r.score >= threshold)
					.map((r) => r.id);

				if (similar.length > 0) {
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
		} else if (this.embedding && this.store) {
			// Embedding path — embed skill names and search store
			for (const name of names) {
				const results = await this.store.search(
					(await this.embedding.embed([name]))[0]!,
					names.length,
					threshold,
				);

				const similar = results
					.filter((r) => r.id !== name && r.score >= threshold)
					.map((r) => r.id);

				if (similar.length > 0) {
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
		}

		return conflicts;
	}

	/**
	 * Build the text to index for a skill entry.
	 * When contextual retrieval is enabled and the skill has body/sections,
	 * prepends extracted context to the description.
	 */
	private enrichText(skill: SkillEntry): string {
		if (this.contextEnabled && (skill.body || skill.sections)) {
			const ctx = extractContext(skill);
			if (ctx) return `${ctx} ${skill.description}`;
		}
		return skill.description;
	}

	/**
	 * Get the number of indexed skills.
	 */
	get count(): number {
		if (this.usesBM25 && this.bm25) {
			return this.bm25.size();
		}
		return this.store?.size() ?? 0;
	}

	/**
	 * Save the index to a JSON-serializable object.
	 */
	save(): SkillRouterSnapshot {
		if (this.usesBM25 && this.bm25) {
			return {
				version: 1,
				embeddingProvider: 'bm25',
				dimensions: 0,
				store: this.bm25.serialize(),
				skillNames: Array.from(this.skillNames),
			};
		}

		return {
			version: 1,
			embeddingProvider: this.embedding!.name,
			dimensions: this.embedding!.dimensions,
			store: this.store!.serialize(),
			skillNames: Array.from(this.skillNames),
		};
	}

	/**
	 * Load a previously saved index.
	 * Validates that the snapshot format matches the current engine.
	 */
	load(snapshot: SkillRouterSnapshot): void {
		if (this.usesBM25 && this.bm25) {
			if (snapshot.embeddingProvider !== 'bm25') {
				throw new Error(
					`Cannot load snapshot from provider "${snapshot.embeddingProvider}" into BM25 router. ` +
						'Create the router with a matching embedding config.',
				);
			}
			this.bm25.deserialize(snapshot.store);
		} else if (this.embedding && this.store) {
			if (snapshot.dimensions !== this.embedding.dimensions) {
				throw new Error(
					`Snapshot dimensions (${snapshot.dimensions}) don't match current provider dimensions (${this.embedding.dimensions})`,
				);
			}
			this.store.deserialize(snapshot.store);
		}

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
