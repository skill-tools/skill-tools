/**
 * @skill-tools/core — Core parser, types, and utilities for Agent Skills (SKILL.md)
 *
 * This package provides the foundational infrastructure shared by all
 * skill-tools ecosystem tools: the SKILL.md parser, type definitions,
 * token counter, and file resolver.
 *
 * @packageDocumentation
 */

export { parseSkill, parseSkillContent } from './parser.js';
export { resolveSkillFiles } from './resolver.js';
export { countTokens } from './tokenizer.js';

export type {
	Diagnostic,
	DiagnosticSeverity,
	DimensionScore,
	ParseResult,
	QualityScore,
	ScoreSuggestion,
	Skill,
	SkillFileReference,
	SkillMetadata,
	SkillSection,
} from './types.js';

export type { SkillLocation } from './resolver.js';
