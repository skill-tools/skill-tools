import type { Diagnostic, DiagnosticSeverity, Skill } from '@skill-tools/core';
import { builtinRules } from './rules/index.js';
import type { RuleConfig, RulesConfig } from './rules/types.js';

/**
 * Result of linting a single skill.
 */
export interface LintResult {
	/** Path to the SKILL.md file */
	readonly filePath: string;
	/** Skill name */
	readonly name: string;
	/** All lint diagnostics */
	readonly diagnostics: readonly Diagnostic[];
	/** Count of errors */
	readonly errorCount: number;
	/** Count of warnings */
	readonly warningCount: number;
	/** Count of info messages */
	readonly infoCount: number;
}

/**
 * Lint a parsed skill against all enabled rules.
 *
 * @param skill - The parsed Skill object
 * @param rulesConfig - Optional rule severity overrides
 * @returns LintResult with all diagnostics
 */
export function lint(skill: Skill, rulesConfig?: RulesConfig): LintResult {
	const diagnostics: Diagnostic[] = [];

	for (const [ruleId, rule] of builtinRules) {
		const configuredSeverity = rulesConfig?.[ruleId];

		// Skip disabled rules
		if (configuredSeverity === 'off') continue;

		// Run the rule
		const ruleDiagnostics = rule.check(skill);

		// Apply configured severity override (after the 'off' check above,
		// configuredSeverity can only be a DiagnosticSeverity or undefined)
		const severity: DiagnosticSeverity =
			(configuredSeverity as DiagnosticSeverity | undefined) ?? rule.defaultSeverity;

		for (const diag of ruleDiagnostics) {
			diagnostics.push({
				...diag,
				severity,
			});
		}
	}

	return {
		filePath: skill.filePath,
		name: skill.metadata.name ?? 'unknown',
		diagnostics,
		errorCount: diagnostics.filter((d) => d.severity === 'error').length,
		warningCount: diagnostics.filter((d) => d.severity === 'warning').length,
		infoCount: diagnostics.filter((d) => d.severity === 'info').length,
	};
}

/**
 * Parse a rules config that might come from a .skill-toolsrc.yml file.
 * Normalizes string values to proper RuleConfig types.
 */
export function parseRulesConfig(raw: Record<string, unknown>): RulesConfig {
	const config: RulesConfig = {};
	const validSeverities = new Set<RuleConfig>(['error', 'warning', 'info', 'off']);

	for (const [key, value] of Object.entries(raw)) {
		if (typeof value === 'string' && validSeverities.has(value as RuleConfig)) {
			config[key] = value as RuleConfig;
		}
	}

	return config;
}
