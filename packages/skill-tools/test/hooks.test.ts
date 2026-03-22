import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generatePreCommitHook, installPreCommitHook } from '../src/hooks.js';

describe('generatePreCommitHook', () => {
	it('generates a valid bash script', () => {
		const script = generatePreCommitHook();
		expect(script).toContain('#!/usr/bin/env bash');
		expect(script).toContain('SKILL.md');
		expect(script).toContain('skill-tools check');
	});

	it('includes min-score option when set', () => {
		const script = generatePreCommitHook({ minScore: 70 });
		expect(script).toContain('--min-score "70"');
	});

	it('includes fail-on option when set', () => {
		const script = generatePreCommitHook({ failOn: 'warning' });
		expect(script).toContain('--fail-on "warning"');
	});
});

describe('installPreCommitHook', () => {
	it('creates a pre-commit hook file', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'hook-test-'));
		const gitDir = join(dir, '.git');
		mkdirSync(join(gitDir, 'hooks'), { recursive: true });

		const result = await installPreCommitHook(gitDir);
		expect(result.installed).toBe(true);
		expect(result.path).toContain('pre-commit');

		const content = readFileSync(result.path, 'utf-8');
		expect(content).toContain('#!/usr/bin/env bash');
		expect(content).toContain('skill-tools');
	});

	it('is idempotent when hook marker already exists', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'hook-test-'));
		const gitDir = join(dir, '.git');
		mkdirSync(join(gitDir, 'hooks'), { recursive: true });

		await installPreCommitHook(gitDir);
		const result = await installPreCommitHook(gitDir);
		expect(result.installed).toBe(true);
		expect(result.appended).toBe(false);
		expect(result.alreadyPresent).toBe(true);
	});
});
