import type { DimensionScore, Skill } from '@skill-tools/core';

const MAX_POINTS = 20;

/**
 * Score spec compliance (20 points max).
 *
 * Factors:
 * - Has name field
 * - Has description field
 * - Name follows format rules
 * - Token count within budget
 * - Has frontmatter
 */
export function scoreSpecCompliance(skill: Skill): DimensionScore {
	let points = 0;
	const details: string[] = [];

	// Has name (0-5 points)
	if (skill.metadata.name) {
		points += 5;
		details.push('Has name');
	}

	// Has description (0-5 points)
	if (skill.metadata.description) {
		points += 5;
		details.push('Has description');
	}

	// Token budget (0-5 points)
	if (skill.tokenCount <= 5000) {
		points += 5;
		details.push(`${skill.tokenCount} tokens (within budget)`);
	} else if (skill.tokenCount <= 7500) {
		points += 2;
		details.push(`${skill.tokenCount} tokens (over budget)`);
	} else {
		details.push(`${skill.tokenCount} tokens (far over budget)`);
	}

	// Line count (0-5 points)
	if (skill.lineCount <= 500) {
		points += 5;
		details.push(`${skill.lineCount} lines`);
	} else if (skill.lineCount <= 750) {
		points += 2;
		details.push(`${skill.lineCount} lines (over recommendation)`);
	} else {
		details.push(`${skill.lineCount} lines (far over recommendation)`);
	}

	return {
		score: Math.min(points, MAX_POINTS),
		max: MAX_POINTS,
		label: 'Spec Compliance',
		details: details.join(', '),
	};
}
