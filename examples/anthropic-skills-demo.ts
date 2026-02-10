/**
 * Full Ecosystem Demo — Analyzing the official Anthropic Skills repo
 *
 * This demo clones https://github.com/anthropics/skills and runs the full
 * skill-tools pipeline:
 *
 *   1. @skill-tools/core   — Parse every SKILL.md
 *   2. skill-tools          — Validate, lint, and score each skill
 *   3. @skill-tools/router  — Build a BM25 index and run sample queries
 *
 * Run:
 *   npx tsx examples/anthropic-skills-demo.ts
 *
 * Prerequisites:
 *   - pnpm build  (to compile all packages)
 *   - git (to clone the repo)
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseSkill, resolveSkillFiles } from '@skill-tools/core';
import type { Skill } from '@skill-tools/core';
import { SkillRouter } from '@skill-tools/router';
import { lint, score, validate } from 'skill-tools';

// ─── Config ──────────────────────────────────────────────────────────────────
const REPO_URL = 'https://github.com/anthropics/skills.git';
const CLONE_DIR = resolve(import.meta.dirname ?? '.', '.anthropic-skills-clone');
const SKILLS_DIR = join(CLONE_DIR, 'skills');

// ─── Helpers ─────────────────────────────────────────────────────────────────
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';

function header(title: string): void {
	console.log('');
	console.log(`${BOLD}${'═'.repeat(70)}${RESET}`);
	console.log(`${BOLD}  ${title}${RESET}`);
	console.log(`${BOLD}${'═'.repeat(70)}${RESET}`);
	console.log('');
}

function subheader(title: string): void {
	console.log(`\n${CYAN}--- ${title} ---${RESET}\n`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	// ─── Step 0: Clone the repo ──────────────────────────────────────────────

	header('Step 0: Cloning anthropics/skills');

	if (existsSync(CLONE_DIR)) {
		console.log(`${DIM}Reusing existing clone at ${CLONE_DIR}${RESET}`);
	} else {
		console.log(`Cloning ${REPO_URL}...`);
		execSync(`git clone --depth 1 ${REPO_URL} "${CLONE_DIR}"`, { stdio: 'inherit' });
	}

	// ─── Step 1: Parse every SKILL.md with @skill-tools/core ─────────────────

	header('Step 1: Parse — @skill-tools/core');

	const locations = await resolveSkillFiles(SKILLS_DIR);
	console.log(`Discovered ${BOLD}${locations.length}${RESET} skills in ${SKILLS_DIR}\n`);

	const parsedSkills: Skill[] = [];
	for (const loc of locations) {
		const result = await parseSkill(loc.skillFile);
		if (result.ok) {
			parsedSkills.push(result.skill);
			const desc =
				result.skill.metadata.description?.slice(0, 80) ??
				`${DIM}(no description)${RESET}`;
			console.log(
				`  ${GREEN}✓${RESET} ${(result.skill.metadata.name ?? loc.dirName).padEnd(24)} ` +
					`${DIM}${result.skill.tokenCount} tokens${RESET}  ${desc}...`,
			);
		} else {
			console.log(
				`  ${RED}✗${RESET} ${loc.dirName.padEnd(24)} ${result.diagnostics.map((d) => d.message).join('; ')}`,
			);
		}
	}

	console.log(`\n${BOLD}Parsed: ${parsedSkills.length}/${locations.length}${RESET}`);

	// ─── Step 2: Validate all skills ─────────────────────────────────────────

	header('Step 2: Validate — skill-tools validate');

	const validationResults = await validate(SKILLS_DIR);
	let passCount = 0;
	let failCount = 0;

	for (const result of validationResults) {
		if (result.valid) {
			passCount++;
			console.log(`  ${GREEN}✓ PASS${RESET}  ${result.name}`);
		} else {
			failCount++;
			console.log(`  ${RED}✗ FAIL${RESET}  ${result.name}`);
			for (const d of result.diagnostics) {
				const icon = d.severity === 'error' ? RED : d.severity === 'warning' ? YELLOW : CYAN;
				console.log(`    ${icon}${d.severity}${RESET}: ${d.message} ${DIM}(${d.ruleId})${RESET}`);
			}
		}
	}

	console.log(
		`\n${BOLD}Validation: ${GREEN}${passCount} passed${RESET}, ${failCount > 0 ? `${RED}${failCount} failed` : `${GREEN}0 failed`}${RESET}`,
	);

	// ─── Step 3: Lint all valid skills ───────────────────────────────────────

	header('Step 3: Lint — skill-tools lint');

	let totalErrors = 0;
	let totalWarnings = 0;
	let totalInfo = 0;

	for (const skill of parsedSkills) {
		const result = lint(skill);
		totalErrors += result.errorCount;
		totalWarnings += result.warningCount;
		totalInfo += result.infoCount;

		if (result.diagnostics.length > 0) {
			console.log(`  ${BOLD}${result.name}${RESET}`);
			for (const d of result.diagnostics) {
				const icon = d.severity === 'error' ? RED : d.severity === 'warning' ? YELLOW : CYAN;
				console.log(`    ${icon}${d.severity}${RESET}: ${d.message} ${DIM}(${d.ruleId})${RESET}`);
			}
		}
	}

	console.log(`\n${BOLD}Lint Summary:${RESET}`);
	if (totalErrors > 0) console.log(`  ${RED}${totalErrors} error(s)${RESET}`);
	if (totalWarnings > 0) console.log(`  ${YELLOW}${totalWarnings} warning(s)${RESET}`);
	if (totalInfo > 0) console.log(`  ${CYAN}${totalInfo} info${RESET}`);
	if (totalErrors + totalWarnings + totalInfo === 0) {
		console.log(`  ${GREEN}No lint issues found!${RESET}`);
	}

	// ─── Step 4: Score all valid skills ──────────────────────────────────────

	header('Step 4: Score — skill-tools score');

	const scores: Array<{ name: string; total: number }> = [];

	for (const skill of parsedSkills) {
		const qualityScore = score(skill);
		const name = skill.metadata.name ?? 'unknown';
		scores.push({ name, total: qualityScore.score });

		const stars =
			qualityScore.score >= 90
				? '★★★★★'
				: qualityScore.score >= 75
					? '★★★★'
					: qualityScore.score >= 60
						? '★★★'
						: qualityScore.score >= 40
							? '★★'
							: '★';

		console.log(`  ${name.padEnd(24)} ${BOLD}${qualityScore.score}/100${RESET}  ${stars}`);

		for (const [, dim] of Object.entries(qualityScore.dimensions)) {
			const barWidth = 10;
			const filled = Math.round((dim.score / dim.max) * barWidth);
			const bar = `${GREEN}${'█'.repeat(filled)}${DIM}${'░'.repeat(barWidth - filled)}${RESET}`;
			console.log(`    ${dim.label.padEnd(24)} ${bar}  ${dim.score}/${dim.max}`);
		}
		console.log('');
	}

	// Rank by score
	scores.sort((a, b) => b.total - a.total);
	subheader('Skill Rankings');
	for (let i = 0; i < scores.length; i++) {
		const s = scores[i]!;
		const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
		console.log(`  ${medal} ${s.name.padEnd(24)} ${s.total}/100`);
	}

	const avgScore =
		scores.length > 0 ? scores.reduce((sum, s) => sum + s.total, 0) / scores.length : 0;
	console.log(`\n${BOLD}Average Score: ${avgScore.toFixed(1)}/100${RESET}`);

	// ─── Step 5: BM25 Skill Routing ──────────────────────────────────────────

	header('Step 5: Route — @skill-tools/router (BM25)');

	const router = new SkillRouter();
	await router.indexSkills(
		parsedSkills
			.filter((s) => s.metadata.description)
			.map((s) => ({
				name: s.metadata.name ?? 'unknown',
				description: s.metadata.description!,
				path: s.filePath,
			})),
	);

	console.log(`Indexed ${BOLD}${router.count}${RESET} skills into BM25\n`);

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
	];

	for (const query of queries) {
		const results = await router.select(query, { topK: 3 });
		console.log(`  ${BOLD}Q: "${query}"${RESET}`);
		for (const r of results) {
			const scoreBar = '█'.repeat(Math.round(r.score * 10));
			console.log(`    ${GREEN}${scoreBar.padEnd(10)}${RESET} ${r.score.toFixed(3)}  ${r.skill}`);
		}
		console.log('');
	}

	// ─── Step 6: Conflict Detection ──────────────────────────────────────────

	subheader('Conflict Detection (threshold: 0.5)');

	const conflicts = await router.detectConflicts(0.5);
	if (conflicts.length > 0) {
		for (const c of conflicts) {
			console.log(
				`  ${YELLOW}Overlap:${RESET} [${c.skills.join(', ')}]  similarity: ${c.similarity.toFixed(3)}`,
			);
			console.log(`    ${DIM}${c.suggestion}${RESET}`);
		}
	} else {
		console.log(`  ${GREEN}No conflicting skills detected${RESET}`);
	}

	// ─── Step 7: Snapshot persistence ────────────────────────────────────────

	subheader('Snapshot Persistence');

	const snapshot = router.save();
	console.log(`  Provider:    ${snapshot.embeddingProvider}`);
	console.log(`  Skills:      ${snapshot.skillNames.length}`);
	console.log(`  Serialized:  ${JSON.stringify(snapshot).length.toLocaleString()} bytes`);

	const restored = SkillRouter.fromSnapshot(snapshot);
	const restoredResults = await restored.select('create a document', { topK: 2 });
	console.log(`\n  Restored router query "create a document":`);
	for (const r of restoredResults) {
		console.log(`    ${r.skill.padEnd(20)} score: ${r.score.toFixed(3)}`);
	}

	// ─── Summary ─────────────────────────────────────────────────────────────

	header('Summary');

	console.log(`  Skills discovered:   ${locations.length}`);
	console.log(`  Successfully parsed: ${parsedSkills.length}`);
	console.log(`  Validation passed:   ${passCount}/${validationResults.length}`);
	console.log(
		`  Lint issues:         ${totalErrors} errors, ${totalWarnings} warnings, ${totalInfo} info`,
	);
	console.log(`  Average score:       ${avgScore.toFixed(1)}/100`);
	console.log(`  BM25 index size:     ${router.count} skills`);
	console.log(`  Snapshot size:       ${JSON.stringify(snapshot).length.toLocaleString()} bytes`);
	console.log('');
	console.log(`${GREEN}${BOLD}Full ecosystem demo complete!${RESET}`);
	console.log('');
}

main().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
