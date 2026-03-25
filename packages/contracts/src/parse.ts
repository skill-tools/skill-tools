import type { Diagnostic, Skill } from '@skill-tools/core';
import { BrowserSkillContractSchema, type ParsedContractResult } from './types.js';

function makeDiagnostic(
	skill: Skill,
	ruleId: string,
	severity: Diagnostic['severity'],
	message: string,
	fix?: string,
): Diagnostic {
	return {
		ruleId,
		severity,
		message,
		file: skill.filePath,
		line: 1,
		fix,
	};
}

/**
 * Parse the optional `contract` frontmatter block from a SKILL.md file.
 *
 * The core parser preserves `metadata.contract` as raw data; this module is the
 * only place where browser-agent semantics are interpreted.
 */
export function parseContract(skill: Skill): ParsedContractResult {
	const rawContract = skill.metadata.contract;
	if (rawContract === undefined) {
		return {
			ok: true,
			contract: null,
			diagnostics: [],
		};
	}

	const parsed = BrowserSkillContractSchema.safeParse(rawContract);
	if (parsed.success) {
		return {
			ok: true,
			contract: parsed.data,
			diagnostics: [],
		};
	}

	const diagnostics: Diagnostic[] = parsed.error.issues.map(
		(issue: (typeof parsed.error.issues)[number]) =>
			makeDiagnostic(
				skill,
				`contract-${issue.path.length > 0 ? issue.path.join('-') : 'schema'}`,
				'error',
				`Invalid contract: ${issue.message}`,
				'Fix the `contract` frontmatter block to match the browser-agent contract schema',
			),
	);

	return {
		ok: false,
		contract: null,
		diagnostics,
	};
}
