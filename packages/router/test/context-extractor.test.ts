import { describe, expect, it } from 'vitest';
import { extractContext } from '../src/context/extractor.js';

describe('extractContext', () => {
	it('returns empty string for skill with no body or sections', () => {
		const ctx = extractContext({
			name: 'deploy-vercel',
			description: 'Deploy applications to Vercel.',
		});
		// Name parts "deploy" and "vercel" are already in description
		expect(ctx).toBe('');
	});

	it('extracts inline code references from body', () => {
		const ctx = extractContext({
			name: 'deploy-vercel',
			description: 'Deploy applications to Vercel.',
			body: 'Run `vercel login` then `vercel --prod` to deploy.',
		});
		expect(ctx).toContain('login');
		expect(ctx).toContain('prod');
	});

	it('extracts section headings', () => {
		const ctx = extractContext({
			name: 'deploy-vercel',
			description: 'Deploy applications to Vercel.',
			sections: [
				{ heading: 'Prerequisites', depth: 2, content: '' },
				{ heading: 'Error Handling', depth: 2, content: '' },
			],
		});
		expect(ctx).toContain('prerequisites');
		expect(ctx).toContain('error');
		expect(ctx).toContain('handling');
	});

	it('splits skill name on hyphens and underscores', () => {
		const ctx = extractContext({
			name: 'run-jest_tests',
			description: 'Execute test suites.',
			body: '',
		});
		expect(ctx).toContain('run');
		expect(ctx).toContain('jest');
		expect(ctx).toContain('tests');
	});

	it('deduplicates against description terms', () => {
		const ctx = extractContext({
			name: 'deploy-vercel',
			description: 'Deploy applications to Vercel using the CLI.',
			body: 'Run `vercel deploy` to push your application.',
		});
		// "deploy", "vercel", "applications" are in the description
		expect(ctx).not.toMatch(/\bdeploy\b/);
		expect(ctx).not.toMatch(/\bvercel\b/);
	});

	it('deduplicates within extracted terms', () => {
		const ctx = extractContext({
			name: 'test-runner',
			description: 'Run tests.',
			body: 'Use `jest` for unit tests. Run `jest --coverage` for reports.',
		});
		const tokens = ctx.split(' ');
		const unique = new Set(tokens);
		expect(tokens.length).toBe(unique.size);
	});

	it('extracts key terms from section content', () => {
		const ctx = extractContext({
			name: 'deploy-vercel',
			description: 'Deploy applications to Vercel.',
			sections: [
				{
					heading: 'Steps',
					depth: 2,
					content: 'Configure the vercel.json file with your framework settings.',
				},
			],
		});
		expect(ctx).toContain('configure');
		expect(ctx).toContain('framework');
		expect(ctx).toContain('settings');
	});

	it('handles empty body and sections gracefully', () => {
		const ctx = extractContext({
			name: 'x',
			description: 'A skill.',
			body: '',
			sections: [],
		});
		expect(typeof ctx).toBe('string');
	});

	it('truncates to max ~80 tokens', () => {
		// Build a skill with tons of unique code refs
		const codeRefs = Array.from({ length: 120 }, (_, i) => `\`unique_tool_${i}\``).join(' ');
		const ctx = extractContext({
			name: 'big-skill',
			description: 'A big skill with lots of tools.',
			body: codeRefs,
		});
		const tokens = ctx.split(' ').filter((t) => t.length > 0);
		expect(tokens.length).toBeLessThanOrEqual(80);
	});

	it('strips leading dashes from code refs', () => {
		const ctx = extractContext({
			name: 'deploy-vercel',
			description: 'Deploy applications to Vercel.',
			body: 'Run `vercel --prod --force` to deploy.',
		});
		// --prod should become "prod", --force should become "force"
		expect(ctx).toContain('prod');
		expect(ctx).toContain('force');
		expect(ctx).not.toContain('--');
	});

	it('filters single-character name parts', () => {
		const ctx = extractContext({
			name: 'a-b-deploy',
			description: 'Something else entirely.',
			body: '',
		});
		// "a" and "b" should be filtered out (length <= 1)
		expect(ctx).not.toMatch(/\ba\b/);
		expect(ctx).not.toMatch(/\bb\b/);
		expect(ctx).toContain('deploy');
	});
});
