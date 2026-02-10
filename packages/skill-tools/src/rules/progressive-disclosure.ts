import type { Diagnostic, Skill } from '@skill-tools/core';
import type { RuleDefinition } from './types.js';

const DEFAULT_MAX_LINES = 500;

/**
 * Check that large skills use progressive disclosure — moving detailed
 * content to references/ or scripts/ to keep the main SKILL.md lean.
 *
 * The spec recommends: "Keep SKILL.md under 500 lines"
 */
export const progressiveDisclosure: RuleDefinition = {
	id: 'progressive-disclosure',
	description: 'Large SKILL.md files should use references/ or scripts/ to keep the main file lean',
	defaultSeverity: 'warning',

	check(skill: Skill): Diagnostic[] {
		const diagnostics: Diagnostic[] = [];

		if (skill.lineCount > DEFAULT_MAX_LINES) {
			const hasReferences = skill.fileReferences.some((r) => r.path.startsWith('references/'));
			const hasScripts = skill.fileReferences.some((r) => r.path.startsWith('scripts/'));

			if (!hasReferences && !hasScripts) {
				diagnostics.push({
					ruleId: 'progressive-disclosure',
					severity: 'warning',
					message: `SKILL.md is ${skill.lineCount} lines (recommended: <${DEFAULT_MAX_LINES}). Move detailed content to references/ or scripts/`,
					file: skill.filePath,
					fix: 'Create a references/ directory and move detailed API docs, examples, or reference tables there. Link from SKILL.md: [See API reference](references/api.md)',
				});
			}
		}

		return diagnostics;
	},
};
