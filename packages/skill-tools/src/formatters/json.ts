import type { ContractAuditResult } from '@skill-tools/contracts';
import type { QualityScore } from '@skill-tools/core';
import type { LintResult } from '../linter.js';
import type { ValidationResult } from '../validator.js';

/**
 * Format validation results as JSON.
 */
export function formatValidationJson(results: ValidationResult[]): string {
	return JSON.stringify(
		results.map((r) => ({
			filePath: r.filePath,
			name: r.name,
			valid: r.valid,
			diagnostics: r.diagnostics,
		})),
		null,
		2,
	);
}

/**
 * Format lint results as JSON.
 */
export function formatLintJson(results: LintResult[]): string {
	return JSON.stringify(
		results.map((r) => ({
			filePath: r.filePath,
			name: r.name,
			errorCount: r.errorCount,
			warningCount: r.warningCount,
			infoCount: r.infoCount,
			diagnostics: r.diagnostics,
		})),
		null,
		2,
	);
}

/**
 * Format a quality score as JSON.
 */
export function formatScoreJson(name: string, qualityScore: QualityScore): string {
	return JSON.stringify(
		{
			name,
			score: qualityScore.score,
			dimensions: qualityScore.dimensions,
			suggestions: qualityScore.suggestions,
		},
		null,
		2,
	);
}

/**
 * Format a contract audit result as JSON.
 */
export function formatAuditJson(result: ContractAuditResult): string {
	return JSON.stringify(
		{
			filePath: result.filePath,
			name: result.name,
			adapter: result.adapter,
			valid: result.valid,
			errorCount: result.errorCount,
			warningCount: result.warningCount,
			infoCount: result.infoCount,
			diagnostics: result.diagnostics,
			evidence: result.evidence,
		},
		null,
		2,
	);
}
