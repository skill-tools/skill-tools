import { describe, expect, it } from 'vitest';
import { countTokens } from '../src/tokenizer.js';

describe('countTokens', () => {
	it('returns 0 for empty string', () => {
		expect(countTokens('')).toBe(0);
	});

	it('counts tokens for simple text', () => {
		const count = countTokens('Hello, world!');
		expect(count).toBeGreaterThan(0);
		expect(count).toBeLessThan(10);
	});

	it('counts tokens for longer text', () => {
		const text = 'The quick brown fox jumps over the lazy dog. '.repeat(100);
		const count = countTokens(text);
		expect(count).toBeGreaterThan(100);
	});

	it('handles markdown content', () => {
		const markdown = `# Heading

Some text with **bold** and *italic*.

\`\`\`bash
echo "hello"
\`\`\`
`;
		const count = countTokens(markdown);
		expect(count).toBeGreaterThan(0);
	});

	it('returns consistent results for same input', () => {
		const text = 'Consistent tokenization test';
		const count1 = countTokens(text);
		const count2 = countTokens(text);
		expect(count1).toBe(count2);
	});
});
