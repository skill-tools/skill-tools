import type {
	ApiEndpoint,
	ApiProperty,
	ApiRequestBody,
	ApiSpec,
	AuthScheme,
	GenerateOptions,
} from './types.js';

/**
 * Render a SKILL.md file from an ApiSpec.
 *
 * In "unified" mode, produces a single SKILL.md covering the entire API.
 * In "per-endpoint" mode, produces one SKILL.md per endpoint.
 */
export function renderSkillMd(
	spec: ApiSpec,
	options: GenerateOptions = {},
): Map<string, string> {
	const mode = options.mode ?? 'unified';
	const files = new Map<string, string>();

	if (mode === 'unified') {
		const name = options.name ?? toKebabCase(spec.title);
		const content = renderUnified(spec, { ...options, name });
		files.set(`${name}/SKILL.md`, content);
	} else {
		for (const endpoint of spec.endpoints) {
			const epName =
				endpoint.operationId
					? toKebabCase(endpoint.operationId)
					: toKebabCase(`${endpoint.method}-${endpoint.path}`);
			const content = renderSingleEndpoint(spec, endpoint, {
				...options,
				name: epName,
			});
			files.set(`${epName}/SKILL.md`, content);
		}
	}

	return files;
}

// ---------------------------------------------------------------------------
// Unified mode — one SKILL.md for the entire API
// ---------------------------------------------------------------------------

function renderUnified(spec: ApiSpec, options: GenerateOptions): string {
	const lines: string[] = [];

	// Frontmatter
	lines.push('---');
	lines.push(`name: ${options.name}`);
	lines.push(
		`description: >-`,
		`  ${options.description ?? buildUnifiedDescription(spec)}`,
	);
	lines.push('---');
	lines.push('');

	// Title
	lines.push(`# ${spec.title}`);
	lines.push('');

	if (spec.description) {
		lines.push(spec.description);
		lines.push('');
	}

	// Base URL
	if (spec.servers.length > 0) {
		lines.push('## Base URL');
		lines.push('');
		for (const server of spec.servers) {
			lines.push(`- \`${server}\``);
		}
		lines.push('');
	}

	// Authentication
	if (spec.auth.length > 0) {
		lines.push('## Authentication');
		lines.push('');
		lines.push(renderAuth(spec.auth));
		lines.push('');
	}

	// Endpoints
	lines.push('## Endpoints');
	lines.push('');

	// Group by tag
	const grouped = groupByTag(spec.endpoints);
	for (const [tag, endpoints] of grouped) {
		if (tag !== '_untagged') {
			lines.push(`### ${tag}`);
			lines.push('');
		}

		for (const ep of endpoints) {
			lines.push(renderEndpointSection(ep));
			lines.push('');
		}
	}

	// Error handling
	if (options.includeErrorHandling !== false) {
		lines.push('## Error Handling');
		lines.push('');
		lines.push(renderErrorHandling(spec));
		lines.push('');
	}

	return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Per-endpoint mode — one SKILL.md per endpoint
// ---------------------------------------------------------------------------

function renderSingleEndpoint(
	spec: ApiSpec,
	endpoint: ApiEndpoint,
	options: GenerateOptions,
): string {
	const lines: string[] = [];

	const summary = endpoint.summary ?? endpoint.description ?? `${endpoint.method} ${endpoint.path}`;

	// Frontmatter
	lines.push('---');
	lines.push(`name: ${options.name}`);
	lines.push(
		`description: >-`,
		`  ${options.description ?? `Use when the user wants to ${summary.toLowerCase()}. Calls ${endpoint.method} ${endpoint.path}.`}`,
	);
	lines.push('---');
	lines.push('');

	// Title
	lines.push(`# ${summary}`);
	lines.push('');

	if (endpoint.description && endpoint.description !== endpoint.summary) {
		lines.push(endpoint.description);
		lines.push('');
	}

	// Base URL
	if (spec.servers.length > 0) {
		lines.push(`**Base URL:** \`${spec.servers[0]}\``);
		lines.push('');
	}

	// Auth
	if (spec.auth.length > 0) {
		lines.push('## Authentication');
		lines.push('');
		lines.push(renderAuth(spec.auth));
		lines.push('');
	}

	// Endpoint details
	lines.push(`## ${endpoint.method} \`${endpoint.path}\``);
	lines.push('');

	// Parameters
	if (endpoint.parameters.length > 0) {
		lines.push('### Parameters');
		lines.push('');
		lines.push(renderParametersTable(endpoint));
		lines.push('');
	}

	// Request body
	if (endpoint.requestBody) {
		lines.push('### Request Body');
		lines.push('');
		lines.push(renderRequestBody(endpoint.requestBody, options));
		lines.push('');
	}

	// Responses
	if (endpoint.responses.length > 0) {
		lines.push('### Responses');
		lines.push('');
		lines.push(renderResponses(endpoint));
		lines.push('');
	}

	// Example
	if (options.includeExamples !== false) {
		lines.push('## Example');
		lines.push('');
		lines.push(renderExample(spec, endpoint));
		lines.push('');
	}

	// Error handling
	if (options.includeErrorHandling !== false) {
		lines.push('## Error Handling');
		lines.push('');
		lines.push(renderEndpointErrorHandling(endpoint));
		lines.push('');
	}

	return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Shared rendering helpers
// ---------------------------------------------------------------------------

function buildUnifiedDescription(spec: ApiSpec): string {
	const endpointCount = spec.endpoints.length;
	const methods = new Set(spec.endpoints.map((e) => e.method));
	const methodList = Array.from(methods).join(', ');

	if (spec.description) {
		return `${spec.description.split('.')[0]}. Use when working with the ${spec.title} (${endpointCount} endpoints, ${methodList}).`;
	}

	return `Interact with the ${spec.title}. Use when the user needs to call any of the ${endpointCount} available endpoints (${methodList}).`;
}

function renderAuth(auth: readonly AuthScheme[]): string {
	const lines: string[] = [];
	for (const scheme of auth) {
		switch (scheme.type) {
			case 'http':
				if (scheme.scheme === 'bearer') {
					lines.push('Use Bearer token authentication:');
					lines.push('```');
					lines.push('Authorization: Bearer <token>');
					lines.push('```');
				} else if (scheme.scheme === 'basic') {
					lines.push('Use HTTP Basic authentication:');
					lines.push('```');
					lines.push('Authorization: Basic <base64(username:password)>');
					lines.push('```');
				}
				break;
			case 'apiKey':
				lines.push(`Pass the API key via ${scheme.in ?? 'header'}:`);
				lines.push('```');
				lines.push(`${scheme.name}: <api-key>`);
				lines.push('```');
				break;
			case 'oauth2':
				lines.push('Uses OAuth 2.0 authentication. Obtain an access token first.');
				break;
			default:
				if (scheme.description) {
					lines.push(scheme.description);
				}
		}
	}
	return lines.join('\n');
}

function groupByTag(
	endpoints: readonly ApiEndpoint[],
): Map<string, ApiEndpoint[]> {
	const grouped = new Map<string, ApiEndpoint[]>();

	for (const ep of endpoints) {
		const tag = ep.tags.length > 0 ? ep.tags[0]! : '_untagged';
		const list = grouped.get(tag) ?? [];
		list.push(ep);
		grouped.set(tag, list);
	}

	return grouped;
}

function renderEndpointSection(ep: ApiEndpoint): string {
	const lines: string[] = [];
	const heading = ep.summary ?? `${ep.method} ${ep.path}`;

	lines.push(`#### ${ep.method} \`${ep.path}\` — ${heading}`);
	lines.push('');

	if (ep.description && ep.description !== ep.summary) {
		lines.push(ep.description);
		lines.push('');
	}

	// Parameters table
	if (ep.parameters.length > 0) {
		lines.push(renderParametersTable(ep));
		lines.push('');
	}

	// Request body
	if (ep.requestBody) {
		lines.push('**Request body** (`' + ep.requestBody.contentType + '`):');
		lines.push('');
		lines.push(renderPropertiesTable(ep.requestBody.properties));
		lines.push('');
	}

	// Compact response summary
	const successResponse = ep.responses.find(
		(r) => r.statusCode.startsWith('2'),
	);
	if (successResponse) {
		lines.push(
			`**Response:** ${successResponse.statusCode} — ${successResponse.description ?? 'Success'}`,
		);
	}

	return lines.join('\n');
}

function renderParametersTable(ep: ApiEndpoint): string {
	const lines: string[] = [];
	lines.push('| Parameter | In | Type | Required | Description |');
	lines.push('|-----------|-----|------|----------|-------------|');
	for (const param of ep.parameters) {
		const req = param.required ? 'Yes' : 'No';
		const desc = param.description ?? '';
		lines.push(
			`| \`${param.name}\` | ${param.in} | ${param.type ?? '-'} | ${req} | ${desc} |`,
		);
	}
	return lines.join('\n');
}

function renderPropertiesTable(properties: readonly ApiProperty[]): string {
	if (properties.length === 0) return '';

	const lines: string[] = [];
	lines.push('| Property | Type | Required | Description |');
	lines.push('|----------|------|----------|-------------|');
	for (const prop of properties) {
		const req = prop.required ? 'Yes' : 'No';
		const desc = prop.description ?? '';
		lines.push(`| \`${prop.name}\` | ${prop.type} | ${req} | ${desc} |`);
	}
	return lines.join('\n');
}

function renderRequestBody(body: ApiRequestBody, options: GenerateOptions): string {
	const lines: string[] = [];
	if (body.description) {
		lines.push(body.description);
		lines.push('');
	}
	lines.push(`Content-Type: \`${body.contentType}\``);
	lines.push('');

	if (body.properties.length > 0) {
		lines.push(renderPropertiesTable(body.properties));
	}

	if (options.includeExamples !== false && body.example) {
		lines.push('');
		lines.push('**Example:**');
		lines.push('```json');
		lines.push(JSON.stringify(body.example, null, 2));
		lines.push('```');
	}

	return lines.join('\n');
}

function renderResponses(ep: ApiEndpoint): string {
	const lines: string[] = [];
	for (const resp of ep.responses) {
		lines.push(`**${resp.statusCode}** — ${resp.description ?? ''}`);
		if (resp.properties.length > 0) {
			lines.push('');
			lines.push(renderPropertiesTable(resp.properties));
		}
		lines.push('');
	}
	return lines.join('\n');
}

function renderExample(spec: ApiSpec, ep: ApiEndpoint): string {
	const baseUrl = spec.servers[0] ?? 'https://api.example.com';
	const lines: string[] = [];

	lines.push('```bash');
	lines.push(`curl -X ${ep.method} "${baseUrl}${ep.path}" \\`);

	// Add auth header hint
	if (spec.auth.length > 0) {
		const authScheme = spec.auth[0]!;
		if (authScheme.type === 'http' && authScheme.scheme === 'bearer') {
			lines.push('  -H "Authorization: Bearer $TOKEN" \\');
		} else if (authScheme.type === 'apiKey') {
			lines.push(`  -H "${authScheme.name}: $API_KEY" \\`);
		}
	}

	lines.push('  -H "Content-Type: application/json"');

	if (ep.requestBody?.example) {
		lines.push(`  -d '${JSON.stringify(ep.requestBody.example)}'`);
	}

	lines.push('```');
	return lines.join('\n');
}

function renderErrorHandling(spec: ApiSpec): string {
	const errorCodes = new Set<string>();
	for (const ep of spec.endpoints) {
		for (const resp of ep.responses) {
			if (resp.statusCode.startsWith('4') || resp.statusCode.startsWith('5')) {
				errorCodes.add(resp.statusCode);
			}
		}
	}

	const lines: string[] = [];
	lines.push('Common error responses:');
	lines.push('');

	if (errorCodes.size === 0) {
		lines.push('- **4xx**: Client error — check request parameters and authentication');
		lines.push('- **5xx**: Server error — retry with exponential backoff');
	} else {
		for (const code of Array.from(errorCodes).sort()) {
			lines.push(`- **${code}**: ${httpStatusDescription(code)}`);
		}
	}

	lines.push('');
	lines.push('When an error occurs:');
	lines.push('1. Check the response body for a detailed error message');
	lines.push('2. Verify authentication credentials are valid');
	lines.push('3. For 429 (rate limit), wait and retry with exponential backoff');
	lines.push('4. For 5xx errors, retry up to 3 times with backoff');

	return lines.join('\n');
}

function renderEndpointErrorHandling(ep: ApiEndpoint): string {
	const errorResponses = ep.responses.filter(
		(r) => r.statusCode.startsWith('4') || r.statusCode.startsWith('5'),
	);

	const lines: string[] = [];

	if (errorResponses.length > 0) {
		lines.push('Possible errors:');
		lines.push('');
		for (const resp of errorResponses) {
			lines.push(`- **${resp.statusCode}**: ${resp.description ?? httpStatusDescription(resp.statusCode)}`);
		}
	} else {
		lines.push('- Check authentication credentials if you receive a 401/403');
		lines.push('- Validate request parameters for 400 errors');
		lines.push('- Retry on 5xx with exponential backoff');
	}

	return lines.join('\n');
}

function httpStatusDescription(code: string): string {
	const descriptions: Record<string, string> = {
		'400': 'Bad Request — check request parameters',
		'401': 'Unauthorized — check authentication',
		'403': 'Forbidden — insufficient permissions',
		'404': 'Not Found — resource does not exist',
		'405': 'Method Not Allowed',
		'409': 'Conflict — resource state conflict',
		'422': 'Unprocessable Entity — validation error',
		'429': 'Too Many Requests — rate limited, retry after backoff',
		'500': 'Internal Server Error — retry with backoff',
		'502': 'Bad Gateway — upstream service error',
		'503': 'Service Unavailable — retry later',
	};
	return descriptions[code] ?? `HTTP ${code} error`;
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
