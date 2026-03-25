import type { Diagnostic, Skill } from '@skill-tools/core';
import { parseContract } from './parse.js';
import type { BrowserSkillContract } from './types.js';

const RISKY_ACTION_PATTERNS = [
	/payment/i,
	/purchase/i,
	/checkout/i,
	/account[-_\s]?settings/i,
	/delete/i,
	/upload/i,
	/submit/i,
	/eval/i,
];

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

function parseAllowedTools(raw: unknown): string[] | null {
	if (typeof raw === 'string') {
		return raw
			.split(',')
			.map((entry) => entry.trim())
			.filter(Boolean);
	}

	if (Array.isArray(raw)) {
		return raw
			.filter((entry): entry is string => typeof entry === 'string')
			.map((entry) => entry.trim());
	}

	return null;
}

function hasRiskyActions(contract: BrowserSkillContract): boolean {
	const actions = contract.runtime.actionClasses ?? [];
	return actions.some((action: string) =>
		RISKY_ACTION_PATTERNS.some((pattern) => pattern.test(action)),
	);
}

function validateRiskyActions(skill: Skill, contract: BrowserSkillContract): Diagnostic[] {
	if (!hasRiskyActions(contract)) return [];
	if (contract.runtime.approval?.policy && contract.runtime.approval.requiredFor?.length) return [];

	return [
		makeDiagnostic(
			skill,
			'contract-risky-actions-approval',
			'warning',
			'Risky runtime action classes are declared without an approval policy and explicit requiredFor coverage',
			'Add runtime.approval with a policy and requiredFor entries for destructive or irreversible actions',
		),
	];
}

function validateProvenanceArtifacts(skill: Skill, contract: BrowserSkillContract): Diagnostic[] {
	const provenanceClaims =
		(contract.provenance.formats?.length ?? 0) > 0 ||
		contract.provenance.replay?.supported === true;
	if (!provenanceClaims || contract.runtime.artifacts) return [];

	return [
		makeDiagnostic(
			skill,
			'contract-provenance-artifacts',
			'warning',
			'Provenance or replay capabilities are declared without a runtime artifact policy',
			'Add runtime.artifacts describing outputs, sensitivity, retention, and redaction behavior',
		),
	];
}

function validateGroundingAbstention(skill: Skill, contract: BrowserSkillContract): Diagnostic[] {
	const hasGroundingClaims =
		contract.grounding.observation !== undefined || contract.grounding.identity !== undefined;
	if (!hasGroundingClaims || contract.grounding.abstention) return [];

	return [
		makeDiagnostic(
			skill,
			'contract-grounding-abstention',
			'warning',
			'Grounding behavior is declared without abstention semantics for ambiguity or low confidence',
			'Add grounding.abstention with supported, ambiguityPolicy, reasons, and confidenceThreshold',
		),
	];
}

function validateAllowedTools(skill: Skill, contract: BrowserSkillContract): Diagnostic[] {
	const allowedTools = parseAllowedTools(skill.metadata['allowed-tools']);
	if (!allowedTools || allowedTools.length === 0) return [];

	const declaredTools = new Set(contract.runtime.tools);
	const mismatched = allowedTools.filter((tool) => !declaredTools.has(tool));
	if (mismatched.length === 0) return [];

	return [
		makeDiagnostic(
			skill,
			'contract-allowed-tools-mismatch',
			'warning',
			`allowed-tools declares values not present in contract.runtime.tools: ${mismatched.join(', ')}`,
			'Align allowed-tools with contract.runtime.tools, or remove tool names that are not part of the declared contract surface',
		),
	];
}

/**
 * Run static validation checks for the optional browser-agent contract block.
 */
export function validateContract(skill: Skill): Diagnostic[] {
	const parsed = parseContract(skill);
	if (!parsed.ok || !parsed.contract) {
		return [...parsed.diagnostics];
	}

	return [
		...validateRiskyActions(skill, parsed.contract),
		...validateProvenanceArtifacts(skill, parsed.contract),
		...validateGroundingAbstention(skill, parsed.contract),
		...validateAllowedTools(skill, parsed.contract),
	];
}
