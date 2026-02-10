/**
 * Demo: Generate SKILL.md files using @skill-tools/gen
 *
 * Run: npx tsx examples/generate-skill.ts
 */
import { generateFromSpec, generateFromText } from '@skill-tools/gen';
import type { ApiSpec } from '@skill-tools/gen';

// --- Method 1: Generate from a text description ---
console.log('=== Generate from Text ===\n');

const textResult = generateFromText(
	'deploy-vercel',
	'Deploy applications to Vercel. Use when the user wants to push code to production on Vercel hosting.',
	`## Steps

1. Ensure the project has a \`vercel.json\` config
2. Run \`vercel login\` to authenticate
3. Run \`vercel --prod\` to deploy to production
4. Return the deployment URL

## Error Handling

If the deployment fails, check for build errors in the Vercel dashboard.`,
);

if (textResult.ok) {
	console.log(`Generated ${textResult.files.size} file(s), ${textResult.tokenCount} tokens`);
	for (const [path, content] of textResult.files) {
		console.log(`\n--- ${path} ---`);
		console.log(content);
	}
}

// --- Method 2: Generate from an API spec object ---
console.log('\n=== Generate from API Spec ===\n');

const spec: ApiSpec = {
	title: 'Todo API',
	description: 'A simple Todo list REST API',
	servers: ['https://api.example.com/v1'],
	version: '1.0.0',
	endpoints: [
		{
			method: 'GET',
			path: '/todos',
			operationId: 'listTodos',
			summary: 'List all todos',
			tags: ['todos'],
			parameters: [
				{
					name: 'status',
					in: 'query',
					description: 'Filter by status (active, completed)',
					required: false,
					type: 'string',
				},
			],
			responses: [
				{
					statusCode: '200',
					description: 'Array of todo objects',
					contentType: 'application/json',
					properties: [],
				},
			],
		},
		{
			method: 'POST',
			path: '/todos',
			operationId: 'createTodo',
			summary: 'Create a new todo',
			tags: ['todos'],
			parameters: [],
			requestBody: {
				contentType: 'application/json',
				required: true,
				properties: [
					{ name: 'title', type: 'string', description: 'Todo title', required: true },
					{ name: 'completed', type: 'boolean', description: 'Completion status', required: false },
				],
			},
			responses: [
				{
					statusCode: '201',
					description: 'Created todo',
					contentType: 'application/json',
					properties: [],
				},
			],
		},
	],
	auth: [{ type: 'http', name: 'bearerAuth', scheme: 'bearer', description: 'JWT Bearer token' }],
};

const specResult = generateFromSpec(spec, {
	name: 'todo-api',
	includeExamples: true,
	includeErrorHandling: true,
});

if (specResult.ok) {
	console.log(`Generated ${specResult.files.size} file(s), ${specResult.endpointCount} endpoints, ${specResult.tokenCount} tokens`);
	for (const [path, content] of specResult.files) {
		console.log(`\n--- ${path} ---`);
		// Truncate for demo readability
		if (content.length > 600) {
			console.log(`${content.slice(0, 600)}\n...(${content.length} chars total)`);
		} else {
			console.log(content);
		}
	}
} else {
	console.error('Generation failed:', specResult.error);
}
