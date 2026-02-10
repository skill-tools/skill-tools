import type { Diagnostic, Skill } from '@skill-tools/core';
import type { RuleDefinition } from './types.js';

/**
 * Patterns that look like secrets, API keys, or tokens.
 * Each pattern has a label for the diagnostic message.
 */
const SECRET_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
	{ pattern: /sk-[a-zA-Z0-9]{20,}/, label: 'OpenAI API key' },
	{ pattern: /sk_live_[a-zA-Z0-9]{20,}/, label: 'Stripe live key' },
	{ pattern: /sk_test_[a-zA-Z0-9]{20,}/, label: 'Stripe test key' },
	{ pattern: /ghp_[a-zA-Z0-9]{36,}/, label: 'GitHub personal access token' },
	{ pattern: /gho_[a-zA-Z0-9]{36,}/, label: 'GitHub OAuth token' },
	{ pattern: /github_pat_[a-zA-Z0-9_]{20,}/, label: 'GitHub fine-grained token' },
	{ pattern: /xoxb-[a-zA-Z0-9-]+/, label: 'Slack bot token' },
	{ pattern: /xoxp-[a-zA-Z0-9-]+/, label: 'Slack user token' },
	{ pattern: /AKIA[0-9A-Z]{16}/, label: 'AWS access key ID' },
	{ pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, label: 'Private key' },
	{ pattern: /eyJ[a-zA-Z0-9_-]{20,500}\.[a-zA-Z0-9_-]{20,500}\./, label: 'JWT token' },
];

/**
 * Check for patterns that look like embedded secrets or credentials.
 */
export const noSecrets: RuleDefinition = {
	id: 'no-secrets',
	description: 'Flag patterns that look like API keys, tokens, or passwords',
	defaultSeverity: 'error',

	check(skill: Skill): Diagnostic[] {
		const diagnostics: Diagnostic[] = [];
		const lines = skill.rawContent.split('\n');

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]!;

			for (const { pattern, label } of SECRET_PATTERNS) {
				if (pattern.test(line)) {
					diagnostics.push({
						ruleId: 'no-secrets',
						severity: 'error',
						message: `Possible ${label} detected. Never embed secrets in SKILL.md files`,
						file: skill.filePath,
						line: i + 1,
						fix: 'Use environment variable references (e.g., $API_KEY) instead of actual secrets',
					});
					break; // One diagnostic per line is enough
				}
			}
		}

		return diagnostics;
	},
};
