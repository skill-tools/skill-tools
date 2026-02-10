import type { Diagnostic, QualityScore } from '@skill-tools/core';
import type { LintResult } from '../linter.js';
import type { ValidationResult } from '../validator.js';

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';

function severityIcon(severity: string): string {
	switch (severity) {
		case 'error':
			return `${RED}\u2717${RESET}`;
		case 'warning':
			return `${YELLOW}\u26A0${RESET}`;
		case 'info':
			return `${CYAN}\u2139${RESET}`;
		default:
			return ' ';
	}
}

function severityColor(severity: string): string {
	switch (severity) {
		case 'error':
			return RED;
		case 'warning':
			return YELLOW;
		case 'info':
			return CYAN;
		default:
			return '';
	}
}

function formatDiagnostic(diag: Diagnostic): string {
	const icon = severityIcon(diag.severity);
	const location = diag.line ? `${DIM}line ${diag.line}${RESET} ` : '';
	const ruleId = `${DIM}(${diag.ruleId})${RESET}`;
	let line = `  ${icon} ${location}${diag.message} ${ruleId}`;

	if (diag.fix) {
		line += `\n    ${DIM}\u2192 ${diag.fix}${RESET}`;
	}

	return line;
}

/**
 * Format validation results as human-readable text.
 */
export function formatValidation(results: ValidationResult[]): string {
	const lines: string[] = [];

	for (const result of results) {
		const status = result.valid
			? `${GREEN}\u2713 PASS${RESET}`
			: `${RED}\u2717 FAIL${RESET}`;

		lines.push(`${BOLD}${result.name}${RESET} ${status}`);
		lines.push(`  ${DIM}${result.filePath}${RESET}`);

		if (result.diagnostics.length > 0) {
			lines.push('');
			for (const diag of result.diagnostics) {
				lines.push(formatDiagnostic(diag));
			}
		}

		lines.push('');
	}

	// Summary
	const total = results.length;
	const passed = results.filter((r) => r.valid).length;
	const failed = total - passed;

	if (failed > 0) {
		lines.push(`${RED}${failed} failed${RESET}, ${GREEN}${passed} passed${RESET} (${total} total)`);
	} else {
		lines.push(`${GREEN}All ${total} skill(s) passed validation${RESET}`);
	}

	return lines.join('\n');
}

/**
 * Format lint results as human-readable text.
 */
export function formatLint(results: LintResult[]): string {
	const lines: string[] = [];

	for (const result of results) {
		lines.push(`${BOLD}${result.name}${RESET}`);
		lines.push(`  ${DIM}${result.filePath}${RESET}`);

		if (result.diagnostics.length > 0) {
			lines.push('');
			for (const diag of result.diagnostics) {
				lines.push(formatDiagnostic(diag));
			}
		} else {
			lines.push(`  ${GREEN}No lint issues${RESET}`);
		}

		lines.push('');
	}

	// Summary
	const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0);
	const totalWarnings = results.reduce((sum, r) => sum + r.warningCount, 0);
	const totalInfo = results.reduce((sum, r) => sum + r.infoCount, 0);

	const parts: string[] = [];
	if (totalErrors > 0) parts.push(`${RED}${totalErrors} error(s)${RESET}`);
	if (totalWarnings > 0) parts.push(`${YELLOW}${totalWarnings} warning(s)${RESET}`);
	if (totalInfo > 0) parts.push(`${CYAN}${totalInfo} info${RESET}`);

	if (parts.length > 0) {
		lines.push(parts.join(', '));
	} else {
		lines.push(`${GREEN}No lint issues found${RESET}`);
	}

	return lines.join('\n');
}

/**
 * Format a quality score as human-readable text with a visual bar.
 */
export function formatScore(name: string, qualityScore: QualityScore): string {
	const lines: string[] = [];

	// Score header
	const stars = scoreToStars(qualityScore.score);
	lines.push('');
	lines.push(`  ${BOLD}Quality Score: ${qualityScore.score}/100${RESET}  ${stars}`);
	lines.push('');

	// Dimension bars
	for (const [_key, dim] of Object.entries(qualityScore.dimensions)) {
		const barWidth = 10;
		const filled = Math.round((dim.score / dim.max) * barWidth);
		const empty = barWidth - filled;
		const bar = `${GREEN}${'█'.repeat(filled)}${DIM}${'░'.repeat(empty)}${RESET}`;
		const scoreStr = `${dim.score}/${dim.max}`.padStart(6);

		lines.push(`  ${dim.label.padEnd(24)} ${bar}  ${scoreStr}`);
	}

	// Suggestions
	if (qualityScore.suggestions.length > 0) {
		lines.push('');
		lines.push(`  ${BOLD}Top suggestions:${RESET}`);
		for (let i = 0; i < Math.min(5, qualityScore.suggestions.length); i++) {
			const s = qualityScore.suggestions[i]!;
			lines.push(`  ${i + 1}. ${s.message} ${DIM}(+${s.pointsGain} points)${RESET}`);
		}
	}

	lines.push('');
	return lines.join('\n');
}

function scoreToStars(score: number): string {
	if (score >= 90) return '\u2605\u2605\u2605\u2605\u2605';
	if (score >= 75) return '\u2605\u2605\u2605\u2605';
	if (score >= 60) return '\u2605\u2605\u2605';
	if (score >= 40) return '\u2605\u2605';
	if (score >= 20) return '\u2605';
	return '';
}
