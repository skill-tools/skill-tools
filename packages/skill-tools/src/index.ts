/**
 * skill-tools — Validate, lint, and score Agent Skills (SKILL.md) files
 *
 * @packageDocumentation
 */

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
export type { LintResult } from './linter.js';

export { lint, parseRulesConfig } from './linter.js';
export type { RuleConfig, RuleDefinition, RulesConfig } from './rules/index.js';
export { builtinRules, recommendedConfig } from './rules/index.js';
export { score } from './scorer/index.js';
export type { ValidationResult } from './validator.js';
export { validate } from './validator.js';
