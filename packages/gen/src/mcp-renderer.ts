/**
 * Render a {@link McpServerSpec} into SKILL.md + references/TOOLS.md.
 *
 * Analogous to {@link renderSkillMd} in renderer.ts but adapted for
 * MCP tool-based content rather than REST endpoints.
 */

import type {
	McpGenerateOptions,
	McpSchemaProperty,
	McpServerSpec,
	McpToolInputSchema,
	McpToolSpec,
} from './mcp-types.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render an MCP server spec into SKILL.md (and optionally references/TOOLS.md).
 *
 * @returns Map of relative file paths to content strings
 */
export function renderMcpSkillMd(
	spec: McpServerSpec,
	options: McpGenerateOptions = {},
): Map<string, string> {
	const name = options.name ?? toKebabCase(spec.name);
	const files = new Map<string, string>();

	const includeRef = options.includeToolReference !== false;

	files.set(`${name}/SKILL.md`, renderMainSkill(spec, { ...options, name }, includeRef));

	if (includeRef && spec.tools.length > 0) {
		files.set(`${name}/references/TOOLS.md`, renderToolReference(spec));
	}

	return files;
}

// ---------------------------------------------------------------------------
// Main SKILL.md
// ---------------------------------------------------------------------------

function renderMainSkill(
	spec: McpServerSpec,
	options: McpGenerateOptions & { name: string },
	includeRef: boolean,
): string {
	const lines: string[] = [];
	const titleName = spec.name
		.split('-')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');

	// Frontmatter
	lines.push('---');
	lines.push(`name: ${options.name}`);
	lines.push('description: >-');
	lines.push(`  ${options.description ?? spec.description}`);
	lines.push('---');
	lines.push('');

	// Title
	lines.push(`# ${titleName}`);
	lines.push('');
	lines.push(
		`${titleName} provides ${spec.toolCount} tools${spec.groups.length > 1 ? ` across ${spec.groups.filter((g) => g.label !== 'Other').length} domains` : ''}.`,
	);
	lines.push('');

	// Quick Start
	const topTools = pickTopTools(spec);
	if (topTools.length > 0) {
		lines.push('## Quick Start');
		lines.push('');
		lines.push('The most commonly used tools:');
		lines.push('');
		for (const tool of topTools) {
			const desc = tool.description ? ` \u2014 ${truncate(tool.description, 80)}` : '';
			lines.push(`1. **\`${tool.name}\`**${desc}`);
		}
		lines.push('');
	}

	// Tool Overview (grouped tables)
	lines.push('## Tools');
	lines.push('');

	for (const group of spec.groups) {
		if (spec.groups.length > 1 || group.label !== 'Other') {
			lines.push(`### ${group.label}`);
			lines.push('');
		}

		lines.push('| Tool | Description |');
		lines.push('|------|-------------|');
		for (const tool of group.tools) {
			const desc = truncate(tool.description ?? '', 80);
			lines.push(`| \`${tool.name}\` | ${desc} |`);
		}
		lines.push('');
	}

	// Common Workflows
	const workflows = generateWorkflows(spec);
	if (workflows.length > 0) {
		lines.push('## Common Workflows');
		lines.push('');
		for (const wf of workflows) {
			lines.push(`### ${wf.title}`);
			lines.push('');
			lines.push('```');
			for (const step of wf.steps) {
				lines.push(step);
			}
			lines.push('```');
			lines.push('');
		}
	}

	// Error Handling
	lines.push('## Error Handling');
	lines.push('');
	lines.push('- Tool calls return `isError: true` on failure with a text description');
	lines.push('- Validate required parameters before calling tools');
	lines.push('- Handle timeouts for long-running operations');
	lines.push('- For rate-limited APIs, retry with exponential backoff');
	lines.push('');

	// Link to reference
	if (includeRef && spec.tools.length > 0) {
		lines.push('---');
		lines.push('');
		lines.push('For complete parameter details, see [references/TOOLS.md](references/TOOLS.md).');
		lines.push('');
	}

	return lines.join('\n');
}

// ---------------------------------------------------------------------------
// references/TOOLS.md
// ---------------------------------------------------------------------------

function renderToolReference(spec: McpServerSpec): string {
	const lines: string[] = [];
	const titleName = spec.name
		.split('-')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');

	lines.push(`# ${titleName} \u2014 Tool Reference`);
	lines.push('');
	lines.push(`Complete parameter reference for all ${spec.toolCount} tools.`);
	lines.push('');

	for (const group of spec.groups) {
		if (spec.groups.length > 1 || group.label !== 'Other') {
			lines.push(`## ${group.label}`);
			lines.push('');
		}

		for (const tool of group.tools) {
			lines.push(renderToolDetail(tool));
			lines.push('');
		}
	}

	return lines.join('\n');
}

function renderToolDetail(tool: McpToolSpec): string {
	const lines: string[] = [];

	lines.push(`### \`${tool.name}\``);
	lines.push('');

	if (tool.description) {
		lines.push(tool.description);
		lines.push('');
	}

	if (tool.annotations) {
		const hints: string[] = [];
		if (tool.annotations.readOnlyHint) hints.push('read-only');
		if (tool.annotations.destructiveHint) hints.push('destructive');
		if (tool.annotations.idempotentHint) hints.push('idempotent');
		if (hints.length > 0) {
			lines.push(`*${hints.join(', ')}*`);
			lines.push('');
		}
	}

	if (tool.inputSchema?.properties && Object.keys(tool.inputSchema.properties).length > 0) {
		lines.push('**Parameters:**');
		lines.push('');
		lines.push(renderInputSchemaTable(tool.inputSchema));
	} else {
		lines.push('*No parameters*');
	}

	return lines.join('\n');
}

function renderInputSchemaTable(schema: McpToolInputSchema): string {
	const flat = flattenSchemaProperties(schema.properties ?? {}, schema.required ?? []);
	if (flat.length === 0) return '*No parameters*';

	const lines: string[] = [];
	lines.push('| Parameter | Type | Required | Description |');
	lines.push('|-----------|------|----------|-------------|');
	for (const prop of flat) {
		const req = prop.required ? 'Yes' : 'No';
		let desc = prop.description ?? '';
		if (prop.enumValues && prop.enumValues.length > 0) {
			const vals = prop.enumValues.map((v) => `\`${v}\``).join(', ');
			desc = desc ? `${desc}. Values: ${vals}` : `Values: ${vals}`;
		}
		if (prop.defaultValue !== undefined) {
			desc = desc
				? `${desc}. Default: \`${prop.defaultValue}\``
				: `Default: \`${prop.defaultValue}\``;
		}
		lines.push(`| \`${prop.name}\` | ${prop.type} | ${req} | ${truncate(desc, 120)} |`);
	}
	return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Schema helpers
// ---------------------------------------------------------------------------

interface FlatProperty {
	name: string;
	type: string;
	required: boolean;
	description?: string;
	enumValues?: readonly unknown[];
	defaultValue?: unknown;
}

function flattenSchemaProperties(
	properties: Readonly<Record<string, McpSchemaProperty>>,
	required: readonly string[],
	prefix = '',
): FlatProperty[] {
	const requiredSet = new Set(required);
	const result: FlatProperty[] = [];

	for (const [name, prop] of Object.entries(properties)) {
		const fullName = prefix ? `${prefix}.${name}` : name;
		let type = prop.type ?? 'unknown';

		if (type === 'array' && prop.items?.type) {
			type = `${prop.items.type}[]`;
		}

		result.push({
			name: fullName,
			type,
			required: requiredSet.has(name),
			description: prop.description,
			enumValues: prop.enum,
			defaultValue: prop.default,
		});

		// Flatten nested objects (one level deep to keep tables readable)
		if (prop.type === 'object' && prop.properties && !prefix) {
			result.push(...flattenSchemaProperties(prop.properties, prop.required ?? [], fullName));
		}
	}

	return result;
}

// ---------------------------------------------------------------------------
// Workflow generation
// ---------------------------------------------------------------------------

interface Workflow {
	title: string;
	steps: string[];
}

function generateWorkflows(spec: McpServerSpec): Workflow[] {
	const workflows: Workflow[] = [];

	for (const group of spec.groups) {
		if (group.label === 'Other') continue;

		const tokens = group.tools.map((t) => ({
			name: t.name,
			tokens: t.name
				.replace(/^[a-zA-Z0-9]+__[a-zA-Z0-9]+__/, '')
				.replace(/([a-z])([A-Z])/g, '$1_$2')
				.split(/[_\-.]/)
				.map((s) => s.toLowerCase()),
		}));

		// Detect CRUD pattern: create + get/list tools in same group
		const hasCreate = tokens.some((t) => t.tokens[0] === 'create' || t.tokens[0] === 'add');
		const hasList = tokens.some((t) => t.tokens[0] === 'list' || t.tokens[0] === 'search');
		const hasGet = tokens.some((t) => t.tokens[0] === 'get' || t.tokens[0] === 'read');

		if (hasCreate && (hasList || hasGet)) {
			const createTool = group.tools.find(
				(t) => t.name.startsWith('create') || t.name.startsWith('add'),
			);
			const listTool = group.tools.find(
				(t) => t.name.startsWith('list') || t.name.startsWith('search'),
			);
			const getTool = group.tools.find(
				(t) => t.name.startsWith('get') || t.name.startsWith('read'),
			);

			const steps: string[] = [];
			if (createTool) {
				steps.push(renderToolCallExample(createTool));
			}
			if (getTool) {
				steps.push(renderToolCallExample(getTool));
			} else if (listTool) {
				steps.push(renderToolCallExample(listTool));
			}

			if (steps.length > 0) {
				workflows.push({
					title: `Create and verify ${group.label.toLowerCase()}`,
					steps,
				});
			}
		}

		// Cap at 3 workflows
		if (workflows.length >= 3) break;
	}

	return workflows;
}

function renderToolCallExample(tool: McpToolSpec): string {
	if (!tool.inputSchema?.properties) {
		return `${tool.name}()`;
	}

	const required = new Set(tool.inputSchema.required ?? []);
	const params: string[] = [];

	for (const [name, prop] of Object.entries(tool.inputSchema.properties)) {
		if (!required.has(name)) continue;
		const placeholder = getPlaceholder(name, prop);
		params.push(`${name}: ${placeholder}`);
	}

	if (params.length === 0) {
		return `${tool.name}()`;
	}

	return `${tool.name}({ ${params.join(', ')} })`;
}

function getPlaceholder(name: string, prop: McpSchemaProperty): string {
	if (prop.enum && prop.enum.length > 0) {
		return JSON.stringify(prop.enum[0]);
	}
	switch (prop.type) {
		case 'string':
			return `"<${name}>"`;
		case 'number':
		case 'integer':
			return '0';
		case 'boolean':
			return 'true';
		case 'array':
			return '[]';
		case 'object':
			return '{}';
		default:
			return `"<${name}>"`;
	}
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function pickTopTools(spec: McpServerSpec): McpToolSpec[] {
	// Pick up to 5 tools: prefer tools from the largest groups
	const result: McpToolSpec[] = [];
	for (const group of spec.groups) {
		if (group.label === 'Other') continue;
		// Pick the first tool from each non-Other group
		if (group.tools.length > 0 && result.length < 5) {
			result.push(group.tools[0]!);
		}
	}
	// Fill remaining from Other
	if (result.length < 3) {
		const other = spec.groups.find((g) => g.label === 'Other');
		if (other) {
			for (const tool of other.tools) {
				if (result.length >= 5) break;
				result.push(tool);
			}
		}
	}
	return result;
}

function truncate(str: string, maxLen: number): string {
	const clean = str.replace(/\n/g, ' ').trim();
	if (clean.length <= maxLen) return clean;
	return `${clean.slice(0, maxLen - 3)}...`;
}

function toKebabCase(input: string): string {
	return input
		.replace(/[^a-zA-Z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/([a-z])([A-Z])/g, '$1-$2')
		.replace(/-+/g, '-')
		.toLowerCase()
		.replace(/^-|-$/g, '')
		.slice(0, 64);
}
