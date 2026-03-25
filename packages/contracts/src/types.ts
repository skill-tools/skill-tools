import type { Diagnostic } from '@skill-tools/core';
import { z } from 'zod';

export const AuditAdapterSchema = z.enum(['bap', 'dbar', 'useid']);
export type AuditAdapter = z.infer<typeof AuditAdapterSchema>;

export const DeterminismLevelSchema = z.enum(['none', 'best-effort', 'strict']);
export type DeterminismLevel = z.infer<typeof DeterminismLevelSchema>;

export const AmbiguityPolicySchema = z.enum(['abstain', 'choose-best']);
export type AmbiguityPolicy = z.infer<typeof AmbiguityPolicySchema>;

export const ArtifactSensitivitySchema = z.enum(['low', 'moderate', 'high']);
export type ArtifactSensitivity = z.infer<typeof ArtifactSensitivitySchema>;

export const ArtifactRetentionSchema = z.enum(['ephemeral', 'session', 'persistent']);
export type ArtifactRetention = z.infer<typeof ArtifactRetentionSchema>;

export const ApprovalPolicySchema = z.enum(['manual', 'session', 'none']);
export type ApprovalPolicy = z.infer<typeof ApprovalPolicySchema>;

export const BrowserRuntimeDomainPolicySchema = z.object({
	mode: z.enum(['allowlist', 'report', 'open']).optional(),
	allow: z.array(z.string().min(1)).optional(),
	deny: z.array(z.string().min(1)).optional(),
});
export type BrowserRuntimeDomainPolicy = z.infer<typeof BrowserRuntimeDomainPolicySchema>;

export const BrowserRuntimeApprovalSchema = z.object({
	policy: ApprovalPolicySchema,
	requiredFor: z.array(z.string().min(1)).optional(),
});
export type BrowserRuntimeApproval = z.infer<typeof BrowserRuntimeApprovalSchema>;

export const BrowserRuntimeArtifactPolicySchema = z.object({
	outputs: z.array(z.string().min(1)).min(1),
	sensitivity: ArtifactSensitivitySchema.optional(),
	retention: ArtifactRetentionSchema.optional(),
	redaction: z.array(z.string().min(1)).optional(),
});
export type BrowserRuntimeArtifactPolicy = z.infer<typeof BrowserRuntimeArtifactPolicySchema>;

export const BrowserRuntimeContractSchema = z.object({
	interfaces: z.array(z.string().min(1)).optional(),
	tools: z.array(z.string().min(1)).min(1),
	actionClasses: z.array(z.string().min(1)).optional(),
	domainPolicy: BrowserRuntimeDomainPolicySchema.optional(),
	approval: BrowserRuntimeApprovalSchema.optional(),
	artifacts: BrowserRuntimeArtifactPolicySchema.optional(),
});
export type BrowserRuntimeContract = z.infer<typeof BrowserRuntimeContractSchema>;

export const BrowserReplayContractSchema = z.object({
	supported: z.boolean(),
	determinism: DeterminismLevelSchema.optional(),
	validator: z.string().min(1).optional(),
});
export type BrowserReplayContract = z.infer<typeof BrowserReplayContractSchema>;

export const BrowserProvenanceContractSchema = z.object({
	formats: z.array(z.string().min(1)).optional(),
	replay: BrowserReplayContractSchema.optional(),
});
export type BrowserProvenanceContract = z.infer<typeof BrowserProvenanceContractSchema>;

export const BrowserObservationContractSchema = z.object({
	models: z.array(z.string().min(1)).min(1),
	selectorRefs: z.array(z.string().min(1)).optional(),
});
export type BrowserObservationContract = z.infer<typeof BrowserObservationContractSchema>;

export const BrowserIdentityContractSchema = z.object({
	mechanisms: z.array(z.string().min(1)).min(1),
	stableRefs: z.boolean().optional(),
});
export type BrowserIdentityContract = z.infer<typeof BrowserIdentityContractSchema>;

export const BrowserAbstentionContractSchema = z.object({
	supported: z.boolean(),
	reasons: z.array(z.string().min(1)).optional(),
	ambiguityPolicy: AmbiguityPolicySchema.optional(),
	confidenceThreshold: z.number().min(0).max(1).optional(),
});
export type BrowserAbstentionContract = z.infer<typeof BrowserAbstentionContractSchema>;

export const BrowserGroundingContractSchema = z.object({
	observation: BrowserObservationContractSchema.optional(),
	identity: BrowserIdentityContractSchema.optional(),
	abstention: BrowserAbstentionContractSchema.optional(),
});
export type BrowserGroundingContract = z.infer<typeof BrowserGroundingContractSchema>;

export const BrowserSkillContractSchema = z.object({
	kind: z.literal('browser-agent'),
	version: z.literal(1),
	runtime: BrowserRuntimeContractSchema,
	provenance: BrowserProvenanceContractSchema,
	grounding: BrowserGroundingContractSchema,
	extensions: z.record(z.unknown()).optional(),
});
export type BrowserSkillContract = z.infer<typeof BrowserSkillContractSchema>;

export const ContractRuntimeEvidenceSchema = z.object({
	interfaces: z.array(z.string().min(1)).optional(),
	tools: z.array(z.string().min(1)).optional(),
	actions: z.array(z.string().min(1)).optional(),
	domains: z.array(z.string().min(1)).optional(),
	artifacts: z.array(z.string().min(1)).optional(),
	approvalsObserved: z.array(z.string().min(1)).optional(),
});
export type ContractRuntimeEvidence = z.infer<typeof ContractRuntimeEvidenceSchema>;

export const ContractProvenanceEvidenceSchema = z.object({
	formats: z.array(z.string().min(1)).optional(),
	replaySupported: z.boolean().optional(),
	determinism: DeterminismLevelSchema.optional(),
	validator: z.string().min(1).optional(),
});
export type ContractProvenanceEvidence = z.infer<typeof ContractProvenanceEvidenceSchema>;

export const ContractGroundingEvidenceSchema = z.object({
	observationModels: z.array(z.string().min(1)).optional(),
	identityMechanisms: z.array(z.string().min(1)).optional(),
	stableRefs: z.boolean().optional(),
	abstentionSupported: z.boolean().optional(),
	ambiguityPolicy: AmbiguityPolicySchema.optional(),
	confidenceThreshold: z.number().min(0).max(1).optional(),
	abstentionReasons: z.array(z.string().min(1)).optional(),
});
export type ContractGroundingEvidence = z.infer<typeof ContractGroundingEvidenceSchema>;

export const ContractEvidenceSchema = z.object({
	adapter: AuditAdapterSchema,
	version: z.literal(1),
	runtime: ContractRuntimeEvidenceSchema.optional(),
	provenance: ContractProvenanceEvidenceSchema.optional(),
	grounding: ContractGroundingEvidenceSchema.optional(),
});
export type ContractEvidence = z.infer<typeof ContractEvidenceSchema>;

export interface ParsedContractResult {
	readonly ok: boolean;
	readonly contract: BrowserSkillContract | null;
	readonly diagnostics: readonly Diagnostic[];
}

export interface ContractAuditResult {
	readonly filePath: string;
	readonly name: string;
	readonly adapter: AuditAdapter;
	readonly valid: boolean;
	readonly contract: BrowserSkillContract | null;
	readonly evidence: ContractEvidence | null;
	readonly diagnostics: readonly Diagnostic[];
	readonly errorCount: number;
	readonly warningCount: number;
	readonly infoCount: number;
}
