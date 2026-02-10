import type { DimensionScore, Skill } from '@skill-tools/core';

const MAX_POINTS = 30;

/**
 * Score the quality of the skill description (30 points max).
 *
 * Factors:
 * - Length (optimal: 50-300 chars)
 * - Specificity (contains action verbs, concrete nouns)
 * - Trigger context (includes "Use when..." or similar)
 * - Uniqueness (doesn't just repeat the skill name)
 */
export function scoreDescriptionQuality(skill: Skill): DimensionScore {
	const desc = skill.metadata.description;
	if (!desc) {
		return {
			score: 0,
			max: MAX_POINTS,
			label: 'Description Quality',
			details: 'No description provided',
		};
	}

	let points = 0;
	const details: string[] = [];

	// Length score (0-8 points)
	const len = desc.length;
	if (len >= 50 && len <= 300) {
		points += 8;
	} else if (len >= 30 && len <= 400) {
		points += 5;
	} else if (len >= 10) {
		points += 2;
	}
	details.push(`Length: ${len} chars`);

	// Specificity score (0-8 points)
	const actionVerbs =
		/\b(deploy|test|build|run|create|generate|analyze|review|format|lint|fix|check|commit|push|pull|fetch|install|configure|search|find|list|delete|update|migrate|convert|export|import)\b/gi;
	const verbCount = (desc.match(actionVerbs) ?? []).length;
	if (verbCount >= 2) {
		points += 8;
	} else if (verbCount === 1) {
		points += 5;
	}
	details.push(`Action verbs: ${verbCount}`);

	// Trigger context score (0-8 points)
	const hasTriggerContext =
		/\buse when\b|\buse for\b|\buse this\b|\binvoke when\b|\bwhen the user\b/i.test(desc);
	if (hasTriggerContext) {
		points += 8;
		details.push('Has trigger context');
	}

	// Not just repeating the name (0-6 points)
	const name = skill.metadata.name ?? '';
	const nameWords = name.split('-').filter((w) => w.length > 2);
	const descLower = desc.toLowerCase();
	const nameRepetitions = nameWords.filter((w) => descLower.includes(w)).length;
	const ratio = nameWords.length > 0 ? nameRepetitions / nameWords.length : 0;

	if (ratio < 0.5) {
		points += 6;
	} else if (ratio < 0.8) {
		points += 3;
	}

	return {
		score: Math.min(points, MAX_POINTS),
		max: MAX_POINTS,
		label: 'Description Quality',
		details: details.join(', '),
	};
}
