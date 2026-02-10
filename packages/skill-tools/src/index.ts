/**
 * skill-tools — Validate, lint, and score Agent Skills (SKILL.md) files
 *
 * @packageDocumentation
 */

export { validate } from './validator.js';
export type { ValidationResult } from './validator.js';

export { lint, parseRulesConfig } from './linter.js';
export type { LintResult } from './linter.js';

export { score } from './scorer/index.js';

export { builtinRules, recommendedConfig } from './rules/index.js';
export type { RuleConfig, RuleDefinition, RulesConfig } from './rules/index.js';

// Re-export core types for convenience
export type {
	Diagnostic,
	DiagnosticSeverity,
	DimensionScore,
	ParseResult,
	QualityScore,
	ScoreSuggestion,
	Skill,
	SkillMetadata,
} from '@skill-tools/core';
