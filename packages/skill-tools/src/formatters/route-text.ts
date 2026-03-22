import type { ConflictGroup, SelectionResult } from '@skill-tools/router';

// ── ANSI codes ──────────────────────────────────────────────────────

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';

// ── Layout helpers ──────────────────────────────────────────────────

const RULE = `${DIM}${'─'.repeat(50)}${RESET}`;

function pad(str: string, width: number): string {
	// Strip ANSI for length calculation
	// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape stripping requires matching \x1b
	const visible = str.replace(/\x1b\[[0-9;]*m/g, '');
	const diff = width - visible.length;
	return diff > 0 ? str + ' '.repeat(diff) : str;
}

// ── Route formatter ─────────────────────────────────────────────────

/**
 * Format route selection results as human-readable text.
 *
 * Shows ranked skills with their BM25 scores so the user can see
 * which skills matched the query and how confidently.
 */
export function formatRouteResults(
	results: SelectionResult[],
	query: string,
	elapsedMs?: number,
): string {
	const lines: string[] = [];

	// Header
	lines.push('');
	lines.push(`  ${BOLD}Route${RESET}  ${DIM}\u201c${query}\u201d${RESET}`);
	lines.push(`  ${RULE}`);

	if (results.length === 0) {
		lines.push(`  ${YELLOW}No matching skills found${RESET}`);
	} else {
		// Ranked results with scores
		for (let i = 0; i < results.length; i++) {
			const result = results[i]!;
			const rank = `${DIM}${i + 1}.${RESET}`;
			const scoreColor = result.score >= 0.75 ? GREEN : result.score >= 0.4 ? YELLOW : RED;
			const scoreStr = `${scoreColor}${result.score.toFixed(2)}${RESET}`;
			lines.push(`  ${rank}  ${pad(result.skill, 32)}  ${scoreStr}`);
		}
	}

	lines.push(`  ${RULE}`);

	// Summary
	if (results.length === 0) {
		lines.push(`  ${DIM}0 skills matched${RESET}`);
	} else {
		const count = results.length;
		lines.push(`  ${GREEN}${count}${RESET} ${count === 1 ? 'skill' : 'skills'} matched`);
	}

	// Timing
	if (elapsedMs != null) {
		lines.push(`  ${DIM}${elapsedMs.toFixed(1)}ms${RESET}`);
	}

	lines.push('');
	return lines.join('\n');
}

// ── Conflict formatter ──────────────────────────────────────────────

/**
 * Format conflict detection results as human-readable text.
 *
 * Shows groups of skills with overlapping descriptions so the author
 * can consolidate or differentiate them.
 */
export function formatConflicts(conflicts: ConflictGroup[], elapsedMs?: number): string {
	const lines: string[] = [];

	// Header
	lines.push('');
	lines.push(`  ${BOLD}Conflicts${RESET}`);
	lines.push(`  ${RULE}`);

	if (conflicts.length > 0) {
		for (const group of conflicts) {
			const similarityColor =
				group.similarity >= 0.95 ? RED : group.similarity >= 0.9 ? YELLOW : CYAN;
			const skills = group.skills.join(` ${DIM}\u2194${RESET} `);
			const similarityStr = `${similarityColor}${group.similarity.toFixed(2)}${RESET}`;

			lines.push(
				`  ${YELLOW}\u25CF${RESET}  ${skills}  ${DIM}similarity:${RESET} ${similarityStr}`,
			);
			lines.push(`     ${DIM}${group.suggestion}${RESET}`);
		}
	}

	lines.push(`  ${RULE}`);

	// Summary
	if (conflicts.length === 0) {
		lines.push(`  ${GREEN}No conflicts detected${RESET}`);
	} else {
		const count = conflicts.length;
		lines.push(`  ${RED}${count}${RESET} conflict ${count === 1 ? 'group' : 'groups'} found`);
	}

	// Timing
	if (elapsedMs != null) {
		lines.push(`  ${DIM}${elapsedMs.toFixed(1)}ms${RESET}`);
	}

	lines.push('');
	return lines.join('\n');
}
