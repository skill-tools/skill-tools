/**
 * skill-tools — Validate, lint, and score Agent Skills (SKILL.md) files
 *
 * @packageDocumentation
 */

export type {
	AuditAdapter,
	BrowserGroundingContract,
	BrowserProvenanceContract,
	BrowserRuntimeContract,
	BrowserSkillContract,
	ContractAuditResult,
	ContractEvidence,
	ParsedContractResult,
} from '@skill-tools/contracts';
export {
	assertAdapter,
	auditContract,
	normalizeBapEvidence,
	normalizeDbarEvidence,
	normalizeUseidEvidence,
	parseContract,
	validateContract,
} from '@skill-tools/contracts';
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
export type { AuditOptions } from './audit.js';
export { audit, parseAuditAdapter } from './audit.js';
export { formatAuditJson } from './formatters/json.js';
export { formatConflictsJson, formatRouteJson } from './formatters/route-json.js';
export { formatConflicts, formatRouteResults } from './formatters/route-text.js';
export { formatAudit } from './formatters/text.js';
export { formatWatchResult } from './formatters/watch-text.js';
export type { HookInstallResult, HookOptions } from './hooks.js';
export { generatePreCommitHook, installPreCommitHook } from './hooks.js';
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
export { auditToSarif, toSarif } from './sarif.js';
export { score } from './scorer/index.js';
export type {
	SkillsShEntry,
	SkillsShNormalizationResult,
	SkillsShNormalizeOptions,
	SkillsShRawEntry,
	SkillsShRepositoryRecord,
} from './skills-sh.js';
export {
	groupSkillsShRepositories,
	normalizeSkillsShEntries,
	parseSkillsShTotalCount,
	toBenchmarkRepositorySources,
} from './skills-sh.js';
export type { ValidationResult } from './validator.js';
export { validate } from './validator.js';
export type { WatchHandle, WatchOptions, WatchResult } from './watcher.js';
export { watchSkills } from './watcher.js';
