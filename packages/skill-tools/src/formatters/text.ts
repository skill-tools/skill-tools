import type { Diagnostic, QualityScore } from '@skill-tools/core';
import type { LintResult } from '../linter.js';
import type { ValidationResult } from '../validator.js';

// ── ANSI codes ──────────────────────────────────────────────────────

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const WHITE = '\x1b[37m';
const RED_BG = '\x1b[41m';
const GREEN_BG = '\x1b[42m';

// ── Icons ───────────────────────────────────────────────────────────

const PASS = `${GREEN}\u2713${RESET}`;
const FAIL = `${RED}\u2717${RESET}`;
const WARN = `${YELLOW}\u25CF${RESET}`;
const INFO = `${CYAN}\u25CF${RESET}`;
const DOT = `${DIM}\u00B7${RESET}`;

// ── Layout helpers ──────────────────────────────────────────────────

const RULE = `${DIM}${'─'.repeat(50)}${RESET}`;

function pad(str: string, width: number): string {
	// Strip ANSI for length calculation
	// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape stripping requires matching \x1b
	const visible = str.replace(/\x1b\[[0-9;]*m/g, '');
	const diff = width - visible.length;
	return diff > 0 ? str + ' '.repeat(diff) : str;
}

function severityLabel(severity: string): string {
	switch (severity) {
		case 'error':
			return `${RED}error${RESET}`;
		case 'warning':
			return `${YELLOW}warning${RESET}`;
		case 'info':
			return `${CYAN}info${RESET}`;
		default:
			return severity;
	}
}

function severityIcon(severity: string): string {
	switch (severity) {
		case 'error':
			return FAIL;
		case 'warning':
			return WARN;
		case 'info':
			return INFO;
		default:
			return DOT;
	}
}

// ── Human-readable rule names ───────────────────────────────────────
// Maps rule IDs to clear, short labels for display

const LINT_RULE_LABELS: Record<string, string> = {
	'description-specificity': 'Description uses specific verbs',
	'description-trigger-keywords': 'Description has trigger keywords',
	'description-length-optimal': 'Description length is optimal',
	'progressive-disclosure': 'File size / progressive disclosure',
	'no-hardcoded-paths': 'No hardcoded paths',
	'no-secrets': 'No embedded secrets',
	'instructions-has-examples': 'Instructions include examples',
	'instructions-has-error-handling': 'Instructions cover error handling',
	'consistent-headings': 'Heading hierarchy is consistent',
};

const VALIDATE_CHECK_LABELS: Record<string, string> = {
	'file-readable': 'File is readable',
	'file-not-empty': 'File is not empty',
	'frontmatter-valid-yaml': 'Valid YAML frontmatter',
	'frontmatter-required': 'Frontmatter present',
	'name-required': 'Has name field',
	'name-type': 'Name is a string',
	'name-format': 'Name format is valid',
	'name-matches-directory': 'Name matches directory',
	'description-required': 'Has description field',
	'description-type': 'Description is a string',
	'description-length': 'Description length is OK',
	'compatibility-type': 'Compatibility is a string',
	'compatibility-length': 'Compatibility length is OK',
	'license-type': 'License is a string',
	'body-required': 'Has markdown body',
	'file-reference-exists': 'File references exist',
	'token-budget': 'Within token budget',
	'unexpected-directory': 'Directory structure',
	'no-bom': 'No byte-order mark',
	'no-binary': 'No binary content',
	'skill-not-found': 'Skill file found',
};

// The validate checks in display order (these are the checks the parser runs)
const VALIDATE_CHECK_ORDER = [
	'file-readable',
	'file-not-empty',
	'frontmatter-valid-yaml',
	'frontmatter-required',
	'name-required',
	'name-type',
	'name-format',
	'name-matches-directory',
	'description-required',
	'description-type',
	'description-length',
	'compatibility-type',
	'compatibility-length',
	'license-type',
	'body-required',
	'file-reference-exists',
	'token-budget',
	'no-bom',
	'no-binary',
	'unexpected-directory',
];

// ── Lint formatter ──────────────────────────────────────────────────

/**
 * Format lint results as human-readable text.
 *
 * Shows every rule that was checked (pass or fail) so the user can see
 * what was evaluated, not just what broke.
 */
export function formatLint(results: LintResult[], elapsedMs?: number): string {
	const lines: string[] = [];

	for (const result of results) {
		// Header
		lines.push('');
		lines.push(`  ${BOLD}${result.name}${RESET}  ${DIM}${result.filePath}${RESET}`);
		lines.push(`  ${RULE}`);

		// Build a set of rule IDs that have diagnostics
		const failedRules = new Map<string, Diagnostic[]>();
		for (const diag of result.diagnostics) {
			if (!failedRules.has(diag.ruleId)) {
				failedRules.set(diag.ruleId, []);
			}
			failedRules.get(diag.ruleId)!.push(diag);
		}

		// Show passing rules first (compact)
		const passingRules: string[] = [];
		for (const ruleId of Object.keys(LINT_RULE_LABELS)) {
			if (!failedRules.has(ruleId)) {
				const label = LINT_RULE_LABELS[ruleId] ?? ruleId;
				passingRules.push(`  ${PASS}  ${label}`);
			}
		}

		if (passingRules.length > 0) {
			for (const line of passingRules) {
				lines.push(line);
			}
		}

		// Show failing rules with details
		if (failedRules.size > 0) {
			if (passingRules.length > 0) lines.push('');

			for (const [ruleId, diags] of failedRules) {
				const label = LINT_RULE_LABELS[ruleId] ?? ruleId;
				const severity = diags[0]!.severity;
				const icon = severityIcon(severity);

				lines.push(`  ${icon}  ${label}  ${severityLabel(severity)}`);

				for (const diag of diags) {
					// Show the message with clear, direct language
					const locationStr = diag.line ? `${DIM}line ${diag.line}${RESET}  ` : '';
					lines.push(`     ${locationStr}${diag.message}`);

					// Show fix suggestion
					if (diag.fix) {
						lines.push(`     ${DIM}\u2192 ${diag.fix}${RESET}`);
					}
				}
			}
		}

		lines.push(`  ${RULE}`);

		// Per-file summary
		const total = Object.keys(LINT_RULE_LABELS).length;
		const passed = total - failedRules.size;
		const parts: string[] = [`${BOLD}${total}${RESET} rules`];

		if (passed > 0) parts.push(`${GREEN}${passed} passed${RESET}`);
		if (result.errorCount > 0)
			parts.push(`${RED}${result.errorCount} error${result.errorCount !== 1 ? 's' : ''}${RESET}`);
		if (result.warningCount > 0)
			parts.push(
				`${YELLOW}${result.warningCount} warning${result.warningCount !== 1 ? 's' : ''}${RESET}`,
			);
		if (result.infoCount > 0) parts.push(`${CYAN}${result.infoCount} info${RESET}`);

		lines.push(`  ${parts.join(`  ${DIM}\u2502${RESET}  `)}`);
	}

	// Timing
	if (elapsedMs != null) {
		lines.push(`  ${DIM}${elapsedMs.toFixed(1)}ms${RESET}`);
	}

	lines.push('');
	return lines.join('\n');
}

// ── Validate formatter ──────────────────────────────────────────────

/**
 * Format validation results as human-readable text.
 *
 * Shows each parse/validation check as a pass/fail checklist so the
 * user can see exactly what was verified.
 */
export function formatValidation(results: ValidationResult[], elapsedMs?: number): string {
	const lines: string[] = [];

	for (const result of results) {
		// Header with pass/fail badge
		const badge = result.valid
			? `${GREEN_BG}${WHITE}${BOLD} PASS ${RESET}`
			: `${RED_BG}${WHITE}${BOLD} FAIL ${RESET}`;

		lines.push('');
		lines.push(`  ${BOLD}${result.name}${RESET}  ${badge}`);
		lines.push(`  ${DIM}${result.filePath}${RESET}`);
		lines.push(`  ${RULE}`);

		// Build a map of failed checks
		const failedChecks = new Map<string, Diagnostic[]>();
		for (const diag of result.diagnostics) {
			if (!failedChecks.has(diag.ruleId)) {
				failedChecks.set(diag.ruleId, []);
			}
			failedChecks.get(diag.ruleId)!.push(diag);
		}

		// Walk through checks in order
		let passCount = 0;
		let failCount = 0;
		const shownRules = new Set<string>();

		for (const checkId of VALIDATE_CHECK_ORDER) {
			const label = VALIDATE_CHECK_LABELS[checkId] ?? checkId;

			if (failedChecks.has(checkId)) {
				failCount++;
				shownRules.add(checkId);
				const diags = failedChecks.get(checkId)!;
				const icon = severityIcon(diags[0]!.severity);

				lines.push(`  ${icon}  ${label}`);
				for (const diag of diags) {
					lines.push(`     ${diag.message}`);
					if (diag.fix) {
						lines.push(`     ${DIM}\u2192 ${diag.fix}${RESET}`);
					}
				}
			} else {
				// Only show this check as passed if we got far enough in parsing
				// to actually run it. If an earlier fatal error stopped parsing,
				// we didn't actually verify later checks.
				const shouldShow = shouldShowCheck(checkId, failedChecks);
				if (shouldShow) {
					passCount++;
					shownRules.add(checkId);
					lines.push(`  ${PASS}  ${label}`);
				}
			}
		}

		// Show any diagnostics with rule IDs not in our predefined list
		for (const [ruleId, diags] of failedChecks) {
			if (shownRules.has(ruleId)) continue;
			failCount++;
			const label = VALIDATE_CHECK_LABELS[ruleId] ?? ruleId;
			const icon = severityIcon(diags[0]!.severity);
			lines.push(`  ${icon}  ${label}`);
			for (const diag of diags) {
				lines.push(`     ${diag.message}`);
				if (diag.fix) {
					lines.push(`     ${DIM}\u2192 ${diag.fix}${RESET}`);
				}
			}
		}

		lines.push(`  ${RULE}`);

		// Summary
		const total = passCount + failCount;
		if (failCount === 0) {
			lines.push(`  ${GREEN}All ${total} checks passed${RESET}`);
		} else {
			const parts = [`${BOLD}${total}${RESET} checks`];
			if (passCount > 0) parts.push(`${GREEN}${passCount} passed${RESET}`);
			parts.push(`${RED}${failCount} failed${RESET}`);
			lines.push(`  ${parts.join(`  ${DIM}\u2502${RESET}  `)}`);
		}
	}

	// Timing
	if (elapsedMs != null) {
		lines.push(`  ${DIM}${elapsedMs.toFixed(1)}ms${RESET}`);
	}

	// Multi-skill summary
	if (results.length > 1) {
		lines.push('');
		const total = results.length;
		const passed = results.filter((r) => r.valid).length;
		const failed = total - passed;

		if (failed > 0) {
			lines.push(
				`  ${RED}${failed} failed${RESET}, ${GREEN}${passed} passed${RESET} ${DIM}(${total} skills)${RESET}`,
			);
		} else {
			lines.push(`  ${GREEN}All ${total} skills passed validation${RESET}`);
		}
	}

	lines.push('');
	return lines.join('\n');
}

/**
 * Determine whether a validation check should be shown as "passed".
 *
 * If parsing failed early (e.g. file unreadable, invalid YAML),
 * we didn't actually run later checks like name-format or token-budget.
 * Only show a check as passed if we got far enough to verify it.
 */
function shouldShowCheck(checkId: string, failedChecks: Map<string, Diagnostic[]>): boolean {
	// These are early-exit checks — if any fails, later checks weren't run
	const earlyExitChecks = ['file-readable', 'file-not-empty', 'frontmatter-valid-yaml'];

	for (const earlyCheck of earlyExitChecks) {
		if (failedChecks.has(earlyCheck)) {
			// If this early check failed, only show checks up to and including it
			const idx = VALIDATE_CHECK_ORDER.indexOf(earlyCheck);
			const checkIdx = VALIDATE_CHECK_ORDER.indexOf(checkId);
			return checkIdx <= idx;
		}
	}

	// No early exit — all checks were run
	return true;
}

// ── Score formatter ─────────────────────────────────────────────────

/**
 * Format a quality score as human-readable text with visual bars.
 */
export function formatScore(_name: string, qualityScore: QualityScore, elapsedMs?: number): string {
	const lines: string[] = [];

	// Score header with color based on score
	const scoreColor = qualityScore.score >= 75 ? GREEN : qualityScore.score >= 40 ? YELLOW : RED;
	const stars = scoreToStars(qualityScore.score);

	lines.push('');
	lines.push(
		`  ${BOLD}Quality Score${RESET}  ${scoreColor}${BOLD}${qualityScore.score}${RESET}${DIM}/100${RESET}  ${stars}`,
	);
	lines.push(`  ${RULE}`);

	// Dimension bars
	for (const [_key, dim] of Object.entries(qualityScore.dimensions)) {
		const barWidth = 10;
		const filled = Math.round((dim.score / dim.max) * barWidth);
		const empty = barWidth - filled;
		const barColor = filled >= barWidth * 0.7 ? GREEN : filled >= barWidth * 0.4 ? YELLOW : RED;
		const bar = `${barColor}${'█'.repeat(filled)}${DIM}${'░'.repeat(empty)}${RESET}`;
		const scoreStr = `${dim.score}/${dim.max}`;

		lines.push(`  ${pad(dim.label, 24)}  ${bar}  ${scoreStr}`);
	}

	// Suggestions
	if (qualityScore.suggestions.length > 0) {
		lines.push('');
		lines.push(`  ${BOLD}Suggestions${RESET}`);
		for (let i = 0; i < Math.min(5, qualityScore.suggestions.length); i++) {
			const s = qualityScore.suggestions[i]!;
			lines.push(`  ${DIM}${i + 1}.${RESET} ${s.message}  ${DIM}+${s.pointsGain} pts${RESET}`);
		}
	}

	// Timing
	if (elapsedMs != null) {
		lines.push('');
		lines.push(`  ${DIM}${elapsedMs.toFixed(1)}ms${RESET}`);
	}

	lines.push('');
	return lines.join('\n');
}

function scoreToStars(score: number): string {
	const filled =
		score >= 90 ? 5 : score >= 75 ? 4 : score >= 60 ? 3 : score >= 40 ? 2 : score >= 20 ? 1 : 0;
	const empty = 5 - filled;
	return `${YELLOW}${'★'.repeat(filled)}${DIM}${'☆'.repeat(empty)}${RESET}`;
}
