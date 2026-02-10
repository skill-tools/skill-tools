import type { DimensionScore, Skill } from '@skill-tools/core';

const MAX_POINTS = 25;

/**
 * Score the clarity of the skill instructions (25 points max).
 *
 * Factors:
 * - Has concrete examples (code blocks, inline code)
 * - Has numbered steps or structured instructions
 * - Has error handling guidance
 * - Body is non-trivially long (provides real value)
 */
export function scoreInstructionClarity(skill: Skill): DimensionScore {
	const body = skill.body;
	if (!body || body.trim().length === 0) {
		return { score: 0, max: MAX_POINTS, label: 'Instruction Clarity', details: 'No instructions' };
	}

	let points = 0;
	const details: string[] = [];

	// Has code blocks (0-7 points)
	const codeBlockCount = (body.match(/```[\s\S]*?```/g) ?? []).length;
	if (codeBlockCount >= 2) {
		points += 7;
		details.push(`${codeBlockCount} code blocks`);
	} else if (codeBlockCount === 1) {
		points += 4;
		details.push('1 code block');
	}

	// Has numbered steps (0-6 points)
	const numberedSteps = (body.match(/^\d+\.\s+/gm) ?? []).length;
	if (numberedSteps >= 3) {
		points += 6;
		details.push(`${numberedSteps} numbered steps`);
	} else if (numberedSteps >= 1) {
		points += 3;
		details.push(`${numberedSteps} numbered steps`);
	}

	// Has error handling (0-6 points)
	const hasErrorSection = /#{1,3}\s+(?:error|troubleshoot|fail|issue|problem|debug)/i.test(body);
	const hasErrorKeywords =
		/\b(?:error|fail|troubleshoot|if .+ fails|when .+ fails|common issues)\b/i.test(body);
	if (hasErrorSection) {
		points += 6;
		details.push('Error handling section');
	} else if (hasErrorKeywords) {
		points += 3;
		details.push('Error mentions');
	}

	// Body substance (0-6 points)
	const wordCount = body.split(/\s+/).length;
	if (wordCount >= 100) {
		points += 6;
	} else if (wordCount >= 50) {
		points += 4;
	} else if (wordCount >= 20) {
		points += 2;
	}
	details.push(`${wordCount} words`);

	return {
		score: Math.min(points, MAX_POINTS),
		max: MAX_POINTS,
		label: 'Instruction Clarity',
		details: details.join(', '),
	};
}
