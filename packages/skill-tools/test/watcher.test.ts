import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { WatchHandle, WatchResult } from '../src/watcher.js';
import { watchSkills } from '../src/watcher.js';

const DEFAULT_OPTS = { debounceMs: 100 };

describe('watchSkills', () => {
	const handles: WatchHandle[] = [];

	afterEach(() => {
		for (const h of handles) h.close();
		handles.length = 0;
	});

	it('runs an initial check immediately', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'watch-test-'));
		mkdirSync(join(dir, 'my-skill'));
		writeFileSync(
			join(dir, 'my-skill', 'SKILL.md'),
			[
				'---',
				'name: my-skill',
				'description: "A test skill for watch"',
				'---',
				'',
				'# My Skill',
				'',
				'## Usage',
				'',
				'1. Do something',
				'',
			].join('\n'),
		);

		const result = await new Promise<WatchResult>((resolve, reject) => {
			const handle = watchSkills(dir, DEFAULT_OPTS, resolve, reject);
			handles.push(handle);
		});

		expect(result.changedFile).toBeNull();
		expect(result.validationResults.length).toBeGreaterThanOrEqual(1);
		expect(result.validationResults[0]!.valid).toBe(true);
		expect(result.scores.length).toBeGreaterThanOrEqual(1);
	});

	it('close() stops the watcher without error', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'watch-test-'));
		mkdirSync(join(dir, 'my-skill'));
		writeFileSync(
			join(dir, 'my-skill', 'SKILL.md'),
			'---\nname: my-skill\ndescription: "test"\n---\n\n# My Skill\n',
		);

		const handle = await new Promise<WatchHandle>((resolve, reject) => {
			const h = watchSkills(dir, DEFAULT_OPTS, () => resolve(h), reject);
			handles.push(h);
		});

		// Should not throw
		handle.close();
	});
});
