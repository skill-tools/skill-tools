import type { Diagnostic, Skill } from '@skill-tools/core';
import type { RuleDefinition } from './types.js';

/**
 * Check that instructions include error handling guidance.
 * Skills that tell agents what to do when things fail are more robust.
 */
export const instructionsHasErrorHandling: RuleDefinition = {
	id: 'instructions-has-error-handling',
	description: 'Instructions should mention what to do when things fail',
	defaultSeverity: 'info',

	check(skill: Skill): Diagnostic[] {
		const diagnostics: Diagnostic[] = [];
		const body = skill.body.toLowerCase();

		const hasErrorSection =
			/#{1,3}\s+(?:error|troubleshoot|fail|issue|problem|debug)/i.test(skill.body);

		const hasErrorKeywords =
			/\b(?:error|fail|troubleshoot|if .+ fails|when .+ fails|common issues|known issues)\b/.test(
				body,
			);

		if (!hasErrorSection && !hasErrorKeywords) {
			diagnostics.push({
				ruleId: 'instructions-has-error-handling',
				severity: 'info',
				message:
					'Instructions have no error handling guidance. Add a section about common failures',
				file: skill.filePath,
				fix: 'Add an "## Error Handling" section describing common failures and how to resolve them',
			});
		}

		return diagnostics;
	},
};
