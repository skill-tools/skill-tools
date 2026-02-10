import type { DimensionScore, Skill } from '@skill-tools/core';
import { noHardcodedPaths } from '../rules/no-hardcoded-paths.js';
import { noSecrets } from '../rules/no-secrets.js';

const MAX_POINTS = 10;

/**
 * Score security (10 points max).
 *
 * Factors:
 * - No hardcoded secrets
 * - No hardcoded paths
 * - No suspicious shell patterns
 */
export function scoreSecurityScore(skill: Skill): DimensionScore {
	let points = MAX_POINTS;
	const details: string[] = [];

	// Check for secrets
	const secretDiags = noSecrets.check(skill);
	if (secretDiags.length > 0) {
		points -= 10; // Fatal: any secret is a full deduction
		details.push(`${secretDiags.length} possible secret(s) found`);
	}

	// Check for hardcoded paths
	const pathDiags = noHardcodedPaths.check(skill);
	if (pathDiags.length > 0) {
		points -= 3;
		details.push(`${pathDiags.length} hardcoded path(s)`);
	}

	// Check for suspicious shell patterns
	const body = skill.body;
	const suspiciousPatterns = [
		/\brm\s+-rf\s+\/(?!\s)/, // rm -rf / (not followed by space)
		/\bcurl\s+.*\|\s*(?:bash|sh)\b/, // curl | bash
		/\beval\s+\$/, // eval $
	];
	for (const pattern of suspiciousPatterns) {
		if (pattern.test(body)) {
			points -= 2;
			details.push('Suspicious shell pattern');
			break;
		}
	}

	if (details.length === 0) {
		details.push('No security issues');
	}

	return {
		score: Math.max(0, points),
		max: MAX_POINTS,
		label: 'Security',
		details: details.join(', '),
	};
}
