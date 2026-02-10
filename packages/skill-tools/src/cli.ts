import { parseSkill, resolveSkillFiles } from '@skill-tools/core';
import { Command } from 'commander';
import { formatLintJson, formatScoreJson, formatValidationJson } from './formatters/json.js';
import { formatLint, formatScore, formatValidation } from './formatters/text.js';
import { lint } from './linter.js';
import { score } from './scorer/index.js';
import { validate } from './validator.js';

const program = new Command();

program
	.name('skill-tools')
	.description('Validate, lint, and score Agent Skills (SKILL.md) files')
	.version('0.1.1');

// --- validate command ---

program
	.command('validate')
	.alias('v')
	.description('Validate SKILL.md files against the Agent Skills specification')
	.argument('<path>', 'Path to SKILL.md file, skill directory, or directory of skills')
	.option('-f, --format <format>', 'Output format: text or json', 'text')
	.action(async (path: string, opts: { format: string }) => {
		const results = await validate(path);
		const output =
			opts.format === 'json' ? formatValidationJson(results) : formatValidation(results);
		console.log(output);

		const hasErrors = results.some((r) => !r.valid);
		process.exitCode = hasErrors ? 1 : 0;
	});

// --- lint command ---

program
	.command('lint')
	.alias('l')
	.description('Lint SKILL.md files for quality issues beyond spec compliance')
	.argument('<path>', 'Path to SKILL.md file, skill directory, or directory of skills')
	.option('-f, --format <format>', 'Output format: text or json', 'text')
	.option(
		'--fail-on <severity>',
		'Fail if any diagnostic has this severity or higher: error, warning, info',
		'error',
	)
	.action(async (path: string, opts: { format: string; failOn: string }) => {
		const locations = await resolveSkillFiles(path);

		if (locations.length === 0) {
			console.error(`No SKILL.md files found at: ${path}`);
			process.exitCode = 1;
			return;
		}

		const results = [];
		for (const location of locations) {
			const parseResult = await parseSkill(location.skillFile);
			if (!parseResult.ok) {
				console.error(
					`Failed to parse ${location.skillFile}: ${parseResult.diagnostics.map((d) => d.message).join(', ')}`,
				);
				continue;
			}
			results.push(lint(parseResult.skill));
		}

		const output = opts.format === 'json' ? formatLintJson(results) : formatLint(results);
		console.log(output);

		const failSeverities = getFailSeverities(opts.failOn);
		const hasFails = results.some((r) => r.diagnostics.some((d) => failSeverities.has(d.severity)));
		process.exitCode = hasFails ? 1 : 0;
	});

// --- score command ---

program
	.command('score')
	.alias('s')
	.description('Compute a quality score (0-100) for SKILL.md files')
	.argument('<path>', 'Path to SKILL.md file, skill directory, or directory of skills')
	.option('-f, --format <format>', 'Output format: text or json', 'text')
	.option('--min-score <score>', 'Fail if any skill scores below this threshold', '0')
	.action(async (path: string, opts: { format: string; minScore: string }) => {
		const locations = await resolveSkillFiles(path);
		const minScore = Number.parseInt(opts.minScore, 10);

		if (Number.isNaN(minScore) || minScore < 0 || minScore > 100) {
			console.error('--min-score must be a number between 0 and 100');
			process.exitCode = 1;
			return;
		}

		if (locations.length === 0) {
			console.error(`No SKILL.md files found at: ${path}`);
			process.exitCode = 1;
			return;
		}

		let anyBelowMin = false;

		for (const location of locations) {
			const parseResult = await parseSkill(location.skillFile);
			if (!parseResult.ok) {
				console.error(
					`Failed to parse ${location.skillFile}: ${parseResult.diagnostics.map((d) => d.message).join(', ')}`,
				);
				anyBelowMin = true;
				continue;
			}

			const qualityScore = score(parseResult.skill);
			const name = parseResult.skill.metadata.name ?? location.dirName;

			const output =
				opts.format === 'json'
					? formatScoreJson(name, qualityScore)
					: formatScore(name, qualityScore);
			console.log(output);

			if (qualityScore.score < minScore) {
				anyBelowMin = true;
			}
		}

		process.exitCode = anyBelowMin ? 1 : 0;
	});

// --- check command (validate + lint + score in one) ---

program
	.command('check')
	.alias('c')
	.description('Run validate + lint + score in a single pass')
	.argument('<path>', 'Path to SKILL.md file, skill directory, or directory of skills')
	.option('-f, --format <format>', 'Output format: text or json', 'text')
	.option('--min-score <score>', 'Fail if any skill scores below this threshold', '0')
	.action(async (path: string, opts: { format: string; minScore: string }) => {
		const minScore = Number.parseInt(opts.minScore, 10);

		// Validate
		const validationResults = await validate(path);
		if (opts.format === 'json') {
			console.log(formatValidationJson(validationResults));
		} else {
			console.log(formatValidation(validationResults));
		}

		// Lint and score only valid skills
		const validSkills = validationResults.filter((r) => r.valid && r.skill);
		let anyBelowMin = false;

		for (const result of validSkills) {
			const skill = result.skill!;

			// Lint
			const lintResult = lint(skill);
			if (opts.format === 'json') {
				console.log(formatLintJson([lintResult]));
			} else {
				console.log(formatLint([lintResult]));
			}

			// Score
			const qualityScore = score(skill);
			const name = skill.metadata.name ?? result.name;
			if (opts.format === 'json') {
				console.log(formatScoreJson(name, qualityScore));
			} else {
				console.log(formatScore(name, qualityScore));
			}

			if (qualityScore.score < minScore) {
				anyBelowMin = true;
			}
		}

		const hasValidationErrors = validationResults.some((r) => !r.valid);
		process.exitCode = hasValidationErrors || anyBelowMin ? 1 : 0;
	});

function getFailSeverities(failOn: string): Set<string> {
	switch (failOn) {
		case 'info':
			return new Set(['error', 'warning', 'info']);
		case 'warning':
			return new Set(['error', 'warning']);
		default:
			return new Set(['error']);
	}
}

program.parse();
