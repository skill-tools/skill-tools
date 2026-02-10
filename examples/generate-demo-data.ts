/**
 * Generate static demo data JSON from multiple skill repos
 * for use in the skills.menu website demo page.
 *
 * Run: pnpm tsx examples/generate-demo-data.ts
 */
import { execSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseSkill, resolveSkillFiles } from '@skill-tools/core';
import type { Skill } from '@skill-tools/core';
import { SkillRouter } from '@skill-tools/router';
import { lint, score, validate } from 'skill-tools';

const CLONE_BASE = resolve(import.meta.dirname ?? '.', '.demo-clones');

const REPOS = [
	{
		label: 'anthropics/skills',
		url: 'https://github.com/anthropics/skills.git',
		skillsDirs: ['skills'],
	},
	{
		label: 'openai/skills',
		url: 'https://github.com/openai/skills.git',
		// Hidden directories (.curated, .system) are skipped by resolveSkillFiles,
		// so we point directly into each subdirectory
		skillsDirs: ['skills/.curated', 'skills/.system'],
	},
	{
		label: 'vercel-labs/agent-skills',
		url: 'https://github.com/vercel-labs/agent-skills.git',
		skillsDirs: ['skills', 'skills/claude.ai'],
	},
];

interface ParseEntry {
	name: string;
	source: string;
	ok: boolean;
	tokenCount?: number;
	description?: string;
	errors?: string[];
}

interface ValidationEntry {
	name: string;
	source: string;
	valid: boolean;
	diagnostics: Array<{ severity: string; message: string; ruleId: string }>;
}

interface LintEntry {
	name: string;
	source: string;
	errorCount: number;
	warningCount: number;
	infoCount: number;
	diagnostics: Array<{ severity: string; message: string; ruleId: string }>;
}

interface ScoreEntry {
	name: string;
	source: string;
	score: number;
	dimensions: Array<{ label: string; score: number; max: number }>;
}

async function main(): Promise<void> {
	if (!existsSync(CLONE_BASE)) {
		execSync(`mkdir -p "${CLONE_BASE}"`);
	}

	const allParsedSkills: Array<Skill & { _source: string }> = [];
	const allParseResults: ParseEntry[] = [];
	const allValidationData: ValidationEntry[] = [];
	const allLintData: LintEntry[] = [];
	const allScoreData: ScoreEntry[] = [];

	let totalSkills = 0;

	for (const repo of REPOS) {
		const cloneDir = join(CLONE_BASE, repo.label.replace('/', '-'));

		console.log(`\n--- ${repo.label} ---`);

		// Clone
		if (existsSync(cloneDir)) {
			console.log(`  Reusing existing clone...`);
		} else {
			console.log(`  Cloning ${repo.url}...`);
			execSync(`git clone --depth 1 ${repo.url} "${cloneDir}"`, { stdio: 'inherit' });
		}

		// Parse across all skill directories for this repo
		const seenNames = new Set<string>();
		for (const dir of repo.skillsDirs) {
			const skillsDir = join(cloneDir, dir);
			if (!existsSync(skillsDir)) continue;

			const locations = await resolveSkillFiles(skillsDir);
			for (const loc of locations) {
				// Avoid duplicates when parent/child dirs overlap
				if (seenNames.has(loc.dirName)) continue;
				seenNames.add(loc.dirName);
				totalSkills++;

				const result = await parseSkill(loc.skillFile);
				if (result.ok) {
					const tagged = Object.assign(result.skill, { _source: repo.label });
					allParsedSkills.push(tagged);
					allParseResults.push({
						name: result.skill.metadata.name ?? loc.dirName,
						source: repo.label,
						ok: true,
						tokenCount: result.skill.tokenCount,
						description: result.skill.metadata.description?.slice(0, 120),
					});
				} else {
					allParseResults.push({
						name: loc.dirName,
						source: repo.label,
						ok: false,
						errors: result.diagnostics.map((d) => d.message),
					});
				}
			}

			// Validate
			const validationResults = await validate(skillsDir);
			for (const r of validationResults) {
				if (allValidationData.some((v) => v.name === r.name && v.source === repo.label)) continue;
				allValidationData.push({
					name: r.name,
					source: repo.label,
					valid: r.valid,
					diagnostics: r.diagnostics.map((d) => ({
						severity: d.severity,
						message: d.message,
						ruleId: d.ruleId,
					})),
				});
			}
		}

		console.log(`  Found ${seenNames.size} skills`);

		// Lint & Score parsed skills from this repo
		for (const skill of allParsedSkills.filter((s) => s._source === repo.label)) {
			// Skip if already processed (from a previous skillsDir iteration)
			if (allLintData.some((l) => l.name === (skill.metadata.name ?? 'unknown') && l.source === repo.label)) continue;

			const lintResult = lint(skill);
			allLintData.push({
				name: lintResult.name,
				source: repo.label,
				errorCount: lintResult.errorCount,
				warningCount: lintResult.warningCount,
				infoCount: lintResult.infoCount,
				diagnostics: lintResult.diagnostics.map((d) => ({
					severity: d.severity,
					message: d.message,
					ruleId: d.ruleId,
				})),
			});

			const qualityScore = score(skill);
			const name = skill.metadata.name ?? 'unknown';
			const dims = Object.entries(qualityScore.dimensions).map(([, dim]) => ({
				label: dim.label,
				score: dim.score,
				max: dim.max,
			}));
			allScoreData.push({ name, source: repo.label, score: qualityScore.score, dimensions: dims });
		}
	}

	allScoreData.sort((a, b) => b.score - a.score);

	// Route — build BM25 index from all parsed skills
	const router = new SkillRouter();
	await router.indexSkills(
		allParsedSkills
			.filter((s) => s.metadata.description)
			.map((s) => ({
				name: s.metadata.name ?? 'unknown',
				description: s.metadata.description!,
				path: s.filePath,
			})),
	);

	const queries = [
		'create a PDF document',
		'build an MCP server',
		'deploy a web application',
		'make a PowerPoint presentation',
		'write tests for my webapp',
		'create an animated GIF',
		'design a frontend UI',
		'write internal communications',
		'generate algorithmic art',
		'create an Excel spreadsheet',
		'implement Figma design',
		'deploy to Cloudflare',
		'create a Jupyter notebook',
		'fix CI pipeline',
		'generate images with AI',
	];

	const routeData: Array<{
		query: string;
		results: Array<{ skill: string; score: number }>;
	}> = [];

	for (const query of queries) {
		const results = await router.select(query, { topK: 3 });
		routeData.push({
			query,
			results: results.map((r) => ({
				skill: r.skill,
				score: Math.round(r.score * 1000) / 1000,
			})),
		});
	}

	// Conflicts — threshold 0.7 filters shared markdown vocabulary noise
	const conflicts = await router.detectConflicts(0.7);
	const conflictData = conflicts.map((c) => ({
		skills: c.skills,
		similarity: Math.round(c.similarity * 1000) / 1000,
		suggestion: c.suggestion,
	}));

	// Summary
	const totalLintErrors = allLintData.reduce((s, l) => s + l.errorCount, 0);
	const totalLintWarnings = allLintData.reduce((s, l) => s + l.warningCount, 0);
	const totalLintInfo = allLintData.reduce((s, l) => s + l.infoCount, 0);
	const avgScore =
		allScoreData.length > 0
			? Math.round((allScoreData.reduce((s, d) => s + d.score, 0) / allScoreData.length) * 10) / 10
			: 0;

	const demoData = {
		generatedAt: new Date().toISOString(),
		sources: REPOS.map((r) => r.label),
		summary: {
			totalSkills,
			parsed: allParsedSkills.length,
			validationPassed: allValidationData.filter((r) => r.valid).length,
			validationFailed: allValidationData.filter((r) => !r.valid).length,
			lintErrors: totalLintErrors,
			lintWarnings: totalLintWarnings,
			lintInfo: totalLintInfo,
			avgScore,
			indexedSkills: router.count,
		},
		parse: allParseResults,
		validation: allValidationData,
		lint: allLintData,
		scores: allScoreData,
		routing: routeData,
		conflicts: conflictData,
	};

	const outputPath = resolve(import.meta.dirname ?? '.', 'demo-data.json');
	writeFileSync(outputPath, JSON.stringify(demoData, null, '\t'));
	console.log(`\nDemo data written to ${outputPath}`);
	console.log(
		`Summary: ${totalSkills} skills from ${REPOS.length} repos, ${allParsedSkills.length} parsed, avg score ${avgScore}/100`,
	);
}

main().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
