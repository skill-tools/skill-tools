import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveSkillFiles } from '../src/resolver.js';

const FIXTURES = resolve(import.meta.dirname, 'fixtures');

describe('resolveSkillFiles', () => {
	it('resolves a single SKILL.md file', async () => {
		const locations = await resolveSkillFiles(
			resolve(FIXTURES, 'valid-skill/SKILL.md'),
		);

		expect(locations).toHaveLength(1);
		expect(locations[0]!.dirName).toBe('valid-skill');
		expect(locations[0]!.skillFile).toContain('SKILL.md');
	});

	it('resolves a directory containing SKILL.md', async () => {
		const locations = await resolveSkillFiles(resolve(FIXTURES, 'valid-skill'));

		expect(locations).toHaveLength(1);
		expect(locations[0]!.dirName).toBe('valid-skill');
	});

	it('resolves multiple skills from parent directory', async () => {
		const locations = await resolveSkillFiles(FIXTURES);

		// Should find all skill directories
		expect(locations.length).toBeGreaterThanOrEqual(4);

		const names = locations.map((l) => l.dirName);
		expect(names).toContain('valid-skill');
		expect(names).toContain('minimal-skill');
		expect(names).toContain('invalid-skill');
	});

	it('returns empty array for non-existent path', async () => {
		const locations = await resolveSkillFiles('/non/existent/path');

		expect(locations).toHaveLength(0);
	});

	it('returns sorted results', async () => {
		const locations = await resolveSkillFiles(FIXTURES);

		const names = locations.map((l) => l.dirName);
		const sorted = [...names].sort();
		expect(names).toEqual(sorted);
	});
});
