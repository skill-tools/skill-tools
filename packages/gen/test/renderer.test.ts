import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseOpenApi } from '../src/openapi.js';
import { renderSkillMd } from '../src/renderer.js';

const FIXTURES = resolve(import.meta.dirname, 'fixtures');

function loadSpec() {
	const content = readFileSync(resolve(FIXTURES, 'petstore.json'), 'utf-8');
	return parseOpenApi(content);
}

describe('renderSkillMd', () => {
	describe('unified mode', () => {
		it('produces a single SKILL.md file', () => {
			const spec = loadSpec();
			const files = renderSkillMd(spec, { mode: 'unified' });

			expect(files.size).toBe(1);
			const [path] = Array.from(files.keys());
			expect(path).toMatch(/SKILL\.md$/);
		});

		it('includes frontmatter with name and description', () => {
			const spec = loadSpec();
			const files = renderSkillMd(spec, { mode: 'unified' });
			const content = Array.from(files.values())[0]!;

			expect(content).toMatch(/^---/);
			expect(content).toContain('name: petstore-api');
			expect(content).toContain('description:');
		});

		it('includes all endpoints', () => {
			const spec = loadSpec();
			const files = renderSkillMd(spec, { mode: 'unified' });
			const content = Array.from(files.values())[0]!;

			expect(content).toContain('/pets');
			expect(content).toContain('/pets/{petId}');
			expect(content).toContain('/store/inventory');
		});

		it('includes authentication section', () => {
			const spec = loadSpec();
			const files = renderSkillMd(spec, { mode: 'unified' });
			const content = Array.from(files.values())[0]!;

			expect(content).toContain('## Authentication');
			expect(content).toContain('Bearer');
		});

		it('includes error handling section', () => {
			const spec = loadSpec();
			const files = renderSkillMd(spec, { mode: 'unified' });
			const content = Array.from(files.values())[0]!;

			expect(content).toContain('## Error Handling');
		});

		it('groups endpoints by tag', () => {
			const spec = loadSpec();
			const files = renderSkillMd(spec, { mode: 'unified' });
			const content = Array.from(files.values())[0]!;

			expect(content).toContain('### Pets');
			expect(content).toContain('### Store');
		});

		it('uses custom name when provided', () => {
			const spec = loadSpec();
			const files = renderSkillMd(spec, { name: 'my-pet-api' });

			const [path] = Array.from(files.keys());
			expect(path).toBe('my-pet-api/SKILL.md');
		});

		it('uses custom description when provided', () => {
			const spec = loadSpec();
			const files = renderSkillMd(spec, { description: 'Custom description here' });
			const content = Array.from(files.values())[0]!;

			expect(content).toContain('Custom description here');
		});

		it('excludes error handling when option is false', () => {
			const spec = loadSpec();
			const files = renderSkillMd(spec, { includeErrorHandling: false });
			const content = Array.from(files.values())[0]!;

			expect(content).not.toContain('## Error Handling');
		});
	});

	describe('per-endpoint mode', () => {
		it('produces one file per endpoint', () => {
			const spec = loadSpec();
			const files = renderSkillMd(spec, { mode: 'per-endpoint' });

			expect(files.size).toBe(5);
		});

		it('names files based on operationId', () => {
			const spec = loadSpec();
			const files = renderSkillMd(spec, { mode: 'per-endpoint' });
			const paths = Array.from(files.keys());

			expect(paths).toContain('list-pets/SKILL.md');
			expect(paths).toContain('create-pet/SKILL.md');
			expect(paths).toContain('get-pet/SKILL.md');
			expect(paths).toContain('delete-pet/SKILL.md');
			expect(paths).toContain('get-inventory/SKILL.md');
		});

		it('each file has frontmatter', () => {
			const spec = loadSpec();
			const files = renderSkillMd(spec, { mode: 'per-endpoint' });

			for (const content of files.values()) {
				expect(content).toMatch(/^---/);
				expect(content).toContain('name:');
				expect(content).toContain('description:');
			}
		});

		it('includes parameters table for endpoint with params', () => {
			const spec = loadSpec();
			const files = renderSkillMd(spec, { mode: 'per-endpoint' });
			const listPets = files.get('list-pets/SKILL.md')!;

			expect(listPets).toContain('### Parameters');
			expect(listPets).toContain('| Parameter |');
			expect(listPets).toContain('`limit`');
		});

		it('includes request body for POST endpoints', () => {
			const spec = loadSpec();
			const files = renderSkillMd(spec, { mode: 'per-endpoint' });
			const createPet = files.get('create-pet/SKILL.md')!;

			expect(createPet).toContain('### Request Body');
			expect(createPet).toContain('`name`');
		});

		it('includes example section', () => {
			const spec = loadSpec();
			const files = renderSkillMd(spec, { mode: 'per-endpoint' });
			const getPet = files.get('get-pet/SKILL.md')!;

			expect(getPet).toContain('## Example');
			expect(getPet).toContain('curl');
		});

		it('excludes examples when option is false', () => {
			const spec = loadSpec();
			const files = renderSkillMd(spec, {
				mode: 'per-endpoint',
				includeExamples: false,
			});
			const getPet = files.get('get-pet/SKILL.md')!;

			expect(getPet).not.toContain('## Example');
		});
	});
});
