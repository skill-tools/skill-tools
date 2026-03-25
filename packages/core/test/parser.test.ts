import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSkill, parseSkillContent } from '../src/parser.js';

const FIXTURES = resolve(import.meta.dirname, 'fixtures');

describe('parseSkill', () => {
	it('parses a valid skill successfully', async () => {
		const result = await parseSkill(resolve(FIXTURES, 'valid-skill/SKILL.md'));

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.skill.metadata.name).toBe('deploy-vercel');
		expect(result.skill.metadata.description).toContain('Deploy web applications to Vercel');
		expect(result.skill.metadata.version).toBe('1.0.0');
		expect(result.skill.body).toContain('# Deploy to Vercel');
		expect(result.skill.tokenCount).toBeGreaterThan(0);
		expect(result.skill.lineCount).toBeGreaterThan(0);
		expect(result.skill.sections.length).toBeGreaterThan(0);
	});

	it('parses a minimal skill', async () => {
		const result = await parseSkill(resolve(FIXTURES, 'minimal-skill/SKILL.md'));

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.skill.metadata.name).toBe('hello');
		expect(result.skill.body).toBe('Say hello to the user.');
	});

	it('reports error for non-existent file', async () => {
		const result = await parseSkill(resolve(FIXTURES, 'does-not-exist/SKILL.md'));

		expect(result.ok).toBe(false);
		expect(result.diagnostics).toHaveLength(1);
		expect(result.diagnostics[0]?.ruleId).toBe('file-readable');
		expect(result.diagnostics[0]?.severity).toBe('error');
	});

	it('reports invalid name format', async () => {
		const result = await parseSkill(resolve(FIXTURES, 'invalid-skill/SKILL.md'));

		expect(result.ok).toBe(false);
		const nameError = result.diagnostics.find((d) => d.ruleId === 'name-format');
		expect(nameError).toBeDefined();
		expect(nameError?.severity).toBe('error');
	});

	it('reports error for missing description', async () => {
		const result = await parseSkill(resolve(FIXTURES, 'missing-desc/SKILL.md'));

		expect(result.ok).toBe(false);
		const descError = result.diagnostics.find((d) => d.ruleId === 'description-required');
		expect(descError).toBeDefined();
		expect(descError?.severity).toBe('error');
	});

	it('detects broken file references', async () => {
		const result = await parseSkill(resolve(FIXTURES, 'broken-refs/SKILL.md'));

		// Should still parse (broken refs in scripts/ and references/ dirs)
		const refErrors = result.diagnostics.filter((d) => d.ruleId === 'file-reference-exists');
		// references/guide.md and scripts/helper.sh don't exist
		expect(refErrors.length).toBeGreaterThanOrEqual(2);

		// The existing script should NOT trigger an error
		if (result.ok) {
			const existingRef = result.skill.fileReferences.find((r) => r.path === 'scripts/existing.sh');
			expect(existingRef?.exists).toBe(true);
		}
	});

	it('extracts sections correctly', async () => {
		const result = await parseSkill(resolve(FIXTURES, 'valid-skill/SKILL.md'));

		if (!result.ok) {
			throw new Error(`Expected ok=true, got diagnostics: ${JSON.stringify(result.diagnostics)}`);
		}

		const headings = result.skill.sections.map((s) => s.heading);
		expect(headings).toContain('Deploy to Vercel');
		expect(headings).toContain('Prerequisites');
		expect(headings).toContain('Steps');
		expect(headings).toContain('Error Handling');
	});
});

describe('parseSkillContent', () => {
	it('parses content from a string', () => {
		const content = `---
name: test-skill
description: A test skill for parsing
---

# Instructions

Do the thing.
`;
		const result = parseSkillContent(content, '/fake/SKILL.md', '/fake');

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.skill.metadata.name).toBe('test-skill');
		expect(result.skill.metadata.description).toBe('A test skill for parsing');
		expect(result.skill.sections).toHaveLength(1);
		expect(result.skill.sections[0]?.heading).toBe('Instructions');
	});

	it('fails on empty content', () => {
		const result = parseSkillContent('', '/fake/SKILL.md', '/fake');
		// Empty frontmatter triggers the frontmatter-required error
		expect(result.ok).toBe(false);
	});

	it('fails on invalid YAML frontmatter', () => {
		const content = `---
name: [invalid yaml
---

Body here.
`;
		const result = parseSkillContent(content, '/fake/SKILL.md', '/fake');

		expect(result.ok).toBe(false);
		const yamlError = result.diagnostics.find((d) => d.ruleId === 'frontmatter-valid-yaml');
		expect(yamlError).toBeDefined();
	});

	it('warns when token count exceeds budget', () => {
		// Generate a large body
		const bigBody = 'A '.repeat(5000);
		const content = `---
name: big-skill
description: A skill with way too much content
---

${bigBody}
`;
		const result = parseSkillContent(content, '/fake/SKILL.md', '/fake');

		expect(result.ok).toBe(true);
		const tokenWarning = result.diagnostics.find((d) => d.ruleId === 'token-budget');
		expect(tokenWarning).toBeDefined();
		expect(tokenWarning?.severity).toBe('warning');
	});

	it('warns for too-short description', () => {
		const content = `---
name: x
description: short
---

Body.
`;
		const result = parseSkillContent(content, '/fake/SKILL.md', '/fake');

		const descWarning = result.diagnostics.find((d) => d.ruleId === 'description-length');
		expect(descWarning).toBeDefined();
		expect(descWarning?.severity).toBe('warning');
	});

	it('errors for too-long description (>1024 chars)', () => {
		const longDesc = 'A'.repeat(1025);
		const content = `---
name: x
description: "${longDesc}"
---

Body.
`;
		const result = parseSkillContent(content, '/fake/SKILL.md', '/fake');

		expect(result.ok).toBe(false);
		const descError = result.diagnostics.find((d) => d.ruleId === 'description-length');
		expect(descError).toBeDefined();
		expect(descError?.severity).toBe('error');
	});

	it('preserves extra metadata fields', () => {
		const content = `---
name: my-skill
description: A skill
context: fork
agent: Explore
disable-model-invocation: true
allowed-tools: Read, Grep, Glob
custom-field: custom-value
---

Body.
`;
		const result = parseSkillContent(content, '/fake/SKILL.md', '/fake');

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.skill.metadata.context).toBe('fork');
		expect(result.skill.metadata.agent).toBe('Explore');
		expect(result.skill.metadata['disable-model-invocation']).toBe(true);
		expect(result.skill.metadata['allowed-tools']).toBe('Read, Grep, Glob');
		expect(result.skill.metadata['custom-field']).toBe('custom-value');
	});

	it('preserves contract metadata as raw frontmatter data', () => {
		const content = `---
name: my-skill
description: A skill
contract:
  kind: browser-agent
  version: 1
  runtime:
    tools:
      - navigate
  provenance: {}
  grounding: {}
---

Body.
`;
		const result = parseSkillContent(content, '/fake/SKILL.md', '/fake');

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.skill.metadata.contract).toEqual({
			kind: 'browser-agent',
			version: 1,
			runtime: { tools: ['navigate'] },
			provenance: {},
			grounding: {},
		});
	});

	it('errors for missing name', () => {
		const content = `---
description: A skill without a name
---

Body.
`;
		const result = parseSkillContent(content, '/fake/SKILL.md', '/fake');

		expect(result.ok).toBe(false);
		const nameError = result.diagnostics.find((d) => d.ruleId === 'name-required');
		expect(nameError).toBeDefined();
		expect(nameError?.severity).toBe('error');
	});

	it('errors for consecutive hyphens in name', () => {
		const content = `---
name: bad--name
description: A skill with bad name
---

Body.
`;
		const result = parseSkillContent(content, '/fake/SKILL.md', '/fake');

		expect(result.ok).toBe(false);
		const nameError = result.diagnostics.find((d) => d.ruleId === 'name-format');
		expect(nameError).toBeDefined();
	});
});
