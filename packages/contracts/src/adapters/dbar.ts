import { type ContractEvidence, ContractEvidenceSchema } from '../types.js';

const DEFAULT_ABSTRACTION = {
	adapter: 'dbar' as const,
	version: 1 as const,
};

/**
 * Normalize DBAR capsule/replay evidence into the generic contract evidence shape.
 *
 * Accepted inputs:
 * - already-normalized audit evidence
 * - `{ manifest, validation, replay }` shaped DBAR exports
 */
export function normalizeDbarEvidence(raw: unknown): ContractEvidence {
	const normalized = ContractEvidenceSchema.safeParse(raw);
	if (normalized.success) {
		if (normalized.data.adapter !== 'dbar') {
			throw new Error(`Expected dbar evidence but got ${normalized.data.adapter}`);
		}
		return normalized.data;
	}

	if (typeof raw !== 'object' || raw === null) {
		throw new Error('DBAR evidence must be an object');
	}

	const obj = raw as Record<string, unknown>;
	const manifest = obj.manifest as Record<string, unknown> | undefined;
	const validation = obj.validation as Record<string, unknown> | undefined;
	const replay = obj.replay as Record<string, unknown> | undefined;
	const steps = Array.isArray(manifest?.steps) ? manifest.steps : [];

	const artifactKinds = new Set<string>();
	for (const step of steps) {
		const artifacts = (step as Record<string, unknown>).artifacts as
			| Record<string, unknown>
			| undefined;
		if (!artifacts) continue;
		if (typeof artifacts.domSnapshot === 'string') artifactKinds.add('dom-snapshot');
		if (typeof artifacts.accessibilityYaml === 'string') artifactKinds.add('accessibility-tree');
		if (typeof artifacts.screenshot === 'string') artifactKinds.add('screenshot');
		if (typeof artifacts.traceSegment === 'string') artifactKinds.add('trace-segment');
	}

	const replaySuccessRate =
		typeof replay?.replaySuccessRate === 'number' ? replay.replaySuccessRate : undefined;
	let determinism: 'none' | 'best-effort' | 'strict' = 'best-effort';
	if (validation?.valid === true && replay?.success === true && replaySuccessRate === 1) {
		determinism = 'strict';
	} else if (replay?.success === false) {
		determinism = 'none';
	}

	return ContractEvidenceSchema.parse({
		...DEFAULT_ABSTRACTION,
		runtime: {
			artifacts: Array.from(artifactKinds),
		},
		provenance: {
			formats: ['dbar-capsule'],
			replaySupported: manifest?.capsuleProfile === 'replay',
			determinism,
			validator:
				typeof replay?.success === 'boolean' ? 'DBAR.validate + DBAR.replay' : 'DBAR.validate',
		},
	});
}
