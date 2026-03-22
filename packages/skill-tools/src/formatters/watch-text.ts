import type { WatchResult } from '../watcher.js';
import { formatLint, formatScore, formatValidation } from './text.js';

// ── ANSI codes ──────────────────────────────────────────────────────

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';

// ── Clear + header ─────────────────────────────────────────────────

const CLEAR = '\x1b[2J\x1b[H';

function timestamp(): string {
	const now = new Date();
	const h = String(now.getHours()).padStart(2, '0');
	const m = String(now.getMinutes()).padStart(2, '0');
	const s = String(now.getSeconds()).padStart(2, '0');
	return `${h}:${m}:${s}`;
}

function trendIndicator(
	name: string,
	current: number,
	previousScores: ReadonlyMap<string, number>,
): string {
	const prev = previousScores.get(name);
	if (prev == null) return '';
	const diff = current - prev;
	if (diff > 0) return ` ${GREEN}\u2191${diff}${RESET}`;
	if (diff < 0) return ` ${RED}\u2193${Math.abs(diff)}${RESET}`;
	return ` ${DIM}\u2550${RESET}`;
}

export function formatWatchResult(result: WatchResult): string {
	const lines: string[] = [CLEAR];

	// Header
	const file = result.changedFile
		? `${DIM}Changed: ${result.changedFile}${RESET}`
		: `${DIM}Initial check${RESET}`;
	lines.push(`  ${CYAN}[${timestamp()}]${RESET}  ${file}`);
	lines.push('');

	// Validation
	lines.push(formatValidation(result.validationResults));

	// Lint
	if (result.lintResults.length > 0) {
		lines.push(formatLint(result.lintResults));
	}

	// Scores with trends
	for (const { name, score: qs } of result.scores) {
		const trend = trendIndicator(name, qs.score, result.previousScores);
		// Use formatScore but append trend
		lines.push(formatScore(name, qs));
		if (trend) {
			// Insert trend after the score line
			lines.push(`  ${BOLD}Trend${RESET}${trend}`);
		}
	}

	lines.push(`  ${DIM}Watching for changes... (Ctrl+C to stop)${RESET}`);
	lines.push('');

	return lines.join('\n');
}
