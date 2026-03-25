import { resolve } from 'node:path';
import { parseSkill } from '@skill-tools/core';
import { describe, expect, it } from 'vitest';
import { normalizeBapEvidence } from '../src/adapters/bap.js';
import { normalizeDbarEvidence } from '../src/adapters/dbar.js';
import { normalizeUseidEvidence } from '../src/adapters/useid.js';
import { auditContract } from '../src/audit.js';

const FIXTURES = resolve(import.meta.dirname, 'fixtures');

describe('contract evidence adapters', () => {
	it('normalizes raw DBAR evidence into provenance evidence', () => {
		const evidence = normalizeDbarEvidence({
			manifest: {
				capsuleProfile: 'replay',
				steps: [
					{
						artifacts: {
							domSnapshot: 'snapshots/0/dom.json',
							accessibilityYaml: 'snapshots/0/accessibility.json',
							screenshot: 'snapshots/0/screenshot.png',
							traceSegment: 'traces/0.json',
						},
					},
				],
			},
			validation: { valid: true },
			replay: { success: true, replaySuccessRate: 1 },
		});

		expect(evidence.adapter).toBe('dbar');
		expect(evidence.provenance?.replaySupported).toBe(true);
		expect(evidence.provenance?.determinism).toBe('strict');
		expect(evidence.runtime?.artifacts).toContain('trace-segment');
	});

	it('normalizes raw uSEID evidence into grounding evidence', () => {
		const evidence = normalizeUseidEvidence({
			signature: { hash: 'abc123' },
			resolution: { resolved: false, abstentionReason: 'ambiguous_match' },
			config: { threshold: 0.9 },
		});

		expect(evidence.adapter).toBe('useid');
		expect(evidence.grounding?.abstentionSupported).toBe(true);
		expect(evidence.grounding?.confidenceThreshold).toBe(0.9);
		expect(evidence.grounding?.ambiguityPolicy).toBe('abstain');
	});

	it('rejects cross-adapter evidence in BAP normalizer', () => {
		expect(() =>
			normalizeBapEvidence({
				adapter: 'dbar',
				version: 1,
				runtime: { tools: ['navigate'] },
			}),
		).toThrow('Expected bap evidence but got dbar');
	});

	it('rejects cross-adapter evidence in DBAR normalizer', () => {
		expect(() =>
			normalizeDbarEvidence({
				adapter: 'bap',
				version: 1,
				runtime: { tools: ['navigate'] },
			}),
		).toThrow('Expected dbar evidence but got bap');
	});

	it('rejects cross-adapter evidence in uSEID normalizer', () => {
		expect(() =>
			normalizeUseidEvidence({
				adapter: 'bap',
				version: 1,
				runtime: { tools: ['navigate'] },
			}),
		).toThrow('Expected useid evidence but got bap');
	});

	it('degrades DBAR replay failure to none determinism', () => {
		const evidence = normalizeDbarEvidence({
			manifest: { capsuleProfile: 'replay', steps: [] },
			validation: { valid: true },
			replay: { success: false, replaySuccessRate: 0 },
		});

		expect(evidence.provenance?.determinism).toBe('none');
	});
});

describe('auditContract', () => {
	it('passes when BAP evidence stays inside the declared contract', async () => {
		const parsedSkill = await parseSkill(resolve(FIXTURES, 'valid-browser-contract/SKILL.md'));
		expect(parsedSkill.ok).toBe(true);
		if (!parsedSkill.ok) return;

		const evidence = normalizeBapEvidence({
			adapter: 'bap',
			version: 1,
			runtime: {
				interfaces: ['cli'],
				tools: ['navigate', 'observe', 'act', 'extract'],
				actions: ['navigate', 'observe', 'extract'],
				domains: ['example.com'],
				artifacts: ['trace-ndjson', 'screenshot'],
			},
			provenance: {
				formats: ['bap-contract-evidence', 'trace-ndjson'],
				replaySupported: true,
				determinism: 'best-effort',
				validator: 'bap trace --export-evidence',
			},
			grounding: {
				observationModels: ['interactive-elements', 'accessibility-tree'],
				identityMechanisms: ['stable-ref', 'role-name'],
				stableRefs: true,
				abstentionSupported: true,
				ambiguityPolicy: 'abstain',
			},
		});

		const result = auditContract(parsedSkill.skill, evidence);
		expect(result.valid).toBe(true);
		expect(result.diagnostics).toHaveLength(0);
	});

	it('warns when observed BAP evidence exceeds the declared contract', async () => {
		const parsedSkill = await parseSkill(resolve(FIXTURES, 'valid-browser-contract/SKILL.md'));
		expect(parsedSkill.ok).toBe(true);
		if (!parsedSkill.ok) return;

		const evidence = normalizeBapEvidence({
			adapter: 'bap',
			version: 1,
			runtime: {
				tools: ['navigate', 'observe', 'eval'],
				actions: ['navigate', 'delete'],
				domains: ['evil.example.com'],
				artifacts: ['trace-ndjson', 'video'],
			},
			provenance: {
				formats: ['trace-zip'],
				replaySupported: false,
				determinism: 'none',
			},
			grounding: {
				observationModels: ['dom-snapshot'],
				identityMechanisms: ['css-selector'],
				stableRefs: false,
				abstentionSupported: false,
				ambiguityPolicy: 'choose-best',
			},
		});

		const result = auditContract(parsedSkill.skill, evidence);
		expect(result.warningCount).toBeGreaterThanOrEqual(5);
		expect(result.diagnostics.some((diag) => diag.ruleId === 'contract-audit-tools')).toBe(true);
		expect(result.diagnostics.some((diag) => diag.ruleId === 'contract-audit-domains')).toBe(true);
		expect(result.diagnostics.some((diag) => diag.ruleId === 'contract-audit-determinism')).toBe(
			true,
		);
	});

	it('warns on missing evidence sections (fail-closed)', async () => {
		const parsedSkill = await parseSkill(resolve(FIXTURES, 'valid-browser-contract/SKILL.md'));
		expect(parsedSkill.ok).toBe(true);
		if (!parsedSkill.ok) return;

		// Evidence with no runtime, no provenance, no grounding
		const evidence = normalizeBapEvidence({
			adapter: 'bap',
			version: 1,
		});

		const result = auditContract(parsedSkill.skill, evidence);
		expect(result.diagnostics.some((d) => d.ruleId === 'contract-missing-runtime-evidence')).toBe(
			true,
		);
		expect(
			result.diagnostics.some((d) => d.ruleId === 'contract-missing-provenance-evidence'),
		).toBe(true);
		expect(result.diagnostics.some((d) => d.ruleId === 'contract-missing-grounding-evidence')).toBe(
			true,
		);
	});

	it('normalizes domain origins before comparison', async () => {
		const parsedSkill = await parseSkill(resolve(FIXTURES, 'valid-browser-contract/SKILL.md'));
		expect(parsedSkill.ok).toBe(true);
		if (!parsedSkill.ok) return;

		// The fixture contract allows example.com and docs.example.com
		// Evidence provides https://example.com (full origin) — should match
		const evidence = normalizeBapEvidence({
			adapter: 'bap',
			version: 1,
			runtime: {
				tools: ['navigate', 'observe'],
				actions: ['navigate'],
				domains: ['https://example.com', 'https://docs.example.com:443'],
				artifacts: ['trace-ndjson'],
			},
			provenance: {
				formats: ['bap-contract-evidence'],
				replaySupported: true,
				determinism: 'best-effort',
			},
			grounding: {
				observationModels: ['interactive-elements'],
				identityMechanisms: ['stable-ref'],
				stableRefs: true,
				abstentionSupported: true,
				ambiguityPolicy: 'abstain',
			},
		});

		const result = auditContract(parsedSkill.skill, evidence);
		// Should NOT have domain violation — https://example.com normalizes to example.com
		expect(result.diagnostics.some((d) => d.ruleId === 'contract-audit-domains')).toBe(false);
	});
});
