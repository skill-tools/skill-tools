import type { Diagnostic, Skill } from '@skill-tools/core';
import { parseContract } from './parse.js';
import type {
	AuditAdapter,
	BrowserSkillContract,
	ContractAuditResult,
	ContractEvidence,
	DeterminismLevel,
} from './types.js';

const DETERMINISM_ORDER = {
	none: 0,
	'best-effort': 1,
	strict: 2,
} as const;

function compareDeterminism(expected: DeterminismLevel, actual: DeterminismLevel): number {
	return DETERMINISM_ORDER[actual] - DETERMINISM_ORDER[expected];
}

function makeDiagnostic(
	skill: Skill,
	ruleId: string,
	severity: Diagnostic['severity'],
	message: string,
): Diagnostic {
	return {
		ruleId,
		severity,
		message,
		file: skill.filePath,
		line: 1,
	};
}

function normalizeToHostname(value: string): string {
	if (value.includes('://')) {
		try {
			return new URL(value).hostname;
		} catch {
			return value;
		}
	}
	// Strip port from bare hostname
	const colonIdx = value.indexOf(':');
	return colonIdx >= 0 ? value.slice(0, colonIdx) : value;
}

function auditMissingEvidence(
	skill: Skill,
	contract: BrowserSkillContract,
	evidence: ContractEvidence,
): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];

	// runtime is always required by schema, so evidence.runtime is always expected
	if (!evidence.runtime) {
		diagnostics.push(
			makeDiagnostic(
				skill,
				'contract-missing-runtime-evidence',
				'warning',
				'Contract declares runtime expectations but no runtime evidence was provided',
			),
		);
	}

	// provenance: expected when contract has formats or replay
	const hasProvenanceExpectations =
		(contract.provenance?.formats && contract.provenance.formats.length > 0) ||
		contract.provenance?.replay != null;
	if (hasProvenanceExpectations && !evidence.provenance) {
		diagnostics.push(
			makeDiagnostic(
				skill,
				'contract-missing-provenance-evidence',
				'warning',
				'Contract declares provenance expectations but no provenance evidence was provided',
			),
		);
	}

	// grounding: expected when any grounding sub-section exists
	const hasGroundingExpectations =
		contract.grounding?.observation != null ||
		contract.grounding?.identity != null ||
		contract.grounding?.abstention != null;
	if (hasGroundingExpectations && !evidence.grounding) {
		diagnostics.push(
			makeDiagnostic(
				skill,
				'contract-missing-grounding-evidence',
				'info',
				'Contract declares grounding expectations but no grounding evidence was provided',
			),
		);
	}

	return diagnostics;
}

function missingDeclarations(
	declared: readonly string[] | undefined,
	observed: readonly string[] | undefined,
): string[] {
	if (!declared || !observed) return [];
	const allowed = new Set(declared);
	return observed.filter((entry) => !allowed.has(entry));
}

function auditRuntime(
	skill: Skill,
	contract: BrowserSkillContract,
	evidence: ContractEvidence,
): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];
	const runtimeEvidence = evidence.runtime;

	const unexpectedTools = missingDeclarations(contract.runtime.tools, runtimeEvidence?.tools);
	if (unexpectedTools.length > 0) {
		diagnostics.push(
			makeDiagnostic(
				skill,
				'contract-audit-tools',
				'warning',
				`Observed tools were not declared in contract.runtime.tools: ${unexpectedTools.join(', ')}`,
			),
		);
	}

	const unexpectedActions = missingDeclarations(
		contract.runtime.actionClasses,
		runtimeEvidence?.actions,
	);
	if (unexpectedActions.length > 0) {
		diagnostics.push(
			makeDiagnostic(
				skill,
				'contract-audit-actions',
				'warning',
				`Observed actions were not declared in contract.runtime.actionClasses: ${unexpectedActions.join(', ')}`,
			),
		);
	}

	const allowlist = contract.runtime.domainPolicy?.allow;
	if (allowlist && allowlist.length > 0 && runtimeEvidence?.domains) {
		const allowedDomains = new Set(allowlist.map(normalizeToHostname));
		const unexpectedDomains = runtimeEvidence.domains.filter(
			(domain: string) => !allowedDomains.has(normalizeToHostname(domain)),
		);
		if (unexpectedDomains.length > 0) {
			diagnostics.push(
				makeDiagnostic(
					skill,
					'contract-audit-domains',
					'warning',
					`Observed domains fall outside the declared allowlist: ${unexpectedDomains.join(', ')}`,
				),
			);
		}
	}

	const expectedArtifacts = contract.runtime.artifacts?.outputs;
	const unexpectedArtifacts = missingDeclarations(expectedArtifacts, runtimeEvidence?.artifacts);
	if (unexpectedArtifacts.length > 0) {
		diagnostics.push(
			makeDiagnostic(
				skill,
				'contract-audit-artifacts',
				'warning',
				`Observed runtime artifacts were not declared in contract.runtime.artifacts.outputs: ${unexpectedArtifacts.join(', ')}`,
			),
		);
	}

	return diagnostics;
}

function auditProvenance(
	skill: Skill,
	contract: BrowserSkillContract,
	evidence: ContractEvidence,
): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];
	const provenanceEvidence = evidence.provenance;

	const unexpectedFormats = missingDeclarations(
		contract.provenance.formats,
		provenanceEvidence?.formats,
	);
	if (unexpectedFormats.length > 0) {
		diagnostics.push(
			makeDiagnostic(
				skill,
				'contract-audit-provenance-formats',
				'warning',
				`Observed provenance formats were not declared in contract.provenance.formats: ${unexpectedFormats.join(', ')}`,
			),
		);
	}

	if (
		contract.provenance.replay?.supported === true &&
		provenanceEvidence?.replaySupported === false
	) {
		diagnostics.push(
			makeDiagnostic(
				skill,
				'contract-audit-replay-support',
				'warning',
				'The contract declares replay support, but the observed evidence does not support replay',
			),
		);
	}

	if (contract.provenance.replay?.determinism && provenanceEvidence?.determinism) {
		if (
			compareDeterminism(contract.provenance.replay.determinism, provenanceEvidence.determinism) < 0
		) {
			diagnostics.push(
				makeDiagnostic(
					skill,
					'contract-audit-determinism',
					'warning',
					`The contract declares ${contract.provenance.replay.determinism} determinism, but evidence only supports ${provenanceEvidence.determinism}`,
				),
			);
		}
	}

	return diagnostics;
}

function auditGrounding(
	skill: Skill,
	contract: BrowserSkillContract,
	evidence: ContractEvidence,
): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];
	const groundingEvidence = evidence.grounding;

	const unexpectedObservationModels = missingDeclarations(
		contract.grounding.observation?.models,
		groundingEvidence?.observationModels,
	);
	if (unexpectedObservationModels.length > 0) {
		diagnostics.push(
			makeDiagnostic(
				skill,
				'contract-audit-observation-models',
				'warning',
				`Observed grounding models were not declared in contract.grounding.observation.models: ${unexpectedObservationModels.join(', ')}`,
			),
		);
	}

	const unexpectedIdentityMechanisms = missingDeclarations(
		contract.grounding.identity?.mechanisms,
		groundingEvidence?.identityMechanisms,
	);
	if (unexpectedIdentityMechanisms.length > 0) {
		diagnostics.push(
			makeDiagnostic(
				skill,
				'contract-audit-identity-mechanisms',
				'warning',
				`Observed identity mechanisms were not declared in contract.grounding.identity.mechanisms: ${unexpectedIdentityMechanisms.join(', ')}`,
			),
		);
	}

	if (contract.grounding.identity?.stableRefs === true && groundingEvidence?.stableRefs === false) {
		diagnostics.push(
			makeDiagnostic(
				skill,
				'contract-audit-stable-refs',
				'warning',
				'The contract declares stable refs, but the observed evidence does not provide stable refs',
			),
		);
	}

	if (
		contract.grounding.abstention?.supported === true &&
		groundingEvidence?.abstentionSupported === false
	) {
		diagnostics.push(
			makeDiagnostic(
				skill,
				'contract-audit-abstention-support',
				'warning',
				'The contract declares abstention support, but the observed evidence does not show abstention behavior',
			),
		);
	}

	if (
		contract.grounding.abstention?.ambiguityPolicy &&
		groundingEvidence?.ambiguityPolicy &&
		contract.grounding.abstention.ambiguityPolicy !== groundingEvidence.ambiguityPolicy
	) {
		diagnostics.push(
			makeDiagnostic(
				skill,
				'contract-audit-ambiguity-policy',
				'warning',
				`Declared ambiguity policy (${contract.grounding.abstention.ambiguityPolicy}) does not match observed policy (${groundingEvidence.ambiguityPolicy})`,
			),
		);
	}

	if (
		typeof contract.grounding.abstention?.confidenceThreshold === 'number' &&
		typeof groundingEvidence?.confidenceThreshold === 'number' &&
		Math.abs(
			contract.grounding.abstention.confidenceThreshold - groundingEvidence.confidenceThreshold,
		) > 0.0001
	) {
		diagnostics.push(
			makeDiagnostic(
				skill,
				'contract-audit-confidence-threshold',
				'warning',
				`Declared confidence threshold (${contract.grounding.abstention.confidenceThreshold}) does not match observed threshold (${groundingEvidence.confidenceThreshold})`,
			),
		);
	}

	return diagnostics;
}

/**
 * Compare a declared browser-agent contract against normalized evidence.
 */
export function auditContract(skill: Skill, evidence: ContractEvidence): ContractAuditResult {
	const parsed = parseContract(skill);
	const name = skill.metadata.name ?? skill.dirPath.split('/').at(-1) ?? 'unknown';
	if (!parsed.ok || !parsed.contract) {
		const diagnostics = parsed.diagnostics.length
			? parsed.diagnostics
			: [
					makeDiagnostic(
						skill,
						'contract-missing',
						'error',
						'Cannot audit a skill without a valid browser-agent contract',
					),
				];
		return {
			filePath: skill.filePath,
			name,
			adapter: evidence.adapter,
			valid: false,
			contract: null,
			evidence,
			diagnostics,
			errorCount: diagnostics.filter((d) => d.severity === 'error').length,
			warningCount: diagnostics.filter((d) => d.severity === 'warning').length,
			infoCount: diagnostics.filter((d) => d.severity === 'info').length,
		};
	}

	const diagnostics = [
		...auditMissingEvidence(skill, parsed.contract, evidence),
		...auditRuntime(skill, parsed.contract, evidence),
		...auditProvenance(skill, parsed.contract, evidence),
		...auditGrounding(skill, parsed.contract, evidence),
	];

	return {
		filePath: skill.filePath,
		name,
		adapter: evidence.adapter,
		valid: diagnostics.every((diag) => diag.severity !== 'error'),
		contract: parsed.contract,
		evidence,
		diagnostics,
		errorCount: diagnostics.filter((d) => d.severity === 'error').length,
		warningCount: diagnostics.filter((d) => d.severity === 'warning').length,
		infoCount: diagnostics.filter((d) => d.severity === 'info').length,
	};
}

export function assertAdapter(adapter: string): adapter is AuditAdapter {
	return adapter === 'bap' || adapter === 'dbar' || adapter === 'useid';
}
