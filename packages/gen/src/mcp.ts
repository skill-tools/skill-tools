/**
 * MCP server introspection — connect, list tools, and build McpServerSpec.
 *
 * Analogous to {@link parseOpenApi} in openapi.ts: takes a raw input source
 * (MCP server connection) and produces an intermediate representation
 * ({@link McpServerSpec}) for downstream rendering.
 */

import type {
	McpConnectionOptions,
	McpSchemaProperty,
	McpServerSpec,
	McpToolAnnotations,
	McpToolGroup,
	McpToolInputSchema,
	McpToolSpec,
} from './mcp-types.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Connect to a live MCP server, introspect its tools, and return a
 * structured {@link McpServerSpec}.
 */
export async function introspectMcpServer(options: McpConnectionOptions): Promise<McpServerSpec> {
	if (!options.command && !options.url) {
		throw new Error('Either --command or --url must be provided');
	}
	if (options.command && options.url) {
		throw new Error('--command and --url are mutually exclusive');
	}

	const timeoutMs = options.timeout ?? 30_000;

	const { Client } = await loadMcpClient();

	const client = new Client({ name: 'skillgen', version: '0.2.2' });

	const transport = options.command
		? await createStdioTransport(options)
		: await createHttpTransport(options);

	try {
		await withTimeout(client.connect(transport), timeoutMs, 'MCP server connection timed out');

		// Collect all tools (handle pagination)
		const allTools: McpToolSpec[] = [];
		let cursor: string | undefined;
		let pages = 0;
		const maxPages = 100;

		do {
			const result = await client.listTools(cursor ? { cursor } : undefined);
			for (const tool of result.tools) {
				allTools.push(toMcpToolSpec(tool));
			}
			cursor = result.nextCursor;
			pages++;
		} while (cursor && pages < maxPages);

		const serverName = options.name ?? deriveServerName(options);
		const groups = clusterTools(allTools);

		return {
			name: serverName,
			description: buildServerDescription(serverName, allTools, groups),
			tools: allTools,
			groups,
			toolCount: allTools.length,
		};
	} finally {
		await client.close().catch(() => {});
	}
}

/**
 * Parse a JSON string representing an MCP `tools/list` response into a
 * {@link McpServerSpec}. Useful for testing without a live server.
 */
export function parseMcpToolsJson(json: string, name = 'mcp-server'): McpServerSpec {
	const parsed = JSON.parse(json) as { tools?: unknown[] };
	const rawTools = Array.isArray(parsed.tools) ? parsed.tools : Array.isArray(parsed) ? parsed : [];

	const tools: McpToolSpec[] = rawTools.map((t) => toMcpToolSpec(t as Record<string, unknown>));
	const groups = clusterTools(tools);

	return {
		name,
		description: buildServerDescription(name, tools, groups),
		tools,
		groups,
		toolCount: tools.length,
	};
}

/**
 * Cluster tools into groups by shared domain nouns extracted from tool names.
 * No LLM required — pure prefix/suffix analysis.
 */
export function clusterTools(tools: readonly McpToolSpec[]): McpToolGroup[] {
	if (tools.length === 0) return [];

	const VERB_PREFIXES = new Set([
		'get',
		'list',
		'create',
		'update',
		'delete',
		'search',
		'find',
		'set',
		'add',
		'remove',
		'check',
		'run',
		'read',
		'write',
		'fetch',
		'put',
		'patch',
		'push',
		'pull',
		'merge',
		'fork',
		'close',
		'open',
		'start',
		'stop',
		'enable',
		'disable',
		'is',
		'has',
		'can',
		'resolve',
		'reject',
		'accept',
		'deny',
		'approve',
		'count',
	]);

	// Step 1: Tokenize each tool name
	const toolTokens = tools.map((tool) => ({
		tool,
		tokens: tokenizeName(tool.name),
	}));

	// Step 2: Extract domain tokens (non-verb)
	const domainMap = new Map<string, McpToolSpec[]>();

	for (const { tool, tokens } of toolTokens) {
		const domainTokens = tokens.filter((t) => !VERB_PREFIXES.has(t));
		const domain = domainTokens.length > 0 ? domainTokens.join('_') : tokens.join('_');

		const list = domainMap.get(domain) ?? [];
		list.push(tool);
		domainMap.set(domain, list);
	}

	// Step 3: Merge singleton domains if they share a prefix with a larger group
	const merged = new Map<string, McpToolSpec[]>();
	const singletons: McpToolSpec[] = [];

	for (const [domain, domainTools] of domainMap) {
		if (domainTools.length > 1) {
			merged.set(domain, domainTools);
		} else {
			// Try to find a parent group
			let found = false;
			for (const [key, group] of merged) {
				if (domain.startsWith(key) || key.startsWith(domain)) {
					group.push(...domainTools);
					found = true;
					break;
				}
			}
			if (!found) {
				singletons.push(...domainTools);
			}
		}
	}

	// Step 4: Build groups, sorted by tool count descending
	const groups: McpToolGroup[] = [];

	const sortedEntries = Array.from(merged.entries()).sort((a, b) => b[1].length - a[1].length);

	for (const [domain, domainTools] of sortedEntries) {
		domainTools.sort((a, b) => a.name.localeCompare(b.name));
		groups.push({
			label: domainToLabel(domain),
			tools: domainTools,
		});
	}

	// Step 5: Add singletons to "Other" group
	if (singletons.length > 0) {
		singletons.sort((a, b) => a.name.localeCompare(b.name));
		groups.push({ label: 'Other', tools: singletons });
	}

	return groups;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Race a promise against a timeout. Rejects with the given message on timeout.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
	let timer: ReturnType<typeof setTimeout>;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error(`${message} (${ms}ms)`)), ms);
	});
	try {
		return await Promise.race([promise, timeout]);
	} finally {
		clearTimeout(timer!);
	}
}

/**
 * Tokenize a tool name into lowercase words.
 * Handles snake_case, camelCase, kebab-case, and MCP `__` namespacing.
 */
function tokenizeName(name: string): string[] {
	return (
		name
			// Strip MCP namespace prefix (e.g. "mcp__github__create_issue" → "create_issue")
			.replace(/^[a-zA-Z0-9]+__[a-zA-Z0-9]+__/, '')
			// Split camelCase boundaries
			.replace(/([a-z])([A-Z])/g, '$1_$2')
			// Split on underscores, hyphens, dots
			.split(/[_\-.]/)
			.map((t) => t.toLowerCase())
			.filter((t) => t.length > 0)
	);
}

/**
 * Convert a domain key like "pull_request" to a label like "Pull Requests".
 */
function domainToLabel(domain: string): string {
	const words = domain.split('_');
	const titled = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
	// Naive pluralization: add 's' if not already plural
	if (!titled.endsWith('s') && !titled.endsWith('y')) {
		return `${titled}s`;
	}
	return titled;
}

/**
 * Convert a raw MCP tool object into a {@link McpToolSpec}.
 */
function toMcpToolSpec(raw: Record<string, unknown>): McpToolSpec {
	const name = typeof raw.name === 'string' ? raw.name : '';
	const description = typeof raw.description === 'string' ? raw.description : undefined;

	let inputSchema: McpToolInputSchema | undefined;
	if (raw.inputSchema && typeof raw.inputSchema === 'object') {
		const schema = raw.inputSchema as Record<string, unknown>;
		inputSchema = {
			type: 'object',
			properties: schema.properties as Record<string, McpSchemaProperty> | undefined,
			required: Array.isArray(schema.required) ? (schema.required as string[]) : undefined,
		};
	}

	let annotations: McpToolAnnotations | undefined;
	if (raw.annotations && typeof raw.annotations === 'object') {
		const ann = raw.annotations as Record<string, unknown>;
		annotations = {
			title: typeof ann.title === 'string' ? ann.title : undefined,
			readOnlyHint: typeof ann.readOnlyHint === 'boolean' ? ann.readOnlyHint : undefined,
			destructiveHint: typeof ann.destructiveHint === 'boolean' ? ann.destructiveHint : undefined,
			idempotentHint: typeof ann.idempotentHint === 'boolean' ? ann.idempotentHint : undefined,
			openWorldHint: typeof ann.openWorldHint === 'boolean' ? ann.openWorldHint : undefined,
		};
	}

	return { name, description, inputSchema, annotations };
}

/**
 * Derive a server name from connection options.
 */
function deriveServerName(options: McpConnectionOptions): string {
	if (options.command) {
		// Extract meaningful name from command
		// e.g. "npx -y @modelcontextprotocol/server-github" → "github"
		const parts = (options.command + ' ' + (options.args ?? []).join(' ')).split(/\s+/);
		for (const part of parts.reverse()) {
			const match = part.match(/server-([a-z0-9-]+)/i);
			if (match) return match[1]!.toLowerCase();
		}
		// Fallback: use last non-flag argument
		const nonFlags = parts.filter((p) => !p.startsWith('-') && !p.startsWith('@'));
		if (nonFlags.length > 0) {
			return toKebabCase(nonFlags[nonFlags.length - 1]!);
		}
	}
	if (options.url) {
		try {
			const url = new URL(options.url);
			const host = url.hostname.replace(/\./g, '-');
			return toKebabCase(host);
		} catch {
			// fallback
		}
	}
	return 'mcp-server';
}

/**
 * Build a description for the MCP server.
 */
function buildServerDescription(
	name: string,
	tools: readonly McpToolSpec[],
	groups: readonly McpToolGroup[],
): string {
	const groupLabels = groups
		.filter((g) => g.label !== 'Other')
		.map((g) => g.label)
		.slice(0, 5);

	const labelStr = groupLabels.length > 0 ? ` across ${groupLabels.join(', ')}` : '';
	const titleName = name
		.split('-')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');

	return `${titleName} MCP server tools. Use when the user wants to interact with ${titleName}. Provides ${tools.length} tools${labelStr}.`;
}

/**
 * Convert a string to kebab-case.
 */
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

// ---------------------------------------------------------------------------
// MCP SDK dynamic loading
// ---------------------------------------------------------------------------

async function loadMcpClient(): Promise<{
	Client: new (info: { name: string; version: string }) => McpClientInstance;
}> {
	try {
		const mod = await import('@modelcontextprotocol/sdk/client/index.js');
		return { Client: mod.Client };
	} catch {
		throw new Error(
			'The @modelcontextprotocol/sdk package is required for MCP introspection.\n' +
				'Install it with: npm install @modelcontextprotocol/sdk',
		);
	}
}

interface McpTransport {
	close?(): Promise<void>;
}

interface McpClientInstance {
	connect(transport: McpTransport): Promise<void>;
	listTools(options?: { cursor?: string }): Promise<{
		tools: Record<string, unknown>[];
		nextCursor?: string;
	}>;
	close(): Promise<void>;
}

async function createStdioTransport(options: McpConnectionOptions): Promise<McpTransport> {
	try {
		const mod = await import('@modelcontextprotocol/sdk/client/stdio.js');
		return new mod.StdioClientTransport({
			command: options.command!,
			args: [...(options.args ?? [])],
			env: { ...process.env, ...options.env } as Record<string, string>,
		});
	} catch {
		throw new Error(
			'The @modelcontextprotocol/sdk package is required for stdio transport.\n' +
				'Install it with: npm install @modelcontextprotocol/sdk',
		);
	}
}

async function createHttpTransport(options: McpConnectionOptions): Promise<McpTransport> {
	try {
		const mod = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
		return new mod.StreamableHTTPClientTransport(new URL(options.url!));
	} catch {
		throw new Error(
			'The @modelcontextprotocol/sdk package is required for HTTP transport.\n' +
				'Install it with: npm install @modelcontextprotocol/sdk',
		);
	}
}
