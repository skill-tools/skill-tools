import { parseSkill, resolveSkillFiles } from '@skill-tools/core';
import type { Diagnostic, Skill } from '@skill-tools/core';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Result of validating a single skill.
 */
export interface ValidationResult {
	/** Path to the SKILL.md file */
	readonly filePath: string;
	/** Skill directory name */
	readonly name: string;
	/** Whether the skill passed validation (no errors) */
	readonly valid: boolean;
	/** Parsed skill, if parsing succeeded */
	readonly skill: Skill | null;
	/** All diagnostics from parsing + structural validation */
	readonly diagnostics: readonly Diagnostic[];
}

/**
 * Validate a SKILL.md file or directory of skills.
 *
 * Runs the parser and structural checks on each discovered skill.
 * Returns validation results with diagnostics for each skill.
 *
 * @param path - Path to a SKILL.md file, skill directory, or directory of skills
 * @returns Array of validation results
 */
export async function validate(path: string): Promise<ValidationResult[]> {
	const locations = await resolveSkillFiles(path);

	if (locations.length === 0) {
		return [
			{
				filePath: path,
				name: 'unknown',
				valid: false,
				skill: null,
				diagnostics: [
					{
						ruleId: 'skill-not-found',
						severity: 'error',
						message: `No SKILL.md file found at path: ${path}`,
						file: path,
					},
				],
			},
		];
	}

	const results: ValidationResult[] = [];

	for (const location of locations) {
		const parseResult = await parseSkill(location.skillFile);
		const extraDiagnostics = parseResult.ok
			? validateStructure(parseResult.skill)
			: [];

		const allDiagnostics = [...parseResult.diagnostics, ...extraDiagnostics];
		const hasErrors = allDiagnostics.some((d) => d.severity === 'error');

		results.push({
			filePath: location.skillFile,
			name: parseResult.ok ? (parseResult.skill.metadata.name ?? location.dirName) : location.dirName,
			valid: !hasErrors,
			skill: parseResult.ok ? parseResult.skill : null,
			diagnostics: allDiagnostics,
		});
	}

	return results;
}

/**
 * Run structural validation checks on a parsed skill.
 * These go beyond what the parser checks.
 */
function validateStructure(skill: Skill): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];

	// Check that skill directories follow conventions
	const dirPath = skill.dirPath;

	// Check for unexpected top-level files/directories
	const expectedDirs = ['scripts', 'references', 'assets', 'examples', 'agents'];
	const entries = safeReaddir(dirPath);
	for (const entry of entries) {
		if (entry === 'SKILL.md' || entry.startsWith('.')) continue;

		const entryPath = join(dirPath, entry);
		const isDir = safeIsDirectory(entryPath);

		if (isDir && !expectedDirs.includes(entry)) {
			diagnostics.push({
				ruleId: 'unexpected-directory',
				severity: 'info',
				message: `Unexpected directory "${entry}" in skill directory. Expected: ${expectedDirs.join(', ')}`,
				file: skill.filePath,
			});
		}
	}

	// Verify encoding is UTF-8 (check for BOM or binary content)
	if (skill.rawContent.charCodeAt(0) === 0xfeff) {
		diagnostics.push({
			ruleId: 'no-bom',
			severity: 'warning',
			message: 'SKILL.md contains a UTF-8 BOM (byte order mark). Remove it for compatibility',
			file: skill.filePath,
			line: 1,
			fix: 'Save the file without BOM',
		});
	}

	// Check for binary content (null bytes)
	if (skill.rawContent.includes('\0')) {
		diagnostics.push({
			ruleId: 'no-binary',
			severity: 'error',
			message: 'SKILL.md contains binary content (null bytes). It must be a text file',
			file: skill.filePath,
		});
	}

	return diagnostics;
}

/**
 * Safely read directory entries. Returns empty array on failure.
 */
function safeReaddir(dirPath: string): string[] {
	try {
		return readdirSync(dirPath).map(String);
	} catch {
		return [];
	}
}

/**
 * Safely check if a path is a directory.
 */
function safeIsDirectory(path: string): boolean {
	try {
		return existsSync(path) && statSync(path).isDirectory();
	} catch {
		return false;
	}
}
