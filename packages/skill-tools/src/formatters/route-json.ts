import type { ConflictGroup, SelectionResult } from '@skill-tools/router';

/**
 * Format route selection results as JSON.
 */
export function formatRouteJson(results: SelectionResult[]): string {
	return JSON.stringify(results, null, 2);
}

/**
 * Format conflict detection results as JSON.
 */
export function formatConflictsJson(conflicts: ConflictGroup[]): string {
	return JSON.stringify(conflicts, null, 2);
}
