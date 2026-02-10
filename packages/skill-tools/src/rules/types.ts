import type { Diagnostic, DiagnosticSeverity, Skill } from '@skill-tools/core';

/**
 * Configuration for a single linting rule.
 */
export type RuleConfig = DiagnosticSeverity | 'off';

/**
 * Definition of a linting rule.
 */
export interface RuleDefinition {
	/** Unique rule ID */
	readonly id: string;
	/** Human-readable description of what the rule checks */
	readonly description: string;
	/** Default severity */
	readonly defaultSeverity: DiagnosticSeverity;
	/**
	 * Run the rule against a parsed skill.
	 * Returns diagnostics (with severity from the rule definition).
	 * The engine will override severity based on user config.
	 */
	check(skill: Skill): Diagnostic[];
}

/**
 * Map of rule IDs to their configured severity.
 */
export type RulesConfig = Record<string, RuleConfig>;
