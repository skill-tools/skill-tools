import { watch, type FSWatcher } from 'node:fs';
import { resolve } from 'node:path';
import type { QualityScore } from '@skill-tools/core';
import { lint } from './linter.js';
import type { LintResult } from './linter.js';
import { score } from './scorer/index.js';
import { validate } from './validator.js';
import type { ValidationResult } from './validator.js';

export interface WatchOptions {
	readonly debounceMs: number;
}

export interface WatchResult {
	readonly changedFile: string | null;
	readonly validationResults: ValidationResult[];
	readonly lintResults: LintResult[];
	readonly scores: ReadonlyArray<{ name: string; score: QualityScore }>;
	readonly previousScores: ReadonlyMap<string, number>;
	readonly elapsedMs: number;
}

export interface WatchHandle {
	close(): void;
}

export function watchSkills(
	path: string,
	options: WatchOptions,
	onResult: (result: WatchResult) => void,
	onError: (err: Error) => void,
): WatchHandle {
	const resolvedPath = resolve(path);
	const previousScores = new Map<string, number>();
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	async function runCheck(changedFile: string | null): Promise<void> {
		try {
			const start = performance.now();
			const validationResults = await validate(resolvedPath);
			const validSkills = validationResults.filter((r) => r.valid && r.skill);

			const lintResults: LintResult[] = [];
			const scores: Array<{ name: string; score: QualityScore }> = [];

			for (const result of validSkills) {
				const skill = result.skill!;
				lintResults.push(lint(skill));
				const qualityScore = score(skill);
				const name = skill.metadata.name ?? result.name;
				scores.push({ name, score: qualityScore });
			}

			const elapsedMs = performance.now() - start;
			const prevScoresSnapshot = new Map(previousScores);

			// Update previous scores for next run
			for (const { name, score: qs } of scores) {
				previousScores.set(name, qs.score);
			}

			onResult({
				changedFile,
				validationResults,
				lintResults,
				scores,
				previousScores: prevScoresSnapshot,
				elapsedMs,
			});
		} catch (err) {
			onError(err instanceof Error ? err : new Error(String(err)));
		}
	}

	// Run initial check immediately
	runCheck(null);

	let watcher: FSWatcher;
	try {
		watcher = watch(resolvedPath, { recursive: true }, (_event, filename) => {
			if (!filename || !filename.endsWith('SKILL.md')) return;

			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				runCheck(filename);
			}, options.debounceMs);
		});
	} catch (err) {
		onError(err instanceof Error ? err : new Error(String(err)));
		return { close() {} };
	}

	return {
		close() {
			if (debounceTimer) clearTimeout(debounceTimer);
			watcher.close();
		},
	};
}
