import { describe, expect, it } from 'vitest';
import { LocalEmbeddingProvider } from '../src/embeddings/local.js';

describe('LocalEmbeddingProvider', () => {
	it('returns vectors of the configured dimension', async () => {
		const provider = new LocalEmbeddingProvider(128);
		expect(provider.dimensions).toBe(128);

		const [vector] = await provider.embed(['deploy my application to production']);
		expect(vector).toHaveLength(128);
	});

	it('defaults to 256 dimensions', () => {
		const provider = new LocalEmbeddingProvider();
		expect(provider.dimensions).toBe(256);
	});

	it('produces L2-normalized vectors', async () => {
		const provider = new LocalEmbeddingProvider(64);
		const [vector] = await provider.embed(['run all the unit tests']);

		const magnitude = Math.sqrt(vector!.reduce((sum, v) => sum + v * v, 0));
		// Normalized vector should have magnitude ≈ 1
		expect(magnitude).toBeCloseTo(1.0, 4);
	});

	it('produces zero vector for empty text', async () => {
		const provider = new LocalEmbeddingProvider(64);
		const [vector] = await provider.embed(['']);

		const sum = vector!.reduce((s, v) => s + Math.abs(v), 0);
		expect(sum).toBe(0);
	});

	it('embeds multiple texts in batch', async () => {
		const provider = new LocalEmbeddingProvider(64);
		const vectors = await provider.embed([
			'deploy application',
			'run tests',
			'fix bug',
		]);

		expect(vectors).toHaveLength(3);
		for (const v of vectors) {
			expect(v).toHaveLength(64);
		}
	});

	it('produces similar vectors for similar texts', async () => {
		const provider = new LocalEmbeddingProvider(128);
		const corpus = [
			'deploy application to production server',
			'deploy app to staging environment',
			'run all unit tests and check coverage',
		];
		provider.buildVocabulary(corpus);

		const vectors = await provider.embed(corpus);

		const dotProduct = (a: number[], b: number[]) =>
			a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);

		// "deploy to production" should be more similar to "deploy to staging"
		// than to "run unit tests"
		const simDeployDeploy = dotProduct(vectors[0]!, vectors[1]!);
		const simDeployTest = dotProduct(vectors[0]!, vectors[2]!);

		expect(simDeployDeploy).toBeGreaterThan(simDeployTest);
	});

	it('buildVocabulary populates IDF values', async () => {
		const provider = new LocalEmbeddingProvider(64);

		// Before building, embeddings use hash-based indexing
		const [before] = await provider.embed(['deploy to production']);
		expect(before).toHaveLength(64);

		// After building, embeddings use vocabulary mapping
		provider.buildVocabulary([
			'deploy to production',
			'run unit tests',
			'manage database connections',
		]);

		const [after] = await provider.embed(['deploy to production']);
		expect(after).toHaveLength(64);
	});

	it('has the correct name', () => {
		const provider = new LocalEmbeddingProvider();
		expect(provider.name).toBe('local-tfidf');
	});
});
