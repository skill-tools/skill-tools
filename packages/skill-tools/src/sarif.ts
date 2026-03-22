import { createRequire } from 'node:module';
import type { Diagnostic } from '@skill-tools/core';
import type { LintResult } from './linter.js';
import type { ValidationResult } from './validator.js';

const require = createRequire(import.meta.url);
const { version: pkgVersion } = require('../package.json');

interface SarifResult {
	readonly ruleId: string;
	readonly level: 'error' | 'warning' | 'note';
	readonly message: { readonly text: string };
	readonly locations: ReadonlyArray<{
		readonly physicalLocation: {
			readonly artifactLocation: { readonly uri: string };
			readonly region?: { readonly startLine: number };
		};
	}>;
}

interface SarifRun {
	readonly tool: {
		readonly driver: {
			readonly name: string;
			readonly version: string;
			readonly informationUri: string;
			readonly rules: ReadonlyArray<{
				readonly id: string;
				readonly shortDescription: { readonly text: string };
			}>;
		};
	};
	readonly results: readonly SarifResult[];
}

interface SarifReport {
	readonly $schema: string;
	readonly version: string;
	readonly runs: readonly SarifRun[];
}

function mapSeverity(severity: string): 'error' | 'warning' | 'note' {
	switch (severity) {
		case 'error':
			return 'error';
		case 'warning':
			return 'warning';
		default:
			return 'note';
	}
}

function diagnosticToSarifResult(diag: Diagnostic, filePath: string): SarifResult {
	return {
		ruleId: diag.ruleId,
		level: mapSeverity(diag.severity),
		message: { text: diag.message },
		locations: [
			{
				physicalLocation: {
					artifactLocation: { uri: filePath },
					...(diag.line ? { region: { startLine: diag.line } } : {}),
				},
			},
		],
	};
}

/**
 * Convert validation and lint results to a SARIF 2.1.0 report.
 */
export function toSarif(
	validationResults: readonly ValidationResult[],
	lintResults: readonly LintResult[],
): SarifReport {
	const results: SarifResult[] = [];
	const ruleIds = new Set<string>();

	// Validation diagnostics
	for (const vr of validationResults) {
		for (const diag of vr.diagnostics) {
			results.push(diagnosticToSarifResult(diag, vr.filePath));
			ruleIds.add(diag.ruleId);
		}
	}

	// Lint diagnostics
	for (const lr of lintResults) {
		for (const diag of lr.diagnostics) {
			results.push(diagnosticToSarifResult(diag, lr.filePath));
			ruleIds.add(diag.ruleId);
		}
	}

	const rules = Array.from(ruleIds).map((id) => ({
		id,
		shortDescription: { text: id },
	}));

	return {
		$schema:
			'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
		version: '2.1.0',
		runs: [
			{
				tool: {
					driver: {
						name: 'skill-tools',
						version: pkgVersion,
						informationUri: 'https://github.com/skill-tools/skill-tools',
						rules,
					},
				},
				results,
			},
		],
	};
}
