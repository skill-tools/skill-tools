import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMcpToolsJson } from '../src/mcp.js';
import { renderMcpSkillMd } from '../src/mcp-renderer.js';

const FIXTURES = resolve(import.meta.dirname, 'fixtures');

function loadSpec() {
	const json = readFileSync(resolve(FIXTURES, 'mcp-tools.json'), 'utf-8');
	return parseMcpToolsJson(json, 'github');
}

describe('renderMcpSkillMd', () => {
	it('produces SKILL.md and references/TOOLS.md files', () => {
		const spec = loadSpec();
		const files = renderMcpSkillMd(spec);

		expect(files.size).toBe(2);
		const paths = Array.from(files.keys());
		expect(paths).toContain('github/SKILL.md');
		expect(paths).toContain('github/references/TOOLS.md');
	});

	it('includes frontmatter with name and description', () => {
		const spec = loadSpec();
		const files = renderMcpSkillMd(spec);
		const skill = files.get('github/SKILL.md')!;

		expect(skill).toMatch(/^---/);
		expect(skill).toContain('name: github');
		expect(skill).toContain('description:');
	});

	it('includes tool overview with grouped tables', () => {
		const spec = loadSpec();
		const files = renderMcpSkillMd(spec);
		const skill = files.get('github/SKILL.md')!;

		expect(skill).toContain('## Tools');
		expect(skill).toContain('| Tool | Description |');
		expect(skill).toContain('`create_issue`');
	});

	it('includes quick start section', () => {
		const spec = loadSpec();
		const files = renderMcpSkillMd(spec);
		const skill = files.get('github/SKILL.md')!;

		expect(skill).toContain('## Quick Start');
	});

	it('includes error handling section', () => {
		const spec = loadSpec();
		const files = renderMcpSkillMd(spec);
		const skill = files.get('github/SKILL.md')!;

		expect(skill).toContain('## Error Handling');
	});

	it('includes link to TOOLS.md reference', () => {
		const spec = loadSpec();
		const files = renderMcpSkillMd(spec);
		const skill = files.get('github/SKILL.md')!;

		expect(skill).toContain('[references/TOOLS.md](references/TOOLS.md)');
	});

	it('renders parameter tables for each tool in TOOLS.md', () => {
		const spec = loadSpec();
		const files = renderMcpSkillMd(spec);
		const tools = files.get('github/references/TOOLS.md')!;

		expect(tools).toContain('### `create_issue`');
		expect(tools).toContain('| Parameter | Type | Required | Description |');
		expect(tools).toContain('`owner`');
		expect(tools).toContain('`title`');
	});

	it('handles tools with no parameters', () => {
		const spec = parseMcpToolsJson(
			JSON.stringify({ tools: [{ name: 'ping', description: 'Ping server' }] }),
			'test',
		);
		const files = renderMcpSkillMd(spec);
		const tools = files.get('test/references/TOOLS.md')!;

		expect(tools).toContain('### `ping`');
		expect(tools).toContain('*No parameters*');
	});

	it('handles custom name option', () => {
		const spec = loadSpec();
		const files = renderMcpSkillMd(spec, { name: 'my-github' });

		const paths = Array.from(files.keys());
		expect(paths).toContain('my-github/SKILL.md');
		expect(paths).toContain('my-github/references/TOOLS.md');

		const skill = files.get('my-github/SKILL.md')!;
		expect(skill).toContain('name: my-github');
	});

	it('handles custom description option', () => {
		const spec = loadSpec();
		const files = renderMcpSkillMd(spec, { description: 'Custom desc here' });
		const skill = files.get('github/SKILL.md')!;

		expect(skill).toContain('Custom desc here');
	});

	it('skips TOOLS.md when includeToolReference is false', () => {
		const spec = loadSpec();
		const files = renderMcpSkillMd(spec, { includeToolReference: false });

		expect(files.size).toBe(1);
		const paths = Array.from(files.keys());
		expect(paths).toContain('github/SKILL.md');
		expect(paths).not.toContain('github/references/TOOLS.md');
	});

	it('includes enum values in parameter descriptions', () => {
		const spec = loadSpec();
		const files = renderMcpSkillMd(spec);
		const tools = files.get('github/references/TOOLS.md')!;

		// The update_issue tool has state with enum ["open", "closed"]
		expect(tools).toContain('`open`');
		expect(tools).toContain('`closed`');
	});

	it('includes default values in parameter descriptions', () => {
		const spec = loadSpec();
		const files = renderMcpSkillMd(spec);
		const tools = files.get('github/references/TOOLS.md')!;

		// list_issues has per_page with default 30
		expect(tools).toContain('Default:');
	});

	it('handles required vs optional parameters correctly', () => {
		const spec = loadSpec();
		const files = renderMcpSkillMd(spec);
		const tools = files.get('github/references/TOOLS.md')!;

		// owner is required, labels is optional in create_issue
		expect(tools).toContain('Yes');
		expect(tools).toContain('No');
	});

	it('generates common workflows section', () => {
		const spec = loadSpec();
		const files = renderMcpSkillMd(spec);
		const skill = files.get('github/SKILL.md')!;

		expect(skill).toContain('## Common Workflows');
	});

	it('renders tool annotations in TOOLS.md', () => {
		const spec = loadSpec();
		const files = renderMcpSkillMd(spec);
		const tools = files.get('github/references/TOOLS.md')!;

		expect(tools).toContain('destructive');
		expect(tools).toContain('read-only');
	});

	it('handles empty tools list gracefully', () => {
		const spec = parseMcpToolsJson(JSON.stringify({ tools: [] }), 'empty');
		const files = renderMcpSkillMd(spec);

		expect(files.size).toBe(1);
		const skill = files.get('empty/SKILL.md')!;
		expect(skill).toContain('name: empty');
		expect(skill).toContain('0 tools');
	});
});
