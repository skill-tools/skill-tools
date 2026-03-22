import { type Diagnostic, parseSkillContent } from '@skill-tools/core';
import { lint, score } from 'skill-tools';
import type { LintResult } from 'skill-tools';
import type { QualityScore } from '@skill-tools/core';

export interface CheckResult {
	readonly diagnostics: readonly Diagnostic[];
	readonly lintResults: readonly LintResult[];
	readonly scores: ReadonlyArray<{ readonly name: string; readonly score: QualityScore }>;
	readonly meetsThreshold: boolean;
}

/**
 * Run validate + lint + score on generated SKILL.md files (in-memory, before writing to disk).
 * Returns aggregated results. If minScore is set, meetsThreshold is false when any skill falls below.
 */
export function checkGeneratedFiles(files: ReadonlyMap<string, string>, minScore = 0): CheckResult {
	const diagnostics: Diagnostic[] = [];
	const lintResults: LintResult[] = [];
	const scores: Array<{ name: string; score: QualityScore }> = [];
	let meetsThreshold = true;

	for (const [path, content] of files) {
		if (!path.endsWith('SKILL.md')) continue;
		const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '.';
		const result = parseSkillContent(content, path, dir);
		diagnostics.push(...result.diagnostics);

		if (result.ok && result.skill) {
			const lintResult = lint(result.skill);
			lintResults.push(lintResult);

			const qualityScore = score(result.skill);
			const name = result.skill.metadata.name ?? path;
			scores.push({ name, score: qualityScore });

			if (qualityScore.score < minScore) {
				meetsThreshold = false;
			}
		} else {
			meetsThreshold = false;
		}
	}

	return { diagnostics, lintResults, scores, meetsThreshold };
}
