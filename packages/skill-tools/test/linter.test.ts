import { resolve } from 'node:path';
import { parseSkill, parseSkillContent } from '@skill-tools/core';
import { describe, expect, it } from 'vitest';
import { lint } from '../src/linter.js';

const FIXTURES = resolve(import.meta.dirname, 'fixtures');

describe('lint', () => {
	it('reports no errors or warnings for a good skill', async () => {
		const parseResult = await parseSkill(resolve(FIXTURES, 'good-skill/SKILL.md'));
		if (!parseResult.ok) throw new Error('Parse failed');

		const result = lint(parseResult.skill);

		expect(result.errorCount).toBe(0);
		expect(result.warningCount).toBe(0);
	});

	it('reports specificity warning for vague description', async () => {
		const parseResult = await parseSkill(resolve(FIXTURES, 'bad-skill/SKILL.md'));
		if (!parseResult.ok) throw new Error('Parse failed');

		const result = lint(parseResult.skill);

		const specificityIssue = result.diagnostics.find((d) => d.ruleId === 'description-specificity');
		expect(specificityIssue).toBeDefined();
	});

	it('reports secrets in SKILL.md', async () => {
		const parseResult = await parseSkill(resolve(FIXTURES, 'secret-skill/SKILL.md'));
		if (!parseResult.ok) throw new Error('Parse failed');

		const result = lint(parseResult.skill);

		const secretIssue = result.diagnostics.find((d) => d.ruleId === 'no-secrets');
		expect(secretIssue).toBeDefined();
		expect(secretIssue?.severity).toBe('error');
	});

	it('reports hardcoded paths', async () => {
		const parseResult = await parseSkill(resolve(FIXTURES, 'secret-skill/SKILL.md'));
		if (!parseResult.ok) throw new Error('Parse failed');

		const result = lint(parseResult.skill);

		const pathIssue = result.diagnostics.find((d) => d.ruleId === 'no-hardcoded-paths');
		expect(pathIssue).toBeDefined();
	});

	it('flags skills with too many top-level sections', () => {
		const sections = Array.from(
			{ length: 7 },
			(_, i) => `## Section ${i + 1}\n\nContent for section ${i + 1}.`,
		).join('\n\n');
		const content = [
			'---',
			'name: many-sections',
			'description: >-',
			'  A skill with many sections. Use when testing section count limits.',
			'---',
			'',
			'# Many Sections',
			'',
			sections,
		].join('\n');

		const parseResult = parseSkillContent(content, '/test/SKILL.md', '/test');
		if (!parseResult.ok) throw new Error('Parse failed');

		const result = lint(parseResult.skill);
		const sectionIssue = result.diagnostics.find(
			(d) => d.ruleId === 'section-count-optimal',
		);
		expect(sectionIssue).toBeDefined();
		expect(sectionIssue?.severity).toBe('info');
		expect(sectionIssue?.message).toContain('7 top-level sections');
	});

	it('does not flag skills with 5 or fewer top-level sections', () => {
		const sections = Array.from(
			{ length: 4 },
			(_, i) => `## Section ${i + 1}\n\nContent for section ${i + 1}.`,
		).join('\n\n');
		const content = [
			'---',
			'name: few-sections',
			'description: >-',
			'  A skill with few sections. Use when testing section count limits.',
			'---',
			'',
			'# Few Sections',
			'',
			sections,
		].join('\n');

		const parseResult = parseSkillContent(content, '/test/SKILL.md', '/test');
		if (!parseResult.ok) throw new Error('Parse failed');

		const result = lint(parseResult.skill);
		const sectionIssue = result.diagnostics.find(
			(d) => d.ruleId === 'section-count-optimal',
		);
		expect(sectionIssue).toBeUndefined();
	});

	it('respects rule overrides', async () => {
		const parseResult = await parseSkill(resolve(FIXTURES, 'bad-skill/SKILL.md'));
		if (!parseResult.ok) throw new Error('Parse failed');

		const result = lint(parseResult.skill, {
			'description-specificity': 'off',
		});

		const specificityIssue = result.diagnostics.find((d) => d.ruleId === 'description-specificity');
		expect(specificityIssue).toBeUndefined();
	});
});
