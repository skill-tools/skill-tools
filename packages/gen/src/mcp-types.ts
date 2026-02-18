/**
 * MCP (Model Context Protocol) intermediate representation types.
 *
 * These types model the output of introspecting an MCP server's tools
 * and are the MCP equivalent of {@link ApiSpec} for OpenAPI specs.
 */

/**
 * A single MCP tool parsed from `tools/list`.
 */
export interface McpToolSpec {
	/** Tool name (e.g. "create_issue") */
	readonly name: string;
	/** Human-readable description */
	readonly description?: string;
	/** JSON Schema for tool input parameters */
	readonly inputSchema?: McpToolInputSchema;
	/** Tool annotations (MCP metadata hints) */
	readonly annotations?: McpToolAnnotations;
}

/**
 * JSON Schema describing a tool's input parameters.
 */
export interface McpToolInputSchema {
	readonly type: 'object';
	readonly properties?: Readonly<Record<string, McpSchemaProperty>>;
	readonly required?: readonly string[];
}

/**
 * A single property in a JSON Schema (simplified for rendering).
 */
export interface McpSchemaProperty {
	readonly type?: string;
	readonly description?: string;
	readonly enum?: readonly unknown[];
	readonly default?: unknown;
	readonly items?: McpSchemaProperty;
	readonly properties?: Readonly<Record<string, McpSchemaProperty>>;
	readonly required?: readonly string[];
}

/**
 * MCP tool annotations (hints about tool behavior).
 */
export interface McpToolAnnotations {
	readonly title?: string;
	readonly readOnlyHint?: boolean;
	readonly destructiveHint?: boolean;
	readonly idempotentHint?: boolean;
	readonly openWorldHint?: boolean;
}

/**
 * A group of related tools, determined by clustering.
 */
export interface McpToolGroup {
	/** Group label (e.g. "Issues", "Pull Requests") */
	readonly label: string;
	/** Tools in this group */
	readonly tools: readonly McpToolSpec[];
}

/**
 * Complete introspection result from an MCP server.
 * This is the MCP equivalent of ApiSpec.
 */
export interface McpServerSpec {
	/** Server name (from serverInfo or CLI --name) */
	readonly name: string;
	/** Server description */
	readonly description: string;
	/** Server version */
	readonly version?: string;
	/** All tools exposed by the server */
	readonly tools: readonly McpToolSpec[];
	/** Tools grouped by domain */
	readonly groups: readonly McpToolGroup[];
	/** Total tool count */
	readonly toolCount: number;
}

/**
 * Options for connecting to an MCP server.
 */
export interface McpConnectionOptions {
	/** Command to start the MCP server (stdio transport) */
	readonly command?: string;
	/** Arguments for the command */
	readonly args?: readonly string[];
	/** Environment variables for the command */
	readonly env?: Readonly<Record<string, string>>;
	/** Remote MCP server URL (HTTP/SSE transport) */
	readonly url?: string;
	/** Connection timeout in ms (default: 30000) */
	readonly timeout?: number;
	/** Server name override */
	readonly name?: string;
}

/**
 * Options for generating SKILL.md from an MCP server.
 */
export interface McpGenerateOptions {
	/** Skill name override (kebab-case, max 64 chars) */
	readonly name?: string;
	/** Output directory */
	readonly outDir?: string;
	/** Maximum token budget for generated SKILL.md (default: 4000) */
	readonly maxTokens?: number;
	/** Custom description override */
	readonly description?: string;
	/** Whether to generate references/TOOLS.md (default: true) */
	readonly includeToolReference?: boolean;
}

/**
 * Result of MCP generation (parallels GenerateResult).
 */
export interface McpGenerateResult {
	readonly ok: true;
	/** Generated files (relative path → content) */
	readonly files: ReadonlyMap<string, string>;
	/** Number of tools processed */
	readonly toolCount: number;
	/** Number of groups detected */
	readonly groupCount: number;
	/** Total estimated tokens */
	readonly tokenCount: number;
}
