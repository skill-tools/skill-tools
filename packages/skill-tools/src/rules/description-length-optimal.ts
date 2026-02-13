import type { Diagnostic, Skill } from '@skill-tools/core';
import type { RuleDefinition } from './types.js';

/**
 * Check that the description length is in the optimal range for agent routing.
 *
 * The spec allows 1-1024 chars, but the sweet spot for agent discovery is 50-300.
 * Too short: agents lack context for matching.
 * Too long: wastes context budget (~100 tokens per skill at metadata tier).
 */
export const descriptionLengthOptimal: RuleDefinition = {
	id: 'description-length-optimal',
	description:
		'Description should be 50-300 characters — enough for routing without wasting context budget',
	defaultSeverity: 'info',

	check(skill: Skill): Diagnostic[] {
		const desc = skill.metadata.description;
		if (!desc) return [];

		const diagnostics: Diagnostic[] = [];
		const len = desc.length;

		if (len < 50) {
			diagnostics.push({
				ruleId: 'description-length-optimal',
				severity: 'info',
				message: `Description is short (${len} chars). Aim for 50-300 chars to give agents enough context for matching`,
				file: skill.filePath,
				line: 1,
				fix: 'Expand to include what the skill does, when to use it, and key trigger keywords',
			});
		} else if (len > 300 && len <= 1024) {
			diagnostics.push({
				ruleId: 'description-length-optimal',
				severity: 'info',
				message: `Description is long (${len} chars). Consider trimming to ~300 chars — each skill costs ~100 tokens at the metadata tier`,
				file: skill.filePath,
				line: 1,
				fix: 'Move detailed explanations to the SKILL.md body. Keep the description focused on routing keywords',
			});
		}

		return diagnostics;
	},
};
