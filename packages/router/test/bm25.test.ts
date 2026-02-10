import { describe, expect, it } from 'vitest';
import { BM25Index } from '../src/bm25/index.js';

const SAMPLE_DOCS = [
	{ id: 'deploy-vercel', text: 'Deploy applications to Vercel production hosting platform', metadata: {} },
	{ id: 'deploy-aws', text: 'Deploy applications to AWS Amazon Web Services cloud infrastructure', metadata: {} },
	{ id: 'run-tests', text: 'Execute unit tests integration tests end-to-end coverage reporting', metadata: {} },
	{ id: 'lint-code', text: 'Run ESLint Biome Prettier code formatting style checking', metadata: {} },
	{
		id: 'database-migrate',
		text: 'Run database migrations using Prisma Drizzle SQL schema updates',
		metadata: {},
	},
];

describe('BM25Index', () => {
	it('starts empty', () => {
		const idx = new BM25Index();
		expect(idx.size()).toBe(0);
	});

	it('adds documents and reports correct size', () => {
		const idx = new BM25Index();
		idx.add(SAMPLE_DOCS);
		expect(idx.size()).toBe(5);
	});

	it('ranks deploy queries with deploy skills first', () => {
		const idx = new BM25Index();
		idx.add(SAMPLE_DOCS);
		const results = idx.search('deploy application production', 5);
		expect(results.length).toBeGreaterThan(0);
		expect(results[0]!.id).toMatch(/^deploy-/);
	});

	it('ranks test queries with test skill first', () => {
		const idx = new BM25Index();
		idx.add(SAMPLE_DOCS);
		const results = idx.search('run unit tests coverage', 5);
		expect(results.length).toBeGreaterThan(0);
		expect(results[0]!.id).toBe('run-tests');
	});

	it('ranks database queries correctly', () => {
		const idx = new BM25Index();
		idx.add(SAMPLE_DOCS);
		const results = idx.search('database migrations prisma', 5);
		expect(results.length).toBeGreaterThan(0);
		expect(results[0]!.id).toBe('database-migrate');
	});

	it('normalizes scores to [0, 1] range', () => {
		const idx = new BM25Index();
		idx.add(SAMPLE_DOCS);
		const results = idx.search('deploy', 5);
		for (const r of results) {
			expect(r.score).toBeGreaterThanOrEqual(0);
			expect(r.score).toBeLessThanOrEqual(1);
		}
		// Top result is always 1.0 (normalized max)
		expect(results[0]!.score).toBeCloseTo(1.0);
	});

	it('respects topK limit', () => {
		const idx = new BM25Index();
		idx.add(SAMPLE_DOCS);
		const results = idx.search('deploy', 2);
		expect(results.length).toBeLessThanOrEqual(2);
	});

	it('respects threshold filter', () => {
		const idx = new BM25Index();
		idx.add(SAMPLE_DOCS);
		const high = idx.search('deploy', 10, 0.99);
		const low = idx.search('deploy', 10, 0.0);
		expect(high.length).toBeLessThanOrEqual(low.length);
	});

	it('removes documents by ID', () => {
		const idx = new BM25Index();
		idx.add(SAMPLE_DOCS);
		idx.remove(['deploy-vercel', 'deploy-aws']);
		expect(idx.size()).toBe(3);
		const results = idx.search('deploy', 5);
		expect(results.find((r) => r.id === 'deploy-vercel')).toBeUndefined();
		expect(results.find((r) => r.id === 'deploy-aws')).toBeUndefined();
	});

	it('serializes and deserializes round-trip', () => {
		const idx = new BM25Index();
		idx.add(SAMPLE_DOCS);
		const snapshot = idx.serialize();

		const restored = new BM25Index();
		restored.deserialize(snapshot);
		expect(restored.size()).toBe(5);

		const results = restored.search('deploy production', 2);
		expect(results.length).toBeGreaterThan(0);
		expect(results[0]!.id).toMatch(/^deploy-/);
	});

	it('returns empty for empty query', () => {
		const idx = new BM25Index();
		idx.add(SAMPLE_DOCS);
		expect(idx.search('', 5)).toHaveLength(0);
	});

	it('returns empty for query with no matching terms', () => {
		const idx = new BM25Index();
		idx.add(SAMPLE_DOCS);
		expect(idx.search('xyzzy frobnicator', 5)).toHaveLength(0);
	});

	it('accepts custom k1 and b parameters', () => {
		const idx = new BM25Index({ k1: 1.5, b: 0.5 });
		idx.add(SAMPLE_DOCS);
		const results = idx.search('deploy', 2);
		expect(results.length).toBeGreaterThan(0);
	});

	it('preserves document metadata', () => {
		const idx = new BM25Index();
		idx.add([{ id: 'test', text: 'test document content', metadata: { custom: 'data', count: 42 } }]);
		const [result] = idx.search('test document', 1);
		expect(result!.metadata).toEqual({ custom: 'data', count: 42 });
	});

	it('throws on invalid snapshot version', () => {
		const idx = new BM25Index();
		expect(() => idx.deserialize({ version: 99 })).toThrow('Unsupported BM25 snapshot version');
	});

	it('handles single-document index', () => {
		const idx = new BM25Index();
		idx.add([{ id: 'solo', text: 'the only document about kubernetes', metadata: {} }]);
		const results = idx.search('kubernetes', 5);
		expect(results).toHaveLength(1);
		expect(results[0]!.id).toBe('solo');
		expect(results[0]!.score).toBeCloseTo(1.0);
	});

	it('handles incremental adds', () => {
		const idx = new BM25Index();
		idx.add(SAMPLE_DOCS.slice(0, 3));
		expect(idx.size()).toBe(3);
		idx.add(SAMPLE_DOCS.slice(3));
		expect(idx.size()).toBe(5);

		// All docs searchable
		const results = idx.search('deploy', 5);
		expect(results.length).toBeGreaterThan(0);
	});
});
