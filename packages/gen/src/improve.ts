import { parseSkill, resolveSkillFiles } from '@skill-tools/core';
import type { QualityScore } from '@skill-tools/core';
import { lint, score } from 'skill-tools';
import type { LintResult } from 'skill-tools';

export interface ImproveResult {
	readonly name: string;
	readonly filePath: string;
	readonly currentScore: QualityScore;
	readonly lintResult: LintResult;
	readonly suggestions: readonly ImprovedSuggestion[];
}

export interface ImprovedSuggestion {
	readonly source: 'score' | 'lint';
	readonly message: string;
	readonly pointsGain: number;
	readonly fix?: string;
}

/**
 * Analyze an existing SKILL.md file or directory and return improvement suggestions.
 * Suggestions are sorted by pointsGain descending.
 */
export async function analyzeSkill(skillPath: string): Promise<ImproveResult[]> {
	const locations = await resolveSkillFiles(skillPath);
	const results: ImproveResult[] = [];

	for (const location of locations) {
		const parseResult = await parseSkill(location.skillFile);
		if (!parseResult.ok || !parseResult.skill) continue;

		const skill = parseResult.skill;
		const lintResult = lint(skill);
		const qualityScore = score(skill);
		const name = skill.metadata.name ?? location.dirName;

		const suggestions: ImprovedSuggestion[] = [];

		// Add scorer suggestions
		for (const s of qualityScore.suggestions) {
			suggestions.push({
				source: 'score',
				message: s.message,
				pointsGain: s.pointsGain,
			});
		}

		// Add lint fix suggestions
		for (const diag of lintResult.diagnostics) {
			if (diag.fix) {
				suggestions.push({
					source: 'lint',
					message: diag.message,
					pointsGain: diag.severity === 'error' ? 5 : diag.severity === 'warning' ? 3 : 1,
					fix: diag.fix,
				});
			}
		}

		// Sort by pointsGain descending
		suggestions.sort((a, b) => b.pointsGain - a.pointsGain);

		results.push({
			name,
			filePath: location.skillFile,
			currentScore: qualityScore,
			lintResult,
			suggestions,
		});
	}

	return results;
}
