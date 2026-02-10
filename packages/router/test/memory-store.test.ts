import { describe, expect, it } from 'vitest';
import { MemoryVectorStore } from '../src/stores/memory.js';

describe('MemoryVectorStore', () => {
	const vec = (values: number[]) => {
		// L2 normalize for consistent cosine similarity
		const mag = Math.sqrt(values.reduce((s, v) => s + v * v, 0));
		return mag === 0 ? values : values.map((v) => v / mag);
	};

	it('starts empty', () => {
		const store = new MemoryVectorStore();
		expect(store.size()).toBe(0);
	});

	it('adds entries and reports correct size', async () => {
		const store = new MemoryVectorStore();
		await store.add([
			{ id: 'a', vector: vec([1, 0, 0]), metadata: {} },
			{ id: 'b', vector: vec([0, 1, 0]), metadata: {} },
		]);
		expect(store.size()).toBe(2);
	});

	it('searches by cosine similarity', async () => {
		const store = new MemoryVectorStore();
		await store.add([
			{ id: 'deploy', vector: vec([1, 0, 0]), metadata: { type: 'deploy' } },
			{ id: 'test', vector: vec([0, 1, 0]), metadata: { type: 'test' } },
			{ id: 'lint', vector: vec([0, 0, 1]), metadata: { type: 'lint' } },
		]);

		const results = await store.search(vec([1, 0.1, 0]), 2);
		expect(results).toHaveLength(2);
		expect(results[0]?.id).toBe('deploy');
		expect(results[0]?.score).toBeGreaterThan(0.9);
	});

	it('respects topK limit', async () => {
		const store = new MemoryVectorStore();
		await store.add([
			{ id: 'a', vector: vec([1, 0, 0]), metadata: {} },
			{ id: 'b', vector: vec([0.9, 0.1, 0]), metadata: {} },
			{ id: 'c', vector: vec([0, 1, 0]), metadata: {} },
		]);

		const results = await store.search(vec([1, 0, 0]), 1);
		expect(results).toHaveLength(1);
		expect(results[0]?.id).toBe('a');
	});

	it('applies similarity threshold', async () => {
		const store = new MemoryVectorStore();
		await store.add([
			{ id: 'close', vector: vec([1, 0, 0]), metadata: {} },
			{ id: 'far', vector: vec([0, 1, 0]), metadata: {} },
		]);

		// Orthogonal vectors have cosine similarity ≈ 0
		const results = await store.search(vec([1, 0, 0]), 10, 0.5);
		expect(results).toHaveLength(1);
		expect(results[0]?.id).toBe('close');
	});

	it('removes entries by ID', async () => {
		const store = new MemoryVectorStore();
		await store.add([
			{ id: 'a', vector: vec([1, 0]), metadata: {} },
			{ id: 'b', vector: vec([0, 1]), metadata: {} },
			{ id: 'c', vector: vec([1, 1]), metadata: {} },
		]);

		await store.remove(['a', 'c']);
		expect(store.size()).toBe(1);

		const results = await store.search(vec([1, 0]), 10);
		expect(results).toHaveLength(1);
		expect(results[0]?.id).toBe('b');
	});

	it('serializes and deserializes', async () => {
		const store = new MemoryVectorStore();
		await store.add([
			{ id: 'x', vector: vec([1, 0, 0]), metadata: { foo: 'bar' } },
			{ id: 'y', vector: vec([0, 1, 0]), metadata: { baz: 42 } },
		]);

		const snapshot = store.serialize();

		const restored = new MemoryVectorStore();
		restored.deserialize(snapshot);

		expect(restored.size()).toBe(2);

		const results = await restored.search(vec([1, 0, 0]), 1);
		expect(results[0]?.id).toBe('x');
		expect(results[0]?.metadata).toEqual({ foo: 'bar' });
	});

	it('throws on unsupported version during deserialize', () => {
		const store = new MemoryVectorStore();
		expect(() => store.deserialize({ version: 99, entries: [] })).toThrow(
			'Unsupported vector store version: 99',
		);
	});

	it('throws on dimension mismatch in search', async () => {
		const store = new MemoryVectorStore();
		await store.add([{ id: 'a', vector: [1, 0, 0], metadata: {} }]);

		await expect(store.search([1, 0], 1)).rejects.toThrow('Vector dimension mismatch');
	});

	it('preserves metadata through search results', async () => {
		const store = new MemoryVectorStore();
		await store.add([
			{
				id: 'skill-1',
				vector: vec([1, 0]),
				metadata: { description: 'Deploy to Vercel', path: '/skills/deploy' },
			},
		]);

		const [result] = await store.search(vec([1, 0]), 1);
		expect(result?.metadata).toEqual({
			description: 'Deploy to Vercel',
			path: '/skills/deploy',
		});
	});
});
