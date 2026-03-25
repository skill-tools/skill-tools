import { resolve } from 'node:path';
import { parseSkill } from '@skill-tools/core';
import { describe, expect, it } from 'vitest';
import { validateContract } from '../src/validate.js';

const FIXTURES = resolve(import.meta.dirname, 'fixtures');

describe('validateContract', () => {
	it('returns no diagnostics for a well-formed browser-agent contract', async () => {
		const parsedSkill = await parseSkill(resolve(FIXTURES, 'valid-browser-contract/SKILL.md'));
		expect(parsedSkill.ok).toBe(true);
		if (!parsedSkill.ok) return;

		expect(validateContract(parsedSkill.skill)).toEqual([]);
	});

	it('surfaces schema diagnostics for malformed contracts', async () => {
		const parsedSkill = await parseSkill(resolve(FIXTURES, 'malformed-contract/SKILL.md'));
		expect(parsedSkill.ok).toBe(true);
		if (!parsedSkill.ok) return;

		const diagnostics = validateContract(parsedSkill.skill);
		expect(diagnostics.length).toBeGreaterThan(0);
		expect(diagnostics[0]?.severity).toBe('error');
	});
});
