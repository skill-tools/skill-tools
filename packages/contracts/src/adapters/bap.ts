import { type ContractEvidence, ContractEvidenceSchema } from '../types.js';

/**
 * Normalize BAP evidence exports into the generic contract evidence shape.
 */
export function normalizeBapEvidence(raw: unknown): ContractEvidence {
	const parsed = ContractEvidenceSchema.parse(raw);
	if (parsed.adapter !== 'bap') {
		throw new Error(`Expected bap evidence but got ${parsed.adapter}`);
	}
	return parsed;
}
