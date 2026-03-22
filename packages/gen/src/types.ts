import type { Diagnostic } from '@skill-tools/core';

/**
 * Configuration for generating a SKILL.md file.
 */
export interface GenerateOptions {
	/** Skill name (kebab-case, max 64 chars). Auto-derived if not provided. */
	readonly name?: string;
	/** Output directory path. Defaults to current working directory. */
	readonly outDir?: string;
	/** Generation mode: one skill per endpoint or one unified skill */
	readonly mode?: 'unified' | 'per-endpoint';
	/** Maximum token budget for the generated SKILL.md (default: 4000) */
	readonly maxTokens?: number;
	/** Include example requests/responses in the output */
	readonly includeExamples?: boolean;
	/** Include error handling section */
	readonly includeErrorHandling?: boolean;
	/** Custom description override */
	readonly description?: string;
}

/**
 * Intermediate representation of an API parsed from any source.
 */
export interface ApiSpec {
	/** API title */
	readonly title: string;
	/** API description/summary */
	readonly description: string;
	/** Base URL(s) */
	readonly servers: readonly string[];
	/** API version */
	readonly version: string;
	/** Parsed endpoints */
	readonly endpoints: readonly ApiEndpoint[];
	/** Authentication schemes */
	readonly auth: readonly AuthScheme[];
}

/**
 * A single API endpoint.
 */
export interface ApiEndpoint {
	/** HTTP method (GET, POST, etc.) */
	readonly method: string;
	/** URL path (e.g. /users/{id}) */
	readonly path: string;
	/** Operation ID (e.g. getUser) */
	readonly operationId?: string;
	/** Summary (short description) */
	readonly summary?: string;
	/** Detailed description */
	readonly description?: string;
	/** Tags for grouping */
	readonly tags: readonly string[];
	/** Path + query + header parameters */
	readonly parameters: readonly ApiParameter[];
	/** Request body schema */
	readonly requestBody?: ApiRequestBody;
	/** Response schemas by status code */
	readonly responses: readonly ApiResponse[];
}

/**
 * An API parameter (path, query, header, cookie).
 */
export interface ApiParameter {
	/** Parameter name */
	readonly name: string;
	/** Location: path, query, header, cookie */
	readonly in: 'path' | 'query' | 'header' | 'cookie';
	/** Description */
	readonly description?: string;
	/** Whether the parameter is required */
	readonly required: boolean;
	/** Schema type (string, integer, etc.) */
	readonly type?: string;
	/** Example value */
	readonly example?: unknown;
}

/**
 * Request body definition.
 */
export interface ApiRequestBody {
	/** Description */
	readonly description?: string;
	/** Content type (e.g. application/json) */
	readonly contentType: string;
	/** Whether the body is required */
	readonly required: boolean;
	/** Schema properties (flattened) */
	readonly properties: readonly ApiProperty[];
	/** Example body */
	readonly example?: unknown;
}

/**
 * A property in a request/response body.
 */
export interface ApiProperty {
	/** Property name */
	readonly name: string;
	/** Schema type */
	readonly type: string;
	/** Description */
	readonly description?: string;
	/** Whether the property is required */
	readonly required: boolean;
	/** Example value */
	readonly example?: unknown;
}

/**
 * An API response definition.
 */
export interface ApiResponse {
	/** HTTP status code (e.g. "200", "404") */
	readonly statusCode: string;
	/** Description */
	readonly description?: string;
	/** Content type */
	readonly contentType?: string;
	/** Schema properties (flattened) */
	readonly properties: readonly ApiProperty[];
}

/**
 * Authentication scheme.
 */
export interface AuthScheme {
	/** Scheme type */
	readonly type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
	/** Scheme name */
	readonly name: string;
	/** Description */
	readonly description?: string;
	/** For apiKey: where the key goes */
	readonly in?: 'header' | 'query' | 'cookie';
	/** For http: scheme (bearer, basic) */
	readonly scheme?: string;
}

/**
 * Result of a generation operation.
 */
export interface GenerateResult {
	/** Whether generation succeeded */
	readonly ok: true;
	/** Generated files (path → content) */
	readonly files: ReadonlyMap<string, string>;
	/** Number of endpoints processed */
	readonly endpointCount: number;
	/** Estimated token count of generated content */
	readonly tokenCount: number;
	/** Validation diagnostics from parsing generated SKILL.md files */
	readonly diagnostics: readonly Diagnostic[];
}

/**
 * Error result from generation.
 */
export interface GenerateError {
	readonly ok: false;
	readonly error: string;
}
