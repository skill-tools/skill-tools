import { describe, expect, it } from 'vitest';
import { checkGeneratedFiles } from '../src/check.js';

describe('checkGeneratedFiles', () => {
	it('returns passing result for valid generated skill', () => {
		const files = new Map([
			[
				'my-skill/SKILL.md',
				[
					'---',
					'name: my-skill',
					'description: "Deploy web applications to production servers. Use when the user wants to deploy."',
					'---',
					'',
					'# My Skill',
					'',
					'## Usage',
					'',
					'1. First step',
					'2. Second step',
					'',
					'## Examples',
					'',
					'```bash',
					'example command',
					'```',
					'',
					'## Error Handling',
					'',
					'- If deploy fails: retry with --force',
					'',
				].join('\n'),
			],
		]);

		const result = checkGeneratedFiles(files);
		expect(result.meetsThreshold).toBe(true);
		expect(result.scores).toHaveLength(1);
		expect(result.scores[0]!.score.score).toBeGreaterThan(0);
	});

	it('fails threshold when score is below minScore', () => {
		const files = new Map([['bad/SKILL.md', '---\nname: b\ndescription: "x"\n---\n\n# B\n']]);

		const result = checkGeneratedFiles(files, 90);
		expect(result.meetsThreshold).toBe(false);
	});

	it('skips non-SKILL.md files', () => {
		const files = new Map([['readme.md', '# Readme']]);

		const result = checkGeneratedFiles(files);
		expect(result.scores).toHaveLength(0);
		expect(result.meetsThreshold).toBe(true);
	});
});
