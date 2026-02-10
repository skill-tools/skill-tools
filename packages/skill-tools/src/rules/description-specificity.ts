import type { Diagnostic, Skill } from '@skill-tools/core';
import type { RuleDefinition } from './types.js';

/**
 * Generic/vague verbs that don't tell an agent when to trigger the skill.
 */
const GENERIC_VERBS = [
	'manage',
	'handle',
	'process',
	'deal with',
	'work with',
	'do stuff',
	'help with',
	'assist with',
	'take care of',
];

/**
 * Check that the description contains specific, actionable language
 * rather than generic verbs that don't help agent routing.
 */
export const descriptionSpecificity: RuleDefinition = {
	id: 'description-specificity',
	description:
		'Description should contain specific nouns or action verbs, not generic phrases like "manages" or "handles"',
	defaultSeverity: 'warning',

	check(skill: Skill): Diagnostic[] {
		const desc = skill.metadata.description;
		if (!desc) return [];

		const diagnostics: Diagnostic[] = [];
		const lowerDesc = desc.toLowerCase();

		const foundGeneric = GENERIC_VERBS.filter((verb) => lowerDesc.includes(verb));
		if (foundGeneric.length > 0) {
			diagnostics.push({
				ruleId: 'description-specificity',
				severity: 'warning',
				message: `Description uses generic verbs: ${foundGeneric.map((v) => `"${v}"`).join(', ')}. Use specific action verbs instead`,
				file: skill.filePath,
				line: 1,
				fix: 'Replace generic verbs with specific ones. E.g., "Deploy apps to Vercel" instead of "Handle Vercel deployments"',
			});
		}

		return diagnostics;
	},
};
