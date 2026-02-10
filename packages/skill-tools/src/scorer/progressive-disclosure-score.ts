import type { DimensionScore, Skill } from '@skill-tools/core';

const MAX_POINTS = 15;

/**
 * Score progressive disclosure (15 points max).
 *
 * Factors:
 * - Lean main SKILL.md (short enough to not need references)
 * - Uses references/scripts when large
 * - References are actually linked from SKILL.md
 */
export function scoreProgressiveDisclosure(skill: Skill): DimensionScore {
	let points = 0;
	const details: string[] = [];

	const isSmall = skill.lineCount <= 100;
	const isMedium = skill.lineCount <= 500;

	if (isSmall) {
		// Small skills automatically get full marks — no progressive disclosure needed
		points += 15;
		details.push('Skill is compact');
	} else if (isMedium) {
		// Medium skills get partial credit
		points += 8;

		// Bonus for using references/scripts
		const hasRefs = skill.fileReferences.some(
			(r) => r.path.startsWith('references/') || r.path.startsWith('scripts/'),
		);
		if (hasRefs) {
			points += 7;
			details.push('Uses supporting files');
		} else {
			details.push('Could benefit from references/');
		}
	} else {
		// Large skills need progressive disclosure
		const hasRefs = skill.fileReferences.some(
			(r) => r.path.startsWith('references/') || r.path.startsWith('scripts/'),
		);
		if (hasRefs) {
			points += 10;
			details.push('Uses supporting files (recommended: further reduce main file)');
		} else {
			points += 2;
			details.push('Large file without progressive disclosure');
		}
	}

	return {
		score: Math.min(points, MAX_POINTS),
		max: MAX_POINTS,
		label: 'Progressive Disclosure',
		details: details.join(', '),
	};
}
