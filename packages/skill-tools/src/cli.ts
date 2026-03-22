import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseSkill, resolveSkillFiles } from '@skill-tools/core';
import { SkillRouter } from '@skill-tools/router';
import { Command } from 'commander';
import { formatLintJson, formatScoreJson, formatValidationJson } from './formatters/json.js';
import { formatConflictsJson, formatRouteJson } from './formatters/route-json.js';
import { formatConflicts, formatRouteResults } from './formatters/route-text.js';
import { formatLint, formatScore, formatValidation } from './formatters/text.js';
import { formatWatchResult } from './formatters/watch-text.js';
import { installPreCommitHook } from './hooks.js';
import { lint } from './linter.js';
import { toSarif } from './sarif.js';
import { score } from './scorer/index.js';
import { validate } from './validator.js';
import { watchSkills } from './watcher.js';

const program = new Command();

program
	.name('skill-tools')
	.description('Validate, lint, and score Agent Skills (SKILL.md) files')
	.version('0.2.2');

// --- validate command ---

program
	.command('validate')
	.alias('v')
	.description('Validate SKILL.md files against the Agent Skills specification')
	.argument('<path>', 'Path to SKILL.md file, skill directory, or directory of skills')
	.option('-f, --format <format>', 'Output format: text or json', 'text')
	.action(async (path: string, opts: { format: string }) => {
		const start = performance.now();
		const results = await validate(path);
		const elapsed = performance.now() - start;

		const output =
			opts.format === 'json' ? formatValidationJson(results) : formatValidation(results, elapsed);
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
		const start = performance.now();
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

		const elapsed = performance.now() - start;
		const output = opts.format === 'json' ? formatLintJson(results) : formatLint(results, elapsed);
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
		const start = performance.now();
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
			const elapsed = performance.now() - start;

			const output =
				opts.format === 'json'
					? formatScoreJson(name, qualityScore)
					: formatScore(name, qualityScore, elapsed);
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
	.option('-f, --format <format>', 'Output format: text, json, or sarif', 'text')
	.option(
		'--fail-on <severity>',
		'Fail if any diagnostic has this severity or higher: error, warning, info',
		'error',
	)
	.option('--min-score <score>', 'Fail if any skill scores below this threshold', '0')
	.action(async (path: string, opts: { format: string; failOn: string; minScore: string }) => {
		const start = performance.now();
		const minScore = Number.parseInt(opts.minScore, 10);

		// Validate
		const validationResults = await validate(path);
		const validateElapsed = performance.now() - start;

		// Lint and score only valid skills
		const validSkills = validationResults.filter((r) => r.valid && r.skill);
		let anyBelowMin = false;
		const failSeverities = getFailSeverities(opts.failOn);
		let hasLintFails = false;
		const allLintResults: ReturnType<typeof lint>[] = [];
		const allScores: Array<{ name: string; qualityScore: ReturnType<typeof score> }> = [];

		for (const result of validSkills) {
			const skill = result.skill!;
			const lintResult = lint(skill);
			allLintResults.push(lintResult);

			if (lintResult.diagnostics.some((d) => failSeverities.has(d.severity))) {
				hasLintFails = true;
			}

			const qualityScore = score(skill);
			const name = skill.metadata.name ?? result.name;
			allScores.push({ name, qualityScore });
			if (qualityScore.score < minScore) {
				anyBelowMin = true;
			}
		}

		// Output based on format
		if (opts.format === 'sarif') {
			console.log(JSON.stringify(toSarif(validationResults, allLintResults), null, 2));
		} else {
			if (opts.format === 'json') {
				console.log(formatValidationJson(validationResults));
			} else {
				console.log(formatValidation(validationResults, validateElapsed));
			}

			for (let i = 0; i < validSkills.length; i++) {
				const lintResult = allLintResults[i]!;
				const { name, qualityScore } = allScores[i]!;
				const elapsed = performance.now() - start;

				if (opts.format === 'json') {
					console.log(formatLintJson([lintResult]));
					console.log(formatScoreJson(name, qualityScore));
				} else {
					console.log(formatLint([lintResult], elapsed));
					console.log(formatScore(name, qualityScore, elapsed));
				}
			}
		}

		const hasValidationErrors = validationResults.some((r) => !r.valid);
		process.exitCode = hasValidationErrors || hasLintFails || anyBelowMin ? 1 : 0;
	});

// --- init command ---

program
	.command('init')
	.description('Scaffold a new skill directory with SKILL.md template')
	.argument('<name>', 'Skill name (kebab-case, e.g. deploy-vercel)')
	.option('-o, --out <dir>', 'Parent directory for the skill', '.')
	.option('-d, --description <desc>', 'Skill description')
	.option('--with-scripts', 'Include a scripts/ directory with example script')
	.option('--with-references', 'Include a references/ directory with template')
	.action(
		async (
			name: string,
			opts: {
				out: string;
				description?: string;
				withScripts?: boolean;
				withReferences?: boolean;
			},
		) => {
			// Validate name format
			const namePattern = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]?$/;
			if (!namePattern.test(name) || /--/.test(name)) {
				console.error(
					`Invalid skill name "${name}". Must be kebab-case, 1-64 chars, no consecutive hyphens.`,
				);
				process.exitCode = 1;
				return;
			}

			const skillDir = resolve(opts.out, name);
			const desc = opts.description ?? `TODO: Describe what ${name} does and when to use it`;

			// Create skill directory
			await mkdir(skillDir, { recursive: true });

			// Generate SKILL.md
			const skillMd = [
				'---',
				`name: ${name}`,
				`description: "${desc}"`,
				'---',
				'',
				`# ${name}`,
				'',
				'## Usage',
				'',
				'1. Step one',
				'2. Step two',
				'3. Step three',
				'',
				'## Examples',
				'',
				'```bash',
				`# Example invocation`,
				'```',
				'',
				'## Error Handling',
				'',
				'- If step one fails: try ...',
				'- If the API returns an error: check ...',
				'',
			].join('\n');

			await writeFile(join(skillDir, 'SKILL.md'), skillMd, 'utf-8');
			console.log(`  Created: ${join(skillDir, 'SKILL.md')}`);

			// Optional scripts directory
			if (opts.withScripts) {
				const scriptsDir = join(skillDir, 'scripts');
				await mkdir(scriptsDir, { recursive: true });

				const exampleScript = [
					'#!/usr/bin/env bash',
					'set -euo pipefail',
					'',
					`# ${name} — helper script`,
					'# This script is referenced from SKILL.md',
					'',
					'echo "TODO: implement"',
					'',
				].join('\n');

				await writeFile(join(scriptsDir, 'run.sh'), exampleScript, 'utf-8');
				console.log(`  Created: ${join(scriptsDir, 'run.sh')}`);
			}

			// Optional references directory
			if (opts.withReferences) {
				const refsDir = join(skillDir, 'references');
				await mkdir(refsDir, { recursive: true });

				const refDoc = [
					`# ${name} — Reference`,
					'',
					'Detailed reference documentation for the skill.',
					'This file is loaded on-demand when the agent needs deeper context.',
					'',
					'## API Reference',
					'',
					'TODO: Add detailed API documentation here.',
					'',
				].join('\n');

				await writeFile(join(refsDir, 'REFERENCE.md'), refDoc, 'utf-8');
				console.log(`  Created: ${join(refsDir, 'REFERENCE.md')}`);
			}

			console.log('');
			console.log(`Skill "${name}" created at ${skillDir}`);
			console.log('');
			console.log('Next steps:');
			console.log(`  1. Edit ${join(skillDir, 'SKILL.md')} with your instructions`);
			console.log(`  2. Run: skill-tools check ${skillDir}`);
		},
	);

// --- to-prompt command ---

program
	.command('to-prompt')
	.description('Generate <available_skills> XML for agent system prompt injection')
	.argument('<paths...>', 'Paths to SKILL.md files, skill directories, or directories of skills')
	.option(
		'--include-location',
		'Include <location> element with file paths (for filesystem-based agents)',
	)
	.option('-f, --format <format>', 'Output format: xml or json', 'xml')
	.action(async (paths: string[], opts: { includeLocation?: boolean; format: string }) => {
		const skills: Array<{
			name: string;
			description: string;
			path: string;
		}> = [];

		for (const searchPath of paths) {
			const locations = await resolveSkillFiles(searchPath);
			for (const location of locations) {
				const parseResult = await parseSkill(location.skillFile);
				if (parseResult.ok && parseResult.skill.metadata.description) {
					skills.push({
						name: parseResult.skill.metadata.name ?? location.dirName,
						description: parseResult.skill.metadata.description,
						path: location.skillFile,
					});
				}
			}
		}

		if (skills.length === 0) {
			console.error('No valid skills found at the specified paths');
			process.exitCode = 1;
			return;
		}

		if (opts.format === 'json') {
			const jsonSkills = skills.map((s) => ({
				name: s.name,
				description: s.description,
				...(opts.includeLocation ? { location: s.path } : {}),
			}));
			console.log(JSON.stringify(jsonSkills, null, 2));
		} else {
			// XML format per agentskills.io/integrate-skills
			const xmlLines = ['<available_skills>'];
			for (const skill of skills) {
				xmlLines.push('  <skill>');
				xmlLines.push(`    <name>${escapeXml(skill.name)}</name>`);
				xmlLines.push(`    <description>${escapeXml(skill.description)}</description>`);
				if (opts.includeLocation) {
					xmlLines.push(`    <location>${escapeXml(skill.path)}</location>`);
				}
				xmlLines.push('  </skill>');
			}
			xmlLines.push('</available_skills>');
			console.log(xmlLines.join('\n'));
		}
	});

// --- route command ---

program
	.command('route')
	.alias('r')
	.description('Route queries to the most relevant skills using BM25 search')
	.argument('[query]', 'Query to match against indexed skills')
	.option('-s, --skills <path>', 'Path to skills directory to index')
	.option('--index <path>', 'Path to skills directory to build index from')
	.option('--save <file>', 'Save index snapshot to JSON file')
	.option('--load <file>', 'Load index snapshot from JSON file')
	.option('--conflicts', 'Detect conflicting/overlapping skills')
	.option('-k, --top-k <n>', 'Number of results to return', '3')
	.option('--threshold <n>', 'Minimum score threshold', '0')
	.option('-f, --format <format>', 'Output format: text or json', 'text')
	.action(
		async (
			query: string | undefined,
			opts: {
				skills?: string;
				index?: string;
				save?: string;
				load?: string;
				conflicts?: boolean;
				topK: string;
				threshold: string;
				format: string;
			},
		) => {
			const start = performance.now();

			// --- Conflicts mode ---
			if (opts.conflicts) {
				const dirPath = opts.skills ?? opts.index;
				if (!dirPath) {
					console.error('--conflicts requires --skills or --index <path>');
					process.exitCode = 1;
					return;
				}

				const router = new SkillRouter();
				const count = await router.indexDirectory(resolve(dirPath));
				if (count === 0) {
					console.error(`No skills found at: ${dirPath}`);
					process.exitCode = 1;
					return;
				}

				const conflicts = await router.detectConflicts();
				const elapsed = performance.now() - start;
				const output =
					opts.format === 'json'
						? formatConflictsJson(conflicts)
						: formatConflicts(conflicts, elapsed);
				console.log(output);
				process.exitCode = conflicts.length > 0 ? 1 : 0;
				return;
			}

			// --- Index + save mode ---
			if (opts.index && opts.save && !query) {
				const router = new SkillRouter();
				const count = await router.indexDirectory(resolve(opts.index));
				if (count === 0) {
					console.error(`No skills found at: ${opts.index}`);
					process.exitCode = 1;
					return;
				}

				const snapshot = router.save();
				await writeFile(resolve(opts.save), JSON.stringify(snapshot, null, 2), 'utf-8');
				const elapsed = performance.now() - start;
				console.log(
					`Indexed ${count} skills, snapshot saved to ${opts.save} (${elapsed.toFixed(1)}ms)`,
				);
				return;
			}

			// --- Query mode ---
			if (!query) {
				console.error('A query argument is required (or use --conflicts or --index --save)');
				process.exitCode = 1;
				return;
			}

			const topK = Number.parseInt(opts.topK, 10);
			const threshold = Number.parseFloat(opts.threshold);

			const router = new SkillRouter();

			if (opts.load) {
				const raw = await readFile(resolve(opts.load), 'utf-8');
				const snapshot = JSON.parse(raw);
				router.load(snapshot);
			} else {
				const dirPath = opts.skills ?? opts.index;
				if (!dirPath) {
					console.error('Query mode requires --skills <path> or --load <file>');
					process.exitCode = 1;
					return;
				}
				const count = await router.indexDirectory(resolve(dirPath));
				if (count === 0) {
					console.error(`No skills found at: ${dirPath}`);
					process.exitCode = 1;
					return;
				}
			}

			const results = await router.select(query, { topK, threshold });
			const elapsed = performance.now() - start;

			const output =
				opts.format === 'json'
					? formatRouteJson(results)
					: formatRouteResults(results, query, elapsed);
			console.log(output);
			process.exitCode = results.length === 0 ? 1 : 0;
		},
	);

// --- watch command ---

program
	.command('watch')
	.alias('w')
	.description('Watch SKILL.md files for changes and re-run validate + lint + score')
	.argument('<path>', 'Path to skill directory or directory of skills')
	.option('-f, --format <format>', 'Output format: text or json', 'text')
	.option('--debounce <ms>', 'Debounce interval in milliseconds', '300')
	.action((path: string, opts: { format: string; debounce: string }) => {
		const debounceMs = Number.parseInt(opts.debounce, 10);

		const handle = watchSkills(
			path,
			{ debounceMs },
			(result) => {
				if (opts.format === 'json') {
					const jsonResult = {
						...result,
						previousScores: Object.fromEntries(result.previousScores),
					};
					console.log(JSON.stringify(jsonResult, null, 2));
				} else {
					console.log(formatWatchResult(result));
				}
			},
			(err) => {
				console.error(`Watch error: ${err.message}`);
			},
		);

		process.on('SIGINT', () => {
			handle.close();
			console.log('\nStopped watching.');
			process.exit(0);
		});
	});

// --- hook command ---

const hook = program.command('hook').description('Git hook management');

hook
	.command('install')
	.description('Install a pre-commit hook that checks staged SKILL.md files')
	.option('--min-score <n>', 'Minimum score threshold for the hook', '0')
	.option('--fail-on <severity>', 'Severity threshold: error, warning, info', 'error')
	.option('--git-dir <path>', 'Path to .git directory', '.git')
	.action(async (opts: { minScore: string; failOn: string; gitDir: string }) => {
		const result = await installPreCommitHook(resolve(opts.gitDir), {
			minScore: Number.parseInt(opts.minScore, 10),
			failOn: opts.failOn,
		});

		if (result.appended) {
			console.log(`Appended skill-tools hook to ${result.path}`);
		} else if (result.alreadyPresent) {
			console.log(`Hook already installed at ${result.path}`);
		} else {
			console.log(`Installed pre-commit hook at ${result.path}`);
		}
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

/**
 * Escape special XML characters.
 */
function escapeXml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

program.parse();
