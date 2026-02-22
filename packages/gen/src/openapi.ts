import YAML from 'yaml';
import type {
	ApiEndpoint,
	ApiParameter,
	ApiProperty,
	ApiRequestBody,
	ApiResponse,
	ApiSpec,
	AuthScheme,
} from './types.js';

/** Maximum $ref resolution depth to prevent stack overflow from deeply nested references. */
const MAX_REF_DEPTH = 20;

/**
 * Parse an OpenAPI 3.x specification (JSON or YAML) into an ApiSpec.
 *
 * Supports OpenAPI 3.0.x and 3.1.x. Does not support Swagger 2.0.
 * Resolves local `$ref` references within the document.
 */
export function parseOpenApi(content: string): ApiSpec {
	const MAX_SPEC_SIZE = 10_000_000; // 10MB
	if (content.length > MAX_SPEC_SIZE) {
		throw new Error(`OpenAPI spec exceeds maximum size (${MAX_SPEC_SIZE} bytes)`);
	}

	const doc = parseDocument(content);

	const version = doc.openapi;
	if (!version || !version.startsWith('3.')) {
		throw new Error(
			`Unsupported OpenAPI version: ${version ?? 'unknown'}. Only OpenAPI 3.x is supported.`,
		);
	}

	// Single shared visited Set threaded through all extract* functions
	// to catch cycles that span multiple deref() calls.
	const visited = new Set<string>();

	const title = doc.info?.title ?? 'Untitled API';
	const description = doc.info?.description ?? '';
	const apiVersion = doc.info?.version ?? '0.0.0';
	const servers = extractServers(doc);
	const auth = extractAuthSchemes(doc, visited);
	const endpoints = extractEndpoints(doc, visited);

	return {
		title,
		description,
		version: apiVersion,
		servers,
		auth,
		endpoints,
	};
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface OpenApiDoc {
	openapi?: string;
	info?: { title?: string; description?: string; version?: string };
	servers?: Array<{ url: string }>;
	paths?: Record<string, Record<string, unknown>>;
	components?: {
		securitySchemes?: Record<string, Record<string, unknown>>;
		schemas?: Record<string, Record<string, unknown>>;
	};
	[key: string]: unknown;
}

/**
 * Parse the document as JSON first, falling back to YAML.
 */
function parseDocument(content: string): OpenApiDoc {
	const trimmed = content.trim();
	if (trimmed.startsWith('{')) {
		try {
			return JSON.parse(trimmed) as OpenApiDoc;
		} catch {
			// Fall through to YAML
		}
	}
	return YAML.parse(content) as OpenApiDoc;
}

/**
 * Resolve a local $ref like "#/components/schemas/Pet".
 *
 * Uses a shared `visited` Set (the current resolution stack) to detect circular
 * references that may span multiple deref() calls.  After a ref is fully
 * resolved, it is removed from the stack so the same $ref can be legitimately
 * referenced again elsewhere in the document.
 *
 * Also enforces a depth limit as a belt-and-suspenders guard against deeply
 * nested (but technically non-circular) $ref chains.
 */
function resolveRef(
	doc: OpenApiDoc,
	ref: string,
	visited: Set<string>,
	depth: number,
): Record<string, unknown> {
	if (!ref.startsWith('#/')) {
		return {};
	}
	if (depth > MAX_REF_DEPTH) {
		throw new Error(`$ref depth limit exceeded (>${MAX_REF_DEPTH}): ${ref}`);
	}
	if (visited.has(ref)) {
		throw new Error(`Circular $ref detected: ${ref}`);
	}
	visited.add(ref);

	try {
		const path = ref.slice(2).split('/');
		let current: unknown = doc;
		for (const segment of path) {
			if (current == null || typeof current !== 'object') return {};
			current = (current as Record<string, unknown>)[segment];
		}

		const resolved = (current as Record<string, unknown>) ?? {};

		// If the resolved object itself contains a $ref, follow it (with cycle tracking)
		if (typeof resolved.$ref === 'string') {
			return resolveRef(doc, resolved.$ref, visited, depth + 1);
		}

		return resolved;
	} finally {
		// Remove from stack so the same $ref can be referenced again in a
		// different branch of the document (e.g. Pet used in multiple endpoints).
		visited.delete(ref);
	}
}

/**
 * If obj has a $ref, resolve it. Otherwise return obj as-is.
 * Uses the shared visited Set to detect cycles that span multiple deref() calls,
 * and tracks depth to prevent stack overflow from deeply nested chains.
 */
function deref(
	doc: OpenApiDoc,
	obj: Record<string, unknown>,
	visited: Set<string>,
	depth: number = 0,
): Record<string, unknown> {
	if (typeof obj.$ref === 'string') {
		return resolveRef(doc, obj.$ref, visited, depth + 1);
	}
	return obj;
}

function extractServers(doc: OpenApiDoc): string[] {
	const servers = doc.servers;
	if (!Array.isArray(servers)) return [];
	return servers.map((s: Record<string, unknown>) => s.url as string).filter(Boolean);
}

function extractAuthSchemes(doc: OpenApiDoc, visited: Set<string>): AuthScheme[] {
	const components = doc.components as Record<string, unknown> | undefined;
	const schemes = components?.securitySchemes as
		| Record<string, Record<string, unknown>>
		| undefined;
	if (!schemes) return [];

	return Object.entries(schemes).map(([name, raw]) => {
		const scheme = deref(doc, raw, visited);
		return {
			type: (scheme.type as AuthScheme['type']) ?? 'apiKey',
			name,
			description: scheme.description as string | undefined,
			in: scheme.in as AuthScheme['in'],
			scheme: scheme.scheme as string | undefined,
		};
	});
}

function extractEndpoints(doc: OpenApiDoc, visited: Set<string>): ApiEndpoint[] {
	const paths = doc.paths as Record<string, Record<string, unknown>> | undefined;
	if (!paths) return [];

	const endpoints: ApiEndpoint[] = [];
	const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

	for (const [path, pathItem] of Object.entries(paths)) {
		const resolved = deref(doc, pathItem, visited);
		// Path-level parameters
		const pathParams = Array.isArray(resolved.parameters)
			? (resolved.parameters as Record<string, unknown>[]).map((p) =>
					extractParameter(doc, p, visited),
				)
			: [];

		for (const method of httpMethods) {
			const operation = resolved[method] as Record<string, unknown> | undefined;
			if (!operation) continue;

			const opParams = Array.isArray(operation.parameters)
				? (operation.parameters as Record<string, unknown>[]).map((p) =>
						extractParameter(doc, p, visited),
					)
				: [];

			// Merge path-level and operation-level params (operation wins on conflict)
			const paramMap = new Map<string, ApiParameter>();
			for (const p of pathParams) paramMap.set(`${p.in}:${p.name}`, p);
			for (const p of opParams) paramMap.set(`${p.in}:${p.name}`, p);

			const requestBody = operation.requestBody
				? extractRequestBody(
						doc,
						deref(doc, operation.requestBody as Record<string, unknown>, visited),
						visited,
					)
				: undefined;

			const responses = extractResponses(
				doc,
				operation.responses as Record<string, unknown> | undefined,
				visited,
			);

			endpoints.push({
				method: method.toUpperCase(),
				path,
				operationId: operation.operationId as string | undefined,
				summary: operation.summary as string | undefined,
				description: operation.description as string | undefined,
				tags: Array.isArray(operation.tags) ? (operation.tags as string[]) : [],
				parameters: Array.from(paramMap.values()),
				requestBody,
				responses,
			});
		}
	}

	return endpoints;
}

function extractParameter(
	doc: OpenApiDoc,
	raw: Record<string, unknown>,
	visited: Set<string>,
): ApiParameter {
	const param = deref(doc, raw, visited);
	const schema = param.schema ? deref(doc, param.schema as Record<string, unknown>, visited) : {};

	return {
		name: (param.name as string) ?? '',
		in: (param.in as ApiParameter['in']) ?? 'query',
		description: param.description as string | undefined,
		required: (param.required as boolean) ?? false,
		type: schema.type as string | undefined,
		example: param.example,
	};
}

function extractRequestBody(
	doc: OpenApiDoc,
	body: Record<string, unknown>,
	visited: Set<string>,
): ApiRequestBody | undefined {
	const content = body.content as Record<string, Record<string, unknown>> | undefined;
	if (!content) return undefined;

	// Prefer application/json, fall back to first content type
	const contentType = 'application/json' in content ? 'application/json' : Object.keys(content)[0];
	if (!contentType) return undefined;

	const mediaType = content[contentType];
	if (!mediaType) return undefined;

	const schema = mediaType.schema
		? deref(doc, mediaType.schema as Record<string, unknown>, visited)
		: {};

	return {
		description: body.description as string | undefined,
		contentType,
		required: (body.required as boolean) ?? false,
		properties: extractProperties(doc, schema, visited),
		example: mediaType.example ?? schema.example,
	};
}

function extractProperties(
	doc: OpenApiDoc,
	schema: Record<string, unknown>,
	visited: Set<string>,
): ApiProperty[] {
	const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
	if (!properties) return [];

	const requiredFields = new Set(
		Array.isArray(schema.required) ? (schema.required as string[]) : [],
	);

	return Object.entries(properties).map(([name, raw]) => {
		const prop = deref(doc, raw, visited);
		return {
			name,
			type: (prop.type as string) ?? 'unknown',
			description: prop.description as string | undefined,
			required: requiredFields.has(name),
			example: prop.example,
		};
	});
}

function extractResponses(
	doc: OpenApiDoc,
	responses: Record<string, unknown> | undefined,
	visited: Set<string>,
): ApiResponse[] {
	if (!responses) return [];

	return Object.entries(responses).map(([statusCode, raw]) => {
		const response = deref(doc, raw as Record<string, unknown>, visited);
		const content = response.content as Record<string, Record<string, unknown>> | undefined;

		let contentType: string | undefined;
		let properties: ApiProperty[] = [];

		if (content) {
			contentType = 'application/json' in content ? 'application/json' : Object.keys(content)[0];

			if (contentType && content[contentType]) {
				const mediaType = content[contentType]!;
				const schema = mediaType.schema
					? deref(doc, mediaType.schema as Record<string, unknown>, visited)
					: {};
				properties = extractProperties(doc, schema, visited);
			}
		}

		return {
			statusCode,
			description: response.description as string | undefined,
			contentType,
			properties,
		};
	});
}
