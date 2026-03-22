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
export type {
	BenchmarkRepositoriesOptions,
	RepositoryBenchmarkOptions,
	RepositoryBenchmarkResult,
	RepositoryBenchmarkRun,
	RepositoryBenchmarkSummary,
	RepositoryLintSummary,
	RepositoryRefreshMode,
	RepositorySkillBenchmark,
	RepositorySource,
} from './repository-benchmark.js';
export { benchmarkRepositories, benchmarkRepository } from './repository-benchmark.js';
export type { RuleConfig, RuleDefinition, RulesConfig } from './rules/index.js';
export { builtinRules, recommendedConfig } from './rules/index.js';
export { score } from './scorer/index.js';
export type {
	SkillsShEntry,
	SkillsShNormalizeOptions,
	SkillsShNormalizationResult,
	SkillsShRawEntry,
	SkillsShRepositoryRecord,
} from './skills-sh.js';
export {
	groupSkillsShRepositories,
	normalizeSkillsShEntries,
	parseSkillsShTotalCount,
	toBenchmarkRepositorySources,
} from './skills-sh.js';
export { formatConflicts, formatRouteResults } from './formatters/route-text.js';
export type { HookInstallResult, HookOptions } from './hooks.js';
export { generatePreCommitHook, installPreCommitHook } from './hooks.js';
export { toSarif } from './sarif.js';
export { formatWatchResult } from './formatters/watch-text.js';
export type { WatchHandle, WatchOptions, WatchResult } from './watcher.js';
export { watchSkills } from './watcher.js';
export { formatConflictsJson, formatRouteJson } from './formatters/route-json.js';
export type { ValidationResult } from './validator.js';
export { validate } from './validator.js';
