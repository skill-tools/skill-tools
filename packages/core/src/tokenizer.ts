import { encodingForModel } from 'js-tiktoken';

/**
 * Cached encoder instance. Created lazily on first use.
 * Uses cl100k_base encoding (GPT-4 / Claude-compatible).
 */
let encoder: ReturnType<typeof encodingForModel> | null = null;

/**
 * Returns the shared tiktoken encoder instance.
 * Uses cl100k_base which is compatible with both OpenAI and Anthropic models.
 */
function getEncoder(): ReturnType<typeof encodingForModel> {
	if (!encoder) {
		encoder = encodingForModel('gpt-4o');
	}
	return encoder;
}

/**
 * Count the number of tokens in a string.
 *
 * Uses the cl100k_base tokenizer (GPT-4o compatible), which provides
 * a reasonable approximation for both OpenAI and Anthropic models.
 * Actual token counts may vary slightly between providers.
 *
 * @param text - The text to count tokens for
 * @returns The number of tokens
 *
 * @example
 * ```ts
 * const count = countTokens('Hello, world!');
 * // => 4
 * ```
 */
export function countTokens(text: string): number {
	if (text.length === 0) {
		return 0;
	}
	const enc = getEncoder();
	return enc.encode(text).length;
}
