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

	// Content quality (0-6 points): procedural signals + focused density

	// Procedural signals (0-3 points)
	const imperativeVerbs =
		/^(?:Run|Create|Add|Set|Configure|Install|Execute|Build|Check|Verify|Open|Navigate|Click|Enter|Select|Copy|Update|Remove|Delete|Enable|Disable|Start|Stop|Deploy)\b/;
	const lines = body.split('\n');
	let imperativeStarts = 0;
	for (const line of lines) {
		if (imperativeVerbs.test(line.trim())) {
			imperativeStarts++;
		}
	}
	const conditionalPatterns = (body.match(/\b(?:if|when|unless|otherwise)\b/gi) ?? []).length;
	const hasNumberedSteps = numberedSteps > 0;
	const proceduralSignals =
		imperativeStarts + conditionalPatterns + (hasNumberedSteps ? numberedSteps : 0);

	let proceduralPoints = 0;
	if (proceduralSignals >= 5) {
		proceduralPoints = 3;
	} else if (proceduralSignals >= 2) {
		proceduralPoints = 2;
	} else if (proceduralSignals >= 1) {
		proceduralPoints = 1;
	}
	points += proceduralPoints;
	details.push(`${proceduralSignals} procedural signals`);

	// Focused density (0-3 points)
	const wordCount = body.split(/\s+/).length;
	let densityPoints = 0;
	if (wordCount >= 50 && skill.tokenCount < 5000) {
		densityPoints = 3;
	} else if (wordCount >= 50) {
		densityPoints = 1;
	} else if (wordCount >= 20) {
		densityPoints = 2;
	}
	points += densityPoints;
	details.push(`${wordCount} words`);

	return {
		score: Math.min(points, MAX_POINTS),
		max: MAX_POINTS,
		label: 'Instruction Clarity',
		details: details.join(', '),
	};
}
