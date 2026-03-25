import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
	type AuditAdapter,
	assertAdapter,
	auditContract,
	type ContractAuditResult,
	type ContractEvidence,
	normalizeBapEvidence,
	normalizeDbarEvidence,
	normalizeUseidEvidence,
} from '@skill-tools/contracts';
import { parseSkill, resolveSkillFiles } from '@skill-tools/core';

export interface AuditOptions {
	readonly adapter: AuditAdapter;
	readonly evidencePath: string;
}

function normalizeEvidence(adapter: AuditAdapter, raw: unknown): ContractEvidence {
	switch (adapter) {
		case 'bap':
			return normalizeBapEvidence(raw);
		case 'dbar':
			return normalizeDbarEvidence(raw);
		case 'useid':
			return normalizeUseidEvidence(raw);
	}
}

/**
 * Resolve a single skill, load evidence from disk, normalize it, and compare it
 * against the declared contract.
 */
export async function audit(path: string, options: AuditOptions): Promise<ContractAuditResult> {
	const locations = await resolveSkillFiles(path);
	if (locations.length === 0) {
		throw new Error(`No SKILL.md files found at: ${path}`);
	}
	if (locations.length > 1) {
		throw new Error('Audit currently supports exactly one skill at a time');
	}

	const location = locations[0]!;
	const parseResult = await parseSkill(location.skillFile);
	if (!parseResult.ok) {
		throw new Error(
			`Failed to parse ${location.skillFile}: ${parseResult.diagnostics.map((d) => d.message).join(', ')}`,
		);
	}

	const raw = JSON.parse(await readFile(resolve(options.evidencePath), 'utf-8')) as unknown;
	const evidence = normalizeEvidence(options.adapter, raw);
	return auditContract(parseResult.skill, evidence);
}

export function parseAuditAdapter(value: string): AuditAdapter {
	if (!assertAdapter(value)) {
		throw new Error(`Unsupported adapter "${value}". Expected one of: bap, dbar, useid`);
	}
	return value;
}
