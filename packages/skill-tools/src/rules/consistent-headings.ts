import type { Diagnostic, Skill } from '@skill-tools/core';
import type { RuleDefinition } from './types.js';

/**
 * Check that heading hierarchy is consistent (no skipping levels).
 * E.g., going from H1 directly to H4 is a problem.
 */
export const consistentHeadings: RuleDefinition = {
	id: 'consistent-headings',
	description: 'Headings should follow a consistent hierarchy without skipping levels',
	defaultSeverity: 'info',

	check(skill: Skill): Diagnostic[] {
		const diagnostics: Diagnostic[] = [];
		const sections = skill.sections;

		for (let i = 1; i < sections.length; i++) {
			const prev = sections[i - 1]!;
			const curr = sections[i]!;

			// A heading can go deeper by at most 1 level from its predecessor
			if (curr.depth > prev.depth + 1) {
				diagnostics.push({
					ruleId: 'consistent-headings',
					severity: 'info',
					message: `Heading "${curr.heading}" (H${curr.depth}) skips levels from "${prev.heading}" (H${prev.depth})`,
					file: skill.filePath,
					line: curr.line,
					fix: `Change to H${prev.depth + 1} for consistent hierarchy`,
				});
			}
		}

		return diagnostics;
	},
};
