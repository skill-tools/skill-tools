import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { clusterTools, parseMcpToolsJson } from '../src/mcp.js';
import type { McpToolSpec } from '../src/mcp-types.js';

const FIXTURES = resolve(import.meta.dirname, 'fixtures');

function loadFixture(): string {
	return readFileSync(resolve(FIXTURES, 'mcp-tools.json'), 'utf-8');
}

describe('parseMcpToolsJson', () => {
	it('parses a tools/list response into McpServerSpec', () => {
		const spec = parseMcpToolsJson(loadFixture(), 'github');

		expect(spec.name).toBe('github');
		expect(spec.toolCount).toBe(15);
		expect(spec.tools.length).toBe(15);
		expect(spec.groups.length).toBeGreaterThan(0);
	});

	it('extracts tool names and descriptions', () => {
		const spec = parseMcpToolsJson(loadFixture(), 'github');

		const createIssue = spec.tools.find((t) => t.name === 'create_issue');
		expect(createIssue).toBeDefined();
		expect(createIssue!.description).toContain('Create a new issue');
	});

	it('extracts inputSchema properties', () => {
		const spec = parseMcpToolsJson(loadFixture(), 'github');

		const createIssue = spec.tools.find((t) => t.name === 'create_issue');
		expect(createIssue!.inputSchema).toBeDefined();
		expect(createIssue!.inputSchema!.properties).toHaveProperty('owner');
		expect(createIssue!.inputSchema!.properties).toHaveProperty('title');
		expect(createIssue!.inputSchema!.required).toContain('owner');
		expect(createIssue!.inputSchema!.required).toContain('title');
	});

	it('extracts annotations', () => {
		const spec = parseMcpToolsJson(loadFixture(), 'github');

		const mergePr = spec.tools.find((t) => t.name === 'merge_pull_request');
		expect(mergePr!.annotations).toBeDefined();
		expect(mergePr!.annotations!.destructiveHint).toBe(true);

		const listPrs = spec.tools.find((t) => t.name === 'list_pull_requests');
		expect(listPrs!.annotations!.readOnlyHint).toBe(true);
	});

	it('handles tools with no inputSchema', () => {
		const json = JSON.stringify({
			tools: [{ name: 'ping', description: 'Ping the server' }],
		});
		const spec = parseMcpToolsJson(json, 'test');

		expect(spec.toolCount).toBe(1);
		expect(spec.tools[0]!.inputSchema).toBeUndefined();
	});

	it('handles empty tools list', () => {
		const json = JSON.stringify({ tools: [] });
		const spec = parseMcpToolsJson(json, 'test');

		expect(spec.toolCount).toBe(0);
		expect(spec.tools).toHaveLength(0);
		expect(spec.groups).toHaveLength(0);
	});

	it('handles array format (tools directly)', () => {
		const json = JSON.stringify([
			{ name: 'tool_a', description: 'Tool A' },
			{ name: 'tool_b', description: 'Tool B' },
		]);
		const spec = parseMcpToolsJson(json, 'test');

		expect(spec.toolCount).toBe(2);
	});

	it('throws on invalid JSON', () => {
		expect(() => parseMcpToolsJson('not valid json', 'test')).toThrow();
	});

	it('generates a description with group labels', () => {
		const spec = parseMcpToolsJson(loadFixture(), 'github');

		expect(spec.description).toContain('Github');
		expect(spec.description).toContain('15 tools');
	});
});

describe('clusterTools', () => {
	it('groups tools by shared domain noun', () => {
		const tools: McpToolSpec[] = [
			{ name: 'create_issue' },
			{ name: 'get_issue' },
			{ name: 'update_issue' },
			{ name: 'list_issues' },
		];

		const groups = clusterTools(tools);
		expect(groups.length).toBe(1);
		expect(groups[0]!.tools).toHaveLength(4);
	});

	it('separates different domains', () => {
		const tools: McpToolSpec[] = [
			{ name: 'create_issue' },
			{ name: 'get_issue' },
			{ name: 'create_pull_request' },
			{ name: 'merge_pull_request' },
		];

		const groups = clusterTools(tools);
		expect(groups.length).toBe(2);

		const issueGroup = groups.find((g) =>
			g.tools.some((t) => t.name === 'create_issue'),
		);
		const prGroup = groups.find((g) =>
			g.tools.some((t) => t.name === 'create_pull_request'),
		);

		expect(issueGroup).toBeDefined();
		expect(prGroup).toBeDefined();
		expect(issueGroup!.tools).toHaveLength(2);
		expect(prGroup!.tools).toHaveLength(2);
	});

	it('handles camelCase names', () => {
		const tools: McpToolSpec[] = [
			{ name: 'createUser' },
			{ name: 'getUser' },
			{ name: 'deleteUser' },
		];

		const groups = clusterTools(tools);
		// All should be in one group
		const userGroup = groups.find((g) => g.tools.length === 3);
		expect(userGroup).toBeDefined();
	});

	it('puts singleton tools in Other group', () => {
		const tools: McpToolSpec[] = [
			{ name: 'create_issue' },
			{ name: 'get_issue' },
			{ name: 'search_code' },
			{ name: 'get_user' },
		];

		const groups = clusterTools(tools);
		const otherGroup = groups.find((g) => g.label === 'Other');
		expect(otherGroup).toBeDefined();
		expect(otherGroup!.tools.some((t) => t.name === 'search_code')).toBe(true);
	});

	it('handles empty tool list', () => {
		const groups = clusterTools([]);
		expect(groups).toHaveLength(0);
	});

	it('sorts groups by tool count descending', () => {
		const tools: McpToolSpec[] = [
			{ name: 'create_issue' },
			{ name: 'get_issue' },
			{ name: 'update_issue' },
			{ name: 'list_issues' },
			{ name: 'create_pull_request' },
			{ name: 'merge_pull_request' },
		];

		const groups = clusterTools(tools);
		// Filter out "Other" for comparison
		const nonOther = groups.filter((g) => g.label !== 'Other');
		for (let i = 1; i < nonOther.length; i++) {
			expect(nonOther[i - 1]!.tools.length).toBeGreaterThanOrEqual(
				nonOther[i]!.tools.length,
			);
		}
	});

	it('sorts tools within group alphabetically', () => {
		const tools: McpToolSpec[] = [
			{ name: 'update_issue' },
			{ name: 'create_issue' },
			{ name: 'get_issue' },
		];

		const groups = clusterTools(tools);
		const issueGroup = groups.find((g) => g.tools.some((t) => t.name === 'create_issue'));
		expect(issueGroup).toBeDefined();
		const names = issueGroup!.tools.map((t) => t.name);
		expect(names).toEqual([...names].sort());
	});

	it('handles MCP namespace prefixes', () => {
		const tools: McpToolSpec[] = [
			{ name: 'mcp__github__create_issue' },
			{ name: 'mcp__github__get_issue' },
		];

		const groups = clusterTools(tools);
		// Should strip the namespace and group by "issue"
		expect(groups.length).toBe(1);
		expect(groups[0]!.tools).toHaveLength(2);
	});

	it('clusters the full fixture correctly', () => {
		const spec = parseMcpToolsJson(loadFixture(), 'github');

		// Should have groups for issues, pull requests, repositories, files, and possibly others
		const groupLabels = spec.groups.map((g) => g.label);
		expect(groupLabels.length).toBeGreaterThan(1);

		// All tools should be accounted for
		const totalToolsInGroups = spec.groups.reduce((sum, g) => sum + g.tools.length, 0);
		expect(totalToolsInGroups).toBe(15);
	});
});
