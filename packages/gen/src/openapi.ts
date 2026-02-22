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

	const title = doc.info?.title ?? 'Untitled API';
	const description = doc.info?.description ?? '';
	const apiVersion = doc.info?.version ?? '0.0.0';
	const servers = extractServers(doc);
	const auth = extractAuthSchemes(doc);
	const endpoints = extractEndpoints(doc);

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
 * Tracks visited refs to detect circular references.
 */
function resolveRef(
	doc: OpenApiDoc,
	ref: string,
	visited: Set<string> = new Set(),
): Record<string, unknown> {
	if (!ref.startsWith('#/')) {
		return {};
	}
	if (visited.has(ref)) {
		throw new Error(`Circular $ref detected: ${ref}`);
	}
	visited.add(ref);

	const path = ref.slice(2).split('/');
	let current: unknown = doc;
	for (const segment of path) {
		if (current == null || typeof current !== 'object') return {};
		current = (current as Record<string, unknown>)[segment];
	}

	const resolved = (current as Record<string, unknown>) ?? {};

	// If the resolved object itself contains a $ref, follow it (with cycle tracking)
	if (typeof resolved.$ref === 'string') {
		return resolveRef(doc, resolved.$ref, visited);
	}

	return resolved;
}

/**
 * If obj has a $ref, resolve it. Otherwise return obj as-is.
 * Passes a visited Set through to detect circular references.
 */
function deref(
	doc: OpenApiDoc,
	obj: Record<string, unknown>,
	visited?: Set<string>,
): Record<string, unknown> {
	if (typeof obj.$ref === 'string') {
		return resolveRef(doc, obj.$ref, visited ?? new Set());
	}
	return obj;
}

function extractServers(doc: OpenApiDoc): string[] {
	const servers = doc.servers;
	if (!Array.isArray(servers)) return [];
	return servers.map((s: Record<string, unknown>) => s.url as string).filter(Boolean);
}

function extractAuthSchemes(doc: OpenApiDoc): AuthScheme[] {
	const components = doc.components as Record<string, unknown> | undefined;
	const schemes = components?.securitySchemes as
		| Record<string, Record<string, unknown>>
		| undefined;
	if (!schemes) return [];

	return Object.entries(schemes).map(([name, raw]) => {
		const scheme = deref(doc, raw);
		return {
			type: (scheme.type as AuthScheme['type']) ?? 'apiKey',
			name,
			description: scheme.description as string | undefined,
			in: scheme.in as AuthScheme['in'],
			scheme: scheme.scheme as string | undefined,
		};
	});
}

function extractEndpoints(doc: OpenApiDoc): ApiEndpoint[] {
	const paths = doc.paths as Record<string, Record<string, unknown>> | undefined;
	if (!paths) return [];

	const endpoints: ApiEndpoint[] = [];
	const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

	for (const [path, pathItem] of Object.entries(paths)) {
		const resolved = deref(doc, pathItem);
		// Path-level parameters
		const pathParams = Array.isArray(resolved.parameters)
			? (resolved.parameters as Record<string, unknown>[]).map((p) => extractParameter(doc, p))
			: [];

		for (const method of httpMethods) {
			const operation = resolved[method] as Record<string, unknown> | undefined;
			if (!operation) continue;

			const opParams = Array.isArray(operation.parameters)
				? (operation.parameters as Record<string, unknown>[]).map((p) => extractParameter(doc, p))
				: [];

			// Merge path-level and operation-level params (operation wins on conflict)
			const paramMap = new Map<string, ApiParameter>();
			for (const p of pathParams) paramMap.set(`${p.in}:${p.name}`, p);
			for (const p of opParams) paramMap.set(`${p.in}:${p.name}`, p);

			const requestBody = operation.requestBody
				? extractRequestBody(doc, deref(doc, operation.requestBody as Record<string, unknown>))
				: undefined;

			const responses = extractResponses(
				doc,
				operation.responses as Record<string, unknown> | undefined,
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

function extractParameter(doc: OpenApiDoc, raw: Record<string, unknown>): ApiParameter {
	const param = deref(doc, raw);
	const schema = param.schema ? deref(doc, param.schema as Record<string, unknown>) : {};

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
): ApiRequestBody | undefined {
	const content = body.content as Record<string, Record<string, unknown>> | undefined;
	if (!content) return undefined;

	// Prefer application/json, fall back to first content type
	const contentType = 'application/json' in content ? 'application/json' : Object.keys(content)[0];
	if (!contentType) return undefined;

	const mediaType = content[contentType];
	if (!mediaType) return undefined;

	const schema = mediaType.schema ? deref(doc, mediaType.schema as Record<string, unknown>) : {};

	return {
		description: body.description as string | undefined,
		contentType,
		required: (body.required as boolean) ?? false,
		properties: extractProperties(doc, schema),
		example: mediaType.example ?? schema.example,
	};
}

function extractProperties(doc: OpenApiDoc, schema: Record<string, unknown>): ApiProperty[] {
	const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
	if (!properties) return [];

	const requiredFields = new Set(
		Array.isArray(schema.required) ? (schema.required as string[]) : [],
	);

	return Object.entries(properties).map(([name, raw]) => {
		const prop = deref(doc, raw);
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
): ApiResponse[] {
	if (!responses) return [];

	return Object.entries(responses).map(([statusCode, raw]) => {
		const response = deref(doc, raw as Record<string, unknown>);
		const content = response.content as Record<string, Record<string, unknown>> | undefined;

		let contentType: string | undefined;
		let properties: ApiProperty[] = [];

		if (content) {
			contentType = 'application/json' in content ? 'application/json' : Object.keys(content)[0];

			if (contentType && content[contentType]) {
				const mediaType = content[contentType]!;
				const schema = mediaType.schema
					? deref(doc, mediaType.schema as Record<string, unknown>)
					: {};
				properties = extractProperties(doc, schema);
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
