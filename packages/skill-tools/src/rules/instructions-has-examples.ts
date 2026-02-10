import type { Diagnostic, Skill } from '@skill-tools/core';
import type { RuleDefinition } from './types.js';

/**
 * Check that skill instructions include at least one concrete example.
 * Examples help agents understand expected input/output patterns.
 */
export const instructionsHasExamples: RuleDefinition = {
	id: 'instructions-has-examples',
	description: 'Skill instructions should include at least one concrete example',
	defaultSeverity: 'info',

	check(skill: Skill): Diagnostic[] {
		const diagnostics: Diagnostic[] = [];
		const body = skill.body;

		// Look for code blocks, numbered steps, or example sections
		const hasCodeBlock = /```[\s\S]*?```/.test(body);
		const hasExampleSection = /^#{1,3}\s+(?:example|usage|demo)/im.test(body);
		const hasInlineCode = /`[^`]+`/.test(body);
		const hasNumberedSteps = /^\d+\.\s+/m.test(body);

		if (!hasCodeBlock && !hasExampleSection && !hasInlineCode && !hasNumberedSteps) {
			diagnostics.push({
				ruleId: 'instructions-has-examples',
				severity: 'info',
				message:
					'Instructions have no examples. Add code blocks, numbered steps, or an Examples section',
				file: skill.filePath,
				fix: 'Add a code block showing expected usage:\n```bash\nskill-tools check ./my-skill/\n```',
			});
		}

		return diagnostics;
	},
};
