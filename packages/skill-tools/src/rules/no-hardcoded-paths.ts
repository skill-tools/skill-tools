import type { Diagnostic, Skill } from '@skill-tools/core';
import type { RuleDefinition } from './types.js';

/**
 * Pattern for common hardcoded absolute paths.
 * Matches /Users/..., /home/..., C:\..., etc.
 */
const HARDCODED_PATH_PATTERN =
	/(?:\/Users\/\w+|\/home\/\w+|[A-Z]:\\\\?Users\\\\?\w+|\/var\/|\/tmp\/\w+)/;

/**
 * Check for hardcoded filesystem paths that won't work on other machines.
 */
export const noHardcodedPaths: RuleDefinition = {
	id: 'no-hardcoded-paths',
	description: 'Flag absolute filesystem paths that are machine-specific',
	defaultSeverity: 'error',

	check(skill: Skill): Diagnostic[] {
		const diagnostics: Diagnostic[] = [];
		const lines = skill.body.split('\n');

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]!;

			// Skip lines inside code fences that are clearly examples showing path patterns
			// But still flag hardcoded paths even in code blocks
			if (HARDCODED_PATH_PATTERN.test(line)) {
				const match = HARDCODED_PATH_PATTERN.exec(line);
				diagnostics.push({
					ruleId: 'no-hardcoded-paths',
					severity: 'error',
					message: `Hardcoded path found: "${match?.[0]}". Use environment variables or relative paths`,
					file: skill.filePath,
					line: i + 1,
					fix: 'Replace with $HOME, relative paths, or environment variables',
				});
			}
		}

		return diagnostics;
	},
};
