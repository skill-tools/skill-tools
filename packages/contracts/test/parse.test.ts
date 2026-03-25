import { resolve } from 'node:path';
import { parseSkill } from '@skill-tools/core';
import { describe, expect, it } from 'vitest';
import { parseContract } from '../src/parse.js';

const FIXTURES = resolve(import.meta.dirname, 'fixtures');

describe('parseContract', () => {
	it('parses a valid browser-agent contract', async () => {
		const parsedSkill = await parseSkill(resolve(FIXTURES, 'valid-browser-contract/SKILL.md'));
		expect(parsedSkill.ok).toBe(true);
		if (!parsedSkill.ok) return;

		const result = parseContract(parsedSkill.skill);
		expect(result.ok).toBe(true);
		expect(result.contract?.kind).toBe('browser-agent');
		expect(result.contract?.runtime.tools).toContain('navigate');
		expect(result.contract?.grounding.abstention?.ambiguityPolicy).toBe('abstain');
	});

	it('reports schema errors for malformed contracts', async () => {
		const parsedSkill = await parseSkill(resolve(FIXTURES, 'malformed-contract/SKILL.md'));
		expect(parsedSkill.ok).toBe(true);
		if (!parsedSkill.ok) return;

		const result = parseContract(parsedSkill.skill);
		expect(result.ok).toBe(false);
		expect(result.contract).toBeNull();
		expect(result.diagnostics.some((diag) => diag.ruleId.startsWith('contract-'))).toBe(true);
	});
});
