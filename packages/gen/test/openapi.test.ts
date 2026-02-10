import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseOpenApi } from '../src/openapi.js';

const FIXTURES = resolve(import.meta.dirname, 'fixtures');

describe('parseOpenApi', () => {
	it('parses a JSON OpenAPI spec', () => {
		const content = readFileSync(resolve(FIXTURES, 'petstore.json'), 'utf-8');
		const spec = parseOpenApi(content);

		expect(spec.title).toBe('Petstore API');
		expect(spec.description).toContain('managing pets');
		expect(spec.version).toBe('1.0.0');
		expect(spec.servers).toEqual(['https://api.petstore.example.com/v1']);
	});

	it('parses a YAML OpenAPI spec', () => {
		const content = readFileSync(resolve(FIXTURES, 'petstore.yaml'), 'utf-8');
		const spec = parseOpenApi(content);

		expect(spec.title).toBe('Petstore YAML');
		expect(spec.endpoints).toHaveLength(1);
	});

	it('extracts all endpoints', () => {
		const content = readFileSync(resolve(FIXTURES, 'petstore.json'), 'utf-8');
		const spec = parseOpenApi(content);

		expect(spec.endpoints).toHaveLength(5);

		const methods = spec.endpoints.map((e) => `${e.method} ${e.path}`);
		expect(methods).toContain('GET /pets');
		expect(methods).toContain('POST /pets');
		expect(methods).toContain('GET /pets/{petId}');
		expect(methods).toContain('DELETE /pets/{petId}');
		expect(methods).toContain('GET /store/inventory');
	});

	it('extracts endpoint parameters', () => {
		const content = readFileSync(resolve(FIXTURES, 'petstore.json'), 'utf-8');
		const spec = parseOpenApi(content);

		const listPets = spec.endpoints.find((e) => e.operationId === 'listPets');
		expect(listPets).toBeDefined();
		expect(listPets!.parameters).toHaveLength(2);

		const limitParam = listPets!.parameters.find((p) => p.name === 'limit');
		expect(limitParam).toMatchObject({
			name: 'limit',
			in: 'query',
			required: false,
			type: 'integer',
		});
	});

	it('extracts request body', () => {
		const content = readFileSync(resolve(FIXTURES, 'petstore.json'), 'utf-8');
		const spec = parseOpenApi(content);

		const createPet = spec.endpoints.find((e) => e.operationId === 'createPet');
		expect(createPet).toBeDefined();
		expect(createPet!.requestBody).toBeDefined();
		expect(createPet!.requestBody!.contentType).toBe('application/json');
		expect(createPet!.requestBody!.required).toBe(true);

		const nameProperty = createPet!.requestBody!.properties.find((p) => p.name === 'name');
		expect(nameProperty).toMatchObject({
			name: 'name',
			type: 'string',
			required: true,
		});
	});

	it('extracts responses', () => {
		const content = readFileSync(resolve(FIXTURES, 'petstore.json'), 'utf-8');
		const spec = parseOpenApi(content);

		const getPet = spec.endpoints.find((e) => e.operationId === 'getPet');
		expect(getPet).toBeDefined();
		expect(getPet!.responses).toHaveLength(2);

		const notFound = getPet!.responses.find((r) => r.statusCode === '404');
		expect(notFound).toBeDefined();
		expect(notFound!.description).toBe('Pet not found');
	});

	it('extracts auth schemes', () => {
		const content = readFileSync(resolve(FIXTURES, 'petstore.json'), 'utf-8');
		const spec = parseOpenApi(content);

		expect(spec.auth).toHaveLength(1);
		expect(spec.auth[0]).toMatchObject({
			type: 'http',
			name: 'bearerAuth',
			scheme: 'bearer',
		});
	});

	it('extracts operation tags', () => {
		const content = readFileSync(resolve(FIXTURES, 'petstore.json'), 'utf-8');
		const spec = parseOpenApi(content);

		const listPets = spec.endpoints.find((e) => e.operationId === 'listPets');
		expect(listPets!.tags).toEqual(['Pets']);

		const getInventory = spec.endpoints.find((e) => e.operationId === 'getInventory');
		expect(getInventory!.tags).toEqual(['Store']);
	});

	it('throws for non-OpenAPI 3.x documents', () => {
		expect(() => parseOpenApi('{"swagger": "2.0"}')).toThrow('Unsupported OpenAPI version');
	});

	it('throws for empty input', () => {
		expect(() => parseOpenApi('')).toThrow();
	});

	it('handles spec with no paths', () => {
		const spec = parseOpenApi(
			JSON.stringify({
				openapi: '3.0.0',
				info: { title: 'Empty', version: '1.0.0' },
			}),
		);
		expect(spec.endpoints).toHaveLength(0);
	});

	it('handles spec with no servers', () => {
		const spec = parseOpenApi(
			JSON.stringify({
				openapi: '3.0.0',
				info: { title: 'No Servers', version: '1.0.0' },
			}),
		);
		expect(spec.servers).toHaveLength(0);
	});
});
