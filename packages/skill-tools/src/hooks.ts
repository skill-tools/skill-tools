import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export interface HookOptions {
	readonly minScore?: number;
	readonly failOn?: string;
}

export interface HookInstallResult {
	readonly installed: boolean;
	readonly path: string;
	readonly appended: boolean;
	readonly alreadyPresent: boolean;
}

const HOOK_MARKER = '# skill-tools pre-commit hook';

/**
 * Generate the contents of a pre-commit hook script.
 */
export function generatePreCommitHook(options: HookOptions = {}): string {
	const minScore = options.minScore ?? 0;
	const validFailOn = ['error', 'warning', 'info'];
	const failOn = validFailOn.includes(options.failOn ?? 'error')
		? (options.failOn ?? 'error')
		: 'error';

	return [
		'#!/usr/bin/env bash',
		'set -euo pipefail',
		'',
		HOOK_MARKER,
		'STAGED_SKILLS=$(git diff --cached --name-only --diff-filter=ACM | grep "SKILL\\.md$" || true)',
		'if [ -z "$STAGED_SKILLS" ]; then',
		'  exit 0',
		'fi',
		'',
		'echo "skill-tools: checking staged SKILL.md files..."',
		'FAILED=0',
		'for skill in $STAGED_SKILLS; do',
		'  dir=$(dirname "$skill")',
		`  if ! npx skill-tools check "$dir" --format text --fail-on "${failOn}" --min-score "${minScore}"; then`,
		'    FAILED=1',
		'  fi',
		'done',
		'',
		'if [ "$FAILED" -ne 0 ]; then',
		'  echo "skill-tools: pre-commit check failed"',
		'  exit 1',
		'fi',
		'',
	].join('\n');
}

/**
 * Install a pre-commit hook into the given git directory.
 * If a hook already exists, appends the skill-tools section (unless already present).
 */
export async function installPreCommitHook(
	gitDir?: string,
	options: HookOptions = {},
): Promise<HookInstallResult> {
	const resolvedGitDir = gitDir ? resolve(gitDir) : resolve('.git');
	const hooksDir = join(resolvedGitDir, 'hooks');
	const hookPath = join(hooksDir, 'pre-commit');

	const hookContent = generatePreCommitHook(options);

	// Ensure hooks directory exists
	await mkdir(hooksDir, { recursive: true });

	try {
		const existing = await readFile(hookPath, 'utf-8');
		if (existing.includes(HOOK_MARKER)) {
			return { installed: true, path: hookPath, appended: false, alreadyPresent: true };
		}
		// Append to existing hook
		await writeFile(hookPath, `${existing}\n${hookContent}`, 'utf-8');
		await chmod(hookPath, 0o755);
		return { installed: true, path: hookPath, appended: true, alreadyPresent: false };
	} catch {
		// No existing hook — create new
		await writeFile(hookPath, hookContent, 'utf-8');
		await chmod(hookPath, 0o755);
		return { installed: true, path: hookPath, appended: false, alreadyPresent: false };
	}
}
