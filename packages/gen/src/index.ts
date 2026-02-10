/**
 * skillgen — Generate Agent Skills (SKILL.md) from API specifications
 *
 * Converts OpenAPI 3.x specs, REST API documentation, or plain text
 * descriptions into well-structured SKILL.md files.
 *
 * @packageDocumentation
 */

export { generateFromOpenApi, generateFromSpec, generateFromText } from './generator.js';
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
