import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { audit, parseAuditAdapter } from '../src/audit.js';

const FIXTURES = resolve(import.meta.dirname, 'fixtures');

describe('audit helper', () => {
	it('parses supported adapters', () => {
		expect(parseAuditAdapter('bap')).toBe('bap');
		expect(parseAuditAdapter('dbar')).toBe('dbar');
		expect(parseAuditAdapter('useid')).toBe('useid');
	});

	it('audits a single skill against evidence on disk', async () => {
		const result = await audit(resolve(FIXTURES, 'contract-skill'), {
			adapter: 'bap',
			evidencePath: resolve(FIXTURES, 'contract-skill/bap-evidence.json'),
		});

		expect(result.valid).toBe(true);
		expect(result.adapter).toBe('bap');
		expect(result.diagnostics).toHaveLength(0);
	});

	it('rejects directories containing more than one skill', async () => {
		await expect(
			audit(FIXTURES, {
				adapter: 'bap',
				evidencePath: resolve(FIXTURES, 'contract-skill/bap-evidence.json'),
			}),
		).rejects.toThrow('exactly one skill');
	});
});
