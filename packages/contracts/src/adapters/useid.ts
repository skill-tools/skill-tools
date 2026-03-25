import { type ContractEvidence, ContractEvidenceSchema } from '../types.js';

const DEFAULT_THRESHOLD = 0.85;
const DEFAULT_REASONS = ['binding_mismatch', 'no_candidates', 'below_threshold', 'ambiguous_match'];

/**
 * Normalize uSEID signature/resolve exports into the generic contract evidence shape.
 */
export function normalizeUseidEvidence(raw: unknown): ContractEvidence {
	const normalized = ContractEvidenceSchema.safeParse(raw);
	if (normalized.success) {
		if (normalized.data.adapter !== 'useid') {
			throw new Error(`Expected useid evidence but got ${normalized.data.adapter}`);
		}
		return normalized.data;
	}

	if (typeof raw !== 'object' || raw === null) {
		throw new Error('uSEID evidence must be an object');
	}

	const obj = raw as Record<string, unknown>;
	const config = obj.config as Record<string, unknown> | undefined;

	return ContractEvidenceSchema.parse({
		adapter: 'useid',
		version: 1,
		grounding: {
			observationModels: ['dom-snapshot', 'accessibility-tree'],
			identityMechanisms: ['semantic', 'structural', 'spatial'],
			stableRefs: false,
			abstentionSupported: true,
			ambiguityPolicy: 'abstain',
			confidenceThreshold:
				typeof config?.threshold === 'number' ? config.threshold : DEFAULT_THRESHOLD,
			abstentionReasons: DEFAULT_REASONS,
		},
	});
}
