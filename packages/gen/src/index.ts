/**
 * skillgen — Generate Agent Skills (SKILL.md) from API specifications
 *
 * Converts OpenAPI 3.x specs, MCP servers, REST API documentation, or plain text
 * descriptions into well-structured SKILL.md files.
 *
 * @packageDocumentation
 */

export type { CheckResult } from './check.js';
export { checkGeneratedFiles } from './check.js';
export {
	generateFromMcp,
	generateFromMcpSpec,
	generateFromOpenApi,
	generateFromSpec,
	generateFromText,
} from './generator.js';
export type { ImprovedSuggestion, ImproveResult } from './improve.js';
export { analyzeSkill } from './improve.js';
export { clusterTools, introspectMcpServer, parseMcpToolsJson } from './mcp.js';
export { renderMcpSkillMd } from './mcp-renderer.js';
export type {
	McpConnectionOptions,
	McpGenerateOptions,
	McpGenerateResult,
	McpSchemaProperty,
	McpServerSpec,
	McpToolAnnotations,
	McpToolGroup,
	McpToolInputSchema,
	McpToolSpec,
} from './mcp-types.js';
export { parseOpenApi } from './openapi.js';
export { renderSkillMd } from './renderer.js';
export type {
	ApiEndpoint,
	ApiParameter,
	ApiProperty,
	ApiRequestBody,
	ApiResponse,
	ApiSpec,
	AuthScheme,
	GenerateError,
	GenerateOptions,
	GenerateResult,
} from './types.js';
