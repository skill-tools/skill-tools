import type { Diagnostic, Skill } from '@skill-tools/core';
import type { RuleDefinition } from './types.js';

/**
 * Check that skill instructions include at least one working example.
 * SkillsBench finding: "concise, stepwise guidance with at least one working example"
 * is the #1 recommendation for effective skills.
 */
export const instructionsHasExamples: RuleDefinition = {
	id: 'instructions-has-examples',
	description: 'Skill instructions should include at least one working example',
	defaultSeverity: 'warning',

	check(skill: Skill): Diagnostic[] {
		const diagnostics: Diagnostic[] = [];
		const body = skill.body;

		// Only accept: fenced code block OR an example/usage/demo section heading
		const hasCodeBlock = /```[\s\S]*?```/.test(body);
		const hasExampleSection = /^#{1,3}\s+(?:example|usage|demo)/im.test(body);

		if (!hasCodeBlock && !hasExampleSection) {
			diagnostics.push({
				ruleId: 'instructions-has-examples',
				severity: 'warning',
				message:
					'Instructions have no working examples. Add a fenced code block or an ## Example section with concrete usage',
				file: skill.filePath,
				fix: 'Add a fenced code block showing expected usage:\n```bash\nskill-tools check ./my-skill/\n```',
			});
		}

		return diagnostics;
	},
};
