import type { QualityScore, ScoreSuggestion, Skill } from '@skill-tools/core';
import { scoreDescriptionQuality } from './description-quality.js';
import { scoreInstructionClarity } from './instruction-clarity.js';
import { scoreProgressiveDisclosure } from './progressive-disclosure-score.js';
import { scoreSecurityScore } from './security-score.js';
import { scoreSpecCompliance } from './spec-compliance.js';

/**
 * Compute the overall quality score for a skill.
 *
 * Score breakdown (100 points total):
 * - Description Quality: 30 points
 * - Instruction Clarity: 25 points
 * - Spec Compliance: 20 points
 * - Progressive Disclosure: 15 points
 * - Security: 10 points
 *
 * @param skill - The parsed Skill object
 * @returns QualityScore with dimension breakdowns and suggestions
 */
export function score(skill: Skill): QualityScore {
	const descriptionQuality = scoreDescriptionQuality(skill);
	const instructionClarity = scoreInstructionClarity(skill);
	const specCompliance = scoreSpecCompliance(skill);
	const progressiveDisclosure = scoreProgressiveDisclosure(skill);
	const security = scoreSecurityScore(skill);

	const totalScore =
		descriptionQuality.score +
		instructionClarity.score +
		specCompliance.score +
		progressiveDisclosure.score +
		security.score;

	const dimensions = {
		description_quality: descriptionQuality,
		instruction_clarity: instructionClarity,
		spec_compliance: specCompliance,
		progressive_disclosure: progressiveDisclosure,
		security,
	};

	const suggestions = generateSuggestions(skill, dimensions);

	return {
		score: totalScore,
		dimensions,
		suggestions,
	};
}

/**
 * Generate actionable suggestions based on dimension scores.
 */
function generateSuggestions(
	skill: Skill,
	dimensions: Record<string, { score: number; max: number }>,
): ScoreSuggestion[] {
	const suggestions: ScoreSuggestion[] = [];

	const descDim = dimensions.description_quality!;
	const instrDim = dimensions.instruction_clarity!;
	const progDim = dimensions.progressive_disclosure!;
	const secDim = dimensions.security!;

	// Description suggestions
	if (!skill.metadata.description) {
		suggestions.push({
			message: 'Add a description field to the frontmatter',
			pointsGain: 15,
			dimension: 'description_quality',
		});
	} else {
		if (descDim.score < descDim.max * 0.6) {
			if (!/\buse when\b/i.test(skill.metadata.description)) {
				suggestions.push({
					message: 'Add "Use when..." to the description to clarify trigger conditions',
					pointsGain: 8,
					dimension: 'description_quality',
				});
			}
		}
	}

	// Instruction suggestions
	if (instrDim.score < instrDim.max * 0.5) {
		const hasCodeBlock = /```[\s\S]*?```/.test(skill.body);
		if (!hasCodeBlock) {
			suggestions.push({
				message: 'Add a concrete usage example with a code block',
				pointsGain: 5,
				dimension: 'instruction_clarity',
			});
		}

		const hasNumberedSteps = /^\d+\.\s+/m.test(skill.body);
		if (!hasNumberedSteps) {
			suggestions.push({
				message: 'Add numbered steps for the main workflow',
				pointsGain: 4,
				dimension: 'instruction_clarity',
			});
		}

		const hasErrorHandling = /#{1,3}\s+(?:error|troubleshoot)/i.test(skill.body);
		if (!hasErrorHandling) {
			suggestions.push({
				message: 'Add an "## Error Handling" section',
				pointsGain: 3,
				dimension: 'instruction_clarity',
			});
		}

		const imperativeVerbs =
			/^(?:Run|Create|Add|Set|Configure|Install|Execute|Build|Check|Verify|Open|Navigate|Click|Enter|Select|Copy|Update|Remove|Delete|Enable|Disable|Start|Stop|Deploy)\b/;
		const hasImperativeStarts = skill.body
			.split('\n')
			.some((line) => imperativeVerbs.test(line.trim()));
		const hasSteps = /^\d+\.\s+/m.test(skill.body);
		if (!hasImperativeStarts && !hasSteps) {
			suggestions.push({
				message:
					'Use imperative verbs to make instructions procedural (e.g. "Run", "Create", "Configure")',
				pointsGain: 3,
				dimension: 'instruction_clarity',
			});
		}
	}

	// Spec compliance suggestions
	if (!skill.metadata.name) {
		suggestions.push({
			message: 'Add a name field to the frontmatter',
			pointsGain: 5,
			dimension: 'spec_compliance',
		});
	}

	if (skill.tokenCount > 5000) {
		suggestions.push({
			message: `Reduce token count from ${skill.tokenCount} to under 5,000`,
			pointsGain: 3,
			dimension: 'spec_compliance',
		});
	}

	// Progressive disclosure suggestions
	if (progDim.score < progDim.max * 0.5 && skill.lineCount > 200) {
		suggestions.push({
			message: 'Move detailed reference content to a references/ directory',
			pointsGain: 5,
			dimension: 'progressive_disclosure',
		});
	}

	// Security suggestions
	if (secDim.score < secDim.max) {
		suggestions.push({
			message: 'Fix security issues (secrets, hardcoded paths, or suspicious patterns)',
			pointsGain: secDim.max - secDim.score,
			dimension: 'security',
		});
	}

	// Sort by point gain descending
	suggestions.sort((a, b) => b.pointsGain - a.pointsGain);

	return suggestions;
}
