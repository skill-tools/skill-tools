import type { Diagnostic, Skill } from '@skill-tools/core';
import type { RuleDefinition } from './types.js';

/**
 * Check that the skill does not have too many top-level sections.
 * SkillsBench finding: 2-3 skill modules are optimal (+18.6pp);
 * 4+ modules are only +5.9pp. Comprehensive documentation style hurts.
 */
export const sectionCountOptimal: RuleDefinition = {
	id: 'section-count-optimal',
	description: 'Skills with fewer top-level sections are more effective',
	defaultSeverity: 'info',

	check(skill: Skill): Diagnostic[] {
		const diagnostics: Diagnostic[] = [];
		const h2Sections = skill.sections.filter((s) => s.depth === 2);

		if (h2Sections.length >= 6) {
			diagnostics.push({
				ruleId: 'section-count-optimal',
				severity: 'info',
				message: `Skill has ${h2Sections.length} top-level sections. Consider consolidating to 5 or fewer — research shows concise skills outperform comprehensive ones`,
				file: skill.filePath,
				fix: 'Merge related sections or move reference content to a references/ directory',
			});
		}

		return diagnostics;
	},
};
