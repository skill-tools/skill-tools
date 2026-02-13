import type { Diagnostic, Skill } from '@skill-tools/core';
import type { RuleDefinition } from './types.js';

/**
 * Check that the description contains trigger keywords — words a user
 * would naturally type that should cause the agent to invoke this skill.
 *
 * The spec says: "Check the description includes keywords users would naturally say"
 */
export const descriptionTriggerKeywords: RuleDefinition = {
	id: 'description-trigger-keywords',
	description:
		'Description should contain words that a user would naturally type to trigger this skill',
	defaultSeverity: 'warning',

	check(skill: Skill): Diagnostic[] {
		const desc = skill.metadata.description;
		if (!desc) return [];

		const diagnostics: Diagnostic[] = [];

		// A good description should include "Use when" or "Use for" to specify trigger conditions
		const hasTriggerPhrase =
			/\buse when\b|\buse for\b|\buse this\b|\binvoke when\b|\btrigger when\b/i.test(desc);

		// Alternatively, check for imperative verbs that describe what the skill does
		const hasActionVerb =
			/\b(deploy|test|build|run|create|generate|analyze|review|format|lint|fix|check|commit|push|pull|fetch|install|configure|setup|search|find|list|delete|update|migrate|convert|export|import)\b/i.test(
				desc,
			);

		if (!hasTriggerPhrase && !hasActionVerb) {
			diagnostics.push({
				ruleId: 'description-trigger-keywords',
				severity: 'warning',
				message:
					'Description has no trigger keywords — agents won\'t know when to invoke this skill. Add "Use when..." or action verbs like deploy, test, build, create',
				file: skill.filePath,
				line: 1,
				fix: 'Example: "Deploy apps to Vercel. Use when the user wants to publish or ship a web app."',
			});
		}

		return diagnostics;
	},
};
